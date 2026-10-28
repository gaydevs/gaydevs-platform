# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82 · Spec: [spec.md](spec.md)

## Abordagem

- Interceptar apenas rotas `/polls` no fallback Apache já existente.
- Servir o mesmo `index.html` compilado por um entrypoint PHP mínimo que injeta a metadata social antes de devolver o HTML.
- Para uma enquete individual, consultar o endpoint público já existente `/gaydevs/api/polls/{slug}` para obter a pergunta; em falha, manter o título genérico de polls sem perder a descrição e URL da rota individual.
- Não alterar backend, autenticação, banco ou contratos de API.

## Validação

- Conferir build do frontend e presença dos arquivos de deploy.
- Validar regras de rewrite, tags obrigatórias e integridade do diff.
- Validar sintaxe PHP quando um runtime PHP estiver disponível; o Survivor não possui PHP instalado.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.
