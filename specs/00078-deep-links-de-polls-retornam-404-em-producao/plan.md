# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/78 · Spec: [spec.md](spec.md)

## Abordagem

Adicionar `frontend/public/.htaccess` com `RewriteBase /gaydevs/platform/`, preservando arquivos/diretórios existentes e encaminhando rotas desconhecidas para `index.html`. O Vite copia arquivos de `public` para `dist`; validar essa saída no workflow de teste. No deploy, verificar a presença do `.htaccess` no diretório temporário antes de trocar o diretório publicado.

## Validação

Executar o build de produção e confirmar que `dist/.htaccess` existe. Inspecionar a regra de fallback e o diff. Após a promoção/deploy, abrir diretamente e recarregar as duas URLs da Issue.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.
