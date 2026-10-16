import {
  api,
  config,
  currentSddBranch,
  localSpecExists,
  main,
  publishedBranch,
  readIssue,
  sddIdentity,
  specIdForIssue,
  parsePrContract,
} from './core.mjs';

function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!['--title', '--body'].includes(flag)) throw new Error(`Opção desconhecida: ${flag}`);
    if (Object.hasOwn(options, flag)) throw new Error(`Opção repetida: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Informe um valor para ${flag}.`);
    options[flag] = value;
  }
  return options;
}

main(() => {
  const options = parseArguments(process.argv.slice(2));
  const { branch, prefix, issueNumber } = currentSddBranch();
  const context = readIssue(issueNumber);
  const identity = sddIdentity(context.issue);
  if (identity.branch.split('/')[0] !== prefix) {
    throw new Error(`Prefixo ${prefix} não corresponde ao tipo ${identity.type} da Issue #${issueNumber}.`);
  }

  const hasSpec = localSpecExists(issueNumber);
  if (identity.type === 'Feature' && !hasSpec) {
    throw new Error(`Feature #${issueNumber} exige uma spec specs/${specIdForIssue(issueNumber)}-*/spec.md.`);
  }
  const specId = hasSpec ? specIdForIssue(issueNumber) : undefined;
  const references = [specId && `Spec: ${specId}`, `Refs #${issueNumber}`].filter(Boolean).join('\n');
  const additionalBody = options['--body'];
  const body = additionalBody === undefined ? references : `${additionalBody}\n\n${references}`;
  const contract = parsePrContract(body);
  if (contract.issueNumber !== issueNumber || contract.specId !== specId) {
    throw new Error('O texto adicional conflita com as referências SDD obrigatórias.');
  }
  if (!publishedBranch(branch)) throw new Error(`A branch ${branch} ainda não está publicada em origin.`);

  const pull = api(`repos/${config.repository}/pulls`, {
    method: 'POST',
    body: {
      title: options['--title'] || context.issue.title,
      head: branch,
      base: config.baseBranch,
      body,
    },
  });
  if (!pull?.number || !pull.html_url) throw new Error('GitHub não retornou os dados esperados para o PR criado.');
  console.log(`PR #${pull.number} criado: ${pull.html_url}`);
});
