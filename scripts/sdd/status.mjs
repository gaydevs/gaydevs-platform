import { main, readIssue, identity, sddIdentity, assertUnblocked, project, currentStatus, setStatus, closeNotPlanned } from './core.mjs';
main(() => {
  const [number, status] = process.argv.slice(2);
  const context = readIssue(number);
  const activeStatuses = ['Backlog', 'Specifying', 'Ready', 'In Progress'];
  const notPlannedStatuses = ['Rejected', 'Canceled'];
  if (![...activeStatuses, ...notPlannedStatuses].includes(status)) throw new Error('Esta fase opera apenas Backlog, Specifying, Ready, In Progress, Rejected e Canceled.');
  if (notPlannedStatuses.includes(status)) {
    sddIdentity(context.issue, { requireOpen: false });
    if (context.issue.state === 'closed' && context.issue.state_reason !== 'not_planned') throw new Error('Issue já encerrada com motivo diferente de Not planned.');
    const board = project();
    const current = currentStatus(context.issue, board);
    const allowed = {
      Rejected: ['Backlog', 'Specifying'],
      Canceled: ['Ready', 'In Progress', 'Review', 'Ready for Release'],
    };
    if (current !== status && !allowed[status].includes(current)) throw new Error(`Transição inválida: ${current} não pode virar ${status}.`);
    setStatus(context.issue, status, board, { expected: current });
    closeNotPlanned(readIssue(context.issue.number).issue);
    console.log(`Issue #${number}: ${status} (Issue encerrada como Not planned)`);
    return;
  } else {
    identity(context.issue);
  }
  if (['Ready', 'In Progress'].includes(status)) {
    assertUnblocked(context);
    if (!process.argv.includes('--human-approved')) throw new Error('Confirme os gates humanos com --human-approved; o agente não pode conceder aprovação.');
  }
  setStatus(context.issue, status);
  console.log(`Issue #${number}: ${status}`);
});
