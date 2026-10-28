# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82 · Spec: [spec.md](spec.md)

## Abordagem

- O frontend mantém somente o asset de preview e a regra Apache de roteamento para crawlers sociais.
- Navegadores comuns continuam recebendo o `index.html` da SPA sem mudança de runtime.
- Crawlers sociais de rotas `/polls` são reescritos internamente para um endpoint público do backend.
- O backend resolve a enquete diretamente via `PollService` e renderiza uma view HTML com Open Graph/Twitter Card; não há chamada HTTP do frontend para a API.
- `APP_FRONTEND_URL` define a origem/base pública usada por `og:url`, canonical e `og:image`; o endpoint falha explicitamente se a configuração estiver ausente.
- Não alterar autenticação, banco ou contratos existentes da API de polls.

## Validação

- Executar teste direcionado do endpoint de preview no backend via CI/local quando PHP estiver disponível.
- Build do frontend e presença do asset/rewrite no `dist`.
- `git diff --check` e checks do PR.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.
