# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115 · Spec: [spec.md](spec.md)
Fast-track risk: Medium

## Abordagem
- Backend Laravel: tabela separada de anotações com chave estrangeira compatível com UUID de users, unicidade por membro, conteúdo textual e timestamps. Migração aditiva; leitura de ficha inexistente como vazia e gravação por upsert.
- Expor rotas próprias de listagem mínima (ID e nome), consulta e atualização da ficha. Usar auth:sanctum, EnsureUserIsActive e a verificação de MemberType::ADMIN já usada nas Enquetes; reutilizar/generalizar a checagem apenas se necessário, sem alterar a política existente.
- Frontend React: integrar ao SectionSubmenuBar e à navegação existente. Reutilizar o padrão de PollsPage/PollCard e PollCreate/FieldControl, sem acoplar regras de enquetes às anotações. Exibir iniciais derivadas do nome.
- Editor simples com controles de formatação e persistência em Markdown textual; renderizar apenas formatação permitida, sem HTML bruto, sem execução de conteúdo e sem dependências desnecessárias. Validar tamanho e tipo no servidor; suportar limpar a ficha.
- Não incluir conteúdo em respostas públicas, busca pública, logs/auditoria com payload, previews sociais ou cache compartilhado. Não usar dados pessoais reais nos testes. Não alterar autenticação nem introduzir novas permissões.

## Validação e risco
- Testes backend: admin ativo lê e grava, não autenticado e não admin não acessam, membro inexistente não cria ficha, atualizações mantêm unicidade e limpeza funciona.
- Testes frontend: submenu, ordenação/cards, edição, formatação, persistência, erros, navegação direta e conteúdo seguro; verificação de layout mobile/desktop.
- Verificar diff, executar testes diretamente relacionados e lint/typecheck aplicáveis.
- Medium se a proteção existente puder ser reutilizada sem mudança sensível; escalar para High antes de código se surgir exposição, mudança de autorização sensível ou necessidade adicional de proteção de dados.

## Aprovação
Fast-track aprovado por um gdev antes da implementação (2026-11-27). Implementação pendente do checkpoint Medium Risk.
