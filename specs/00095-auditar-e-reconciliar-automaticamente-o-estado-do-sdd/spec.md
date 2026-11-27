# 00095 — Auditar e reconciliar automaticamente o estado do SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/95
Estado: spec e risco High aprovados; plano pendente de aprovação.
Risco aprovado: High (automações com escrita no Project, fechamento de issues e impacto sobre gates humanos).
Prioridade: Medium, conforme GitHub; sem blockers na consulta inicial.

## Problema e objetivo

O estado do Project pode divergir da etapa efetiva do SDD, inclusive após scripts informarem sucesso. A auditoria de 27/11/2026 identificou 13 inconsistências em 44 cards e nas issues ausentes. Prevenir regressões na origem e reconciliar automaticamente somente o que for comprovável, sem substituir aprovações humanas.

## Escopo e comportamento

### P1 — Transições confiáveis
- Investigar causa raiz com evidência reproduzível, incluindo automações nativas e scripts. A chamada de adição repetida é uma hipótese, não causa comprovada.
- Operações sobre cards existentes reutilizam o item; inclusão ocorre somente se ausente.
- Toda alteração é verificada por leitura remota. Falha, conflito ou resultado inconclusivo são informados; nunca declarar sucesso sem confirmação.
- Operações repetidas não duplicam cards nem revertem estados válidos. Em concorrência, mudanças humanas mais recentes são preservadas; se não for possível demonstrar segurança, não escrever.
- Fluxos from-issue, status, fast-track, pr-create, pr-sync e release-sync mantêm seus contratos e gates. from-issue --start recusa issue sem Priority.

### P1 — Reconciliação segura
- Auditar issues, Project, tipo/Priority, dependências, branches, specs, planos, tasks, evidências de aprovações, PRs vinculados, releases e deploys quando aplicável.
- Adicionar cards elegíveis ausentes. Restaurar status ausente ou incorreto somente com evidência determinística; caso contrário, emitir pendência humana.
- Uma issue com trabalho de especificação comprovado pode retornar a Specifying. A existência de branch, spec ou PR por si só não comprova aprovação nem autoriza promoção.
- PR aberto durante revisão de spec ou escalonamento de risco não autoriza Review. PR mergeado em develop pode justificar Ready for Release se não houver trabalho posterior ou conflito de gates.
- Done exige entrega rastreável em main e deploy bem-sucedido quando aplicável, sem trabalho pendente. Encerrar como completed após verificar esses requisitos; reparar fechamento pendente mesmo quando o card já está em Done. Em falha parcial, retomar sem repetir alterações concluídas.
- Respeitar exclusões, blockers, reaberturas, cancelamentos e rejeições. Não inferir aprovação, reabrir, cancelar, definir tipo ou prioridade arbitrariamente.
- Sinalizar issues abertas sem tipo e elegíveis sem Priority. Ignorar Team Access, Task e tipos fora do SDD. Verificar disponibilidade do campo Priority nos quatro tipos elegíveis.

### P2 — Operação
- Execução agendada e manual, com modo dry-run sem mutações. Reportar evidências, alterações propostas/executadas, conflitos, erros e pendências humanas; paginar todos os recursos relevantes.
- Falhas transitórias têm tratamento limitado e verificável. Falta de evidência ou permissão resulta em relatório, não promoção.
- Auditoria global independente dos required checks; preservar revisão humana e proteções existentes. A rotina não faz merge/deploy.
- Usar apenas permissões autorizadas; nenhuma credencial criada ou proteção contornada.
- Revalidar e documentar os 13 casos iniciais antes de corrigir. Casos ambíguos não são alterados.

## Requisitos verificáveis

- REQ-001: transições persistidas e relidas, idempotentes, sem adição redundante e com tratamento de conflitos.
- REQ-002: reconciliação determinística de card ausente, status ausente/incorreto, PR e release, conforme evidências e gates.
- REQ-003: consistência entre Done e fechamento completed; nenhuma decisão terminal automática sem evidência.
- REQ-004: sinalização de tipo/Priority faltantes e bloqueio local de início sem Priority.
- REQ-005: execução agendada/manual, dry-run, relatório e recuperação de falha parcial.
- REQ-006: testes unitários, regressão e E2E em sandbox, sem mutações reais por testes automatizados.
- REQ-007: reconciliação inicial controlada com evidência de cada ação ou pendência humana.

## Critérios de aceite

- Dado #113 e #115 com evidência de especificação vigente, quando reconciliadas, então Specifying é restaurado sem inferir aprovação; um PR aberto da #115 não altera essa decisão.
- Dado #114 e #117 com release #119 e deploys comprovados, quando a evidência atual confirmar ausência de pendências, então cards Done e issues completed.
- Dadas #29, #60, #66, #68, #98 e #102 em Done mas abertas, quando entrega e ausência de trabalho pendente forem comprovadas, então fechamento completed; caso contrário relatório de pendência.
- Dadas #55, #56 e #57 sem tipo, então sinalização, sem atribuir tipo automaticamente.
- Dado card existente ou atualização repetida, então nenhum item duplicado e nenhuma regressão indevida; causa raiz identificada, corrigida e coberta por regressão.
- Dado PR fechado sem merge, release/deploy pendente ou falho, blocker, exclusão, reabertura ou aprovação ausente, então não promover indevidamente.
- Dada falha parcial, rate limit, paginação ou concorrência, então execução limitada, verificável e retomável, sem falso sucesso.
- Dado dry-run, então nenhuma mutação; dado workflow periódico/manual, então relatório claro e nenhum bloqueio global de PR.
- Todos os cenários acima e as regressões dos scripts SDD passam na sandbox; reconciliação real inicial documentada separadamente.

## Dependências e questões abertas

- Sem blockers nativos na consulta inicial.
- Confirmar a causa raiz da regressão de status: ainda não comprovada.
- Definir no plano como obter evidências confiáveis de gates e entrega, lidar com ausência de evidências e validar permissões para Project e workflow sem ampliar privilégios.
- Definir frequência, relatório, estratégia de concorrência e reconciliação inicial no plano. Qualquer mudança de configuração nativa exige evidência e autorização compatível.

## Aprovação humana

Spec e risco High aprovados explicitamente pelo gdev solicitante em 27/11/2026, resposta "aprova" à spec publicada em fb7b8c2. Plano requer aprovação separada antes de tasks e implementação.
