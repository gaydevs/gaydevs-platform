// Pure policy; GitHub text and missing evidence never grant approval.
export function decide(snapshot) {
  const { issue, item, eligible, priority, evidence = {}, teamAccess = false } = snapshot;
  const number = issue.number;
  const status = item?.status ?? null;
  const result = (action, reason, target) => ({ number, status, action, reason, ...(target ? { target } : {}) });
  if (!issue.type?.name) return issue.state === 'open' && !teamAccess ? result('report', 'Issue aberta sem tipo') : result('ignore', 'Fora do SDD');
  if (!eligible) return result('ignore', 'Tipo fora do SDD');
  if (evidence.incomplete || evidence.conflict) return result('report', evidence.conflict || 'Evidência incompleta');
  if (status === 'Rejected' || status === 'Canceled') return issue.state === 'closed' && issue.state_reason === 'not_planned' ? result('noop', 'Decisão terminal preservada') : result('report', 'Decisão terminal divergente; revisão humana');
  if (issue.state === 'closed' && issue.state_reason !== 'completed') return result('report', 'Issue encerrada sem entrega; preservar decisão');
  if (evidence.reopened || evidence.excluded || evidence.pendingWork || (evidence.blocked && (item || evidence.activity))) return result('report', 'Reabertura, exclusão, trabalho posterior ou blocker');
  if (evidence.delivered && (issue.state === 'open' || issue.state_reason === 'completed')) {
    if (status === 'Done' && issue.state === 'closed') return result('noop', 'Entrega e fechamento coerentes');
    if (status === 'Done') return result('close', 'Entrega comprovada; fechamento pendente', 'Done');
    return result('finish', 'Entrega e ausência de pendências comprovadas', 'Done');
  }
  if (status === 'Done' && issue.state === 'closed' && issue.state_reason === 'completed') return result('noop', 'Estado terminal coerente');
  if (status === 'Done' || issue.state === 'closed') return result('report', 'Entrega ou fechamento não comprovado');
  if (evidence.specifying && [null, 'Backlog'].includes(status)) return result('status', 'Especificação vigente comprovada', 'Specifying');
  if (!priority) return result('report', 'Priority ausente');
  if (evidence.gates && evidence.workPr === 'merged' && ['Backlog','Specifying','Ready','In Progress','Review',null].includes(status)) return result('status', 'PR mergeado em develop com gates comprovados', 'Ready for Release');
  if (evidence.gates && evidence.workPr === 'open' && status === 'In Progress') return result('status', 'PR aberto após implementação autorizada', 'Review');
  if (evidence.gates && evidence.workPr === 'closed' && status === 'Review') return result('status', 'PR fechado sem merge', 'In Progress');
  if (!item && !evidence.activity) return result('status', 'Issue elegível sem card e sem trabalho iniciado', 'Backlog');
  if (status === null && !evidence.activity) return result('status', 'Status ausente sem trabalho iniciado', 'Backlog');
  if ((status === 'Backlog' || status === null) && evidence.activity) return result('report', 'Atividade detectada; etapa não comprovada');
  if (status === 'Ready for Release' && !evidence.delivered) return result('report', 'Entrega ainda não comprovada');
  return result('noop', 'Nenhuma correção determinística');
}
