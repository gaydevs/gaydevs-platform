# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/114 · Spec: [spec.md](spec.md)
Fast-track risk: Low

## Abordagem

Estender EventFormat e CommitType, atualizar events/timeline/photos e CSS de landing. Usar WebPs completos recuperados da página pública incorporável do Instagram e o gerador de imagens existente. Atualizar a auditoria editorial para validar as três comitivas e manter os demais invariantes.

## Validação

Executar npm run images, check:content, lint, build e test no frontend; revisar diff e preservar assets não relacionados.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o risco permanecer Low.
