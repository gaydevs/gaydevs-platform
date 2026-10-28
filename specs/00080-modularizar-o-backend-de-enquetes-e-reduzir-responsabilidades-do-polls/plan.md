# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/80 · Spec: [spec.md](spec.md)

Aprovação da spec: gdev `luvittor`, 2026-10-28, mensagem explícita “aprovado” nesta conversa.

## Abordagem

Refatorar por capacidade, mantendo Laravel/Eloquent e os contratos existentes. Não adicionar pacote, camada de repositórios, migration nem abstração genérica. Controllers continuam como fronteira HTTP e sem regras de domínio.

Organização-alvo:

- `App\Actions\Polls\CreatePoll`, `ClosePoll`, `SubmitPollResponse`, `AddPollOption` e `HidePollOption` passam a conter as mutações e suas transações. Fechamento, votação, slug e regras concorrentes permanecem dentro das mesmas transações/locks atuais.
- `PollOptionLabelRules` centraliza a normalização e a validação de rótulos compartilhadas pela criação e inclusão de opções.
- `App\Services\Polls\PollReadService` reúne resolução, listagem, cursores, sincronização `since` e sugestões. A listagem carrega os polls e relações em lote; não chama `resolve()` uma vez por resultado. O caminho `since` continua retornando todos os polls alterados, sem aplicar `limit`.
- `PollPayloadBuilder` monta payloads com o viewer recebido explicitamente, sem consultar `Auth`. Agrupa votos por opção em uma passagem e só inclui nomes/hidrata `activeVotes.user` quando a resposta autenticada os expõe. `PollAuditPayloadBuilder` isola a montagem da linha do tempo sem alterar seus eventos ou ordenação.
- `PollController` chama os componentes por método e preserva envelopes, códigos HTTP e middleware. As rotas e permissões atuais permanecem na fronteira existente; verificações de propriedade e estado que dependem de locks continuam dentro da ação. Onde `abort()` for substituído, exceções Laravel equivalentes devem manter 403/404 atuais.
- `PollService` é removido depois que todos os chamadores migrarem. `PollsTest.php` permanece no lugar durante as extrações; dividir o arquivo não é necessário para cumprir o escopo e seria uma mudança independente.

A hidratação da listagem deve reutilizar eager loading em coleções ordenadas. Se o resultado de `since` exigir lotes por limites de SQL, o serviço carrega cada lote e recompõe a ordem original antes da serialização. Isso preserva o delta completo e evita uma consulta por enquete. Não se altera o limite, cursor ou payload para controlar memória nesta refatoração.

Alternativas consideradas: manter um `PollService` fachada amplo conserva o acoplamento; um repository layer duplicaria Eloquent sem necessidade; uma reescrita em um único passo dificultaria localizar regressões. A sequência abaixo usa commits pequenos e deixa o primeiro commit de implementação somente com testes verdes.

## Impactos e dependências

- Código afetado: `backend/app/Services/PollService.php`, `PollController.php` e novos componentes de Polls em `app/Actions` e `app/Services`.
- Testes: `backend/tests/Feature/PollsTest.php`; os testes atuais de preferências continuam cobrindo sugestões e não precisam ser movidos.
- API: nenhuma rota, middleware, autorização, status HTTP, campo JSON, ordenação ou semântica de `since` muda. A lista de contratos preservados está em [contracts/polls-api.md](contracts/polls-api.md).
- Dados/infraestrutura: nenhuma migration, alteração de esquema, dependência Composer ou mudança de frontend.
- Bloqueios: Issue #80 relida, sem `blocked by` ou `blocking`; card confirmado em `Specifying`.

## Validação

### Sequência de commits

1. **Teste de caracterização, somente testes**: adicionar em `PollsTest` um caso com três polls alterados e `since` junto de `limit=1`; confirmar que os três são retornados. O código de produção não muda. Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` e `composer test`; todos devem passar no código atual.
2. **Leitura e payload**: extrair `PollReadService` e os builders; no mesmo commit, adicionar testes de regressão para consultas da listagem que não crescem por enquete, agregação que não revarre votos por opção e ausência de hidratação de votantes no payload anônimo. Rodar lint, `PollsTest` e suíte completa.
3. **Criação e fechamento**: extrair esses casos para Actions sem alterar transações nem middleware; validar testes de criação, slug, permissões e fechamento, depois lint e suíte completa.
4. **Votação**: extrair `SubmitPollResponse`; validar single/multiple choice, retirada/substituição, duplicidade, opção escondida, poll encerrado e concorrência. Rodar MySQL isolado após esta etapa para cobrir locks.
5. **Opções**: extrair adição/ocultação/remoção; validar duplicidade normalizada, autoria, admin, votos de terceiros e mínimo de opções. Rodar lint, `PollsTest`, suíte completa e MySQL isolado.
6. **Auditoria e remoção do legado**: separar o builder de auditoria, migrar os chamadores restantes, remover `PollService` se não houver referências e confirmar que nenhum endpoint ficou sem cobertura.

Após cada etapa de produção, executar `composer lint`, os testes focados de Polls e `composer test`. Não remover nem enfraquecer testes existentes. O teste de query count e o de hidratação anônima entram com a otimização que os faz passar; não haverá commit intermediário vermelho.

### Validação final, comparada à linha de base

Executar os mesmos comandos registrados em [spec.md](spec.md): `composer lint`, `composer test`, `composer test:parallel`, `composer test:random` e `php artisan test --env=mysql.testing`. Comparar contagens de testes/assertions e skips, registrar o seed aleatório e resultado no PR. MySQL só pode usar a base isolada `gaydevs_test`; nunca executar `RefreshDatabase` contra o banco de desenvolvimento. Encerrar com `git diff --check` e sem alterações em migrations/contratos.

Não há validação frontend neste escopo porque nenhum arquivo ou contrato do frontend muda.

## Constitution check

- **SDD**: fluxo normal para Refactor; não é fast-track trivial. Issue #80 existe e tem tipo/prioridade confirmados via gh.
- **Uma feature, uma spec**: único diretório `specs/00080-*`, cobrindo o módulo backend de enquetes.
- **Gates humanos**: spec e plano aprovados explicitamente por `luvittor` em 2026-10-28.
- **Escopo**: nenhuma rota, regra de produto, esquema ou migration muda. Mudança de escopo exige atualizar spec e nova aprovação.
- **Dependências**: zero blockers abertos; status do Project foi relido como `Specifying`.
- **Rastreabilidade**: branch `refactor/00080-modularizar-o-backend-de-enquetes-e-reduzir-responsabilidades-do-polls`, issue #80, prioridade Medium.

## Aprovação humana

Plano aprovado por gdev `luvittor` em 2026-10-28, com referência à mensagem explícita “aprovo” nesta conversa.
