import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, pullRequest, ok, fail } from './sandbox/index.mjs';

const noWrites = s => assert.deepEqual(s.mutations(), []);

function setupWorkPr(s, { pr = {}, status = 'In Progress' } = {}) {
  s.change(v => {
    v.pulls[101] = pullRequest(101, 27, pr);
    v.pullFiles[101] = [{ filename: 'specs/00027-technical-fixture-27/spec.md' }];
    v.items = { I_27: { id: 'ITEM_I_27', status } };
  });
}

test('pr-sync: open work PR moves In Progress to Review and rerun is no-op', t => {
  const s = sandbox(t);
  setupWorkPr(s);
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'Review');
  assert.equal(s.mutations().length, 2);
  s.clearCalls();
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'Review');
  noWrites(s);
});

test('pr-sync: closed unmerged work PR moves Review back to In Progress', t => {
  const s = sandbox(t);
  setupWorkPr(s, { status: 'Review', pr: { state: 'closed', merged: false } });
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'In Progress');
});

test('pr-sync: merged work PR moves Review to Ready for Release and keeps Issue open', t => {
  const s = sandbox(t);
  setupWorkPr(s, { status: 'Review', pr: { state: 'closed', merged: true, merged_at: '2026-10-13T12:00:00Z', merge_commit_sha: 'merge-101' } });
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'Ready for Release');
  assert.equal(s.state().issues[27].state, 'open');
});

test('pr-sync: terminal states are no-op', t => {
  const s = sandbox(t);
  for (const status of ['Rejected', 'Canceled', 'Done']) {
    setupWorkPr(s, { status });
    s.clearCalls();
    ok(s.cli('pr-sync', [101]));
    assert.equal(s.state().items.I_27.status, status);
    noWrites(s);
  }
});

test('pr-sync: incompatible states fail before mutation', t => {
  const s = sandbox(t);
  setupWorkPr(s, { status: 'Backlog' });
  fail(s.cli('pr-sync', [101]), /Transição inválida/);
  noWrites(s);
});
