# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115 · Spec: [spec.md](spec.md)
Fast-track risk: Medium

## Abordagem
- Backend Laravel: tabela separada de anotações com chave estrangeira compatível com UUID de users, unicidade por membro, conteúdo textual e timestamps. Migração aditiva; leitura de ficha inexistente como vazia e gravação por upsert.
- Expor rotas próprias de listagem mínima (ID, nome e prévia textual curta da anotação, limitada a 160 caracteres), consulta e atualização da ficha. A prévia é calculada no backend apenas para o endpoint admin; não retornar anotações completas na listagem. Usar auth:sanctum, EnsureUserIsActive e a verificação de MemberType::ADMIN já usada nas Enquetes; reutilizar/generalizar a checagem apenas se necessário, sem alterar a política existente.
- Frontend React: reutilizar padrões de PollsBrand, PollsPage/PollCard, PollDetail, SectionSubmenuBar e o observador de visibilidade do ícone das Enquetes. Criar ícone SVG de ficha/anotação com gradiente ciano–violeta–magenta e wordmark /gdevs/notes; manter o prefixo de rota real existente da plataforma. A marca principal vira submenu fixo quando sai de vista e permanece no submenu da ficha. Exibir iniciais e prévia limitada nos cards apenas quando houver texto. Centralizar a primeira linha do nome no avatar usando line-height e padding calculado; reutilizar poll-loading__shine nos esqueletos da lista, detalhe e editor lazy.
- Editor WYSIWYG Tiptap (React, StarterKit, BubbleMenu e Markdown), com extensões limitadas aos formatos previstos e três botões H1/H2/H3 no BubbleMenu, com hierarquia tipográfica distinta; manter Markdown textual na API/banco, sem modo de código ou preview separado. Não renderizar HTML arbitrário, imagens remotas ou links ativos; verificar XSS, colagem e round-trip dos formatos. Validar tamanho e tipo no servidor; suportar limpar a ficha. Tiptap 3.35.0 com dependências fixadas no lockfile e carregamento sob demanda apenas na ficha; não introduzir serviço externo. Colagem é tratada como texto para evitar HTML arbitrário.
- Autosave com debounce de aproximadamente 700 ms, apenas uma gravação em voo por ficha e fila da versão mais recente; não substituir edição local com resposta antiga. Manter estados internos; exibir salvamento e falha apenas no modal de saída. Sem armazenamento persistente de rascunho no navegador. Guardar navegação interna, histórico e logout enquanto houver alterações pendentes: abrir modal seguindo ModalHeader, login-overlay e padrão de confirmação das Enquetes, disparar/aguardar gravação e só então navegar; Cancelar mantém a edição; Tentar de novo em falha. Para fechar/recarregar a aba, usar aviso nativo beforeunload, pois o navegador não permite modal personalizado nessa situação.
- Não incluir conteúdo em respostas públicas, busca pública, logs/auditoria com payload, previews sociais ou cache compartilhado. Não usar dados pessoais reais nos testes. Não alterar autenticação nem introduzir novas permissões.

## Validação e risco
- Testes backend: admin ativo lê e grava, não autenticado e não admin não acessam, membro inexistente não cria ficha, atualizações mantêm unicidade e limpeza funciona.
- Testes frontend: marca e submenu, ordenação/cards/prévia, editor visual, formatação e round-trip, debounce, gravações concorrentes, erro/retry, cancelamento de saída, navegação interna/histórico/logout, beforeunload e conteúdo seguro; verificação visual mobile/desktop. Testar listagem com prévia limitada e sem acesso não autorizado.
- Verificar diff, executar testes diretamente relacionados e lint/typecheck aplicáveis.
- Medium se a proteção existente puder ser reutilizada sem mudança sensível; escalar para High antes de código se surgir exposição, mudança de autorização sensível ou necessidade adicional de proteção de dados.

## Aprovação
Fast-track aprovado por um gdev antes da implementação (2026-11-27). Checkpoint Medium Risk original aprovado; implementação inicial publicada. Revisão de escopo com novo checkpoint Medium Risk aprovado em 27/11/2026, incluindo Tiptap. A prévia permanece exclusivamente admin e o autosave mantém o mesmo mecanismo de autorização.
