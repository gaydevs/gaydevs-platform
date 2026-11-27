# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115 · Spec: [spec.md](spec.md)
Fast-track risk: High
**Branch:** feat/00115-adicionar-area-de-anotacoes-sobre-gdevs
**Estado:** refinamento de navegação aprovado na spec; plano do refinamento aprovado (High Risk).
**Spec aprovada:** 27/11/2026, conversa após commit 4577cea.

## Resumo e contexto técnico
Isolar notas por autor autenticado, preservando a interface existente e a restrição admin. Laravel 13/Sanctum 4, React/TypeScript/Tiptap, banco relacional MySQL em produção e SQLite nos testes Pest; Vitest para frontend. Não introduzir dependências nem novas permissões.

## Abordagem
- Backend Laravel: tabela user_notes com id UUIDv7, author_id e user_id UUID referenciando users, content e timestamps. Unicidade no par (author_id, user_id); índice pelo membro e chaves estrangeiras com exclusão em cascata, conforme política existente. Uma anotação por autor por membro. Ler ficha inexistente como vazia e gravar atomicamente por upsert no par, sem alterar id na atualização. Usar o trait HasUuidV7 existente ou gerar explicitamente UUIDv7 para inserções via upsert.
- O servidor deriva author_id exclusivamente de request->user()->getAuthIdentifier() após autenticação e autorização. Todas as consultas de notas são limitadas ao par autor/membro. O endpoint de listagem inclui o filtro do autor dentro do ON do LEFT JOIN, preservando todos os membros mesmo sem nota própria; nenhum conteúdo/indicador de outros autores é retornado.
- Manter os três endpoints e middleware existentes. Rejeitar campos de propriedade enviados no corpo da gravação (author_id, user_id, id) com validação, sem aceitar alterações de proprietário. Aplicar autenticação, atividade e perfil admin antes de consultar a ficha.
- Proteção adicional contra troca de sessão em outra aba: frontend envia X-Notes-Actor com o ID do usuário renderizado em cada requisição de notas (inclusive autosave). Backend exige correspondência com o usuário autenticado após os gates existentes, recusando ausente ou divergente com 409 e resposta genérica sem dados. Esse header é somente precondição de consistência da sessão, nunca fonte de autorização ou seleção de autor. O servidor sempre usa a sessão real. O ID esperado é capturado no início do fluxo e não recalculado após await do CSRF.
- Troca de identidade no React: manter chaves por ID do admin e membro, abortar GET pendente e invalidar timers/continuações de gravação do editor desmontado. Não reaproveitar conteúdo, estado de listagem ou rascunho entre autores. Não iniciar novas gravações de uma sessão invalidada; qualquer requisição que atravessar mudança de cookie falha pela precondição. Tratar 409 como sessão divergente e orientar recarregamento/autenticação sem enviar conteúdo para a outra conta.
- Expor rotas próprias de listagem mínima (ID, nome e prévia textual curta da anotação, limitada a 160 caracteres), consulta e atualização da ficha. A prévia é calculada no backend apenas para o endpoint admin; não retornar anotações completas na listagem. Usar auth:sanctum, EnsureUserIsActive e a verificação de MemberType::ADMIN já usada nas Enquetes; reutilizar/generalizar a checagem apenas se necessário, sem alterar a política existente.
- Frontend React: reutilizar padrões de PollsBrand, PollsPage/PollCard, PollDetail, SectionSubmenuBar e o observador de visibilidade do ícone das Enquetes. Criar ícone SVG de ficha/anotação com gradiente ciano–violeta–magenta e wordmark /gdevs/notes; manter o prefixo de rota real existente da plataforma. A marca principal vira submenu fixo quando sai de vista e permanece no submenu da ficha. Exibir iniciais e prévia limitada nos cards apenas quando houver texto. Centralizar a primeira linha do nome no avatar usando line-height e padding calculado; reutilizar poll-loading__shine nos esqueletos da lista, detalhe e editor lazy.
- Editor WYSIWYG Tiptap (React, StarterKit, BubbleMenu e Markdown), com extensões limitadas aos formatos previstos e três botões H1/H2/H3 no BubbleMenu, com hierarquia tipográfica distinta; manter Markdown textual na API/banco, sem modo de código ou preview separado. Não renderizar HTML arbitrário, imagens remotas ou links ativos; verificar XSS, colagem e round-trip dos formatos. Validar tamanho e tipo no servidor; suportar limpar a ficha. Tiptap 3.35.0 com dependências fixadas no lockfile e carregamento sob demanda apenas na ficha; não introduzir serviço externo. Colagem é tratada como texto para evitar HTML arbitrário.
- Autosave com debounce de aproximadamente 700 ms, apenas uma gravação em voo por ficha e fila da versão mais recente; não substituir edição local com resposta antiga. Manter estados internos; exibir salvamento e falha apenas no modal de saída. Sem armazenamento persistente de rascunho no navegador. Guardar navegação interna, histórico e logout enquanto houver alterações pendentes: abrir modal seguindo ModalHeader, login-overlay e padrão de confirmação das Enquetes, disparar/aguardar gravação e navegar após confirmação, ou prosseguir sem confirmação ao selecionar Ignorar; X/Escape mantém a edição; Tentar de novo em falha. Para fechar/recarregar a aba, usar aviso nativo beforeunload, pois o navegador não permite modal personalizado nessa situação.
- Não incluir conteúdo em respostas públicas, busca pública, logs/auditoria com payload, previews sociais ou cache compartilhado. Não usar dados pessoais reais nos testes. Não alterar autenticação nem introduzir novas permissões.

## Validação e risco
- Testes backend: dois admins independentes lendo, criando, atualizando e limpando o mesmo alvo; isolamento de prévias e de existência de registros; admin alvo não vê notas de outro sobre si; adulteração de campos e header não altera registros; visitante, membro comum e admin inativo bloqueados nos três endpoints; membro inexistente; unicidade, id estável e integridade referencial; cache privado/no-store e erros sem payload; migration inicial com o esquema final.
- Testes frontend: marca e submenu, ordenação/cards/prévia, editor visual, formatação e round-trip, debounce, gravações concorrentes, erro/retry, cancelamento de saída, navegação interna/histórico/logout, beforeunload e conteúdo seguro; verificação visual mobile/desktop. Testar listagem com prévia limitada e sem acesso não autorizado.
- Verificar diff, executar testes diretamente relacionados e lint/typecheck aplicáveis.
- Testes frontend adicionais: menu admin/visitante/membro; troca de admin durante GET e autosave (inclusive espera por CSRF); header vinculado ao autor esperado; 409 sem reenvio sob outra identidade; limpeza de estado na troca de sessão; regressões do editor, carregamento e navegação.
- Verificar suite de backend e frontend, Pint, TypeScript, ESLint e build; não declarar validação visual real se indisponível. Testar MySQL quando houver ambiente autorizado; registrar limitação se apenas SQLite estiver disponível.

## Migration
- O PR #120 permanece aberto; a migration inicial ainda não consta em main/develop. O gdev confirmou em 27/11/2026 que não existem anotações antigas.
- Corrigir diretamente a migration de criação de user_notes nesta branch antes do merge, criando o esquema final com id, author_id, user_id e UNIQUE(author_id, user_id).
- Não criar tabela legada, migration de transição ou rotina de conversão/backfill.
- Executar migrations em banco descartável de testes. Se algum ambiente persistente já tiver aplicado a versão anterior da migration, interromper o rollout e verificar o esquema antes de qualquer alteração. Não realizar reset destrutivo nem deploy nesta etapa.

## Constituição e estrutura
- High Risk mantido: autorização por registro e privacidade. Spec aprovada; plano aprovado separadamente em 27/11/2026 antes de tasks/implementação. Uma branch/spec, issue #115 e PR #120 preservados.
- Arquivos de implementação previstos: backend/app/Models/UserNote.php, backend/app/Http/Controllers/UserNoteController.php, backend/routes/api.php se necessário, migration inicial de user_notes e backend/tests/Feature/UserNotesTest.php; frontend/src/features/notesApi.ts, NotesPage.tsx, useNoteAutosave.ts e testes relacionados. Reutilizar middleware admin existente sem alterar a autorização de Enquetes.
- Contrato e modelo descritos nos artefatos data-model.md e contracts/notes-api.md. Sem violação arquitetural planejada.

## Aprovação
Fast-track aprovado por um gdev antes da implementação (2026-11-27). Checkpoint Medium Risk original aprovado; implementação inicial publicada. Revisão de escopo com novo checkpoint Medium Risk aprovado em 27/11/2026, incluindo Tiptap. A prévia permanece exclusivamente admin e o autosave mantém o mesmo mecanismo de autorização.

Aprovação da revisão de privacidade: spec aprovada explicitamente em 27/11/2026 (commit 4577cea). Plano revisado aprovado explicitamente em 27/11/2026 (commit 38af8fc); implementação autorizada.

## Plano do refinamento de navegação e refresh (27/11/2026)

Spec aprovada explicitamente após commit 15eb617. Mantido o fluxo SDD High Risk da issue. Plano aprovado explicitamente pelo gdev em 27/11/2026 após commit ff7e31a.

### Login obrigatório
- Reutilizar SectionAuthGate (mode required) em NotesPage, com skeleton apropriado à rota de listagem/detalhe durante restauração e enquanto visitante; nenhuma chamada notes antes de sessão admin.
- Generalizar no App.tsx o callback de login obrigatório atualmente usado por Enquetes, preservando o fluxo de #login/#login/otp e a rota de origem. Calcular homePath a partir do prefixo da seção ativa (notes ou polls), de modo que cancelar o login retorne à home da plataforma, não à raiz do domínio.
- Autenticado não admin recebe modal Área restrita sobre o mesmo skeleton, sem requisições privadas. Reutilizar ModalHeader, login-overlay e poll-error-dialog; Home/X/Escape navegam à home; aguardar fechamento do login para montar o modal. Aplicar também aos 403 na listagem e ficha, descartando dados da listagem. Admin usa o fluxo existente com actorId. Não modificar gates/middleware ou contratos do backend.

### Ignorar salvamento
- Em useNoteAutosave, adicionar ação explícita ignoreLeave separada de cancelLeave (X/Escape). Capturar e limpar o callback de saída antes de executá-lo uma única vez. Invalidar a fila/timer e a continuação do autosave da ficha abandonada; abortar o fetch local em voo quando possível. Uma requisição já aceita pelo servidor ainda pode concluir, sem garantia. Não tentar rollback de escrita nem reenviar após saída ou mudança de sessão.
- Remover aviso beforeunload da ficha explicitamente abandonada para não bloquear a navegação autorizada. Preservar o aviso nativo para fechamento/reload não autorizado pelo modal.
- SaveDialog: Ignorar como ação secundária durante salvamento, erro e sessão divergente; Tentar de novo em falhas transitórias; Recarregar na divergência. Mensagem de possível perda de edição; X/Escape fecha modal sem sair. Nenhuma mudança no comportamento silencioso normal.
- Preservar o callback original de destino, incluindo popstate e logout, sem disparar uma segunda proteção ou sair duas vezes se a resposta chegar tarde. Testar saída que não desmonta imediatamente, como logout assíncrono.

### Refresh da listagem
- Extrair hook useNoteList ou manter lógica isolada equivalente. Usar intervalo de 15.000 ms, alinhado ao POLL_REFRESH_INTERVAL_MS existente. GET completo de /notes com X-Notes-Actor, cache no-store e ordenação atual, sem alterações na API. Substituir snapshot, incluindo remoções de membros e prévias que ficaram vazias.
- Consulta inicial ao montar, inclusive retorno da ficha; refresh a cada 15s somente com documento visível, e imediatamente em visibilitychange para visible. Evitar requisições concorrentes; descartar respostas de geração/autor anterior, cancelar requisições e timers/listeners no unmount.
- Esqueleto só até primeira carga. Falha transitória de refresh mantém cards e tenta no próximo ciclo. 401/403/409 limpa snapshot, impede novos refreshes com sessão inválida e exibe orientação correspondente; nunca mostrar conteúdo antigo de outra sessão.

### Validação
- Testes com timers falsos e respostas controladas: periodicidade, visibilidade, sobreposição, snapshot atualizado (inclusive remoções), falhas transitórias e autorização, desmontagem e troca de autor.
- Testes de integração App/NotesPage: login direto nas duas rotas, skeleton/modal, cancelamento para home correta, autenticação admin e não admin, ausência de consultas privadas sem admin; regressão Enquetes.
- Testes hook/modal/App: Ignorar em espera/erro/409, saída única com fila descartada e resposta tardia, logout/histórico, X/Escape mantém ficha, retry e salvamento normal permanecem.
- Executar suíte frontend, typecheck, lint e build; suíte backend de regressão para confirmar que autorização e isolamento continuam intactos. Sem nova dependência, migration ou endpoint.

### Extração dos modais (27/11/2026)
Refinamento interno autorizado pelo gdev: RestrictedAccessDialog, PendingSaveDialog e useModalLifecycle em components, sem dependência de Anotações, mantendo textos, CSS, ações e políticas de fechamento. O gate global, proteção de navegação, autosave genérico e migração dos modais das Enquetes ficam na issue #122 (Refactor, bloqueada por #115); não alterar autorização ou persistência nesta extração.
