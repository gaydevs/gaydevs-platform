# Tasks — Enquetes da comunidade (Polls)

Issue: [#30](https://github.com/gaydevs/gaydevs-platform/issues/30) · Plano:
[plan.md](plan.md)

- [x] T001 Criar migrations, models, factories e índices para enquetes,
  opções e votos.
- [x] T002 Implementar geração do slug na criação, sem referência pública por
  UUID, e resolução de colisões.
- [x] T003 Implementar endpoints públicos e autenticados da enquete, incluindo
  criação/remoção de opções permitidas e atualização do voto.
- [x] T004 Implementar cálculo de resultados, arredondamento e exposição
  condicional dos votantes.
- [x] T005 Implementar a tela frontend da enquete com estados público,
  autenticado, múltiplo, encerrado e sem votos.
- [x] T005a Implementar a URL autenticada de listagem, links para cada enquete,
  navegação de retorno no detalhe e acesso pelo menu superior.
- [x] T005b Adicionar `member_type`, autorização de admins e modo de criação na
  mesma interface da enquete.
- [x] T005c Registrar criadores e tornar votos auditáveis, com cancelamento em
  vez de exclusão.
- [x] T006 Adicionar testes backend, frontend, concorrência, acessibilidade e
  validação de contratos.
- [x] T007 Executar lint, audit, suítes de teste e verificações finais.
- [x] T007a Ajustar o cálculo de resultados para contar seleções brutas, conforme
  a confirmação posterior baseada nos dados do StrawPoll.
- [x] T007b Transformar URLs em perguntas e opções em links externos seguros,
  preservando a navegação interna dos cards.
- [x] T007c Exibir o tempo relativo desde o encerramento no detalhe das
  enquetes finalizadas.
- [x] T007d Aplicar tag verde ao estado aberto e manter a tag vermelha no estado
  encerrado.
- [x] T007e Alinhar a listagem ao detalhe com status e tempo relativo de abertura
  ou encerramento.
- [x] T007f Fazer o card de opção tremer antes de abrir o login para visitantes
  deslogados, com teste do atraso e da abertura do modal.
- [x] T007g Permitir novos cliques durante o salvamento do voto, exibindo
  spinner por opção e revertendo com tremor quando o backend falhar.
- [x] T007h Exibir a auditoria autenticada de votos e alterações em modal
  reutilizando a estrutura visual do login.
- [x] T007i Ordenar cronologicamente todos os eventos da auditoria, incluindo
  criação de opções e cancelamentos.
- [x] T007j Atualizar periodicamente a listagem para inserir novas enquetes no
  topo, preservando as já carregadas abaixo.
- [x] T007k Animar a reorganização da listagem com FLIP, preservando a posição
  dos cards já carregados durante a entrada de uma nova enquete.
- [x] T007l Permitir retirar o voto em enquetes de escolha única, cancelando o
  registro existente e atualizando o estado do rádio no frontend.
- [x] T007m Remover o acesso à auditoria dos cards da listagem e mantê-lo apenas
  no detalhe da enquete.
- [x] T007n Adicionar filtro local na auditoria por opção votada/desvotada e por
  gdev responsável pelos eventos.
- [x] T007o Ajustar a linguagem e o dropdown da auditoria para combinar com o
  modal de autenticação.
- [x] T007p Remover a mensagem “Ainda não há votos” do detalhe da enquete,
  mantendo os cards como indicação do estado vazio.
- [x] T007q Ordenar a listagem com enquetes abertas primeiro e, dentro de cada
  grupo, da mais nova para a mais antiga.
- [x] T007r Exibir falhas ao salvar votos no modal padronizado
  `/gdevs/polls/error`, mantendo a reversão e o tremor da opção afetada.
- [x] T007s Substituir o texto de carregamento da auditoria por skeletons dos
  eventos.
- [x] T007t Abrir automaticamente a autenticação ao entrar na listagem de
  enquetes sem sessão e evitar o erro de autenticação na tela.
- [x] T007u Manter o skeleton da listagem atrás do login automático e redirecionar
  para a home quando esse login for cancelado.
- [x] T007v Cobrir com testes os fluxos de cancelamento do login e de sucesso
  enquanto a listagem permanece em carregamento.
- [x] T007w Cobrir chamadas diretas não autorizadas para votar e criar enquetes,
  incluindo enquete encerrada, visitante e membro sem permissão admin.
- [x] T007x Ajustar a tela de nova enquete com switches, remoção de opções,
  bloqueio durante envio e mínimo condicional de opções.
- [x] T007y Paginar a listagem autenticada em lotes de três, carregar o próximo
  lote por sentinel com skeleton e mesclar sincronizações incrementais sem
  duplicar ou perder enquetes.
- [x] T007z Sugerir até três enquetes abertas após um voto, com toast/modal,
  snooze sincronizado de no máximo 24 horas e recusa individual persistida no
  JSON de preferências do usuário.
- [x] T007aa Registrar o admin que encerrou a enquete, bloquear votos e novas
  opções após o encerramento e exibir o estado somente leitura.
- [x] T007ab Substituir exclusão de opções por ocultação auditável, registrar
  `hidden_at`/`hidden_by_user_id`, cancelar votos com motivo próprio e aplicar
  o mínimo de opções visíveis.
- [x] T007ac Completar guards de backend contra visitante, membro sem admin,
  enquete encerrada, opção oculta, opção não permitida e referências inválidas,
  incluindo chamadas diretas fora da interface.
- [x] T007ad Ordenar listagem e opções de forma estável, preservar empate por
  data de criação e manter cursor/merge durante sincronização incremental.
- [x] T007ae Completar skeletons de listagem, detalhe e auditoria, incluindo
  o skeleton atrás do login automático e o redirecionamento após cancelamento.
- [x] T007af Implementar criação condicional de opções, validação por campo,
  tooltip de erro geral, bloqueio integral durante envio, switches e controles
  compartilhados de input/`+`/`×`.
- [x] T007ag Manter a auditoria apenas no detalhe, ordenar todos os eventos,
  identificar autoria/encerramento/ocultação e filtrar por opção e gdev.
- [x] T007ah Validar preferências JSON sem cascata de exclusão, com snooze de
  no máximo 24 horas e recusa de enquete sincronizada entre dispositivos.
- [x] T007ai Adicionar testes de caracterização para `PollCard`, submenu,
  transformação da marca da seção, links externos, teclado e ações compactas,
  antes da refatoração estrutural.
- [x] T007aj Reutilizar o `PollCard` compacto no modal de sugestões, manter o
  menu `...` visível no contexto correto e padronizar os textos de sugestão e
  de nova opção em minúsculas, sem reticências indevidas.

## Refatoração frontend executada

- [x] T008 Extrair o shell genérico de seção, marca, título, submenu e retorno
  ao início, sem acoplamento à feature de polls.
- [x] T008a Consolidar `FieldControl`, `FieldActionButton`, spinner, shake,
  disabled e erro em primitivas com contratos acessíveis e testáveis.
- [x] T008b Separar `PollsPage.tsx` em rota, listagem, criação, detalhe,
  auditoria, modais e componentes de opção sem alterar a API pública.
- [x] T008c Extrair hooks de dados e funções puras para cursor, merge,
  ordenação, voto otimista, sugestões e tradução de erros.
- [x] T008d Padronizar os gates de autenticação `required`/`preview` e os
  estados assíncronos de loading, erro, rollback e sucesso.
- [x] T008e Centralizar tokens de paleta, espaçamento, tipografia, foco e
  movimento, mantendo suporte a `prefers-reduced-motion`.
- [x] T008f Executar validação visual desktop/mobile, suíte completa, lint,
  typecheck, build e `git diff --check` após cada fase.

Validação executada antes do aditivo de sugestões: backend `131 passed, 1 skipped`
(799 assertions), frontend `79 passed` em 10 arquivos, TypeScript, ESLint, Pint e
`git diff --check` passaram.

As tasks permanecem neste arquivo; não gerar Issues automaticamente.

Validação do aditivo de sugestões: backend `152 passed, 1 skipped` (919
assertions), frontend `106 passed` em 14 arquivos, typecheck sem incremental,
build Vite, ESLint, Pint e `git diff --check` passaram.

Validação do checkpoint de proteção da refatoração: frontend `112 passed` em
16 arquivos, ESLint e `npx tsc -p frontend/tsconfig.app.json --noEmit`
passaram. O plano temporário correspondente está em
`.tmp/frontend-standardization-plan.md`; ele não substitui o plano técnico.

Validação final da refatoração: frontend `123 passed` em 19 arquivos, backend
`152 passed, 1 skipped` (919 assertions), ESLint, `tsc -b`, build Vite e
`git diff --check` passaram. O skip do backend continua sendo o teste de
concorrência que exige locks do MySQL.
