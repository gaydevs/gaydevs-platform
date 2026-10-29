# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/91 · Spec: [spec.md](spec.md)
Fast-track risk: Medium

## Abordagem

Aplicar a menor alteração necessária para atender a Issue, preservando os contratos existentes.

## Validação

Executar os testes diretamente relacionados e verificações de integridade do diff.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Implementação pendente do checkpoint Medium Risk.


## Implementação

- chamar `POST /repos/{repo}/merges` com `base=develop` e `head=<release merge sha>`;
- executar o back-sync após todas as validações e antes das mutações de Project/Issue;
- falhar visivelmente se o GitHub não puder realizar o merge.
