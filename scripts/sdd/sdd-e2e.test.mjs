import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, pullRequest, ok } from './sandbox/index.mjs';

test('technical E2E: manual work PR, assisted sync, manual release PR and assisted finalization', t => {
  const s = sandbox(t);
  s.change(v => {
    v.items = { I_27: { id: 'ITEM_I_27', status: 'In Progress' } };
    v.pulls[101] = pullRequest(101, 27);
    v.pullFiles[101] = [{ filename: 'specs/00027-technical-fixture-27/spec.md' }];
  });

  ok(s.cli('pr-check', [101]));
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'Review');

  // The sandbox models the external human gate as explicit fixture state.
  s.change(v => {
    v.pulls[101].state = 'closed';
    v.pulls[101].merged = true;
    v.pulls[101].merged_at = '2026-10-13T12:00:00Z';
    v.pulls[101].merge_commit_sha = 'merge-101';
  });
  ok(s.cli('pr-sync', [101]));
  assert.equal(s.state().items.I_27.status, 'Ready for Release');
  assert.equal(s.state().issues[27].state, 'open');

  s.change(v => {
    v.pulls[200] = pullRequest(200, 0, {
      state: 'closed',
      merged: true,
      merged_at: '2026-10-13T13:00:00Z',
      merge_commit_sha: 'release-merge',
      base: { ref: 'main', sha: 'main-before' },
      head: { ref: 'develop', sha: 'develop-at-release' },
      body: '',
    });
    v.compares['main-before...release-merge'] = { commits: [{ sha: 'merge-101' }, { sha: 'release-merge' }] };
  });
  ok(s.cli('release-sync', [200]));
  assert.equal(s.state().items.I_27.status, 'Done');
  assert.equal(s.state().issues[27].state, 'closed');
  assert.equal(s.state().issues[27].state_reason, 'completed');
});
