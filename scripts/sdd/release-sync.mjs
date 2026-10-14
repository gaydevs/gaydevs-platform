import {
  closeCompleted,
  compareCommits,
  config,
  currentStatus,
  listPullRequests,
  main,
  project,
  readPullRequest,
  setStatusIfNeeded,
  terminalStatuses,
  validatePrContract,
} from './core.mjs';

main(() => {
  const [number] = process.argv.slice(2);
  const release = readPullRequest(number);
  if (release.base?.ref !== 'main' || release.head?.ref !== config.baseBranch) throw new Error('Release sync exige PR develop -> main.');
  if (release.state !== 'closed') throw new Error('Release sync exige PR fechado.');
  if (!release.merged) {
    console.log(`PR #${number}: fechado sem merge; nenhuma alteração.`);
    return;
  }
  if (!release.base?.sha || !release.merge_commit_sha) throw new Error('PR de release sem base.sha ou merge_commit_sha rastreável.');

  const comparison = compareCommits(release.base.sha, release.merge_commit_sha);
  const delivered = new Set((comparison.commits || []).map(commit => commit.sha));
  if (!delivered.size) throw new Error('Intervalo de release sem commits rastreáveis.');

  const workPrs = listPullRequests({ base: config.baseBranch, state: 'closed' })
    .filter(pr => pr.merged_at && pr.merge_commit_sha && delivered.has(pr.merge_commit_sha));
  if (!workPrs.length) throw new Error('Nenhum PR de trabalho com merge_commit_sha rastreável encontrado no release.');

  const byIssue = new Map();
  for (const pr of workPrs) {
    const result = validatePrContract(pr, { requireBase: config.baseBranch });
    byIssue.set(result.context.issue.number, { pr, context: result.context });
  }

  const board = project();
  const candidates = [...byIssue.values()].map(entry => ({ ...entry, status: currentStatus(entry.context.issue, board) }));
  const invalid = candidates.filter(entry => !['Ready for Release', ...terminalStatuses].includes(entry.status));
  if (invalid.length) {
    throw new Error(`Issues em estado incompatível para release: ${invalid.map(entry => `#${entry.context.issue.number} (${entry.status})`).join(', ')}`);
  }

  let changed = 0;
  for (const entry of candidates) {
    if (entry.status !== 'Ready for Release') continue;
    const status = setStatusIfNeeded(entry.context.issue, 'Done', board);
    closeCompleted(entry.context.issue);
    if (status.changed || entry.context.issue.state !== 'closed' || entry.context.issue.state_reason !== 'completed') changed += 1;
  }

  console.log(`PR #${number}: ${candidates.length} Issue(s) SDD descoberta(s), ${changed} finalizada(s).`);
});
