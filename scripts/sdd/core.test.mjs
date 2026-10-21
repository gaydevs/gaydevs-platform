import './sandbox/guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, assertUnblocked, issueNumber } from './core.mjs';

const issue = (type = 'Feature', changes = {}) => ({ number: 27, title: 'Login com autenticação', type: { name: type }, body: `<!-- gaydevs-sdd:${type} -->`, state: 'open', ...changes });
test('ID vem da Issue e não trunca números maiores; slug é seguro', () => {
  assert.equal(identity(issue()).branch, 'feat/00027-login-com-autenticacao');
  assert.equal(identity(issue('Bug', { number: 123456 })).id, '123456');
  assert.equal(identity(issue('Bug', { title: '$(cmd) / ../ -- &&' })).branch, 'fix/00027-cmd');
});
test('todos os tipos possuem prefixo e Feature não pode ser trivial', () => {
  for (const [type, prefix] of [['Feature', 'feat'], ['Bug', 'fix'], ['Refactor', 'refactor'], ['Tech Debt', 'techdebt']]) assert.ok(identity(issue(type)).branch.startsWith(`${prefix}/`));
  assert.throws(() => identity(issue(), true), /sempre exige/);
  assert.equal(identity(issue('Bug'), true).needsSpec, false);
});
test('marcador no body é opcional e conteúdo legado continua válido', () => {
  assert.doesNotThrow(() => identity(issue('Feature', { body: '' })));
  assert.doesNotThrow(() => identity(issue('Feature')));
});
test('tipos não suportados, sem tipo, fechadas e PRs são recusados', () => {
  for (const value of [issue('Team Access'), issue('Task'), issue('Feature', { type: null }), issue('Feature', { state: 'closed' }), issue('Feature', { pull_request: {} })]) assert.throws(() => identity(value));
});
test('blockers abertos interrompem; blockers fechados permitem', () => {
  assert.throws(() => assertUnblocked({ blockedBy: [{ state: 'open', html_url: 'https://github.com/test/1' }] }), /Blockers abertos/);
  assert.doesNotThrow(() => assertUnblocked({ blockedBy: [{ state: 'closed' }] }));
});
test('números inválidos não viram paths ou argumentos', () => {
  for (const n of ['../27', '0', '-1', '2.5', '27 --help', '9007199254740992', undefined]) assert.throws(() => issueNumber(n));
});
