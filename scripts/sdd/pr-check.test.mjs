import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, issue, pullRequest, ok, fail } from './sandbox/index.mjs';

const noWrites = s => assert.deepEqual(s.mutations(), []);
const root = fileURLToPath(new URL('../../', import.meta.url));

test('pr-check: valid manual PR to develop is read-only', t => {
  const s = sandbox(t);
  s.change(v => {
    v.pulls[101] = pullRequest(101, 27);
    v.pullFiles[101] = [{ filename: 'specs/00027-technical-fixture-27/spec.md' }];
  });
  assert.match(ok(s.cli('pr-check', [101])), /contrato SDD válido/);
  assert.deepEqual(s.calls().map(c => [c.method, c.endpoint]), [
    ['GET', 'repos/gaydevs/gaydevs-platform/pulls/101'],
    ['GET', 'repos/gaydevs/gaydevs-platform/pulls/101/files?per_page=100'],
    ['GET', 'repos/gaydevs/gaydevs-platform/issues/27'],
    ['GET', 'repos/gaydevs/gaydevs-platform/issues/27/comments?per_page=100'],
    ['GET', 'repos/gaydevs/gaydevs-platform/issues/27/issue-field-values?per_page=100'],
    ['GET', 'repos/gaydevs/gaydevs-platform/issues/27/dependencies/blocked_by?per_page=100'],
    ['GET', 'repos/gaydevs/gaydevs-platform/issues/27/dependencies/blocking?per_page=100'],
  ]);
  noWrites(s);
});

for (const [label, body, pattern] of [
  ['missing Refs', 'Spec: 00027', /exatamente um Refs/],
  ['multiple Refs', 'Spec: 00027\nRefs #27\nRefs #28', /exatamente um Refs/],
  ['divergent Spec', 'Spec: 00028\nRefs #27', /corresponder/],
  ['closing keyword', 'Spec: 00027\nCloses #27\nRefs #27', /Closes\/Fixes\/Resolves/],
]) test(`pr-check: ${label} fails without writes`, t => {
  const s = sandbox(t);
  s.change(v => {
    v.pulls[101] = pullRequest(101, 27, { body });
    v.pullFiles[101] = [{ filename: 'specs/00027-technical-fixture-27/spec.md' }];
  });
  fail(s.cli('pr-check', [101]), pattern);
  noWrites(s);
});

for (const [label, changes, pattern] of [
  ['missing Issue', { issue: undefined }, /Missing fixture Issue 27/],
  ['PR number instead of Issue', { issue: issue(27, 'Feature', { pull_request: {} }) }, /pertence a um PR/],
  ['non-SDD Issue', { issue: issue(27, 'Task') }, /fora do SDD/],
  ['missing Spec for spec work', { body: 'Refs #27' }, /exige exatamente um Spec/],
]) test(`pr-check: ${label} fails without writes`, t => {
  const s = sandbox(t);
  s.change(v => {
    if (Object.hasOwn(changes, 'issue') && changes.issue === undefined) delete v.issues[27];
    else if (changes.issue) v.issues[27] = changes.issue;
    v.pulls[101] = pullRequest(101, 27, changes.body ? { body: changes.body } : {});
    v.pullFiles[101] = [{ filename: 'specs/00027-technical-fixture-27/spec.md' }];
  });
  fail(s.cli('pr-check', [101]), pattern);
  noWrites(s);
});

test('pr-check workflow uses pull_request and read-only permissions only', t => {
  const workflow = readFileSync(path.join(root, '.github/workflows/sdd-pr-check.yml'), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /GH_PROJECT|APP_ID|PRIVATE_KEY|contents:\s*write|issues:\s*write|pull-requests:\s*write/);
});
