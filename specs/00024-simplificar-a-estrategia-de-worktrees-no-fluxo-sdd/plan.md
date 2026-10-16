# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/24 · Spec: [spec.md](spec.md)

Aprovação da spec: luvittor, 2026-10-16, nesta conversa.

## Abordagem

Atualizar exclusivamente a documentação permanente do fluxo SDD para consolidar
três regras: usar o checkout atual para um único trabalho, usar worktrees apenas
para checkouts simultâneos e limpar um worktree somente após tratar alterações
locais. A orientação deve mandar localizar branch/spec antes de criar outra
instância do trabalho.

Não haverá alteração de scripts, automação de remoção, frontend, backend ou
configuração Git.

## Impactos e dependências

Não há API, modelo de dados, migração, segredo, infraestrutura ou dependência
externa. Não há blockers abertos. Os documentos exatos a atualizar serão
identificados nas tasks, respeitando o escopo aprovado.

## Validação

Revisar a documentação alterada contra os três cenários da spec:

1. trabalho único usa o checkout existente;
2. trabalho simultâneo usa worktree separado;
3. limpeza preserva/trata alterações locais antes da remoção.

Executar `git diff --check`. Não há comportamento executável novo que exija
testes de aplicação ou da sandbox SDD.

Consulte [research.md](research.md), [data-model.md](data-model.md) e
[quickstart.md](quickstart.md) para as decisões e a verificação manual.

## Constitution check

- A Issue #24 existe, está em `Specifying` e não possui blockers abertos.
- A spec aprovada delimita a mudança a documentação; o plan não amplia esse
  escopo.
- Há uma branch e uma pasta `specs/00024-*` para a Issue.
- Tasks e implementação só poderão ser elaboradas após aprovação humana deste
  plan.

## Aprovação humana

Aprovado por luvittor em 2026-10-16, nesta conversa.
