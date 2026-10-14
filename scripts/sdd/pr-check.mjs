import { listPullRequestFiles, main, readPullRequest, validatePrContract } from './core.mjs';

main(() => {
  const [number] = process.argv.slice(2);
  const pr = readPullRequest(number);
  const files = listPullRequestFiles(number);
  const { context, requiresSpec, specId } = validatePrContract(pr, { files });
  const spec = requiresSpec ? ` Spec: ${specId}.` : '';
  console.log(`PR #${number}: contrato SDD válido para Issue #${context.issue.number}.${spec}`);
});
