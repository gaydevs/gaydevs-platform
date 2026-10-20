# Pesquisa técnica — Issue #40

## Decisão 1 — impedir tracking na própria criação da branch

**Decision:** usar `git switch --no-track -c <branch> origin/develop`.

**Rationale:** mantém o commit inicial exatamente igual a `origin/develop` e impede que a branch recém-criada herde `origin/develop` como upstream. A correção acontece de forma atômica no comando que cria a branch.

**Alternatives considered:** criar com tracking e remover depois via `git branch --unset-upstream` foi rejeitado por criar um estado intermediário inseguro; alterar `branch.autoSetupMerge` foi rejeitado por ampliar o efeito além do fluxo SDD.

## Decisão 2 — preservar stdout estruturado

**Decision:** manter JSON em stdout e emitir a orientação `git push -u origin HEAD` em stderr, além de incluí-la no comentário da Issue.

**Rationale:** os testes e automações existentes fazem parse de stdout como JSON. Adicionar texto humano ao stdout quebraria o contrato atual.

**Alternatives considered:** adicionar um campo ao JSON exigiria mudança de contrato sem necessidade; imprimir texto em stdout é incompatível com consumidores atuais.

## Decisão 3 — validar o ciclo completo de upstream na sandbox

**Decision:** no teste existente de criação de branches, verificar ausência de `@{upstream}`, repontar `origin` para o bare remote da fixture, executar `git push -u origin HEAD` e verificar `origin/<branch>`.

**Rationale:** testa o defeito e também o comportamento esperado após a primeira publicação usando Git real, sem depender do GitHub real.

**Alternatives considered:** testar apenas configuração `branch.<name>.merge` seria mais acoplado à implementação; testar somente ausência de upstream não cobriria o critério de aceite pós-push.

## Decisão 4 — documentação em uma única sequência operacional

**Decision:** atualizar `docs/development-workflow.md` no trecho que hoje pula diretamente da criação local para `pr-create.mjs`.

**Rationale:** é o guia operacional dos gdevs e já declara que `pr-create` não faz push; portanto é o local natural para tornar o primeiro push explícito.

**Alternatives considered:** criar documento novo duplicaria o fluxo e aumentaria risco de divergência.
