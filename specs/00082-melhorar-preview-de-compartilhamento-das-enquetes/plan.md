# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82 · Spec: [spec.md](spec.md)

## Abordagem

### Frontend / Apache

- Manter arquivos e diretórios reais fora do rewrite, como hoje.
- Remover o `RewriteBase /gaydevs/platform/` específico do ambiente.
- Para crawlers sociais, encaminhar qualquer rota relativa da SPA para `../api/social/preview/{path}`.
- Manter `../api/` como contrato estrutural de publicação, coerente com `resolveApiBase()` no React.
- Para navegadores comuns, manter `RewriteRule ^ index.html [L]`.

### Backend

- Substituir o endpoint específico `/social/polls-preview/{identifier?}` por `/social/preview/{path?}` com captura do restante da rota.
- Usar um `SocialPreviewController` como dispatcher simples de metadata.
- Tratar `polls` como área conhecida e resolver `polls/{slug}` via busca não-excepcional no `PollService`.
- Se o recurso de uma área conhecida não existir ou a subrota não for reconhecida, usar a metadata da área; somente áreas desconhecidas usam a metadata global já usada pelo frontend.
- Usar uma única view `social/preview.blade.php` para Open Graph/Twitter Card.
- Derivar canonical e assets públicos de `APP_FRONTEND_URL`; falhar explicitamente se a configuração estiver ausente.

### Contrato de hospedagem

A instalação atual depende da topologia de mesma origem com diretórios irmãos:

```text
platform/
../api/
```

Esse acoplamento existe deliberadamente em dois pontos de runtime:

1. React: `resolveApiBase()` deriva a API com `../api/`.
2. Apache: `.htaccess` envia crawlers para `../api/social/preview/...`.

O proxy do Vite também usa `/gaydevs/api` no desenvolvimento. Uma futura migração da API para outro path ou origem deve revisar os três pontos e `APP_FRONTEND_URL`; essa obrigação será registrada em `docs/backend-hosting-requirements.md`.

## Segurança e comportamento

- O path capturado pelo endpoint genérico não seleciona arquivos nem classes; somente passa por regras explícitas de resolução no controller.
- Apenas slugs de poll no formato esperado entram na busca de `PollService`; ausência do recurso é comportamento esperado e usa fallback da área, enquanto áreas desconhecidas usam fallback global.
- Blade mantém escaping padrão para perguntas de polls.
- Não alterar autenticação, banco ou contratos existentes da API de polls.

## Validação

- Testes do backend para lista de polls, detalhe, fallback global e ausência de `APP_FRONTEND_URL`.
- Testar que paths não reconhecidos não são confundidos com polls.
- Build do frontend e presença do `.htaccess`/asset no `dist`.
- Verificar no `.htaccess` a ausência de paths absolutos `/gaydevs/...` para o social preview.
- `git diff --check`, lint, testes e CI completo do PR.
