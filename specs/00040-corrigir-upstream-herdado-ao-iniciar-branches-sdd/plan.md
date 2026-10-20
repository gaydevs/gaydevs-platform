# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/40 · Spec: [spec.md](spec.md)
Aprovação da spec: Luciano, 20/10/2026, aprovação explícita nesta conversa com o Cleito Bot.

## Abordagem

Corrigir a criação da branch em `scripts/sdd/from-issue.mjs` para usar `git switch --no-track -c <branch> origin/develop`. Assim `origin/develop` continua sendo a referência exata do commit inicial, mas o Git não registra `branch.<nome>.remote`/`branch.<nome>.merge` apontando para `develop`.

O helper continuará emitindo JSON em stdout. A orientação para primeira publicação será escrita em stderr e no comentário criado na Issue, usando explicitamente `git push -u origin HEAD`; isso evita quebrar consumidores que fazem parse do JSON de stdout.

A regressão será adicionada ao bloco existente de criação de branches em `scripts/sdd/cli.test.mjs`: após `from-issue --start`, o teste verificará que `@{upstream}` não existe. Em seguida, o sandbox apontará `origin` para o remoto bare já criado pela fixture, executará `git push -u origin HEAD` e confirmará que o upstream passa a ser `origin/<mesmo-nome-da-branch>`.

A documentação em `docs/development-workflow.md` separará três ações hoje agrupadas: criar a branch local, publicar pela primeira vez com `git push -u origin HEAD` e depois criar o PR com `pr-create.mjs`.

Alternativas rejeitadas:

- criar a branch normalmente e executar `git branch --unset-upstream` depois: existe uma janela intermediária insegura e uma falha entre os comandos preservaria o upstream errado;
- mudar configuração global/local do Git (`branch.autoSetupMerge`): efeito amplo e fora do escopo do helper;
- automatizar push no `from-issue --start`: viola a spec, que mantém criação local separada de publicação.

## Impactos e dependências

- Código: `scripts/sdd/from-issue.mjs` e `scripts/sdd/cli.test.mjs`.
- Documentação: `docs/development-workflow.md`.
- GitHub: o texto do comentário inicial da Issue muda para incluir o primeiro push seguro; nenhum novo endpoint ou permissão é necessário.
- Git: depende apenas do `git switch --no-track`, já disponível no Git usado pelo projeto/Survivor.
- API/dados/migrations/infraestrutura: não aplicável.
- Segurança operacional: reduz o risco de um primeiro `git push` tentar atualizar a branch protegida `develop`.
- Compatibilidade: stdout JSON do helper permanece inalterado; a orientação adicional fica em stderr.

## Validação

1. Executar o teste de sandbox que cobre Feature, Bug, Refactor e Tech Debt e confirmar, para cada tipo, que:
   - HEAD é igual a `origin/develop`;
   - `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` falha antes da publicação;
   - stderr contém `git push -u origin HEAD`;
   - depois do primeiro push, o upstream é `origin/<branch>`.
2. Confirmar que o comentário esperado na Issue inclui a orientação de primeira publicação.
3. Executar `node scripts/sdd/test.mjs` com timeout compatível com o Survivor e exigir sucesso integral.
4. No checkout real da #40, antes de publicar, confirmar ausência de upstream; após a implementação validada, publicar exatamente com `git push -u origin HEAD` e confirmar o upstream remoto correto.
5. Revisar `docs/development-workflow.md` para garantir que nenhum trecho sugira `git push` simples como primeira publicação de branch inédita.

## Constitution check

- SDD preservado: Issue #40 existe e é Bug não trivial, com spec aprovada antes deste plan.
- Rastreabilidade preservada: Issue `#40` ↔ ID `00040` ↔ branch `fix/00040-corrigir-upstream-herdado-ao-iniciar-branches-sdd` ↔ pasta da spec.
- Escopo aprovado preservado: nenhuma mudança de requisito foi introduzida no plan.
- Blockers: nenhum blocker aberto registrado para a Issue #40.
- Fonte de verdade: GitHub foi consultado pelo helper/gh no início do trabalho.
- Gate atual: este plan precisa de aprovação humana antes de tasks/implementação.
- Gate posterior: PR para `develop` continua exigindo revisão de outro gdev; este trabalho não automatiza aprovação ou merge.
- Pós-design: nenhum conflito com a constitution identificado.

## Aprovação humana

Aprovado por Luciano em 20/10/2026. Referência: aprovação explícita nesta conversa com o Cleito Bot.
