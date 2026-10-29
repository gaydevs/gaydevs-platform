// Stateful gh boundary for tests only. Every response comes from local fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.SDD_SANDBOX_BASE;
if (!base || process.env.GH_BIN !== path.join(base, 'fake-gh')) throw new Error('Mandatory fake gh missing');
const args = process.argv.slice(2);
const file = path.join(base, 'github.json');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const flag = name => args[args.indexOf(name) + 1];
const method = args.includes('-X') ? flag('-X') : 'GET';
const endpoint = args[1];
const body = args.includes('--input') ? JSON.parse(fs.readFileSync(0, 'utf8')) : undefined;
const call = { method, endpoint, body, args };
fs.appendFileSync(path.join(base, 'github-calls.jsonl'), JSON.stringify(call) + '\n');
const save = () => fs.writeFileSync(file, JSON.stringify(state));
const output = value => process.stdout.write(value === undefined ? '' : JSON.stringify(value));
function pages(values) {
  const chunks = values.length ? values.map(value => [value]) : [[]];
  return args.includes('--paginate') ? (args.includes('--slurp') ? chunks : values) : chunks[0];
}
function serve() {
  assert.equal(args[0], 'api', 'Only gh api is allowed');
  const version = flag('-H');
  assert.ok(['X-GitHub-Api-Version: 2026-03-10', 'X-GitHub-Api-Version: 2022-11-28'].includes(version));
  if (body !== undefined) assert.equal(flag('--input'), '-');
  const failure = state.failures?.find(f => endpoint.includes(f.endpoint) && (!f.method || f.method === method));
  if (failure) {
    if (failure.kind === 'graphql') return output({ errors: [{ message: 'sandbox GraphQL failure' }] });
    if (failure.kind === 'json') return process.stdout.write('not JSON');
    throw new Error(`HTTP ${failure.code || 503}: sandbox API failure`);
  }
  if (endpoint === 'graphql') {
    assert.equal(method, 'POST');
    const { query, variables: v } = body;
    if (query.includes('projectItems')) {
      assert.deepEqual(v, { issue: v.issue });
      const issue = Object.values(state.issues).find(i => i.node_id === v.issue);
      assert.ok(issue, 'unknown Issue node');
      const item = state.items[v.issue];
      const nodes = item ? [{ id: item.id, project: { id: state.project.id }, fieldValues: { nodes: [
        { name: item.status, field: { id: 'STATUS', name: 'Status' } },
      ] } }] : [];
      return output({ data: { node: { projectItems: { nodes } } } });
    }
    if (query.startsWith('query(')) {
      assert.deepEqual(v, { org: 'gaydevs', number: 1 });
      return output({ data: { organization: { projectV2: state.project } } });
    }
    if (query.includes('addProjectV2ItemById')) {
      assert.equal(v.project, state.project.id);
      assert.ok(Object.values(state.issues).some(i => i.node_id === v.issue));
      state.items[v.issue] ||= { id: `ITEM_${v.issue}`, status: null };
      save();
      return output({ data: { addProjectV2ItemById: { item: { id: state.items[v.issue].id } } } });
    }
    if (query.includes('updateProjectV2ItemFieldValue')) {
      assert.equal(v.project, state.project.id);
      const field = state.project.fields.nodes.find(f => f.id === v.field);
      assert.ok(field, 'unknown Project field');
      const option = field.options.find(o => o.id === v.option);
      assert.ok(option, 'unknown Status option');
      const item = Object.values(state.items).find(i => i.id === v.item);
      assert.ok(item, 'unknown Project item');
      item.status = option.name;
      save();
      return output({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.id } } } });
    }
    throw new Error('Unexpected GraphQL operation');
  }
  if (endpoint === 'repos/gaydevs/gaydevs-platform') {
    assert.equal(method, 'GET');
    return output({ id: 123 });
  }
  if (endpoint === 'repos/gaydevs/incorrect') {
    assert.equal(method, 'GET');
    return output({ id: 456 });
  }
  const pullMatch = endpoint.match(/^repos\/gaydevs\/gaydevs-platform\/pulls(?:\/(\d+))?(.*)$/);
  if (pullMatch) {
    const number = pullMatch[1] ? Number(pullMatch[1]) : null;
    const suffix = pullMatch[2];
    if (number) {
      const pull = state.pulls[number];
      assert.ok(pull, `Missing fixture PR ${number}`);
      if (method === 'GET' && !suffix) return output(version.endsWith('2022-11-28') ? (state.legacyPulls?.[number] || pull) : pull);
      if (method === 'GET' && suffix === '/files?per_page=100') return output(pages(state.pullFiles[number] || []));
    } else if (method === 'GET') {
      const params = new URLSearchParams(suffix.replace(/^\?/, ''));
      const base = params.get('base');
      const prState = params.get('state') || 'open';
      const pulls = version.endsWith('2022-11-28') ? { ...state.pulls, ...state.legacyPulls } : state.pulls;
      const values = Object.values(pulls).filter(pr => (!base || pr.base?.ref === base) && (prState === 'all' || pr.state === prState));
      return output(pages(values));
    } else if (method === 'POST' && !suffix) {
      assert.equal(body.base, 'develop');
      assert.equal(typeof body.title, 'string');
      assert.equal(typeof body.head, 'string');
      assert.equal(typeof body.body, 'string');
      const prNumber = Math.max(100, ...Object.keys(state.pulls).map(Number)) + 1;
      const pull = {
        number: prNumber, state: 'open', merged: false, merged_at: null, merge_commit_sha: null,
        base: { ref: body.base, sha: `base-${prNumber}` },
        head: { ref: body.head, sha: `head-${prNumber}` },
        title: body.title, body: body.body,
        html_url: `https://github.com/gaydevs/gaydevs-platform/pull/${prNumber}`,
      };
      state.pulls[prNumber] = pull;
      save();
      return output(pull);
    }
    throw new Error(`Unexpected pull endpoint: ${method} ${endpoint}`);
  }
  if (endpoint === 'repos/gaydevs/gaydevs-platform/merges') {
    assert.equal(method, 'POST');
    assert.equal(body.base, 'develop');
    assert.equal(typeof body.head, 'string');
    assert.equal(typeof body.commit_message, 'string');
    return output({ sha: `sync-${body.head}` });
  }
  const compareMatch = endpoint.match(/^repos\/gaydevs\/gaydevs-platform\/compare\/([^?]+)(?:\?(.*))?$/);
  if (compareMatch) {
    assert.equal(method, 'GET');
    const [base, head] = compareMatch[1].split('...');
    const key = `${base}...${head}`;
    const value = state.compares[key];
    assert.ok(value, `Missing fixture compare ${key}`);
    const params = new URLSearchParams(compareMatch[2] || '');
    if (params.has('page') || params.has('per_page')) {
      const page = Number(params.get('page') || 1);
      const perPage = Number(params.get('per_page') || 30);
      assert.ok(Number.isInteger(page) && page > 0, 'invalid compare page');
      assert.ok(Number.isInteger(perPage) && perPage > 0 && perPage <= 100, 'invalid compare per_page');
      const commits = value.commits || [];
      return output({
        ...value,
        total_commits: value.total_commits ?? commits.length,
        commits: commits.slice((page - 1) * perPage, page * perPage),
      });
    }
    return output(value);
  }
  const match = endpoint.match(/^repos\/gaydevs\/gaydevs-platform\/issues\/(\d+)(.*)$/);
  assert.ok(match, `Unexpected endpoint: ${endpoint}`);
  const number = Number(match[1]);
  const suffix = match[2];
  const issue = state.issues[number];
  assert.ok(issue, `Missing fixture Issue ${number}`);
  if (!suffix) {
    if (method === 'GET') return output(issue);
    if (method === 'PATCH') {
      assert.ok(['not_planned', 'completed'].includes(body.state_reason));
      assert.deepEqual(body, { state: 'closed', state_reason: body.state_reason });
      issue.state = 'closed';
      issue.state_reason = body.state_reason;
      save(); return output(issue);
    }
  }
  if (method === 'GET') {
    if (suffix === '/comments?per_page=100') return output(pages(state.comments[number] || []));
    if (suffix === '/issue-field-values?per_page=100') return output(pages(state.fields[number] || []));
    if (suffix === '/dependencies/blocked_by?per_page=100') return output(pages((state.dependencies[number] || []).map(n => state.issues[n])));
    if (suffix === '/dependencies/blocking?per_page=100') return output(pages(Object.entries(state.dependencies).filter(([, ns]) => ns.includes(number)).map(([n]) => state.issues[n])));
  }
  if (method === 'POST' && suffix === '/comments') {
    assert.equal(typeof body.body, 'string');
    const comment = { id: (state.comments[number] || []).length + 1, body: body.body };
    (state.comments[number] ||= []).push(comment);
    save(); return output(comment);
  }
  if (method === 'POST' && suffix === '/issue-field-values') {
    assert.equal(body.issue_field_values.length, 1);
    assert.equal(body.issue_field_values[0].field_id, 99);
    assert.ok(['High', 'Medium', 'Low'].includes(body.issue_field_values[0].value));
    state.fields[number] = [{ issue_field_name: 'Priority', single_select_option: { name: body.issue_field_values[0].value } }];
    save(); return output(state.fields[number]);
  }
  if (method === 'POST' && suffix === '/dependencies/blocked_by') {
    const blocker = Object.values(state.issues).find(i => i.id === body.issue_id);
    assert.ok(blocker, 'Use native Issue id, not number');
    const list = state.dependencies[number] ||= [];
    if (!list.includes(blocker.number)) list.push(blocker.number);
    save(); return output(blocker);
  }
  if (method === 'DELETE' && /^\/dependencies\/blocked_by\/\d+$/.test(suffix)) {
    assert.equal(body, undefined);
    const id = Number(suffix.split('/').at(-1));
    state.dependencies[number] = (state.dependencies[number] || []).filter(n => state.issues[n].id !== id);
    save(); return output();
  }
  throw new Error(`Unexpected method/endpoint: ${method} ${endpoint}`);
}
try { serve(); } catch (error) { console.error(`FAKE GH: ${error.message}`); process.exitCode = 1; }
