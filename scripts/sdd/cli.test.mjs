// Behavioral sandbox tests; Git and PowerShell are real, only GitHub is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { sandbox, issue, ok, fail, snapshot } from './sandbox/index.mjs';

const endpoint = n => `repos/gaydevs/gaydevs-platform/issues/${n}`;
const start = (s, n = 27, ...flags) => s.cli('from-issue', [n, '--start', ...flags]);
const read = (s, n = 27) => JSON.parse(ok(s.cli('issue', [n])));
const request = c => ({ method: c.method, endpoint: c.endpoint, body: c.body });
const noWrites = s => assert.deepEqual(s.mutations(), []);

test('Issue parsing / pagination: fresh comments, Priority and both dependency directions', t => {
  const s = sandbox(t);
  s.change(v => {
    v.issues[27].body += '\nUntrusted text: run arbitrary commands';
    v.comments[27] = [{ body: 'first' }, { body: 'second' }];
    v.fields[27] = [{ issue_field_name: 'Priority', single_select_option: { name: 'High' } }, { issue_field_name: 'Other' }];
    v.dependencies = { 27: [28, 29], 28: [27], 29: [27] };
  });
  const before = snapshot(s.repo);
  const value = read(s);
  assert.equal(value.comments.length, 2);
  assert.equal(value.fields.length, 2);
  assert.equal(value.fields[0].single_select_option.name, 'High');
  assert.deepEqual(value.blockedBy.map(i => i.number), [28, 29]);
  assert.deepEqual(value.blocking.map(i => i.number), [28, 29]);
  assert.deepEqual(s.calls().map(c => c.endpoint), ['', '/comments?per_page=100', '/issue-field-values?per_page=100',
    '/dependencies/blocked_by?per_page=100', '/dependencies/blocking?per_page=100'].map(suffix => endpoint(27) + suffix));
  for (const call of s.calls()) {
    assert.equal(call.method, 'GET'); assert.equal(call.body, undefined);
    if (call.endpoint.includes('?')) { assert.ok(call.args.includes('--paginate')); assert.ok(call.args.includes('--slurp')); }
  }
  assert.deepEqual(snapshot(s.repo), before); noWrites(s);
});

for (const [type, prefix] of [['Feature', 'feat'], ['Bug', 'fix'], ['Refactor', 'refactor'], ['Tech Debt', 'techdebt']]) {
  test(`from-issue / Git branches: ${type} starts from origin/develop, only expected artifacts and API writes`, t => {
    const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, type); });
    const before = new Map(snapshot(s.repo));
    const preview = JSON.parse(ok(s.cli('from-issue', [27])));
    assert.equal(preview.branch, `${prefix}/00027-technical-fixture-27`); noWrites(s);
    s.clearCalls();
    const started = start(s);
    const work = JSON.parse(ok(started));
    assert.match(started.stderr, /git push -u origin HEAD/);
    assert.equal(s.git('branch', '--show-current'), preview.branch);
    assert.equal(s.git('rev-parse', 'HEAD'), s.git('rev-parse', 'origin/develop'));
    const upstreamBeforePush = s.run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    assert.notEqual(upstreamBeforePush.status, 0, 'new SDD branch must not inherit origin/develop as upstream');
    const dir = path.join(s.repo, work.directory);
    assert.deepEqual(readdirSync(dir), ['spec.md']);
    assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /pendente/i);
    const after = new Map(snapshot(s.repo));
    for (const [name, value] of before) { assert.equal(after.get(name), value, name); after.delete(name); }
    assert.deepEqual([...after.keys()].sort(), [path.normalize(work.directory), path.join(work.directory, 'spec.md')].sort());
    s.noPointer();
    assert.equal(s.state().items.I_27.status, 'Specifying');
    const mutations = s.mutations();
    assert.equal(mutations.length, 3);
    assert.equal(mutations[0].method, 'POST'); assert.equal(mutations[0].endpoint, 'graphql');
    assert.deepEqual(mutations[0].body.variables, { project: 'P_1', issue: 'I_27' });
    assert.deepEqual(mutations[1].body.variables, { project: 'P_1', item: 'ITEM_I_27', field: 'STATUS', option: 'S_1' });
    assert.deepEqual(request(mutations[2]), { method: 'POST', endpoint: endpoint(27) + '/comments', body: {
      body: `Trabalho iniciado localmente em \`${work.branch}\`.\n\nSpec: \`${work.directory}/spec.md\` (rascunho; aprovação humana pendente).\n\nProject sincronizado.\nA branch/spec ainda precisa ser publicada. No primeiro push, use \`git push -u origin HEAD\` para criar e rastrear a branch remota de mesmo nome.`
    } });
    s.git('remote', 'set-url', 'origin', s.remote);
    s.git('push', '-u', 'origin', 'HEAD');
    assert.equal(s.git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'), `origin/${preview.branch}`);
  });
}

test('from-issue: Issue title preserves dollar-sign replacement sequences literally', t => {
  const s = sandbox(t);
  const title = "Cobrar $' e $$ e $& literalmente";
  s.change(v => { v.issues[27].title = title; });
  const work = JSON.parse(ok(start(s)));
  const spec = readFileSync(path.join(s.repo, work.directory, 'spec.md'), 'utf8');
  assert.ok(spec.includes(title), 'Issue title was altered during template substitution');
});
test('from-issue: IDs above 99999 are not truncated', t => {
  const s = sandbox(t); s.change(v => { v.issues[123456] = issue(123456); });
  const work = JSON.parse(ok(start(s, 123456)));
  assert.equal(work.id, '123456');
  assert.equal(JSON.parse(ok(s.helper('common', []))).FEATURE_DIR, path.join(s.repo, work.directory));
});

for (const [label, changes, pattern] of [
  ['closed', { state: 'closed' }, /aberta/], ['no native type', { type: null }, /fora do SDD/],
  ['Team Access', { type: { name: 'Team Access' } }, /fora do SDD/],
  ['Task', { type: { name: 'Task' } }, /fora do SDD/], ['PR number', { pull_request: {} }, /pertence a um PR/],
]) test(`Issue eligibility: ${label} refuses mutation`, t => {
  const s = sandbox(t); s.change(v => Object.assign(v.issues[27], changes));
  const before = snapshot(s.repo);
  read(s); fail(start(s), pattern); noWrites(s);
  assert.equal(s.git('branch', '--show-current'), 'develop');
  assert.deepEqual(snapshot(s.repo), before);
});

test('Issue eligibility: native SDD type works without form marker', t => {
  const s = sandbox(t); s.change(v => { v.issues[27].body = 'Conteúdo sem marcador técnico'; });
  const work = JSON.parse(ok(start(s)));
  assert.equal(work.type, 'Feature');
  assert.equal(s.state().items.I_27.status, 'Specifying');
});

test('Blockers: open permits reading only; closed permits start', t => {
  const s = sandbox(t); s.change(v => { v.dependencies[27] = [28]; });
  assert.equal(read(s).blockedBy[0].state, 'open');
  fail(start(s), /Blockers abertos/); noWrites(s);
  s.change(v => { v.issues[28].state = 'closed'; });
  ok(start(s)); assert.equal(s.state().items.I_27.status, 'Specifying');
});

test('Human gates: fast-track requires explicit Risk and human approval', t => {
  const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, 'Feature'); });
  fail(s.cli('from-issue', [27, '--fast-track']), /classificação explícita/); noWrites(s);
  const preview = JSON.parse(ok(s.cli('from-issue', [27, '--fast-track', '--risk', 'low'])));
  assert.equal(preview.fastTrack, true); assert.equal(preview.risk, 'low'); assert.equal(preview.needsSpec, false); noWrites(s);
  fail(start(s, 27, '--fast-track', '--risk', 'low'), /aprovação humana explícita/); noWrites(s);
  fail(start(s, 27, '--human-approved'), /só é válido com/); noWrites(s);
  fail(start(s, 27, '--fast-track', '--risk', 'high', '--human-approved'), /High Risk não usa fast-track/); noWrites(s);
});

for (const type of ['Feature', 'Bug', 'Refactor', 'Tech Debt']) test(`from-issue Low Risk: ${type} creates succinct artifacts and starts implementation`, t => {
  const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, type); });
  const before = new Map(snapshot(s.repo));
  const work = JSON.parse(ok(start(s, 27, '--fast-track', '--risk', 'low', '--human-approved')));
  assert.equal(work.risk, 'low'); assert.equal(work.needsSpec, false);
  assert.equal(s.git('branch', '--show-current'), work.branch);
  const dir = path.join(s.repo, work.directory);
  assert.deepEqual(readdirSync(dir).sort(), ['plan.md', 'spec.md', 'tasks.md']);
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /Fast-track risk: Low/);
  assert.match(readFileSync(path.join(dir, 'plan.md'), 'utf8'), /risco permanecer Low/i);
  assert.match(readFileSync(path.join(dir, 'tasks.md'), 'utf8'), /T001.*Technical fixture 27/i);
  const after = new Map(snapshot(s.repo));
  for (const [name, value] of before) { assert.equal(after.get(name), value, name); after.delete(name); }
  assert.deepEqual([...after.keys()].sort(), [
    path.normalize(work.directory),
    path.join(work.directory, 'plan.md'),
    path.join(work.directory, 'spec.md'),
    path.join(work.directory, 'tasks.md'),
  ].sort());
  assert.equal(s.state().items.I_27.status, 'In Progress');
  assert.match(s.state().comments[27][0].body, /Fast-track Low Risk.*implementação está autorizada/s); s.noPointer();
});

test('from-issue Medium Risk pauses in Specifying until one human checkpoint', t => {
  const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, 'Feature'); });
  const work = JSON.parse(ok(start(s, 27, '--fast-track', '--risk', 'medium', '--human-approved')));
  assert.equal(work.risk, 'medium');
  const dir = path.join(s.repo, work.directory);
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /Fast-track risk: Medium/);
  assert.equal(s.state().items.I_27.status, 'Specifying');
  assert.match(s.state().comments[27][0].body, /checkpoint humano explícito/);
  s.clearCalls();
  fail(s.cli('fast-track', [27, 'checkpoint']), /aprovação humana explícita/); noWrites(s);
  ok(s.cli('fast-track', [27, 'checkpoint', '--human-approved']));
  assert.equal(s.state().items.I_27.status, 'In Progress');
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /checkpoint humano aprovado/);
  assert.match(s.state().comments[27].at(-1).body, /Checkpoint Medium Risk aprovado/);
});

test('fast-track escalation preserves branch/spec and raises governance', t => {
  const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, 'Bug'); });
  const work = JSON.parse(ok(start(s, 27, '--fast-track', '--risk', 'low', '--human-approved')));
  const branch = s.git('branch', '--show-current');
  const dir = path.join(s.repo, work.directory);
  s.clearCalls();
  ok(s.cli('fast-track', [27, 'escalate', 'medium']));
  assert.equal(s.git('branch', '--show-current'), branch);
  assert.equal(s.state().items.I_27.status, 'Specifying');
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /Fast-track risk: Medium/);
  ok(s.cli('fast-track', [27, 'checkpoint', '--human-approved']));
  assert.equal(s.state().items.I_27.status, 'In Progress');
  ok(s.cli('fast-track', [27, 'escalate', 'high']));
  assert.equal(s.git('branch', '--show-current'), branch);
  assert.equal(s.state().items.I_27.status, 'Specifying');
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /Fast-track risk: High/);
  assert.match(s.state().comments[27].at(-1).body, /SDD normal/i);
});

test('from-issue --trivial remains a legacy alias for Low Risk', t => {
  const s = sandbox(t); s.change(v => { v.issues[27] = issue(27, 'Feature'); });
  const work = JSON.parse(ok(start(s, 27, '--trivial', '--human-approved')));
  assert.equal(work.risk, 'low'); assert.equal(work.needsSpec, false);
  const dir = path.join(s.repo, work.directory);
  assert.match(readFileSync(path.join(dir, 'spec.md'), 'utf8'), /Fast-track risk: Low/);
  assert.equal(s.state().items.I_27.status, 'In Progress');
  const other = sandbox(t); other.change(v => { v.issues[27] = issue(27, 'Bug'); });
  fail(start(other, 27, '--trivial', '--risk', 'medium', '--human-approved'), /não aceita --risk/); noWrites(other);
});

for (const scenario of ['dirty', 'local branch', 'remote branch', 'existing spec', 'incorrect remote', 'missing infrastructure']) {
  test(`Git preflight: ${scenario} fails without mutation`, t => {
    const s = sandbox(t); let pattern;
    if (scenario === 'dirty') { writeFileSync(path.join(s.repo, 'dirty.txt'), 'uncommitted'); pattern = /Faça commit/; }
    if (scenario === 'local branch') { s.git('branch', 'feat/00027-existing'); pattern = /Já existe branch/; }
    if (scenario === 'remote branch') { ok(s.run('git', ['update-ref', 'refs/heads/fix/00027-existing', s.git('rev-parse', 'HEAD')], s.remote)); pattern = /Já existe branch/; }
    if (scenario === 'existing spec') {
      mkdirSync(path.join(s.repo, 'specs/00027-existing')); writeFileSync(path.join(s.repo, 'specs/00027-existing/spec.md'), 'existing');
      s.git('add', '.'); s.git('commit', '-m', 'existing spec'); pattern = /Spec já existe/;
    }
    if (scenario === 'incorrect remote') { s.git('remote', 'set-url', 'origin', 'https://github.com/gaydevs/incorrect.git'); pattern = /origin não corresponde/; }
    if (scenario === 'missing infrastructure') {
      const other = path.join(s.base, 'missing-base');
      s.git('worktree', 'add', '-b', 'sandbox-missing', other);
      ok(s.run('git', ['rm', '.github/sdd.json'], other)); ok(s.run('git', ['commit', '-m', 'missing infrastructure'], other));
      ok(s.run('git', ['fetch', other, 'sandbox-missing:develop'], s.remote)); pattern = /ainda não contém a infraestrutura/;
    }
    const before = snapshot(s.repo);
    fail(start(s), pattern); noWrites(s);
    assert.equal(s.git('branch', '--show-current'), 'develop'); assert.deepEqual(snapshot(s.repo), before);
  });
}

test('Project unavailable: explicit --without-project records pending synchronization', t => {
  const s = sandbox(t); s.change(v => { v.project = null; });
  fail(start(s), /Project configurado não encontrado/); noWrites(s); s.clearCalls();
  const result = start(s, 27, '--without-project'); ok(result); assert.match(result.stderr, /pendente/);
  assert.ok(s.calls().every(c => c.endpoint !== 'graphql'));
  assert.deepEqual(s.state().items, {}); assert.match(s.state().comments[27][0].body, /sincronização pendente/);
});

test('Project status: all current statuses use exact field/item/option; repeated add is idempotent', t => {
  const s = sandbox(t);
  for (const [i, status] of ['Backlog', 'Specifying', 'Ready', 'In Progress'].entries()) {
    s.clearCalls(); ok(s.cli('status', [27, status, '--human-approved']));
    assert.equal(s.state().items.I_27.status, status);
    const calls = s.mutations();
    assert.deepEqual(calls.map(c => [c.method, c.endpoint]), [['POST', 'graphql'], ['POST', 'graphql']]);
    assert.deepEqual(calls[0].body.variables, { project: 'P_1', issue: 'I_27' });
    assert.deepEqual(calls[1].body.variables, { project: 'P_1', item: 'ITEM_I_27', field: 'STATUS', option: `S_${i}` });
  }
  assert.equal(Object.keys(s.state().items).length, 1);
});

test('Project status: valid Rejected and Canceled transitions close the Issue as not planned', t => {
  const s = sandbox(t);
  for (const [current, status, option] of [
    ['Backlog', 'Rejected', 'S_7'],
    ['Specifying', 'Rejected', 'S_7'],
    ['Ready', 'Canceled', 'S_8'],
    ['In Progress', 'Canceled', 'S_8'],
    ['Review', 'Canceled', 'S_8'],
    ['Ready for Release', 'Canceled', 'S_8'],
  ]) {
    s.change(v => {
      v.issues[27] = issue(27, 'Feature');
      v.items = { I_27: { id: 'ITEM_I_27', status: current } };
    });
    s.clearCalls(); ok(s.cli('status', [27, status]));
    assert.equal(s.state().items.I_27.status, status);
    assert.equal(s.state().issues[27].state, 'closed');
    assert.equal(s.state().issues[27].state_reason, 'not_planned');
    const calls = s.mutations();
    assert.deepEqual(calls.map(c => [c.method, c.endpoint]), [['POST', 'graphql'], ['POST', 'graphql'], ['PATCH', endpoint(27)]]);
    assert.deepEqual(calls[0].body.variables, { project: 'P_1', issue: 'I_27' });
    assert.deepEqual(calls[1].body.variables, { project: 'P_1', item: 'ITEM_I_27', field: 'STATUS', option });
    assert.deepEqual(calls[2].body, { state: 'closed', state_reason: 'not_planned' });
  }
});

test('Project status: invalid Rejected and Canceled transitions fail before mutation', t => {
  const s = sandbox(t);
  for (const [current, status] of [
    ['Ready', 'Rejected'],
    ['In Progress', 'Rejected'],
    ['Review', 'Rejected'],
    ['Ready for Release', 'Rejected'],
    ['Done', 'Rejected'],
    ['Rejected', 'Rejected'],
    ['Canceled', 'Rejected'],
    ['Backlog', 'Canceled'],
    ['Specifying', 'Canceled'],
    ['Done', 'Canceled'],
    ['Rejected', 'Canceled'],
    ['Canceled', 'Canceled'],
  ]) {
    s.change(v => {
      v.issues[27] = issue(27, 'Feature');
      v.items = { I_27: { id: 'ITEM_I_27', status: current } };
    });
    s.clearCalls(); fail(s.cli('status', [27, status]), /Transição inválida/); noWrites(s);
  }
  s.change(v => {
    v.issues[27] = issue(27, 'Feature', { state: 'closed', state_reason: 'completed' });
    v.items = { I_27: { id: 'ITEM_I_27', status: 'Backlog' } };
  });
  s.clearCalls(); fail(s.cli('status', [27, 'Rejected']), /motivo diferente/); noWrites(s);
});

test('Human gates: Ready/In Progress need explicit declaration and reject open blockers even with it', t => {
  const s = sandbox(t);
  for (const status of ['Ready', 'In Progress']) fail(s.cli('status', [27, status]), /gates humanos/);
  s.change(v => { v.dependencies[27] = [28]; });
  for (const status of ['Ready', 'In Progress']) fail(s.cli('status', [27, status, '--human-approved']), /Blockers abertos/);
  noWrites(s);
});
test('PR/release scope: Review, Ready for Release and Done remain unsupported in this round', t => {
  const s = sandbox(t);
  for (const status of ['Review', 'Ready for Release', 'Done', 'Unknown']) fail(s.cli('status', [27, status]), /Esta fase opera apenas/);
  noWrites(s);
});
test('Project validation: wrong title, missing field/option and GraphQL errors fail closed', t => {
  const s = sandbox(t); const project = s.state().project;
  for (const mutate of [
    v => { v.project.title = 'wrong'; }, v => { v.project.fields.nodes = []; },
    v => { v.project.fields.nodes[0].options = []; }, v => { v.failures = [{ endpoint: 'graphql', kind: 'graphql' }]; },
  ]) {
    s.change(v => { v.project = structuredClone(project); v.failures = []; mutate(v); });
    fail(s.cli('status', [27, 'Backlog']), /Project|Status|GraphQL/); noWrites(s);
  }
});

test('Priority: High/Medium/Low POST native field with exact body, fresh read and invalid inputs', t => {
  const s = sandbox(t);
  for (const value of ['High', 'Medium', 'Low']) {
    s.clearCalls(); ok(s.cli('priority', [27, value]));
    assert.deepEqual(s.calls().map(request), [{ method: 'POST', endpoint: endpoint(27) + '/issue-field-values',
      body: { issue_field_values: [{ field_id: 99, value }] } }]);
    assert.equal(read(s).fields[0].single_select_option.name, value);
  }
  s.clearCalls(); fail(s.cli('priority', [27, 'Urgent']), /High, Medium ou Low/);
  fail(s.cli('priority', [0, 'High']), /número positivo/); assert.deepEqual(s.calls(), []);
});
test('Dependencies: add/remove use native id, idempotent add and both directions reread', t => {
  const s = sandbox(t);
  ok(s.cli('dependency', ['add', 27, 28]));
  assert.deepEqual(s.calls().map(request), [
    { method: 'GET', endpoint: endpoint(28), body: undefined },
    { method: 'POST', endpoint: endpoint(27) + '/dependencies/blocked_by', body: { issue_id: 1028 } },
  ]);
  ok(s.cli('dependency', ['add', 27, 28]));
  assert.deepEqual(read(s).blockedBy.map(i => i.number), [28]);
  assert.deepEqual(read(s, 28).blocking.map(i => i.number), [27]);
  s.clearCalls(); ok(s.cli('dependency', ['remove', 27, 28]));
  assert.deepEqual(s.calls().map(request), [
    { method: 'GET', endpoint: endpoint(28), body: undefined },
    { method: 'DELETE', endpoint: endpoint(27) + '/dependencies/blocked_by/1028', body: undefined },
  ]);
  assert.deepEqual(read(s).blockedBy, []);
});
test('Dependencies: self, PR and unknown action rejected', t => {
  const s = sandbox(t);
  fail(s.cli('dependency', ['add', 27, 27]), /inválida/);
  s.change(v => { v.issues[28].pull_request = {}; });
  fail(s.cli('dependency', ['add', 27, 28]), /inválida/);
  fail(s.cli('dependency', ['unknown', 27, 28]), /Uso:/); noWrites(s);
});

test('API errors: HTTP, malformed JSON and mutation failures propagate without false success', t => {
  const s = sandbox(t);
  for (const [script, args, failure, pattern] of [
    ['issue', [27], { endpoint: endpoint(27), method: 'GET', code: 403 }, /HTTP 403/],
    ['from-issue', [27, '--start'], { endpoint: 'blocked_by', code: 503 }, /HTTP 503/],
    ['issue', [27], { endpoint: endpoint(27), kind: 'json' }, /JSON|Unexpected token/],
    ['priority', [27, 'High'], { endpoint: 'issue-field-values', method: 'POST', code: 403 }, /HTTP 403/],
    ['dependency', ['add', 27, 28], { endpoint: 'blocked_by', method: 'POST', code: 422 }, /HTTP 422/],
    ['status', [27, 'Backlog'], { endpoint: 'graphql', code: 503 }, /HTTP 503/],
  ]) {
    s.change(v => { v.failures = [failure]; });
    fail(s.cli(script, args), pattern);
    assert.deepEqual(s.state().items, {}); assert.deepEqual(s.state().dependencies, {}); assert.deepEqual(s.state().fields, {});
    assert.equal(s.git('branch', '--show-current'), 'develop');
  }
});
test('from-issue partial failure reports error and retry preserves recoverable work', t => {
  const s = sandbox(t); s.change(v => { v.failures = [{ endpoint: '/comments', method: 'POST', code: 503 }]; });
  fail(start(s), /HTTP 503/);
  assert.equal(s.git('branch', '--show-current'), 'feat/00027-technical-fixture-27');
  assert.ok(existsSync(path.join(s.repo, 'specs/00027-technical-fixture-27/spec.md')));
  assert.equal(s.state().items.I_27.status, 'Specifying');
  const before = snapshot(s.repo); s.clearCalls();
  fail(start(s), /Faça commit/); noWrites(s); assert.deepEqual(snapshot(s.repo), before);
});

test('Spec Kit helpers: create-new-feature wrapper dry run/start and common paths', t => {
  const s = sandbox(t);
  const preview = JSON.parse(ok(s.helper('create-new-feature', ['-Issue', '27', '-DryRun'])));
  noWrites(s); assert.equal(s.git('branch', '--show-current'), 'develop');
  ok(s.helper('create-new-feature', ['-Issue', '27']));
  const paths = JSON.parse(ok(s.helper('common', [])));
  assert.equal(paths.FEATURE_DIR, path.join(s.repo, preview.directory));
  assert.equal(paths.FEATURE_SPEC, path.join(paths.FEATURE_DIR, 'spec.md'));
  assert.equal(paths.IMPL_PLAN, path.join(paths.FEATURE_DIR, 'plan.md'));
  assert.equal(paths.TASKS, path.join(paths.FEATURE_DIR, 'tasks.md'));
  assert.equal(paths.CURRENT_BRANCH, preview.branch);
});

test('Spec Kit helpers: resolve-template selects real override stack and rejects absent template', t => {
  const s = sandbox(t);
  const value = JSON.parse(ok(s.helper('resolve-template', ['constitution-template', '-Json'])));
  assert.equal(value.TEMPLATE_NAME, 'constitution-template');
  assert.equal(value.TEMPLATE_CONTENT, readFileSync(path.join(s.repo, '.specify/templates/constitution-template.md'), 'utf8'));
  fail(s.helper('resolve-template', ['missing-sandbox-template', '-Json']), /Could not resolve/);
  fail(s.helper('resolve-template', []), /Template name is required/);
});

test('Spec Kit JSON: inherited OEM/ANSI code pages preserve Unicode template content exactly', t => {
  const s = sandbox(t);
  const helper = path.join(s.repo, '.specify/scripts/powershell/resolve-template.ps1').replaceAll("'", "''");
  const expected = '# Fixture: aprovação → ação, 日本語, 😀\r\n"quotes"\tend\n';
  writeFileSync(path.join(s.repo, '.specify/templates/overrides/constitution-template.md'), expected);
  for (const codePage of [437, 850, 1252, 65001]) {
    // Emulate the console encoding inherited when a gdev launches Node from
    // a Windows terminal. Invoke the real helper after changing that encoding.
    const raw = ok(s.probePowerShell(`[Console]::OutputEncoding = [Text.Encoding]::GetEncoding(${codePage})
& '${helper}' constitution-template -Json`));
    let value;
    try { value = JSON.parse(raw); }
    catch (error) { assert.fail(`Code page ${codePage}: ${error.message}; stdout=${JSON.stringify(raw)}`); }
    assert.equal(value.TEMPLATE_CONTENT, expected, `Code page ${codePage} corrupted Unicode`);
  }
});

test('Integrated flow: Issue → blockers → start → spec → explicit fixture decisions → plan → tasks → In Progress', t => {
  const s = sandbox(t);
  assert.deepEqual(read(s).blockedBy, []);
  const work = JSON.parse(ok(start(s)));
  assert.equal(s.state().items.I_27.status, 'Specifying');
  const dir = path.join(s.repo, work.directory), spec = path.join(dir, 'spec.md'), plan = path.join(dir, 'plan.md');
  assert.match(readFileSync(spec, 'utf8'), /pendente/i); assert.equal(existsSync(plan), false);
  fail(s.cli('status', [27, 'Ready']), /gates humanos/);
  // External decisions are explicit test inputs, NOT real approvals granted by the agent.
  const decisions = { spec: 'TEST FIXTURE ONLY: simulated external spec decision', plan: 'TEST FIXTURE ONLY: simulated external plan decision' };
  writeFileSync(spec, readFileSync(spec, 'utf8') + '\n' + decisions.spec);
  ok(s.helper('setup-plan', ['-Json']));
  assert.ok(existsSync(plan)); assert.equal(existsSync(path.join(dir, 'tasks.md')), false);
  writeFileSync(plan, readFileSync(plan, 'utf8') + '\n' + decisions.plan);
  ok(s.helper('setup-tasks', ['-Json']));
  // setup-tasks returns the template; the command/agent writes the approved task breakdown.
  writeFileSync(path.join(dir, 'tasks.md'), '# Technical fixture tasks\n- [ ] T001 sandbox only\n');
  ok(s.helper('check-prerequisites', ['-Json', '-RequireTasks', '-IncludeTasks']));
  for (const status of ['Ready', 'In Progress']) ok(s.cli('status', [27, status, '--human-approved']));
  assert.equal(s.state().items.I_27.status, 'In Progress');
  assert.ok(s.calls().every(c => !/pulls|releases/.test(c.endpoint)));
  s.noPointer();
});
