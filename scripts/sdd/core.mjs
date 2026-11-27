import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const config = JSON.parse(readFileSync(path.join(root, '.github/sdd.json'), 'utf8'));
const windowsGh = 'C:/Program Files/GitHub CLI/gh.exe';
export const ghBinary = process.env.GH_BIN || (process.platform === 'win32' && existsSync(windowsGh) ? windowsGh : 'gh');
export function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: root, input, encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${command} failed (${result.status})`);
  return result.stdout.trim();
}
export const git = (...args) => run('git', args);
export function api(endpoint, { method = 'GET', body, paginate = false, version = '2026-03-10' } = {}) {
  const args = ['api', endpoint, '-X', method, '-H', `X-GitHub-Api-Version: ${version}`];
  if (paginate) args.push('--paginate', '--slurp');
  if (body !== undefined) args.push('--input', '-');
  // Retry reads only. Mutations may already have reached GitHub even if
  // the response was lost, so a caller must re-read before trying again.
  const readOnly = method === 'GET' || (endpoint === 'graphql' && /^query\b|^query\(/.test(body?.query || ''));
  let value;
  for (let attempt=1; ; attempt++) {
    try {
      value=JSON.parse(run(ghBinary,args,body===undefined?undefined:JSON.stringify(body)) || 'null');
      break;
    } catch (error) {
      // A rate limit with no reliable Retry-After is reported instead of
      // retrying blindly. Only explicit transient transport/5xx errors retry.
      if (!readOnly || attempt>=3 || !/HTTP (502|503|504)\b|ETIMEDOUT|ECONNRESET/i.test(error.message)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250*attempt);
    }
  }
  if (paginate && (!Array.isArray(value) || value.some(page => !Array.isArray(page)))) throw new Error('Resposta paginada incompleta ou inválida.');
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
export const fastTrackRiskLevels = ['low', 'medium', 'high'];
export function fastTrackRisk(value) {
  const risk = String(value || '').toLowerCase();
  if (!fastTrackRiskLevels.includes(risk)) throw new Error('Risk deve ser low, medium ou high.');
  return risk;
}
export function sddIdentity(issue, { fastTrack = false, trivial = false, requireOpen = true } = {}) {
  const type = issue.type?.name;
  const prefix = config.types[type];
  if (!prefix) throw new Error('Issue fora do SDD: exige tipo nativo suportado.');
  if (issue.pull_request) throw new Error('O número pertence a um PR.');
  if (requireOpen && issue.state !== 'open') throw new Error('A Issue precisa estar aberta para iniciar trabalho.');
  const compact = fastTrack || trivial;
  const id = String(issueNumber(issue.number)).padStart(5, '0');
  const slug = issue.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '') || 'issue';
  return { id, type, branch: `${prefix}/${id}-${slug}`, directory: `specs/${id}-${slug}`, needsSpec: !compact };
}
export function identity(issue, fastTrack = false) {
  return sddIdentity(issue, { fastTrack });
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
export function localSpecDirectory(number) {
  const specs = path.join(root, 'specs');
  if (!existsSync(specs)) return null;
  const id = specIdForIssue(number);
  const matches = readdirSync(specs, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${id}-`) && existsSync(path.join(specs, entry.name, 'spec.md')));
  if (matches.length > 1) throw new Error(`Mais de uma spec encontrada para ${id}.`);
  return matches.length === 1 ? path.join(specs, matches[0].name) : null;
}
export function localSpecExists(number) {
  return Boolean(localSpecDirectory(number));
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
export function projectItem(issue, board = project()) {
  const items = [];
  let cursor = null;
  do {
    const data = graphql('query($issue:ID!,$cursor:String){node(id:$issue){... on Issue{projectItems(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id isArchived project{id} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}', { issue: issue.node_id, cursor });
    const page = data.node?.projectItems;
    if (!page || !Array.isArray(page.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw new Error('Project: leitura incompleta.');
    items.push(...page.nodes.filter(item => item.project.id === board.id));
    if (!page.pageInfo.hasNextPage) break;
    const next = page.pageInfo.endCursor;
    if (!next || next === cursor) throw new Error('Project: cursor inválido.');
    cursor = next;
  } while (true);
  if (items.length > 1) throw new Error('Project: cards duplicados.');
  return items.length ? { id: items[0].id, status: items[0].fieldValueByName?.name ?? null, archived: Boolean(items[0].isArchived) } : null;
}
export function setStatus(issue, status, board = project(), { expected } = {}) {
  if (!config.statuses.includes(status)) throw new Error('Status desconhecido.');
  const field = board.fields.nodes.find(field => field.name === 'Status');
  const option = field?.options.find(option => option.name === status);
  if (!option) throw new Error('Status ' + status + ' não configurado no Project.');
  let item = projectItem(issue, board);
  if (item?.archived) throw new Error('Project: card arquivado; revisão humana necessária.');
  if (expected !== undefined && (item?.status ?? null) !== expected) throw new Error('Conflito: Status mudou antes da alteração.');
  if (item?.status === status) return { changed: false, status };
  if (!item) {
    const added = graphql('mutation($project:ID!,$issue:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$issue}){item{id}}}', { project: board.id, issue: issue.node_id });
    item = projectItem(issue, board);
    if (!item || item.id !== added.addProjectV2ItemById?.item?.id) throw new Error('Project: inclusão não confirmada.');
    if (item.status === status) return { changed: true, status };
    if (item.status && item.status !== 'Backlog') throw new Error('Conflito: card inicializado com Status diferente.');
  }
  const latest = projectItem(issue, board);
  if (!latest || latest.archived || latest.id !== item.id || latest.status !== item.status) throw new Error('Conflito: card mudou antes da escrita.');
  graphql('mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option}}){projectV2Item{id}}}', { project: board.id, item: item.id, field: field.id, option: option.id });
  const verified = projectItem(issue, board);
  if (verified?.id !== item.id || verified.archived || verified.status !== status) throw new Error('Project: Status não persistido ou alteração concorrente.');
  return { changed: true, status };
}
export function setStatusIfNeeded(issue, status, board = project(), options = {}) {
  const current = currentStatus(issue, board);
  return setStatus(issue, status, board, { expected: options.expected ?? current });
}
export function currentStatus(issue, board = project()) {
  const value = projectItem(issue, board)?.status;
  if (!value) throw new Error('Status atual não encontrado no Project.');
  return value;
}
export function statusHistory(issue, board = project()) {
  let cursor = null;
  const seen = new Set();
  const events = [];
  do {
    const data = graphql('query($issue:ID!,$cursor:String){node(id:$issue){... on Issue{timelineItems(first:100,after:$cursor,itemTypes:[PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]){pageInfo{hasNextPage endCursor} nodes{... on ProjectV2ItemStatusChangedEvent{id createdAt previousStatus status actor{login} project{id}}}}}}}', {issue:issue.node_id,cursor});
    const page = data.node?.timelineItems;
    if (!page || !Array.isArray(page.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw new Error('Histórico de Status incompleto.');
    events.push(...page.nodes.filter(e=>e.project?.id===board.id));
    if (!page.pageInfo.hasNextPage) break;
    cursor=page.pageInfo.endCursor;
    if (!cursor || seen.has(cursor)) throw new Error('Cursor de histórico inválido.');
    seen.add(cursor);
  } while (true);
  return events;
}
export function assertPriority(context) {
  const field = context.fields.find(f => f.issue_field_id === config.priorityFieldId || f.issue_field_name === 'Priority');
  if (!['High', 'Medium', 'Low'].includes(field?.single_select_option?.name)) throw new Error('Defina Priority na Issue antes de iniciar.');
}
export const terminalStatuses = ['Rejected', 'Canceled', 'Done'];
function closeIssue(issue, reason) {
  const endpoint = 'repos/' + config.repository + '/issues/' + issueNumber(issue.number);
  const current = api(endpoint);
  if (current.state === 'closed' && current.state_reason === reason) return current;
  if (current.state !== 'open' || (issue.updated_at && current.updated_at !== issue.updated_at)) throw new Error('Conflito: Issue mudou antes do fechamento.');
  api(endpoint, { method: 'PATCH', body: { state: 'closed', state_reason: reason } });
  const verified = api(endpoint);
  if (verified.state !== 'closed' || verified.state_reason !== reason) throw new Error('Fechamento da Issue não confirmado.');
  return verified;
}
export function closeNotPlanned(issue) { return closeIssue(issue, 'not_planned'); }
export function closeCompleted(issue) { return closeIssue(issue, 'completed'); }
export function main(fn) { try { fn(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
