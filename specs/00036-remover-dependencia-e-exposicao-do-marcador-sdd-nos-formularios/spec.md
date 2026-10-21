# 00036 — Remover dependência e exposição do marcador SDD nos formulários

Issue: https://github.com/gaydevs/gaydevs-platform/issues/36
Estado: aprovada.

## Problema e objetivo

O SDD já possui tipo nativo no GitHub, mas os helpers ainda exigem o marcador `gaydevs-sdd` no body. Remover essa dependência e deixar o conteúdo da Issue livre de metadado técnico.

## Escopo e comportamento

- Classificar SDD pelo tipo nativo: Feature, Bug, Refactor ou Tech Debt.
- Não exigir nem gerar `gaydevs-sdd` nos formulários.
- Issues antigas com marcador continuam válidas sem migração.
- Preservar gates atuais de tipo, estado e spec.

## Requisitos verificáveis

- REQ-001: Issue com tipo SDD válido funciona sem marcador no body.
- REQ-002: Issue sem tipo ou com tipo não suportado continua recusada.
- REQ-003: Forms não exibem nem solicitam preservação do marcador.
- REQ-004: Testes e documentação refletem o tipo nativo como fonte de classificação.

## Critérios de aceite

- Helpers iniciam e validam Issues SDD com ou sem marcador quando o tipo nativo é válido.
- Feature continua exigindo spec e tipos inválidos continuam falhando claramente.
- Novas Issues criadas pelos forms não recebem `gaydevs-sdd`.

## Dependências e questões abertas

Sem blockers ou questões abertas.

## Aprovação humana

Aprovada por Luciano em 2026-10-20, nesta conversa.
