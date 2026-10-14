import './guard.cjs';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const executable = (name, windowsDefault) => process.platform === 'win32' ? windowsDefault : name;
export const pwsh = process.env.PWSH_BIN || executable('pwsh', 'C:/Program Files/PowerShell/7/pwsh.exe');
const gitBin = executable('git', 'C:/Program Files/Git/cmd/git.exe');
export const ok = result => {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};
export const fail = (result, pattern) => {
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, 'Expected failure but command succeeded');
  assert.match(result.stderr, pattern);
};
export function issue(number = 27, type = 'Feature', changes = {}) {
  return { number, id: 1000 + number, node_id: `I_${number}`, state: 'open', title: `Technical fixture ${number}`,
    type: type ? { name: type } : null, body: `<!-- gaydevs-sdd:${type} -->`,
    html_url: `https://github.com/gaydevs/gaydevs-platform/issues/${number}`, ...changes };
}
export function pullRequest(number = 101, issueNumber = 27, changes = {}) {
  return {
    number,
    state: 'open',
    merged: false,
    merged_at: null,
    merge_commit_sha: null,
    base: { ref: 'develop', sha: `base-${number}` },
    head: { ref: `techdebt/${String(issueNumber).padStart(5, '0')}-technical-fixture-${issueNumber}`, sha: `head-${number}` },
    body: `Spec: ${String(issueNumber).padStart(5, '0')}\nRefs #${issueNumber}`,
    html_url: `https://github.com/gaydevs/gaydevs-platform/pull/${number}`,
    ...changes,
  };
}
export function initialState() {
  return {
    issues: { 27: issue(), 28: issue(28, 'Bug'), 29: issue(29, 'Tech Debt') },
    pulls: {}, pullFiles: {}, compares: {},
    comments: {}, fields: {}, dependencies: {}, items: {}, failures: [],
    project: { id: 'P_1', title: 'gaydevs project', fields: { nodes: [{ id: 'STATUS', name: 'Status',
      options: ['Backlog', 'Specifying', 'Ready', 'In Progress', 'Review', 'Ready for Release', 'Done', 'Rejected', 'Canceled'].map((name, i) => ({ id: `S_${i}`, name })) }] } },
  };
}
export function snapshot(directory, relative = '') {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (!relative && entry.name === '.git') return [];
    const name = path.join(relative, entry.name);
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? [[name, 'directory'], ...snapshot(file, name)] : [[name, readFileSync(file).toString('base64')]];
  });
}
export function sandbox(t, { specs = [], state = initialState() } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'gdevs-sdd-sandbox-'));
  const repo = path.join(base, 'repo with spaces');
  const remote = path.join(base, 'remote.git');
  const beforeCleanup = [];
  const cleanup = () => {
    const target = path.resolve(base);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.match(path.basename(target), /^gdevs-sdd-sandbox-/);
    if (!existsSync(target)) return;
    try { for (const check of beforeCleanup) check(); }
    finally { rmSync(target, { recursive: true, force: true, maxRetries: 3 }); }
    assert.equal(existsSync(target), false, 'Sandbox cleanup left residue');
  };
  // Register immediately: setup failures are cleaned too, not just test failures.
  t.after(cleanup);
  mkdirSync(repo);
  const stateFile = path.join(base, 'github.json');
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(?:SPECIFY_|SPECKIT_|GIT_|GH_|GITHUB_|SSH_|NODE_OPTIONS$|SDD_|.*TOKEN|.*PROXY|.*PASSWORD|.*SECRET)/i.test(key)) delete env[key];
  }
  const blankGit = path.join(base, 'gitconfig');
  writeFileSync(blankGit, '');
  Object.assign(env, {
    SDD_SANDBOX_BASE: base, SDD_BARE_REMOTE: remote, SDD_GIT_BIN: gitBin,
    SDD_PWSH_BIN: pwsh, SDD_NODE_BIN: process.execPath,
    GH_BIN: path.join(base, 'fake-gh'), GH_CONFIG_DIR: path.join(base, 'gh-config'),
    NODE_OPTIONS: `--require "${path.join(here, 'guard.cjs').replaceAll('\\', '/')}"`,
    GIT_CONFIG_GLOBAL: blankGit, GIT_CONFIG_NOSYSTEM: '1', GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: path.join(base, 'no-hooks'),
    GIT_CONFIG_KEY_1: 'commit.gpgsign', GIT_CONFIG_VALUE_1: 'false',
  });
  let requestId = 0;
  const s = {
    base, repo, remote, env, cleanup, beforeCleanup,
    run(command, args, cwd = repo, overrides = {}) {
      return spawnSync(command, args, { cwd, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 30000 });
    },
    git(...args) { return ok(s.run('git', args)); },
    node(code, overrides = {}, cwd = repo) { return s.run(process.execPath, ['--input-type=module', '-e', code], cwd, overrides); },
    cli(script, args = [], overrides = {}, cwd = repo) {
      return s.run(process.execPath, [path.join(cwd, 'scripts/sdd', `${script}.mjs`), ...args.map(String)], cwd, overrides);
    },
    helper(name = 'check-prerequisites', args = ['-Json', '-PathsOnly'], overrides = {}, cwd = repo, projectRoot = cwd) {
      const request = path.join(base, `request-${requestId++}.json`);
      writeFileSync(request, JSON.stringify({ repo: projectRoot, script: path.join(projectRoot, '.specify/scripts/powershell', `${name}.ps1`), arguments: args, common: name === 'common' }));
      return s.run(pwsh, ['-NoProfile', '-File', path.join(here, 'powershell.ps1'), request], cwd, overrides);
    },
    probePowerShell(source) {
      const script = path.join(base, `probe-${requestId++}.ps1`);
      const request = path.join(base, `request-${requestId++}.json`);
      writeFileSync(script, source);
      writeFileSync(request, JSON.stringify({ repo, script, arguments: [] }));
      return s.run(pwsh, ['-NoProfile', '-File', path.join(here, 'powershell.ps1'), request]);
    },
    state() { return JSON.parse(readFileSync(stateFile, 'utf8')); },
    change(fn) { const current = s.state(); fn(current); writeFileSync(stateFile, JSON.stringify(current)); },
    calls() { const file = path.join(base, 'github-calls.jsonl'); return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []; },
    clearCalls() { writeFileSync(path.join(base, 'github-calls.jsonl'), ''); },
    mutations() { return s.calls().filter(c => c.method !== 'GET' && !(c.endpoint === 'graphql' && c.body.query.startsWith('query('))); },
    noPointer() { assert.equal(existsSync(path.join(repo, '.specify/feature.json')), false); assert.equal(existsSync(path.join(repo, '.specify/context')), false); },
  };
  writeFileSync(stateFile, JSON.stringify(state));
  try {
    cpSync(path.join(root, '.specify'), path.join(repo, '.specify'), { recursive: true,
      filter: source => !['feature.json', 'context'].includes(path.basename(source)) });
    cpSync(path.join(root, 'scripts/sdd'), path.join(repo, 'scripts/sdd'), { recursive: true });
    cpSync(path.join(root, '.gitignore'), path.join(repo, '.gitignore'));
    const config = JSON.parse(readFileSync(path.join(root, '.github/sdd.json'), 'utf8'));
    config.projectNumber = 1; config.priorityFieldId = 99;
    mkdirSync(path.join(repo, '.github'));
    writeFileSync(path.join(repo, '.github/sdd.json'), JSON.stringify(config));
    mkdirSync(path.join(repo, 'specs'));
    writeFileSync(path.join(repo, 'specs/README.md'), 'Technical sandbox only.\n');
    for (const name of specs) {
      mkdirSync(path.join(repo, 'specs', name));
      writeFileSync(path.join(repo, 'specs', name, 'spec.md'), '# Technical fixture\n');
    }
    s.git('init', '-b', 'develop');
    s.git('config', 'user.name', 'SDD sandbox');
    s.git('config', 'user.email', 'sandbox@example.invalid');
    s.git('add', '.'); s.git('commit', '-m', 'sandbox baseline');
    s.git('clone', '--bare', repo, remote);
    s.git('remote', 'add', 'origin', 'https://github.com/gaydevs/gaydevs-platform.git');
    s.git('fetch', 'origin', 'develop');
    return s;
  } catch (error) { cleanup(); throw error; }
}
