import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, issue, pullRequest, ok, fail } from './sandbox/index.mjs';

const noWrites = s => assert.deepEqual(s.mutations(), []);

function setupRelease(s, { issues = [27], statuses = ['Ready for Release'], release = {} } = {}) {
  s.change(v => {
    v.pulls[200] = pullRequest(200, 0, {
      state: 'closed',
      merged: true,
      merged_at: '2026-10-13T13:00:00Z',
      merge_commit_sha: 'release-merge',
      base: { ref: 'main', sha: 'main-before' },
      head: { ref: 'develop', sha: 'develop-at-release' },
      body: '',
      ...release,
    });
    v.compares['main-before...release-merge'] = { commits: [{ sha: 'merge-101' }, { sha: 'merge-102' }, { sha: 'release-merge' }] };
    v.items = {};
    for (const [index, number] of issues.entries()) {
      v.issues[number] = issue(number, index === 0 ? 'Feature' : 'Tech Debt');
      v.items[`I_${number}`] = { id: `ITEM_I_${number}`, status: statuses[index] || statuses[0] };
      v.pulls[101 + index] = pullRequest(101 + index, number, {
        state: 'closed',
        merged: true,
        merged_at: '2026-10-13T12:00:00Z',
        merge_commit_sha: `merge-${101 + index}`,
      });
    }
  });
}

test('release-sync: develop -> main closed without merge is no-op', t => {
  const s = sandbox(t);
  setupRelease(s, { release: { merged: false, merge_commit_sha: null } });
  ok(s.cli('release-sync', [200]));
  noWrites(s);
});

test('release-sync: discovers Issues from work PR merge_commit_sha, not release body', t => {
  const s = sandbox(t);
  setupRelease(s);
  ok(s.cli('release-sync', [200]));
  assert.equal(s.state().items.I_27.status, 'Done');
  assert.equal(s.state().issues[27].state, 'closed');
  assert.equal(s.state().issues[27].state_reason, 'completed');
  assert.ok(s.calls().some(c => c.endpoint === 'repos/gaydevs/gaydevs-platform/pulls?state=closed&per_page=100&base=develop'));
  assert.ok(!s.calls().some(c => /commits\/.+\/pulls/.test(c.endpoint)));
});

test('release-sync: paginates the complete release commit range before selecting work PRs', t => {
  const s = sandbox(t);
  setupRelease(s);
  s.change(v => {
    v.compares['main-before...release-merge'] = {
      total_commits: 251,
      commits: [
        ...Array.from({ length: 249 }, (_, i) => ({ sha: `noise-${i}` })),
        { sha: 'merge-101' },
        { sha: 'release-merge' },
      ],
    };
  });
  ok(s.cli('release-sync', [200]));
  assert.equal(s.state().items.I_27.status, 'Done');
  assert.ok(s.calls().some(c => c.endpoint === 'repos/gaydevs/gaydevs-platform/compare/main-before...release-merge?per_page=100&page=3'));
  assert.ok(!s.calls().some(c => c.endpoint === 'repos/gaydevs/gaydevs-platform/compare/main-before...release-merge'));
});

test('release-sync: incomplete release commit range fails before mutation', t => {
  const s = sandbox(t);
  setupRelease(s);
  s.change(v => {
    v.compares['main-before...release-merge'] = {
      total_commits: 3,
      commits: [{ sha: 'merge-101' }, { sha: 'release-merge' }],
    };
  });
  fail(s.cli('release-sync', [200]), /Compare incompleto/);
  noWrites(s);
});

test('release-sync: multiple Issues are deduplicated by Issue number', t => {
  const s = sandbox(t);
  setupRelease(s, { issues: [27, 28], statuses: ['Ready for Release', 'Ready for Release'] });
  s.change(v => {
    v.pulls[103] = pullRequest(103, 27, {
      state: 'closed',
      merged: true,
      merged_at: '2026-10-13T12:30:00Z',
      merge_commit_sha: 'merge-103',
    });
    v.compares['main-before...release-merge'].commits.push({ sha: 'merge-103' });
  });
  ok(s.cli('release-sync', [200]));
  assert.equal(s.state().items.I_27.status, 'Done');
  assert.equal(s.state().items.I_28.status, 'Done');
  const completed = s.mutations().filter(c => c.method === 'PATCH').map(c => c.endpoint);
  assert.deepEqual(completed.sort(), [
    'repos/gaydevs/gaydevs-platform/issues/27',
    'repos/gaydevs/gaydevs-platform/issues/28',
  ]);
});

test('release-sync: terminal states are idempotent no-ops', t => {
  const s = sandbox(t);
  setupRelease(s, { statuses: ['Done'] });
  s.change(v => { v.issues[27].state = 'closed'; v.issues[27].state_reason = 'completed'; });
  ok(s.cli('release-sync', [200]));
  noWrites(s);
});

test('release-sync: incompatible states fail before mutation', t => {
  const s = sandbox(t);
  setupRelease(s, { statuses: ['Review'] });
  fail(s.cli('release-sync', [200]), /estado incompatível/);
  noWrites(s);
});

test('release-sync: missing traceable merge commit fails visibly', t => {
  const s = sandbox(t);
  setupRelease(s);
  s.change(v => {
    v.pulls[101].merge_commit_sha = null;
    v.compares['main-before...release-merge'] = { commits: [{ sha: 'squashed-work' }] };
  });
  fail(s.cli('release-sync', [200]), /Nenhum PR de trabalho/);
  noWrites(s);
});
