import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, issue, ok, fail } from './sandbox/index.mjs';

const noWrites = s => assert.deepEqual(s.mutations(), []);

test('pr-create: creates a referenced PR and the existing check accepts it', t => {
  const s = sandbox(t, {
    branch: 'feat/00027-technical-fixture-27',
    specs: ['00027-technical-fixture-27'],
  });
  assert.match(ok(s.cli('pr-create', ['--title', 'Custom title', '--body', 'Summary and test notes. \n'])), /PR #101 criado/);
  const create = s.calls().find(call => call.method === 'POST');
  assert.equal(create.endpoint, 'repos/gaydevs/gaydevs-platform/pulls');
  assert.deepEqual(create.body, {
    title: 'Custom title',
    head: 'feat/00027-technical-fixture-27',
    base: 'develop',
    body: 'Summary and test notes. \n\n\nSpec: 00027\nRefs #27',
  });
  assert.match(ok(s.cli('pr-check', [101])), /contrato SDD válido para Issue #27/);
  assert.equal(s.mutations().length, 1);
  assert.deepEqual(s.mutations()[0].body, create.body);
});

test('pr-create: uses Issue title and omits Spec for a non-Feature without one', t => {
  const s = sandbox(t, { branch: 'fix/00028-fix-fixture', published: true });
  assert.match(ok(s.cli('pr-create')), /PR #101 criado/);
  const pull = s.state().pulls[101];
  assert.equal(pull.title, 'Technical fixture 28');
  assert.equal(pull.body, 'Refs #28');
  assert.match(ok(s.cli('pr-check', [101])), /contrato SDD válido para Issue #28/);
});

for (const [label, branch, specs, state, pattern, published] of [
  ['invalid branch', 'main', [], undefined, /Branch atual inválida/, true],
  ['missing Issue', 'feat/99999-missing-fixture', [], undefined, /Missing fixture Issue 99999/, true],
  ['prefix/type mismatch', 'fix/00027-wrong-type', [], undefined, /não corresponde ao tipo Feature/, true],
  ['closed Issue', 'feat/00027-closed-fixture', [], undefined, /Issue precisa estar aberta/, true],
  ['Feature missing spec', 'feat/00027-no-spec', [], undefined, /exige uma spec/, true],
  ['ambiguous spec', 'feat/00027-ambiguous-spec', ['00027-first', '00027-second'], undefined, /Mais de uma spec encontrada/, true],
  ['unpublished branch', 'feat/00027-unpublished', ['00027-local-spec'], undefined, /ainda não está publicada/, false],
]) {
  test(`pr-create: ${label} fails without creating a PR`, t => {
    const s = sandbox(t, {
      branch,
      specs,
      state,
      published,
    });
    if (label === 'closed Issue') s.change(v => { v.issues[27].state = 'closed'; });
    fail(s.cli('pr-create'), pattern);
    noWrites(s);
  });
}

test('pr-create: rejects additional content that duplicates mandatory references', t => {
  const s = sandbox(t, { branch: 'fix/00028-conflicting-body' });
  fail(s.cli('pr-create', ['--body', 'Refs #28']), /exatamente um Refs/);
  noWrites(s);
});

test('pr-create: rejects additional content with a conflicting Spec ID', t => {
  const s = sandbox(t, {
    branch: 'feat/00027-conflicting-spec',
    specs: ['00027-technical-fixture-27'],
  });
  fail(s.cli('pr-create', ['--body', 'Spec: 00028']), /no máximo um Spec/);
  noWrites(s);
});

test('pr-create: rejects closing keywords before creating a PR', t => {
  const s = sandbox(t, { branch: 'fix/00028-closing-keyword' });
  fail(s.cli('pr-create', ['--body', 'Resolves #28']), /Closes\/Fixes\/Resolves/);
  noWrites(s);
});

for (const args of [
  ['--unknown', 'value'],
  ['--title'],
  ['--body', '--title'],
  ['--title', 'One', '--title', 'Two'],
]) test(`pr-create: rejects invalid arguments (${args.join(' ')})`, t => {
  const s = sandbox(t, { branch: 'fix/00028-invalid-arguments' });
  fail(s.cli('pr-create', args), /Opção|Informe/);
  noWrites(s);
});

test('pr-create: accepts Issue without marker when native SDD type is valid', t => {
  const s = sandbox(t, { branch: 'fix/00028-no-marker' });
  s.change(v => { v.issues[28] = issue(28, 'Bug', { body: 'No form marker' }); });
  assert.match(ok(s.cli('pr-create')), /PR #101 criado/);
  assert.equal(s.state().pulls[101].body, 'Refs #28');
});
