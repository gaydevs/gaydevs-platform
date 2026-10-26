# 00029 — Login passwordless para membros

Issue: https://github.com/gaydevs/gaydevs-platform/issues/29
Estado: APROVADA por gdev em 2026-10-16.

## Problema e objetivo

Permitir que gdevs existentes acessem funcionalidades protegidas sem criar ou
lembrar uma senha. A prova de acesso é enviada somente ao e-mail já associado
ao membro, e a interface pública nunca mostra endereços completos.

## Escopo e comportamento

- O membro começa a digitar o nome ou o início do e-mail e a busca mostra só as
  correspondências, com nome e e-mail mascarados. A parte do nome ou o início
  do e-mail que coincide com o texto digitado permanece visível; nas demais
  partes aparece somente a inicial, preservando separadores e o sufixo do
  domínio. Para `Roberto Souza <roberto.sousa@example.com>`, digitar
  `Ro` mostra `Ro***** S**** <ro*****.s****@e******.com>` e digitar
  `Souz` mostra `R****** Souz* <r******.s****@e******.com>`. Ele escolhe
  o seu item. Sem digitação, nada é listado. Só membros cadastrados
  aparecem.
- O banco é populado manualmente com os dados dos gdevs após o deploy; não há
  cadastro pela aplicação.
- O sistema envia ao endereço cadastrado um código OTP temporário e de uso
  único. A solicitação, por si só, não autentica nem cria uma sessão.
- O fluxo possui limites globais independentes para geração de OTP e envio de
  e-mails, somando todas as solicitações e usuários. Esses limites são
  configuráveis por ambiente, usam cache compartilhado e impedem a criação do
  OTP e o envio quando qualquer um deles é excedido.
- O OTP nunca se repete para o mesmo membro: um código novo é sempre diferente
  dos emitidos antes para ele.
- O assunto do e-mail já contém o OTP. O corpo traz um único código em linha
  própria, em destaque, fácil de copiar no Gmail web e nas notificações móveis.
- A confirmação válida autentica o membro e cria uma sessão utilizável por
  funcionalidades protegidas.
- O membro pode encerrar a sessão.
- A autenticação acontece num popup (modal) sobre a página atual, que fica
  escurecida; não há troca de tela. A URL é atualizada ao abrir e ao avançar
  de etapa (busca, código), e abrir essa URL diretamente reabre o popup.
- Cada busca de membros, pedido de OTP, confirmação ou encerramento de sessão
  gera uma observação append-only. O backend emite um UUID pseudônimo em cookie
  first-party `HttpOnly`; o navegador o envia automaticamente nas chamadas do
  frontend. IP ou User-Agent nunca são usados como identidade. Cada observação registra
  User-Agent integral e seus derivados, idioma, referer, horário e IP quando
  disponível. País, cidade e ASN ficam centralizados por IP, com data das
  bases locais que produziram o resultado.
- Cada tentativa de confirmação do OTP é registrada sem sobrescrever as
  anteriores. O histórico distingue confirmação aceita, código inválido,
  expirado, já usado, bloqueado, substituído e limitado por taxa. Reapresentar
  corretamente um OTP depois de uma autenticação bem-sucedida fica registrado
  como `already_used`, sem criar outra sessão. O pedido do OTP é um evento
  separado, e o tempo até a primeira confirmação aceita também é registrado.
  Um pedido fica `superseded` quando outro OTP mais novo é emitido para o
  mesmo gdev; o pedido antigo registra quando e por qual pedido foi substituído,
  e apenas o desafio mais recente pode ser confirmado. Se um e-mail atrasado
  levar o gdev a informar um código substituído na etapa atual, o sistema
  reconhece esse código pelos hashes anteriores, registra a tentativa sem
  consumir uma falha do OTP atual e informa que existe um código mais novo.
  O OTP nunca é armazenado de forma reversível.
- Estatísticas que exigem script no frontend (tela, tema, fuso, Web Vitals,
  uso e erros de JavaScript) e o aviso de privacidade LGPD ficam na Issue #37.
- Confirmações inválidas, expiradas ou já utilizadas não autenticam ninguém.
- A busca expõe apenas nome e e-mail mascarados, e só para o texto digitado;
  não há listagem completa.
- O backend será Laravel/PHP e o envio usará o Mail do Laravel (Symfony Mailer,
  via Composer), não a função `mail()` nativa.
- O remetente será configurado por variável de ambiente, fora dos registros
  versionados: `MAIL_FROM_ADDRESS` em `backend/.env`. O valor real ficará
  apenas nesse arquivo ignorado pelo Git; `backend/.env.example` documenta a
  variável sem conter o endereço.
- Fora de escopo: enquetes (Issue #30), edição de perfil, login social com
  Google/GitHub, criação/recuperação de senha, cadastro público e administração
  avançada de permissões.

## Requisitos verificáveis

- REQ-001: Apenas membros existentes e elegíveis podem obter autenticação; não
  há fluxo de cadastro público.
- REQ-002: O pedido identifica o membro escolhido nos resultados da busca
  mascarada por nome ou início do e-mail. A prova vai somente ao e-mail
  cadastrado desse membro.
- REQ-003: A solicitação não cria uma sessão autenticada. Uma sessão só é
  criada após confirmação de prova válida.
- REQ-004: Cada prova expira e pode ser usada uma única vez; prova inválida,
  expirada ou previamente usada não cria sessão.
- REQ-005: Uma sessão autenticada pode ser usada por funcionalidades protegidas
  e pode ser encerrada pelo membro.
- REQ-006: A busca só devolve resultados para texto digitado (sem listagem
  completa), casa o início do e-mail ou de qualquer parte do nome e expõe
  apenas nome e e-mail mascarados. Somente o prefixo coincidente já informado
  pela pessoa fica visível; o endereço completo nunca é exposto.
- REQ-007: O assunto do e-mail contém o OTP; o corpo traz um único código em
  linha própria, em destaque e copiável.
- REQ-008: O envio usa o Mail do Laravel.
- REQ-010: Um OTP novo nunca repete um emitido antes para o mesmo membro.
- REQ-011: Os membros são inseridos manualmente no banco após o deploy.
- REQ-012: `visitors` guarda a identidade pseudônima emitida pelo backend;
  `visits` delimita períodos de atividade e `visitor_observations` preserva
  cada contexto observado sem sobrescrever históricos. `ip_addresses`
  centraliza o IP e `ip_geolocations` versiona país, cidade, ASN, estado da
  resolução, período de validade e datas das bases City/ASN. Cada observação
  aponta para a versão vigente. Uma observação autenticada aponta diretamente
  para a sessão auditável ou PAT que autorizou aquela chamada; as visitas de
  cada credencial são derivadas dessas observações. Ausência ou indisponibilidade
  de GeoIP não impede autenticação.
- REQ-014: Cada tentativa de confirmação fica em histórico append-only com seu
  resultado (`accepted`, `invalid_code`, `expired`, `already_used`, `locked`,
  `superseded` ou `rate_limited`). Uma reapresentação correta após consumo é
  registrada como `already_used`, sem criar outra sessão. O pedido do OTP é
  registrado separadamente, assim como o tempo até a primeira confirmação
  aceita. Um pedido substituído registra `superseded_at` e o pedido sucessor.
  Quando o código informado para o pedido atual corresponde ao hash de um
  pedido substituído recente do mesmo gdev, a tentativa preserva tanto o pedido
  atual quanto o pedido cujo hash correspondeu, não incrementa as falhas do
  pedido atual e responde que o código foi substituído.
- REQ-015: A geração de OTP e o envio de e-mails possuem limites globais
  independentes, configuráveis por ambiente e compartilhados entre instâncias.
  O backend verifica os limites por membro, por IP, global de OTP e global de
  e-mail antes de gerar o código; ao exceder qualquer janela, não cria outro
  pedido nem envia e-mail e registra o bloqueio sem o código.
- REQ-013: O login é um popup sobre a página atual, com o fundo escurecido e
  sem troca de tela; a URL reflete o estado do popup e permite reabri-lo.
- REQ-009: O endereço do remetente é lido do ambiente, não fica em código nem
  em registros versionados; `backend/.env.example` documenta a variável sem
  conter o valor real.

## Critérios de aceite

- Dado um membro que digita o início do nome, sobrenome ou e-mail, quando a
  busca responde, então vê o seu item com o prefixo coincidente visível e o
  restante do nome e e-mail mascarado; ao escolhê-lo e solicitar
  acesso, recebe no e-mail cadastrado um OTP temporário de uso único, com o
  código no assunto.
- Dado um pedido de OTP, então é possível consultar a observação de origem, o
  IP quando disponível, navegador e horário, resultado da tentativa e tempo
  até a confirmação; dada uma sessão auditável, todas as chamadas e visitas em
  que foi usada, mesmo com IPs ou identificadores diferentes.
- Dado o fluxo sob carga distribuída, quando o limite global configurado de OTP
  ou de e-mail for atingido, então novas solicitações de qualquer usuário ou IP
  são recusadas sem criar pedido nem enviar mensagem, até a janela expirar.
- Dado um visitante em qualquer página, quando abre o login, então vê um popup
  com o fundo escurecido, a página permanece a mesma e a URL é atualizada; ao
  autenticar, o popup fecha e a página continua onde estava.
- Dado um membro que pediu vários OTPs, então nenhum código se repete.
- Dado um gdev que solicitou outro OTP antes de receber o anterior, quando
  informa o código antigo na etapa do pedido atual, então não é autenticado,
  recebe a informação de que o código foi substituído, a tentativa fica
  auditada contra os dois pedidos e não consome uma falha do OTP atual.
- Dado um membro que ainda não confirmou a prova, quando tenta acessar uma
  funcionalidade protegida, então permanece não autenticado.
- Dada uma prova válida e ainda não utilizada, quando o membro a confirma,
  então obtém uma sessão autenticada reutilizável por funcionalidades
  protegidas.
- Dada uma prova inválida, expirada ou já utilizada, quando alguém tenta
  confirmá-la, então nenhuma sessão autenticada é criada.
- Dado um membro com sessão ativa, quando encerra a sessão, então a sessão deixa
  de autorizar o acesso às funcionalidades protegidas.
- Dado qualquer estado do fluxo, quando uma pessoa não autorizada consulta a
  interface pública, então não há listagem completa e só vê nomes e e-mails
  mascarados dos resultados do que digitou.
- Dado o e-mail de OTP, quando o membro o vê no Gmail web ou numa notificação
  móvel, então o código aparece no assunto e em linha própria no corpo.
- Dado o ambiente de execução configurado, quando o sistema envia OTP, então
  usa o remetente definido no ambiente e o Mail do Laravel.

## Dependências e questões abertas

Na consulta ao GitHub em 2026-10-18, a Issue #29 não tem blockers e bloqueia a
Issue #30 (Polls).

Ambiente (consultado em 2026-10-16): PHP 8.3.30 (FastCGI), servidor MySQL
8.4.11 e cliente MySQL 8.0.46, com `pdo_mysql`, `mbstring`, `openssl`, `intl`,
`sodium` e as
demais extensões exigidas pelo Laravel. `sendmail` em `/usr/sbin/sendmail`;
`composer` não está no servidor. O plan deve escolher Laravel compatível com
PHP 8.3 e fixar `config.platform.php`.

Gmail: a documentação oficial de markup (schema.org) não tem tipo para OTP; os
destaques cobrem reservas, pedidos e encomendas, e o registro exige centenas de
e-mails por dia e semanas de histórico. Não encontrei padrão oficial; fica o
código no assunto e em linha própria no corpo, verificado com e-mail real.

Envio no DreamHost: viável. O Mail do Laravel (Symfony Mailer) usa o `sendmail`
do host (`/usr/sbin/sendmail -t -i`), sem depender de `mail()`; `disable_functions`
está vazio. Falta confirmar entrega real (SPF/DKIM do domínio remetente) na
implantação.

O plan ainda definirá o transporte do Mail (sendmail ou SMTP), validade e
limites do OTP, duração/revogação de sessão e superfícies de interação.

O ambiente local já configura `MAIL_FROM_ADDRESS` em `backend/.env` (ignorado
pelo Git); o arquivo de exemplo versionado mantém o valor vazio.

Os limites globais de geração de OTP e e-mail começam em 100 por hora por
padrão, com os valores ajustáveis no ambiente; esse valor mantém margem abaixo
dos limites documentados pelo DreamHost para o hosting compartilhado.

## Aprovação humana

Aprovada por luvittor em 2026-10-16, em revisão na sessão com o agente.
O refinamento da busca por nome ou e-mail e da máscara contextual foi solicitado
e aprovado por luvittor em 2026-10-20, nesta sessão.
Os limites globais de geração de OTP e envio de e-mails foram solicitados e
aprovados por luvittor em 2026-10-24, nesta sessão, para implementação nesta
Issue.
