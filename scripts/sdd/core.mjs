import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const config = JSON.parse(readFileSync(path.join(root, '.github/sdd.json'), 'utf8'));
const windowsGh = 'C:/Program Files/GitHub CLI/gh.exe';
export const ghBinary = process.env.GH_BIN || (process.platform === 'win32' && existsSync(windowsGh) ? windowsGh : 'gh');
export function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: root, input, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${command} failed (${result.status})`);
  return result.stdout.trim();
}
export const git = (...args) => run('git', args);
export function api(endpoint, { method = 'GET', body, paginate = false, version = '2026-03-10' } = {}) {
  const args = ['api', endpoint, '-X', method, '-H', `X-GitHub-Api-Version: ${version}`];
  if (paginate) args.push('--paginate', '--slurp');
  if (body !== undefined) args.push('--input', '-');
  const value = JSON.parse(run(ghBinary, args, body === undefined ? undefined : JSON.stringify(body)) || 'null');
  return paginate ? value.flat() : value;
}
export function graphql(query, variables = {}) {
  const response = api('graphql', { method: 'POST', body: { query, variables } });
  if (response.errors) throw new Error(JSON.stringify(response.errors));
  return response.data;
}
export function issueNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Informe um número positivo de Issue.');
  return Number(value);
}
export function sddIdentity(issue, { trivial = false, requireOpen = true } = {}) {
  const type = issue.type?.name;
  const prefix = config.types[type];
  // The form marker also allows agents to create an equivalent issue through the API.
  if (!prefix || !issue.body?.includes(`<!-- gaydevs-sdd:${type} -->`)) throw new Error('Issue fora do SDD: exige tipo nativo e marcador do form correspondente.');
  if (issue.pull_request) throw new Error('O número pertence a um PR.');
  if (requireOpen && issue.state !== 'open') throw new Error('A Issue precisa estar aberta para iniciar trabalho.');
  if (trivial && type === 'Feature') throw new Error('Feature sempre exige spec.');
  const id = String(issueNumber(issue.number)).padStart(5, '0');
  const slug = issue.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '') || 'issue';
  return { id, type, branch: `${prefix}/${id}-${slug}`, directory: `specs/${id}-${slug}`, needsSpec: !trivial };
}
export function identity(issue, trivial = false) {
  return sddIdentity(issue, { trivial });
}
export function readIssue(number) {
  const endpoint = `repos/${config.repository}/issues/${issueNumber(number)}`;
  const issue = api(endpoint);
  return {
    issue,
    comments: api(`${endpoint}/comments?per_page=100`, { paginate: true }),
    fields: api(`${endpoint}/issue-field-values?per_page=100`, { paginate: true }),
    blockedBy: api(`${endpoint}/dependencies/blocked_by?per_page=100`, { paginate: true }),
    blocking: api(`${endpoint}/dependencies/blocking?per_page=100`, { paginate: true }),
  };
}
export function readPullRequest(number) {
  const endpoint = `repos/${config.repository}/pulls/${issueNumber(number)}`;
  const pull = api(endpoint);
  if (!pull.merged || pull.merge_commit_sha) return pull;
  return api(endpoint, { version: '2022-11-28' });
}
export function listPullRequests({ base, state = 'closed' } = {}) {
  const query = new URLSearchParams({ state, per_page: '100' });
  if (base) query.set('base', base);
  const endpoint = `repos/${config.repository}/pulls?${query}`;
  const pulls = api(endpoint, { paginate: true });
  if (!pulls.some(pull => pull.merged_at && !pull.merge_commit_sha)) return pulls;
  return api(endpoint, { paginate: true, version: '2022-11-28' });
}
export function listPullRequestFiles(number) {
  return api(`repos/${config.repository}/pulls/${issueNumber(number)}/files?per_page=100`, { paginate: true });
}
export function compareCommits(base, head) {
  const perPage = 100;
  let first;
  const commits = [];
  for (let page = 1; ; page += 1) {
    const comparison = api(`repos/${config.repository}/compare/${base}...${head}?per_page=${perPage}&page=${page}`);
    first ||= comparison;
    const pageCommits = comparison.commits || [];
    commits.push(...pageCommits);
    if (pageCommits.length < perPage) break;
  }
  const total = first?.total_commits;
  if (Number.isInteger(total) && commits.length !== total) {
    throw new Error(`Compare incompleto: ${commits.length} de ${total} commits coletados.`);
  }
  return { ...first, commits, total_commits: total ?? commits.length };
}
export function parsePrContract(body = '') {
  const refs = [...body.matchAll(/(?:^|\n)Refs #([1-9]\d*)\b/g)].map(match => Number(match[1]));
  if (refs.length !== 1) throw new Error('PR deve conter exatamente um Refs #ID.');
  const closing = /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#([1-9]\d*)\b/i.exec(body);
  if (closing) throw new Error('PR para develop não pode usar Closes/Fixes/Resolves para Issue SDD.');
  const specs = [...body.matchAll(/(?:^|\n)Spec:\s*(\d{5,})\b/g)].map(match => match[1]);
  if (specs.length > 1) throw new Error('PR deve conter no máximo um Spec: NNNNN.');
  return { issueNumber: refs[0], specId: specs[0] };
}
export function specIdForIssue(number) {
  return String(issueNumber(number)).padStart(5, '0');
}
export function prFilesIncludeSpec(files, number) {
  const id = specIdForIssue(number);
  return files.some(file => file.filename?.startsWith(`specs/${id}-`) && file.filename.endsWith('/spec.md'));
}
export function localSpecExists(number) {
  const specs = path.join(root, 'specs');
  if (!existsSync(specs)) return false;
  const id = specIdForIssue(number);
  const matches = readdirSync(specs, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${id}-`) && existsSync(path.join(specs, entry.name, 'spec.md')));
  if (matches.length > 1) throw new Error(`Mais de uma spec encontrada para ${id}.`);
  return matches.length === 1;
}
export function currentSddBranch() {
  const branch = git('branch', '--show-current');
  const match = branch.match(/^(feat|fix|refactor|techdebt)\/(\d{5,})-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (!match) throw new Error('Branch atual inválida: use prefixo SDD, ID com ao menos cinco dígitos e slug.');
  const number = Number(match[2]);
  return { branch, prefix: match[1], issueNumber: issueNumber(number) };
}
export function publishedBranch(branch) {
  return git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).length > 0;
}
export function validatePrContract(pr, { files, requireBase = config.baseBranch } = {}) {
  if (requireBase && pr.base?.ref !== requireBase) throw new Error(`PR deve apontar para ${requireBase}.`);
  const contract = parsePrContract(pr.body || '');
  const context = readIssue(contract.issueNumber);
  const identity = sddIdentity(context.issue, { requireOpen: false });
  const hasSpec = localSpecExists(contract.issueNumber) || (files ? prFilesIncludeSpec(files, contract.issueNumber) : Boolean(contract.specId));
  const requiresSpec = identity.type === 'Feature' || hasSpec;
  if (requiresSpec && !contract.specId) throw new Error('Trabalho com spec exige exatamente um Spec: NNNNN.');
  if (!requiresSpec && contract.specId) throw new Error('Spec: NNNNN só deve ser informado quando houver spec.');
  if (contract.specId && contract.specId !== specIdForIssue(contract.issueNumber)) throw new Error('Spec: NNNNN deve corresponder ao mesmo ID de Refs #ID.');
  return { ...contract, context, identity, requiresSpec };
}
export function assertUnblocked(context) {
  const open = context.blockedBy.filter(issue => issue.state === 'open');
  if (open.length) throw new Error(`Blockers abertos: ${open.map(issue => issue.html_url).join(', ')}`);
}
export function project() {
  if (!config.projectNumber) throw new Error('Project ainda não configurado em .github/sdd.json.');
  const data = graphql(`query($org:String!,$number:Int!){organization(login:$org){projectV2(number:$number){id title fields(first:100){nodes{... on ProjectV2SingleSelectField{id name options{id name}}}}}}}`, { org: config.organization, number: config.projectNumber });
  const value = data.organization?.projectV2;
  if (!value || value.title !== config.projectTitle) throw new Error('Project configurado não encontrado ou título divergente.');
  return value;
}
export function setStatus(issue, status, board = project()) {
  if (!config.statuses.includes(status)) throw new Error('Status desconhecido.');
  const field = board.fields.nodes.find(field => field.name === 'Status');
  const option = field?.options.find(option => option.name === status);
  if (!option) throw new Error(`Status ${status} não configurado no Project.`);
  const added = graphql(`mutation($project:ID!,$issue:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$issue}){item{id}}}`, { project: board.id, issue: issue.node_id });
  graphql(`mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option}}){projectV2Item{id}}}`, { project: board.id, item: added.addProjectV2ItemById.item.id, field: field.id, option: option.id });
}
export function setStatusIfNeeded(issue, status, board = project()) {
  const current = currentStatus(issue, board);
  if (current === status) return { changed: false, status: current };
  setStatus(issue, status, board);
  return { changed: true, status };
}
export function currentStatus(issue, board = project()) {
  const data = graphql(`query($issue:ID!){node(id:$issue){... on Issue{projectItems(first:100){nodes{id project{id} fieldValues(first:100){nodes{... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2SingleSelectField{id name}}}}}}}}}}`, { issue: issue.node_id });
  const item = data.node?.projectItems.nodes.find(item => item.project.id === board.id);
  const value = item?.fieldValues.nodes.find(value => value.field?.name === 'Status');
  if (!value?.name) throw new Error('Status atual não encontrado no Project.');
  return value.name;
}
export const terminalStatuses = ['Rejected', 'Canceled', 'Done'];
export function closeNotPlanned(issue) {
  if (issue.state === 'closed' && issue.state_reason === 'not_planned') return issue;
  return api(`repos/${config.repository}/issues/${issueNumber(issue.number)}`, {
    method: 'PATCH',
    body: { state: 'closed', state_reason: 'not_planned' },
  });
}
export function closeCompleted(issue) {
  if (issue.state === 'closed' && issue.state_reason === 'completed') return issue;
  return api(`repos/${config.repository}/issues/${issueNumber(issue.number)}`, {
    method: 'PATCH',
    body: { state: 'closed', state_reason: 'completed' },
  });
}
export function main(fn) { try { fn(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
