import {
  currentStatus,
  listPullRequestFiles,
  main,
  project,
  readPullRequest,
  setStatusIfNeeded,
  terminalStatuses,
  validatePrContract,
} from './core.mjs';

main(() => {
  const [number] = process.argv.slice(2);
  const pr = readPullRequest(number);
  const files = listPullRequestFiles(number);
  const { context } = validatePrContract(pr, { files });
  const board = project();
  const current = currentStatus(context.issue, board);
  const terminal = terminalStatuses.includes(current);
  let target;

  if (pr.state === 'open') {
    if (terminal || current === 'Review') target = current;
    else if (current === 'In Progress') target = 'Review';
    else throw new Error(`Transição inválida para PR aberto: ${current} não pode virar Review.`);
  } else if (pr.merged) {
    if (terminal || current === 'Ready for Release') target = current;
    else if (current === 'Review') target = 'Ready for Release';
    else throw new Error(`Transição inválida para PR mergeado em develop: ${current} não pode virar Ready for Release.`);
  } else {
    if (terminal || current === 'In Progress') target = current;
    else if (current === 'Review') target = 'In Progress';
    else throw new Error(`Transição inválida para PR fechado sem merge: ${current} não pode virar In Progress.`);
  }

  const result = target === current ? { changed: false, status: current } : setStatusIfNeeded(context.issue, target, board);
  const suffix = result.changed ? '' : ' (no-op)';
  console.log(`PR #${number}: Issue #${context.issue.number} ${current} -> ${target}${suffix}`);
});
