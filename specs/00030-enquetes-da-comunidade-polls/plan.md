# Plano técnico

Issue: [#30](https://github.com/gaydevs/gaydevs-platform/issues/30) · Spec:
[spec.md](spec.md)

Aprovação da spec: luvittor, 2026-10-26, nesta conversa.

## Abordagem

Implementar a Feature como um fluxo único entre a API Laravel em `backend/` e
a SPA React em `frontend/`. A mesma tela terá modo de criação e modo de
visualização/votação. A criação e administração serão protegidas por
`users.member_type = admin`; `member` é o tipo inicial sem permissão
administrativa. O campo será convertido pelo enum backed `MemberType` e
persistido como `ENUM('member', 'admin')` no MySQL. Novos tipos exigirão
alteração do enum por migration.

O backend fornecerá uma listagem autenticada paginada por cursor, uma leitura
pública por slug e uma leitura enriquecida para sessões autenticadas. O UUID
será apenas identificador interno; o slug obrigatório será gerado na criação,
antes de a enquete ser disponibilizada.

O domínio terá as entidades `polls`, `poll_options` e `poll_votes`. `users`
receberá `member_type` com `member` como padrão. `polls` e
`poll_options` usarão UUIDs internos; `polls` terá `created_by_user_id`, pergunta,
`slug` único, datas de início, `allow_multiple`, `allow_new_options` e
`closed_at`. Cada voto novo ligará um membro a uma opção e será append-only;
votos legados agregados poderão ter `user_id` nulo. Todos terão status ativo ou cancelado,
motivo e momento do cancelamento. Uma transação de substituição do conjunto de
opções cancelará os votos ativos anteriores antes de registrar os novos,
impedindo duplicidade ativa sem apagar o histórico.

Opções criadas por gdevs guardarão `created_by_user_id`. A enquete também guardará seu
criador. A remoção só será permitida
para a opção criada pelo próprio membro quando nenhum outro membro tiver votado
nela; opções com votos de outros membros permanecerão. A criação de opções será
recusada quando `allow_new_options` estiver desabilitado ou a enquete estiver
encerrada.

O detalhe exibirá o criador da enquete. A autoria de uma opção será exibida
somente quando seu criador for diferente do criador da enquete.

O serviço de resultados contará cada seleção ativa como uma unidade, seja ela
identificada ou legada sem `user_id`, usando a quantidade total de seleções como
  base bruta. Depois agregará as contagens por opção e arredondará cada percentual
  normalmente, sem aplicar resíduo artificial para forçar a soma em 100%. Sem
  respostas, todas as opções terão `0%` e a mensagem definida na spec. A resposta pública conterá
somente percentuais; a resposta autenticada também conterá os nomes dos
votantes por opção.

O slug será normalizado em minúsculas, sem acentos, com pontuação e espaços
convertidos em hífens, hífens repetidos removidos e limite de 120 caracteres.
As colisões serão resolvidas na ordem `YYYY-MM`, `YYYY-MM-DD`,
`YYYY-MM-DD-HH-mm` e contador de dois dígitos ao final, sempre verificando a
restrição única no banco.
Antes da criação, a pergunta será validada com no mínimo 10 caracteres e duas
palavras; não haverá slug fallback genérico.

## Impactos e dependências

- Migrations e models no backend para enquetes, opções e votos.
- Auditoria append-only de votos, cancelamento com motivo e atribuição de
  criadores da enquete e das opções.
- Migration para `users.member_type` e policy/middleware que autorize apenas o
  tipo `admin` nas operações de criação e administração.
- Rotas públicas e autenticadas em `backend/routes/api.php`.
- Rota autenticada de listagem de enquetes e navegação da listagem para o
  detalhe.
- Form Requests, policies/serviços de domínio e serialização sem expor nomes
  em respostas anônimas.
- Nova tela/rota de enquete no frontend, com estado de leitura, login,
  seleção simples ou múltipla, criação opcional de opção, edição do próprio
  voto e modo de criação visível somente para admins. O menu superior terá uma
  seta ao lado esquerdo do nome do gdev para abrir a listagem autenticada. A
  renderização de perguntas e opções detectará URLs HTTP/HTTPS e as abrirá em
  nova aba/janela, sem interromper os links internos da listagem. O detalhe
  exibirá o tempo relativo desde o encerramento quando a enquete estiver
  finalizada, sem revelar a data exata.
- O login passwordless e a sessão Sanctum existentes são dependências já
  disponíveis em produção; não haverá novo mecanismo de autenticação.
- Preferências pessoais serão persistidas em uma linha por usuário na tabela
  `user_preferences`, usando um documento JSON versionado. O serviço de
  preferências expõe o snooze global das sugestões e a lista de UUIDs de
  enquetes recusadas; o frontend nunca será a fonte de verdade.
- Após uma resposta autenticada, a API retornará um resumo de até três polls
  abertas sem voto ativo daquele gdev. A consulta excluirá a enquete atual,
  UUIDs recusados e opções fora do prazo de snooze, sem consultar JSON por
  linha; a lista será lida uma vez e aplicada como `whereNotIn`.
- Índices únicos e transações devem funcionar em SQLite de testes e MySQL de
  produção, sem SQL específico de um único banco.
- A importação das enquetes legadas será entregue como SQL separado, preservando
  datas de início, contagens anônimas do WhatsApp e votos identificados do
  StrawPoll.

## Validação

- Testes de API para criação por admin, leitura por slug, colisões de slug,
  listagem completa e rejeição de referências por UUID.
- Testes de autorização para visitante, gdev autenticado, enquete encerrada,
  opção nova permitida/bloqueada e exposição dos nomes somente ao autenticado.
- Testes de voto para seleção simples, múltipla, alteração, cancelamento e
  histórico, remoção permitida, remoção bloqueada por votos de terceiros,
  duplicidade e concorrência.
- Testes do cálculo bruto por seleção, arredondamento individual, contagens
  exibidas e enquete sem votos.
- Testes Vitest/Testing Library para estados públicos, login, seleção, erros,
  redirecionamento, listagem, sugestões, snooze e recusa de enquetes, além da
  acessibilidade básica das telas.
- Testes de preferências para persistência JSON, sincronização por sessão,
  limite de 24 horas, autenticação e exclusão de sugestões recusadas.
- Executar lint, audit, testes backend e testes frontend conforme os checks
  existentes, além de `git diff --check`.

## Constitution check

- Uma única Feature/spec cobre backend e frontend.
- A spec foi aprovada antes deste plano; nenhum código ou task será criado
  antes da aprovação deste plano.
- A Issue #30 está sem relações `blocked by` ou `blocking`.
- A implementação manterá `gdev`/`gdevs` na documentação para pessoas.
- Não há fast-track: trata-se de uma Feature com autenticação, dados pessoais
  na visualização autenticada e regras de concorrência.

## Aprovação humana

Aprovado por gdev luvittor em 2026-10-26, nesta conversa, incluindo os aditivos
de `member_type`, criação na mesma interface, slug gerado na criação, listagem
autenticada e auditoria de votos. Não substitui revisão de PR ou gate de
release.

Aditivo aprovado por gdev luvittor em 2026-10-27, nesta conversa: o serviço de
resultados usa a contagem bruta de seleções do StrawPoll, com arredondamento
individual e sem compensação para 100%.

Aditivo solicitado por gdev luvittor em 2026-10-27: URLs em perguntas e opções
 devem ser links externos seguros, abertos em nova aba/janela.

Aditivo solicitado por gdev luvittor em 2026-10-27: o detalhe mostra o tempo
relativo desde o encerramento das enquetes finalizadas.

Aditivo solicitado por gdev luvittor em 2026-10-27: o estado aberto usa a cor
verde da paleta, mantendo o estado encerrado em vermelho.

Aditivo solicitado por gdev luvittor em 2026-10-27: os cards da listagem usam o
mesmo marcador e tempo relativo de estado do detalhe.

Aditivo solicitado por gdev luvittor em 2026-10-27: os percentuais não devem
ser compensados para somar 100%; o detalhe e a listagem também exibem as
contagens brutas de votos.

Aditivo solicitado por gdev luvittor em 2026-10-27: a listagem usa lotes de três,
skeleton durante o lazy loading e sincronização incremental que mescla novas ou
alteradas sem perder o cursor ou duplicar cards.
