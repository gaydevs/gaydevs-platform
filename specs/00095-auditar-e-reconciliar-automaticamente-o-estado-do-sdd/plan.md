# Plano técnico — 00095

Issue: https://github.com/gaydevs/gaydevs-platform/issues/95 · Spec: [spec.md](spec.md)
Aprovação da spec e risco High: gdev solicitante, 27/11/2026, resposta explícita "aprova" à spec publicada em fb7b8c2.
Estado: plano pendente de aprovação humana.

## Abordagem

### 1. Diagnóstico e correção das transições

- Inventariar configuração atual do Project #1, workflows nativos, histórico disponível e scripts. Comparar o comportamento observado com o registro histórico em docs/sdd-implementation.md: auto-add assíncrono e Item added to project define Backlog. A regressão por adição redundante é hipótese; confirmar em ambiente isolado/fixture autorizada ou com evidência de eventos antes de alterar configuração remota.
- Centralizar no core.mjs a consulta paginada de projectItems, campos e opções. Identificar card pela issue node_id e projectId, não pelo título. Não chamar addProjectV2ItemById para item existente. Detectar duplicações e estados desconhecidos sem remover registros.
- Implementar operação idempotente de status com estado esperado, precondições, leitura imediatamente antes da escrita e verificação posterior. Após adicionar item, considerar a inicialização assíncrona nativa antes de avançar; reler e distinguir conflito, falha e sucesso. Repetir apenas falhas transitórias classificadas, com limite (até 3 tentativas e backoff respeitando Retry-After), sem repetir cegamente mutações de resultado incerto. Fechamentos também devem ser relidos e verificados.
- A API de Projects não oferece compare-and-swap atômico para o Status; serialização das execuções próprias e revalidações reduzem, mas não eliminam, corrida com alterações externas. Em divergência ou falta de evidência, não escrever; se detectada alteração concorrente depois da escrita, reportar sem sobrescrever novamente. Validar essa limitação antes de habilitar escrita automática.
- Manter contratos de from-issue, status, fast-track, pr-create, pr-sync e release-sync. Validar Priority nativa na própria issue antes de qualquer mutação de from-issue --start. Centralizar regras compartilhadas em módulo puro, sem duplicar lógica de transição entre scripts e reconciliador.
- Registrar evidência de transições autorizadas por gdev em registro durável na issue (comentário estruturado com versão, status anterior/alvo, referências da branch/spec/PR/release, identificador da operação e resultado verificado), aproveitando os comandos existentes. Validar identidade/origem de quem registra com os mecanismos disponíveis; texto livre e comentários não confiáveis nunca equivalem a aprovação. Não gerar retroativamente aprovações ou registrar como confirmada uma mutação falha. Preservar evidências históricas; conflitos e ausência de rastreabilidade vão para análise humana.

### 2. Auditoria e reconciliador

- Criar scripts/sdd/reconcile.mjs (CLI) e módulos de coleta de evidências, decisão pura e execução. Reutilizar config/core e contratos já existentes, sem dependências externas de runtime. Coletar issue state/state_reason, tipo, Priority, blockers, cards, refs e specs publicados, PRs e histórico de entrega com paginação; consultar detalhes sob demanda. Tratar resultados truncados/erros como incompletos, não como inexistência.
- Separar snapshot, propostas e aplicação. Default CLI dry-run; --apply explícito habilita somente ações determinísticas. --issue N permite escopo reduzido. Saída Markdown/JSON com evidência (IDs, refs e URLs), decisão, estado anterior, resultado verificado e motivo de pendência. Não incluir credenciais ou conteúdo sensível desnecessário.
- Evidências históricas serão aceitas apenas quando provenientes de registros existentes verificáveis e coerentes com o estado remoto; não inferir autorização a partir de texto gerado por agente, mera presença de spec/branch ou existência de PR. Gates ausentes, dados contraditórios ou aprovação posterior ao artefato incorreto exigem decisão humana. Distinguir etapa de trabalho de entrega comprovada.

| Evidência | Decisão |
|---|---|
| Issue aberta de tipo SDD sem card | Adicionar card; Backlog apenas se não houver evidência de etapa posterior nem conflito. |
| Status ausente ou Backlog + registro verificável de início/especificação vigente | Specifying; não promover pela existência de branch isoladamente. |
| Ready / In Progress | Restaurar apenas com evidência explícita do gate humano correspondente e blockers resolvidos; não inventar aprovação. |
| PR de trabalho aberto, contrato válido, implementação autorizada e etapa compatível | Review; se spec/risco estiver em revisão, preservar Specifying. Draft, reabertura ou conflito exigem validação. |
| PR fechado sem merge | Aplicar transição existente Review -> In Progress somente com evidência e sem estado mais recente/terminal. |
| PR de trabalho mergeado em develop, contrato e gate verificáveis, sem trabalho posterior ou conflito | Ready for Release. |
| Entrega comprovada em main e deploy bem-sucedido quando aplicável, sem pendência | Done e fechar como completed, confirmando as duas operações. |
| Done + issue aberta | Fechar apenas com a mesma evidência de entrega; caso contrário reportar. |
| Rejected, Canceled, fechamento incompatível, reabertura, exclusão explícita ou conflito | Preservar decisão humana; reportar se incoerente. |
| Issue aberta sem tipo ou elegível sem Priority | Reportar; não atribuir valor. Ignorar Team Access comprovado, Task e tipos não SDD. |

- Usar contratos Refs #N / Spec: NNNNN, identidade do PR e histórico Git/merge_commit_sha para vincular trabalho a releases; verificar que commits de entrega alcançam main, não depender de títulos, datas ou listas de release isoladamente. Respeitar exclusões e PRs/commits posteriores, rollback/revert e reabertura; se não for possível estabelecer o estado efetivo, não fechar. Validar deploys pelo SHA da release e workflows aplicáveis segundo os paths/regras de deploy existentes; não confundir CI com deploy nem considerar workflow ausente como sucesso quando obrigatório.
- Nenhuma escrita em snapshot incompleto relevante. Reconsultar a issue/card, evidências e blockers antes de aplicar cada proposta; não avançar se houve alteração incompatível. Em caso de falha parcial, registrar o que foi confirmado e continuar na próxima execução apenas após revalidar. Um caso inconsistente não deve impedir relatório dos demais.
- Reconciliador não executa release-sync completo (que também sincroniza branches), não cria merge, não faz push em branches protegidas nem deploy. Extrair somente regras de status/fechamento necessárias; manter sincronização de histórico no fluxo autorizado existente.

### 3. Workflow e operação

- Criar workflow independente dos required checks, acionado por schedule diário (06:17 UTC = 03:17 São Paulo na data do plano) e workflow_dispatch com dry-run por padrão. Adotar grupo de concorrência único para reconciliações do workflow, sem cancelamento de execução em andamento. Avaliar trigger seguro para PR/release concluído; usar somente código confiável da branch protegida, sem checkout/execução de código ou comandos oriundos de PRs ou comentários.
- Schedule e workflow_dispatch dependem da disponibilidade do workflow na branch padrão. Entregar via fluxo normal de PR/develop/release. Inicialmente agendamento somente de auditoria; habilitar auto-heal agendado após validar a causa raiz, permissões e execução controlada com gdev. A automação periódica de escrita deve ser efetivamente validada após essa ativação; não declarar o requisito entregue apenas com dry-run.
- Verificar permissões reais para organization Project, leitura de PRs/actions/contents e escrita de status/fechamento. Não presumir que GITHUB_TOKEN tem acesso de escrita ao Project da organização. Usar mecanismo de autenticação existente e autorizado, com menor privilégio; se indisponível, reportar bloqueio de ativação, manter auditoria/CLI assistida quando autorizada e não criar/solicitar exposição de credenciais. Não modificar proteções.
- Relatório no summary/artifact da execução com acesso e retenção restritos ao projeto, sem duplicar comentários ou registrar segredos. Falhas explícitas na execução da auditoria, não nos checks obrigatórios de PR.
- Reconciliação inicial: revalidar todos os 13 casos e evidências atuais. Executar dry-run, revisar propostas, aplicar somente as determinísticas com autorização do plano e precondições válidas, reler imediatamente e em nova rodada para confirmar que não retornaram a Backlog. As #55/#56/#57 sem tipo devem permanecer como pendência humana, não virar cards por inferência. Se causa raiz ou concorrência não estiverem resolvidas, manter escrita suspensa e reportar.
- Documentar configuração, operação, falhas, evidências, recuperação e ativação em docs/sdd-implementation.md e docs/development-workflow.md; atualizar AGENTS/CONTRIBUTING se os comandos ou regras operacionais mudarem.

## Impactos e dependências

- Arquivos previstos: scripts/sdd/core.mjs, status.mjs, from-issue.mjs, fast-track.mjs, pr-create.mjs, pr-sync.mjs, release-sync.mjs, novo reconcile.mjs/módulos de apoio e testes; .github/workflows/sdd-reconcile.yml; configuração/documentação estritamente necessárias. Sem mudanças de produto, migrations ou novas bibliotecas.
- Estado de Project e GitHub real continua fonte de verdade, com evidências complementares em commits e registros do fluxo. Sem blockers nativos na consulta inicial.
- Limitações conhecidas: causa raiz não comprovada; disponibilidade da API/histórico de workflows nativos e escopos da credencial do Actions ainda a validar. Não alterar configuração do Project em produção sem diagnóstico, autorização e verificação.
- Risco residual de corrida externa sem escrita condicional atômica: operar de modo conservador, restringir auto-heal a casos seguros comprovados; reportar o restante. Nenhuma promessa de eliminar toda inconsistência futura.

## Validação

- Usar node scripts/sdd/test.mjs e sandbox oficial com Git/PowerShell reais, GitHub simulado obrigatório, bloqueio de rede e fixtures descartáveis. Não desativar guards. Cobrir unitariamente regras de decisão e contratos de evidência, e E2E para os comandos existentes e novo reconciliador.
- Casos obrigatórios: regressão a Backlog, card ausente/existente/duplicado, status ausente, Priority e tipo faltantes, quatro tipos elegíveis, paginação e respostas incompletas, reabertura, blockers, exclusões, PR aberto durante Specifying, PR fechado sem merge, merge em develop, release/deploy pendente/falho, entrega confirmada, Done aberto, alteração concorrente, falha parcial, retry, idempotência e dry-run sem mutação.
- Cobrir cada um dos 13 casos da auditoria como fixture e registrar reconciliação real separadamente. Validar duas execuções consecutivas sem mutações adicionais e ausência de regressão na leitura posterior. Teste controlado real não faz parte da suíte automatizada; exige fixture/escopo autorizados e não toca issues não relacionadas.
- Verificar YAML/workflow, diff, suite completa SDD e contrato do PR. Não usar required check global, nem relaxar gates. Registrar bloqueios da infraestrutura ou validações indisponíveis.

## Constitution check

High Risk aprovado; spec aprovada em fb7b8c2; plano exige aprovação separada. Uma issue #95, branch e spec. Não inferir aprovação de artefatos, não criar issues de tasks e não efetuar merge/deploy nem modificar proteções. Consultar GitHub e dependências novamente antes de iniciar tasks. A reconciliação não substitui gates humanos. Status Specifying até os gates exigidos.

## Aprovação humana

Pendente. Registrar aprovação explícita do plano por um gdev, data e referência antes de tasks/implementação.
