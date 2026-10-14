import {
  closeCompleted,
  compareCommits,
  config,
  currentStatus,
  issueNumber,
  listPullRequests,
  main,
  parsePrContract,
  project,
  readIssue,
  readPullRequest,
  setStatusIfNeeded,
  terminalStatuses,
  validatePrContract,
} from './core.mjs';

function excludedIssues(args) {
  const excluded = new Set();
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== '--exclude-issue') throw new Error('Argumento inválido. Use --exclude-issue NUMERO.');
    excluded.add(issueNumber(args[index + 1]));
  }
  return excluded;
}

main(() => {
  const [number, ...args] = process.argv.slice(2);
  const excluded = excludedIssues(args);
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

  const mergedDevelopPrs = listPullRequests({ base: config.baseBranch, state: 'closed' })
    .filter(pr => pr.merged_at);
  const board = project();

  const untraceableReady = [];
  for (const pr of mergedDevelopPrs.filter(pr => !pr.merge_commit_sha)) {
    let contract;
    try { contract = parsePrContract(pr.body || ''); }
    catch { continue; }
    if (excluded.has(contract.issueNumber)) continue;
    const result = validatePrContract(pr, { requireBase: config.baseBranch });
    if (currentStatus(result.context.issue, board) === 'Ready for Release') {
      untraceableReady.push({ pr, issue: result.context.issue });
    }
  }
  if (untraceableReady.length) {
    throw new Error(`PRs SDD em Ready for Release sem merge_commit_sha rastreável: ${untraceableReady.map(entry => `#${entry.pr.number}/Issue #${entry.issue.number}`).join(', ')}`);
  }

  const workPrs = mergedDevelopPrs.filter(pr => pr.merge_commit_sha && delivered.has(pr.merge_commit_sha));
  if (!workPrs.length) throw new Error('Nenhum PR de trabalho com merge_commit_sha rastreável encontrado no release.');

  const byIssue = new Map();
  const foundExclusions = new Set();
  for (const pr of workPrs) {
    const contract = parsePrContract(pr.body || '');
    if (excluded.has(contract.issueNumber)) {
      foundExclusions.add(contract.issueNumber);
      continue;
    }
    const result = validatePrContract(pr, { requireBase: config.baseBranch });
    byIssue.set(result.context.issue.number, { pr, context: result.context });
  }
  const missingExclusions = [...excluded].filter(number => !foundExclusions.has(number));
  if (missingExclusions.length) throw new Error(`Exclusões não encontradas no release: ${missingExclusions.map(number => `#${number}`).join(', ')}.`);

  const candidates = [...byIssue.values()].map(entry => ({ ...entry, status: currentStatus(entry.context.issue, board) }));
  const invalid = candidates.filter(entry => !['Ready for Release', ...terminalStatuses].includes(entry.status));
  if (invalid.length) {
    throw new Error(`Issues em estado incompatível para release: ${invalid.map(entry => `#${entry.context.issue.number} (${entry.status})`).join(', ')}`);
  }

  let changed = 0;
  for (const entry of candidates) {
    if (entry.status === 'Done') {
      const latest = readIssue(entry.context.issue.number).issue;
      if (latest.state !== 'closed' || latest.state_reason !== 'completed') {
        closeCompleted(latest);
        changed += 1;
      }
      continue;
    }
    if (entry.status !== 'Ready for Release') continue;
    const status = setStatusIfNeeded(entry.context.issue, 'Done', board);
    closeCompleted(entry.context.issue);
    if (status.changed || entry.context.issue.state !== 'closed' || entry.context.issue.state_reason !== 'completed') changed += 1;
  }

  const exclusions = excluded.size ? ` Excluídas explicitamente: ${[...excluded].map(number => `#${number}`).join(', ')}.` : '';
  console.log(`PR #${number}: ${candidates.length} Issue(s) SDD descoberta(s), ${changed} finalizada(s).${exclusions}`);
});
