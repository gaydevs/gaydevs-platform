# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/112 · Spec: [spec.md](spec.md)
Fast-track risk: Medium

## Abordagem

1. Revalidar dependências em develop e notas/advisories upstream; usar o PR #111 fechado sem merge como referência, não como base.
2. Atualizar os ranges de eslint para ^10.15.0 e typescript-eslint para ^8.73.0 em frontend/package.json e resolver a árvore com npm, verificando que minimatch transitive está em versão corrigida (alvo 11.0.9). Não adicionar minimatch como dependência direta nem forçar overrides sem necessidade demonstrada.
3. Revisar o diff dos dois arquivos de dependências; aceitar apenas alterações transitivas necessárias à resolução. Se a mudança de major exigir alterações relevantes de configuração/código, pausar para reavaliação antes de ampliar o escopo.

## Validação

- Executar npm ci no frontend com Node compatível com engines.
- Inspecionar npm ls minimatch --all e npm audit --json; confirmar a correção dos advisories da issue e distinguir eventuais achados preexistentes fora do escopo.
- Executar npm run lint, npm run test, npm run typecheck e npm run build; conferir git diff --check e escopo do diff.
- Publicar branch, criar PR SDD para develop e sincronizar status Review pelos scripts oficiais, sem aprovar ou fazer merge.

## Aprovação

Classificação Medium Risk aprovada pelo gdev solicitante em 2026-11-27 nesta conversa. Implementação pendente do checkpoint Medium Risk.
