// Test-only boundary. Loaded in test workers and every sandbox Node subprocess.
// No command can fall back to the real gh, a shell, or a network transport.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const spawn = cp.spawnSync;
const append = fs.appendFileSync;
const inside = (base, value) => {
  const relative = path.relative(base, path.resolve(value));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
function deny(message) {
  const error = new Error(`SDD SANDBOX BLOCKED: ${message}`);
  error.code = 'SDD_SANDBOX_VIOLATION';
  throw error;
}
function guarded(command, args = [], options = {}) {
  const env = options.env || process.env;
  const base = env.SDD_SANDBOX_BASE;
  if (!base || !env.GH_BIN || env.GH_BIN !== path.join(base, 'fake-gh')) deny('mandatory fake gh missing');
  if (!inside(base, options.cwd || process.cwd())) deny('process outside temporary sandbox');
  if (options.shell) deny('shell execution');
  if (!env.NODE_OPTIONS?.replaceAll('\\', '/').includes(__filename.replaceAll('\\', '/')) || env.GIT_ALLOW_PROTOCOL !== 'file') deny('sandbox guards removed');
  let executable = command;
  let actualArgs = args;
  if (command === env.GH_BIN) {
    executable = process.execPath;
    actualArgs = [path.join(__dirname, 'fake-gh.cjs'), ...args];
  } else if (command === 'git' || command === env.SDD_GIT_BIN) {
    executable = env.SDD_GIT_BIN;
    if (!['init', 'config', 'add', 'commit', 'clone', 'switch', 'rev-parse', 'remote', 'fetch', 'push',
      'ls-remote', 'status', 'branch', 'worktree', 'update-ref', 'ls-tree', 'cat-file', 'log', 'diff', 'rm'].includes(args[0])) deny(`Git operation: ${args[0]}`);
    if (args[0] === 'push') {
      if (args.length !== 4 || args[1] !== '-u' || args[2] !== 'origin' || args[3] !== 'HEAD') deny('Git push outside first-publication contract');
      if (!inside(base, env.SDD_BARE_REMOTE)) deny('remote outside sandbox');
      const cwd = options.cwd || process.cwd();
      const resolved = spawn(executable, ['remote', 'get-url', '--push', '--all', 'origin'], {
        cwd, env, encoding: 'utf8', timeout: options.timeout || 30000, shell: false,
      });
      if (resolved.error || resolved.status !== 0) deny('cannot resolve push remote');
      const pushUrls = String(resolved.stdout || '').trim().split(/\r?\n/).filter(Boolean);
      const expected = path.resolve(env.SDD_BARE_REMOTE);
      if (!pushUrls.length || pushUrls.some(url => /^(?:[a-z][a-z0-9+.-]*:\/\/|git@|\\\\)/i.test(url) || path.resolve(cwd, url) !== expected)) {
        deny('push remote is not sandbox bare remote');
      }
    }
    if (['fetch', 'ls-remote'].includes(args[0])) {
      // The repo URL stays canonical for production preflight. Only the real
      // transport is redirected to the sandbox's own local bare repository.
      if (!inside(base, env.SDD_BARE_REMOTE)) deny('remote outside sandbox');
      actualArgs = ['-c', `url.${env.SDD_BARE_REMOTE.replaceAll('\\', '/')}.insteadOf=https://github.com/gaydevs/gaydevs-platform.git`, ...args];
    }
    if (args.some(a => /^(?:https?|ssh|git|ftp):|^git@|^\\\\/i.test(a)) &&
      !(args[0] === 'remote' && ['add', 'set-url'].includes(args[1]))) deny('external Git URL');
  } else if (command === process.execPath) {
    // Child inherits mandatory NODE_OPTIONS and this exact fake environment.
  } else if (command === env.SDD_PWSH_BIN) {
    if (args[0] !== '-NoProfile' || args[1] !== '-File' || args[2] !== path.join(__dirname, 'powershell.ps1')) deny('unguarded PowerShell');
  } else {
    deny(`executable ${command} (real gh/network tools are forbidden)`);
  }
  append(path.join(base, 'processes.jsonl'), JSON.stringify({ command, args, cwd: options.cwd }) + '\n');
  return spawn(executable, actualArgs, { ...options, env, timeout: options.timeout || 30000, shell: false });
}
cp.spawnSync = guarded;
for (const key of ['spawn', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) cp[key] = () => deny(`uncontrolled subprocess: ${key}`);
for (const [module, names] of Object.entries({
  http: ['request', 'get'], https: ['request', 'get'], net: ['connect', 'createConnection'],
  tls: ['connect'], dns: ['lookup', 'resolve', 'resolve4', 'resolve6'], dgram: ['createSocket'], http2: ['connect'],
})) {
  const target = require(`node:${module}`);
  for (const name of names) target[name] = () => deny(`network ${module}.${name}`);
}
require('node:net').Socket.prototype.connect = () => deny('network Socket.connect');
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) require('node:dns').promises[name] = () => deny(`network dns.promises.${name}`);
globalThis.fetch = () => deny('network fetch');
globalThis.WebSocket = class { constructor() { deny('network WebSocket'); } };
require('node:worker_threads').Worker = class { constructor() { deny('uncontrolled worker'); } };

// Trap legacy state access by production Node code, including mere probes.
// Fixture setup/inspection runs in the parent, without SDD_SANDBOX_BASE.
if (process.env.SDD_SANDBOX_BASE) {
  const check = value => {
    if (value instanceof URL) value = fileURLToPath(value);
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) return;
    const normalized = path.resolve(String(value)).replaceAll('\\', '/');
    if (/\/\.specify\/(feature\.json(?:$|\/)|context(?:$|\/))/i.test(normalized)) deny(`legacy feature state: ${normalized}`);
  };
  for (const name of ['readFileSync', 'writeFileSync', 'appendFileSync', 'openSync', 'existsSync', 'statSync', 'lstatSync', 'accessSync', 'mkdirSync', 'readdirSync', 'readFile', 'writeFile', 'appendFile', 'open', 'stat', 'access', 'createReadStream', 'createWriteStream']) {
    const original = fs[name];
    fs[name] = (file, ...args) => { check(file); return original(file, ...args); };
  }
  for (const name of ['readFile', 'writeFile', 'appendFile', 'open', 'stat', 'access', 'mkdir', 'readdir']) {
    const original = fs.promises[name];
    fs.promises[name] = (file, ...args) => { check(file); return original(file, ...args); };
  }
}
require('node:module').syncBuiltinESMExports();
