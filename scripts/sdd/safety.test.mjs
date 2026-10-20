import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sandbox, ok, fail, snapshot } from './sandbox/index.mjs';

test('No real GitHub writes: real gh, alternate executables and missing mandatory guard fail immediately', t => {
  const s = sandbox(t);
  for (const executable of ['gh', 'gh.exe', 'C:/Program Files/GitHub CLI/gh.exe', 'curl', 'powershell', 'cmd']) {
    assert.throws(() => s.run(executable, ['--version']), /SDD SANDBOX BLOCKED/);
  }
  for (const env of [{ GH_BIN: undefined }, { GH_BIN: 'gh' }, { NODE_OPTIONS: '' }, { GIT_ALLOW_PROTOCOL: 'https' }]) {
    assert.throws(() => s.node('throw new Error("must never execute")', env), /SDD SANDBOX BLOCKED/);
  }
  assert.deepEqual(s.calls(), []);
});

test('No external network: Node fetch/HTTP/HTTPS/DNS/TCP/TLS/UDP/WebSocket and subprocess bypasses fail immediately', t => {
  const s = sandbox(t);
  for (const code of [
    "fetch('https://github.com')",
    "import http from 'node:http'; http.get('http://github.com')",
    "import https from 'node:https'; https.request('https://github.com')",
    "import net from 'node:net'; new net.Socket().connect(443, 'github.com')",
    "import dns from 'node:dns/promises'; await dns.lookup('github.com')",
    "import tls from 'node:tls'; tls.connect(443, 'github.com')",
    "import dgram from 'node:dgram'; dgram.createSocket('udp4')",
    "new WebSocket('wss://github.com')",
    "import http2 from 'node:http2'; http2.connect('https://github.com')",
    "import { Worker } from 'node:worker_threads'; new Worker('fetch(\\'https://github.com\\')', { eval: true })",
    "import cp from 'node:child_process'; cp.execSync('gh --version')",
  ]) fail(s.node(code), /SDD SANDBOX BLOCKED/);
  assert.throws(() => s.run('git', ['ls-remote', 'https://github.com/example/forbidden.git']), /external Git URL/);
  assert.throws(() => s.run('git', ['push', '-u', 'origin', 'HEAD']), /push remote is not sandbox bare remote/);
  s.git('remote', 'set-url', 'origin', s.remote);
  s.git('remote', 'set-url', '--add', '--push', 'origin', 'https://github.com/example/forbidden.git');
  assert.throws(() => s.run('git', ['push', '-u', 'origin', 'HEAD']), /push remote is not sandbox bare remote/);
  s.git('remote', 'add', 'forbidden', 'https://github.com/example/forbidden.git');
  fail(s.run('git', ['fetch', 'forbidden']), /transport 'https' not allowed/);
  assert.deepEqual(s.calls(), []);
});

test('No real GitHub writes: PowerShell command discovery and direct .NET network APIs are blocked', t => {
  const s = sandbox(t);
  for (const code of [
    'gh --version', "& 'C:/Program Files/GitHub CLI/gh.exe' --version",
    'Invoke-WebRequest https://github.com', 'curl https://github.com',
    '[System.Net.Http.HttpClient]::new()', '[System.Diagnostics.Process]::Start("gh")', 'New-Object System.Net.WebClient',
  ]) fail(s.probePowerShell(code), /SDD SANDBOX BLOCKED/);
  assert.deepEqual(s.calls(), []);
});

test('No persistent feature state: legacy reads/writes/probes fail; poisoned residues never influence from-issue', t => {
  const s = sandbox(t);
  const pointer = path.join(s.repo, '.specify/feature.json'), cache = path.join(s.repo, '.specify/context/00027.json');
  mkdirSync(path.dirname(cache)); writeFileSync(pointer, 'invalid JSON'); writeFileSync(cache, 'obsolete context');
  for (const code of [
    "import fs from 'node:fs'; fs.readFileSync('.specify/feature.json')",
    "import fs from 'node:fs'; fs.writeFileSync('.specify/feature.json','bad')",
    "import fs from 'node:fs'; fs.existsSync('.specify/context/00027.json')",
    "import fs from 'node:fs/promises'; await fs.readFile('.specify/context/00027.json')",
  ]) fail(s.node(code), /legacy feature state/);
  fail(s.probePowerShell("Test-Path '.specify/feature.json'"), /SDD SANDBOX BLOCKED/);
  const before = snapshot(path.join(s.repo, '.specify'));
  ok(s.cli('from-issue', [27, '--start']));
  ok(s.helper('setup-plan', ['-Json']));
  ok(s.helper('setup-tasks', ['-Json']));
  assert.deepEqual(snapshot(path.join(s.repo, '.specify')), before);
  assert.equal(readFileSync(pointer, 'utf8'), 'invalid JSON');
  assert.equal(readFileSync(cache, 'utf8'), 'obsolete context');
});

test('Disposable sandbox: test runner cleanup removes repo, bare remote and worktree after intentional failure', t => {
  const s = sandbox(t);
  const marker = path.join(s.base, 'failed-fixture-path.txt');
  const module = new URL('./sandbox/index.mjs', import.meta.url).href;
  // Running node:test as a normal Node program avoids a second test-runner
  // subprocess layer. The intentionally failing child still runs t.after.
  const result = s.node(`
    import test from 'node:test';
    import { writeFileSync } from 'node:fs';
    import path from 'node:path';
    import { sandbox } from ${JSON.stringify(module)};
    test('intentional cleanup probe', t => {
      const fixture = sandbox(t);
      writeFileSync(${JSON.stringify(marker)}, fixture.base);
      fixture.git('worktree', 'add', '-b', 'feat/00027-cleanup', path.join(fixture.base, 'second'));
      throw new Error('INTENTIONAL TEST FAILURE');
    });
  `);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stdout + result.stderr, /INTENTIONAL TEST FAILURE/);
  const removed = readFileSync(marker, 'utf8');
  assert.equal(existsSync(removed), false, 'Failed test left its temporary repository behind');
});
