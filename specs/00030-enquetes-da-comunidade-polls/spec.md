# 00030 — Enquetes da comunidade (Polls)

Issue: https://github.com/gaydevs/gaydevs-platform/issues/30
Estado: aprovado — implementação em andamento.

## Problema e objetivo

Oferecer uma forma simples e reutilizável de coletar decisões da comunidade,
começando pela escolha de jogos para o próximo jogaydev. A enquete deve
complementar as conversas no WhatsApp, permitindo que visitantes conheçam a
pergunta e os resultados, enquanto somente gdevs autenticados registram
respostas.

## Escopo e comportamento

- Uma tela autenticada de listagem mostra as enquetes existentes em lotes de até
  três; cada item leva ao link da enquete correspondente e novos lotes são
  carregados conforme o gdev se aproxima do fim.
- A listagem é acessada pelo menu superior, através de uma seta à esquerda do
  nome do gdev autenticado. Visitantes não veem nem acessam esse menu/listagem.
- A página individual da enquete oferece navegação de volta para a listagem.
- A mesma interface da enquete possui um modo de criação, disponível apenas
  para membros cujo `member_type` seja `admin`; depois da criação, a interface
  passa ao modo normal de visualização/votação.
- O tipo inicial `member` pode visualizar, votar e, quando a enquete permitir,
  adicionar opções de resposta; não pode criar ou administrar enquetes. O campo
  textual permite acrescentar outros tipos no futuro.
- Toda enquete existente no banco pode ser aberta por qualquer visitante que
  possua seu link.
- O criador da enquete fica registrado e é exibido no detalhe.
- O criador de uma opção é exibido quando for diferente do criador da enquete;
  quando forem a mesma pessoa, não há autoria adicional na opção.
- O link canônico da enquete usa um slug obrigatório, derivado da pergunta no
  momento da criação.
- O UUID é apenas identificador interno e não é usado nas URLs ou referências
  da interface.
- O slug base é derivado da pergunta. Em caso de repetição, o sistema tenta,
  nesta ordem, acrescentar `YYYY-MM`, depois `YYYY-MM-DD`, depois
  `YYYY-MM-DD-HH-mm` e, persistindo a colisão, um contador ao final no formato
  `-00`, `-01`, `-02` etc.
- Para gerar o slug base, a pergunta é convertida para minúsculas, tem os
  acentos removidos, espaços e pontuação convertidos em hífens, hífens
  duplicados removidos e o resultado limitado ao tamanho máximo definido para
  o identificador.
- A pergunta exige no mínimo 10 caracteres e pelo menos duas palavras; não há
  fallback genérico para perguntas que não produzam um slug válido.
- Depois de persistido, o slug não é regenerado automaticamente a partir de
  alterações posteriores na pergunta.
- A visualização pública mostra, no mínimo, a pergunta, as opções e os
  percentuais dos resultados, sem identificar os votantes.
- Um gdev autenticado pode visualizar os resultados completos, incluindo qual
  membro votou em cada opção.
- Votos legados sem identificação continuam compondo os percentuais; para uma
  sessão autenticada, somente os votos identificados exibem o membro votante.
- Visitantes não autenticados podem visualizar a prévia, mas não podem
  selecionar ou enviar respostas efetivas.
- O envio exige uma sessão válida do login passwordless já existente.
- Cada enquete informa se aceita uma ou várias opções por gdev; quando aceitar
  várias, o gdev pode selecionar mais de uma opção antes do envio.
- Cada enquete informa separadamente se permite que gdevs autenticados criem
  novas opções durante a votação.
- Cada resposta nova fica associada ao membro autenticado e à enquete; votos
  legados importados podem ter `user_id` nulo quando a origem só fornecer
  contagens agregadas.
- Um gdev autenticado pode alterar livremente a própria resposta enquanto a
  enquete estiver aberta.
- Uma opção criada por um gdev pode ser removida por ele enquanto não houver
  outro votante; depois que receber votos de outros membros, não pode mais ser
  removida por esse gdev.
- Não há resposta pendente antes do login nem confirmação separada por e-mail.
- O sistema deve impedir duplicidade indevida para a mesma combinação de
  membro e enquete, inclusive em envios repetidos ou concorrentes.
- Cada voto é mantido em histórico append-only; quando substituído, removido
  ou invalidado, recebe registro de cancelamento em vez de ser apagado.
- Enquetes encerradas permanecem disponíveis para visualização, mas não aceitam
  novas respostas.
- Falhas de autenticação, enquete inexistente/indisponível ou resposta inválida
  não registram voto parcial.

Fora do escopo desta Feature: substituir discussões no WhatsApp, criar cadastro
ou autenticação paralela, confirmação de voto por e-mail, regras avançadas de
moderação e funcionalidades não necessárias ao primeiro caso de uso.

## Requisitos verificáveis

- REQ-001: Uma enquete existente no banco pode ser consultada sem autenticação
  pelo seu slug.
- REQ-001a: A listagem autenticada de enquetes exibe todas as enquetes
  existentes e fornece o link canônico de cada uma.
- REQ-001b: Um membro com `member_type=admin` pode abrir o modo de criação na
  mesma interface da enquete e criar uma enquete.
- REQ-001c: Um membro com `member_type=member` não pode criar, editar, encerrar
  ou remover enquetes, mas pode adicionar opções quando `allow_new_options`
  estiver habilitado.
- REQ-002: A consulta pública exibe pergunta, opções e percentuais, sem nomes
  dos votantes.
- REQ-002a: Uma sessão autenticada pode consultar os resultados completos,
  incluindo a associação entre membro e opção votada.
- REQ-003: Uma sessão não autenticada não consegue registrar seleção nem
  resposta por qualquer fluxo público.
- REQ-004: Uma sessão autenticada consegue selecionar e enviar uma resposta
  válida para uma enquete disponível.
- REQ-005: A configuração da enquete permite restringir a resposta a uma opção
  ou permitir selecionar múltiplas opções.
- REQ-005a: A configuração da enquete permite ou impede a criação de novas
  opções por gdevs autenticados.
- REQ-006: Cada opção enviada é associada ao membro autenticado e à enquete
  correta.
- REQ-007: Repetições da mesma submissão não criam respostas duplicadas para o
  mesmo membro e enquete.
- REQ-007a: Enquanto a enquete estiver aberta, um gdev pode substituir ou
  ajustar a própria resposta.
- REQ-007b: Uma opção criada por um gdev só pode ser removida por ele enquanto
  não houver votos de outros membros; após isso, permanece disponível.
- REQ-007c: Votos cancelados permanecem auditáveis com motivo e momento do
  cancelamento.
- REQ-007d: A enquete e cada opção registram o membro que as criou.
- REQ-007e: A autoria da opção só é exibida quando seu criador for diferente
  do criador da enquete; a autoria do criador da enquete permanece exibida.
- REQ-007f: Votos legados sem identificador de membro podem ser importados,
  contam individualmente nos resultados e não expõem um nome de votante.
- REQ-008: Uma resposta inválida ou uma tentativa sem autenticação produz erro
  observável e não altera os resultados.
- REQ-009: Cada seleção ativa de uma opção contribui com um voto para o cálculo
  do percentual, inclusive em enquetes com múltiplas seleções, de modo que a
  base seja compatível com a contagem bruta do StrawPoll.
- REQ-010: Os percentuais são arredondados normalmente e não recebem ajuste
  artificial para que a soma exibida permaneça em 100%; opções com a mesma
  quantidade de votos devem exibir o mesmo percentual.
- REQ-011: Uma enquete sem respostas exibe `0%` para todas as opções e a
  mensagem “Ainda não há votos”.
- REQ-012: Ao criar uma enquete, o sistema gera e persiste automaticamente um
  slug derivado da pergunta antes de disponibilizar o link.
- REQ-013: A geração de slug resolve colisões acrescentando, em sequência,
  ano-mês, ano-mês-dia, ano-mês-dia-hora-minuto e contador de dois dígitos.
- REQ-014: Uma enquete que já possui slug mantém esse slug mesmo que sua
  pergunta seja alterada.
- REQ-016: A criação rejeita perguntas com menos de 10 caracteres ou menos de
  duas palavras.
- REQ-017: URLs HTTP ou HTTPS presentes na pergunta ou no texto de uma opção
  são exibidas como links externos e abertas em uma nova aba/janela.
- REQ-018: O detalhe de uma enquete encerrada exibe há quanto tempo ela foi
  encerrada, sem mostrar a data exata de encerramento.
- REQ-019: O estado aberto da enquete é identificado por uma tag verde da
  paleta visual da plataforma; o estado encerrado permanece vermelho.
- REQ-020: A listagem exibe o mesmo estado e tempo relativo do detalhe,
  incluindo “iniciada há…” para abertas e “encerrada há…” para finalizadas.
- REQ-021: O detalhe exibe a quantidade de votos de cada opção e a listagem
  exibe a quantidade total de votos da enquete.
- REQ-022: A listagem carrega no máximo três enquetes por chamada inicial ou de
  continuação, exibe skeleton durante cada lote pendente e não exibe skeleton
  depois que o servidor informar o fim.
- REQ-022a: Sincronizações incrementais mesclam enquetes novas ou alteradas por
  identificador, reordenam os cards pela regra vigente e não duplicam, perdem ou
  reiniciam o cursor das enquetes já carregadas.
- REQ-023: Depois de um voto autenticado salvo com sucesso, a API pode retornar
  até três enquetes abertas que não sejam a atual e nas quais o gdev ainda não
  tenha voto ativo; enquetes já recusadas ou temporariamente silenciadas ficam
  fora das sugestões.
- REQ-024: “Agora não” silencia as sugestões do gdev por um período entre 1 e
  24 horas, persistido no JSON de preferências do usuário e validado no
  frontend e no backend; nenhum cliente pode gravar prazo superior a 24 horas.
- REQ-025: “Não quero votar” registra somente o UUID da enquete na lista de
  preferências do usuário, não cria voto nem evento de auditoria e remove essa
  enquete das sugestões futuras em todos os dispositivos.
- REQ-026: A listagem ordena primeiro enquetes abertas, depois encerradas; em
  cada grupo, ordena da criação mais recente para a mais antiga. O detalhe
  ordena opções pela quantidade bruta de votos decrescente e, em empate, pela
  criação mais antiga, preservando essa ordem após atualizações otimistas e
  sincronizações do backend.
- REQ-027: O backend rejeita, mesmo em chamadas forjadas, votos em enquetes
  encerradas ou opções ocultadas, votos sem autenticação, criação de enquete
  por membro que não seja admin, criação de opção quando desabilitada e toda
  operação administrativa sem a autorização correspondente.
- REQ-028: Encerrar uma enquete registra `closed_at` e o admin responsável;
  depois disso a enquete permanece visível somente para leitura e não aceita
  voto, nova opção ou alteração administrativa incompatível.
- REQ-029: Ocultar uma opção registra `hidden_at` e o gdev responsável,
  mantém a opção e seus votos disponíveis para auditoria, cancela os votos
  ativos com motivo próprio e impede novos votos nela. A operação respeita o
  mínimo de opções visíveis: duas quando novas opções não são permitidas e uma
  quando são permitidas.
- REQ-030: A auditoria autenticada lista em ordem cronológica todos os eventos
  de criação, voto, cancelamento, ocultação e encerramento, identifica o gdev
  responsável quando houver e oferece filtros por opção/evento e por gdev.
  A auditoria não é acessível a partir dos cards da listagem, somente do
  detalhe da enquete.
- REQ-031: A listagem, o detalhe e a auditoria exibem skeletons durante o
  carregamento; o skeleton do detalhe preserva a marca da seção. A listagem
  carrega lotes de três, usa lazy loading e remove o skeleton ao atingir o fim.
- REQ-032: Ao entrar na seção de polls sem autenticação, o sistema mantém o
  skeleton atrás do modal de login e retorna à home se o login for cancelado.
  Ao abrir diretamente uma enquete, o visitante permanece na página vendo a
  prévia pública e só recebe o login depois de tentar votar.
- REQ-033: A criação de enquete usa a mesma interface visual de edição/votação;
  todos os campos ficam desabilitados durante o envio, o botão mostra loading,
  erros de campo aparecem no próprio campo e fazem o componente tremer, e
  erros gerais aparecem em tooltip sobre o botão de submissão.
- REQ-034: A criação exige a primeira opção; a segunda é obrigatória quando
  novas opções não são permitidas e opcional quando são permitidas. Opções
  adicionais podem ser removidas, exceto a primeira, e a validação de
  duplicidade normaliza apenas para comparação, preservando o texto original.
- REQ-035: Login, criação de enquete e sugestão de nova opção reutilizam o
  mesmo shell de input e as ações modulares de adicionar/remover, com labels
  acessíveis, estados disabled, spinner, foco e paleta visual compartilhados.
- REQ-036: Preferências do usuário são armazenadas em JSON por usuário sem
  cascata automática de exclusão; o serviço valida que o snooze nunca exceda
  24 horas e mantém a lista de enquetes recusadas sincronizada entre
  dispositivos.
- REQ-037: O modal de sugestões reutiliza o mesmo card da listagem em variante
  compacta, sem exibir o slug; cada card mantém o menu `...` visível somente no
  modal, com a ação `não quero votar nesta enquete` em minúsculas. A listagem
  não exibe esse menu.
- REQ-038: O card para criação de opção usa exatamente o texto
  `sugira uma nova opção`, em minúsculas e sem reticências, como placeholder e
  identificação acessível.
- REQ-015: A normalização do slug é determinística: minúsculas, sem acentos,
  separadores em hífen, sem hífens duplicados e limitada ao tamanho máximo
  definido para o identificador.

## Critérios de aceite

- Dado um visitante não autenticado, quando ele abre uma enquete existente pelo
  link,
  então vê a pergunta, as opções e os percentuais permitidos pela visibilidade
  configurada.
- Dado um visitante não autenticado, quando tenta selecionar ou enviar uma
  resposta, então a operação não registra resposta e orienta a autenticação.
- Dado um gdev autenticado, quando a enquete aceita uma opção e ele envia uma
  opção válida, então a resposta é registrada para esse membro.
- Dado um gdev autenticado, quando a enquete aceita múltiplas opções e ele
  envia um conjunto válido, então todas as opções selecionadas são registradas
  para esse membro e essa enquete.
- Dado um gdev autenticado, quando ele repete a mesma submissão, então o
  sistema não cria duplicidade indevida.
- Dado um gdev que substitui ou remove uma resposta, quando a operação termina,
  então o voto anterior permanece no histórico com status cancelado e motivo.
- Dado um gdev autenticado, quando envia uma opção inválida ou uma combinação
  incompatível com a configuração da enquete, então a operação falha sem
  alterar os resultados.
- Dado um resultado com respostas de uma ou várias opções, quando os
  percentuais são exibidos, então cada seleção ativa contribui igualmente para
  a base bruta e cada percentual é arredondado individualmente, sem ajuste
  artificial da soma visual.
- Dado um admin definindo a pergunta de uma nova enquete, quando a enquete é
  criada, então o sistema gera e persiste o slug derivado antes de retornar o
  link canônico.
- Dado um gdev autenticado, quando abre a listagem pelo menu superior, então vê
  todas as enquetes e pode abrir qualquer uma pelo link correspondente.
- Dado que o slug base já exista, quando um novo slug é gerado, então o sistema
  tenta os sufixos temporais definidos e, se necessário, usa o próximo
  contador disponível sem duplicar o slug.
- Dado que a pergunta ou uma opção contenha uma URL HTTP ou HTTPS, quando o
  texto for exibido, então a URL será clicável e abrirá em uma nova aba/janela
  sem navegar para fora da enquete atual.
- Dado que uma enquete esteja encerrada, quando o detalhe for aberto, então o
  sistema exibirá um texto relativo como “encerrada há 3 dias” e manterá apenas
  o marcador de encerramento, sem exibir a data exata.
- Dado que um admin encerre uma enquete ou oculte uma opção, quando outro gdev
  consultar a auditoria, então o evento exibirá o responsável, o momento e os
  votos cancelados permanecerão consultáveis.
- Dado que uma chamada direta tente votar em enquete encerrada ou opção
  oculta, quando chegar ao backend, então ela será rejeitada sem criar voto
  ativo ou alterar os resultados.
- Dado que o usuário entre na listagem sem sessão, quando fechar o login sem
  concluir a autenticação, então o skeleton será desmontado e a navegação irá
  para a home; ao abrir uma enquete diretamente, a prévia permanecerá visível.
- Dado que um erro de criação seja retornado pelo backend, quando o frontend
  receber um campo como `option.0`, então o erro será traduzido, associado à
  opção correspondente e o campo tremerá sem expor a mensagem técnica.
- Dado que a listagem receba uma enquete nova ou uma mudança de estado durante
  o lazy loading, quando a sincronização terminar, então os cards serão
  mesclados sem duplicação, sem perder o cursor e com a reorganização animada.

## Dependências e questões abertas

As dependências nativas com as Issues #29 (login passwordless) e #66 (SMTP
transacional) foram removidas após a confirmação de que ambas foram promovidas
para produção. A Issue #30 não possui atualmente relações `blocked by` ou
`blocking`.

Decisões registradas:

- A criação, edição, publicação, encerramento e remoção de enquetes ocorrerão
  pela interface compartilhada, mas somente para `member_type=admin`.
- O acesso será controlado pelo link da enquete; enquetes encerradas ficam em
  modo somente leitura.
- Visitantes veem percentuais sem nomes; gdevs autenticados veem os resultados
  completos, incluindo quem votou em cada opção.
- O membro pode ajustar a própria resposta enquanto a enquete estiver aberta,
  respeitando a proteção de opções que já receberam votos de outros membros.
- Em múltiplas seleções, cada opção selecionada conta como uma seleção bruta,
  compatível com a contagem do StrawPoll; os percentuais são arredondados
  individualmente e podem não somar exatamente 100% visualmente.
- Votos legados agregados são importados como registros ativos sem `user_id`;
  enquetes legadas ficam encerradas e disponíveis somente para visualização.
- Encerramento e ocultação são ações administrativas auditáveis; votos de uma
  opção ocultada não são apagados, apenas cancelados com motivo específico.
- O modal de erro de conexão é o padrão para falhas de mutação que não podem
  ser compreendidas no campo; o frontend continua preparado para erros gerais
  mesmo quando o backend retorna erros específicos por campo.
- A padronização estrutural do frontend será executada separadamente, em fases,
  após a proteção do comportamento atual por testes; ela não altera contratos
  da API nem regras do backend.
- O card de sugestão deve compartilhar o componente e a formatação do card da
  listagem, alterando apenas escala e ações disponíveis no contexto do modal.

Questões a resolver antes do plano técnico: nenhuma funcional pendente.

## Aprovação humana

Aprovado por gdev luvittor em 2026-10-26, nesta conversa, incluindo os aditivos
de `member_type`, criação na mesma interface, slug gerado na criação, listagem
autenticada e auditoria de votos. Esta aprovação libera a implementação; não
substitui revisão de PR ou gate de release.

Aditivo aprovado por gdev luvittor em 2026-10-27, nesta conversa: resultados
passam a usar a contagem bruta de seleções do StrawPoll, com arredondamento
individual dos percentuais e sem ajuste artificial para 100%.

Aditivo solicitado por gdev luvittor em 2026-10-27: URLs presentes em perguntas
 e opções são links externos abertos em nova aba/janela.

Aditivo solicitado por gdev luvittor em 2026-10-27: enquetes encerradas exibem
o tempo relativo desde o encerramento, sem a data exata.

Aditivo solicitado por gdev luvittor em 2026-10-27: a tag “aberta” usa o verde
da paleta visual da plataforma.

Aditivo solicitado por gdev luvittor em 2026-10-27: a listagem repete o estado
aberta/encerrada e o tempo relativo exibidos no detalhe.

Aditivo solicitado por gdev luvittor em 2026-10-27: os percentuais não devem
ser compensados para somar 100%; o detalhe e a listagem também exibem as
contagens brutas de votos.

Aditivo solicitado por gdev luvittor em 2026-10-27: a listagem deve carregar
 enquetes em lotes de três por lazy loading, mostrar skeleton enquanto o próximo
 lote chega e sincronizar alterações incrementais sem perder a posição dos cards.

Aditivo aprovado por gdev luvittor em 2026-10-27: após votar, gdevs autenticados
recebem sugestões de outras enquetes abertas; “Agora não” usa uma preferência
JSON sincronizada por no máximo 24 horas e “Não quero votar” registra a enquete
recusada na mesma preferência, sem criar voto ou auditoria.

Aditivos documentados posteriormente na implementação: encerramento com autoria
do admin, ocultação auditável de opções com `hidden_at`/`hidden_by_user_id`,
cancelamento dos votos afetados, guards contra chamadas diretas inválidas,
ordenação estável de listagem e opções, skeletons de lista/detalhe/auditoria,
login protegido com redirecionamento após cancelamento, formulário com
validação condicional de opções e inputs/ações visuais compartilhados.

A refatoração estrutural de frontend descrita no plano temporário foi executada
após a aprovação do plano, preservando os contratos públicos, o comportamento
visual e os fluxos funcionais cobertos pelos testes.
