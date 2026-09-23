'use strict';
/**
 * Child-process driver for tests/regression/sprint-131-expo-push-real-sdk.test.ts.
 *
 * Runs under plain Node, not Jest, because production loads expo-server-sdk through Node's own
 * require() — see that test's header. It compiles src/lib/expoPush.ts the way `npm run build` does
 * (this service's tsconfig, tsc's CommonJS emit), loads it from its real location so every require()
 * resolves as the built file's would, and substitutes only the database. EXPO_BASE_URL, when set,
 * comes from the environment the test spawns this with. Only data arrives on stdin, never code.
 *
 * stdin:  JSON { tokens, userIds, title, body, data? } — the database's rows, then the call
 * stdout: one JSON line { sdkVersion, sdkLoadedByRequire, outcome, error?, consoleErrors }
 */
const Module = require('node:module');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const util = require('node:util');
const ts = require('typescript');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(SERVICE_ROOT, 'src', 'lib', 'expoPush.ts');
const DATABASE = path.join(SERVICE_ROOT, 'src', 'database', 'db.ts');

// Nothing but loopback may be dialed from this process, so no run can ever reach exp.host.
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function connectLoopbackOnly(...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first !== null && typeof first === 'object' ? first.host : args[1];
  if (host !== undefined && !LOOPBACK.has(host)) {
    throw new Error(`egress blocked: ${host}`);
  }
  return realConnect.apply(this, args);
};

// Node 24 could strip the types itself, but that would keep import() native; the build does not.
const tsconfig = ts.readConfigFile(path.join(SERVICE_ROOT, 'tsconfig.json'), ts.sys.readFile);
if (tsconfig.error) {
  throw new Error(ts.flattenDiagnosticMessageText(tsconfig.error.messageText, '\n'));
}
const { options } = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, SERVICE_ROOT);
Module._extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  mod._compile(ts.transpileModule(source, { compilerOptions: options, fileName: filename }).outputText, filename);
};

// The one substitution: the database answers with the rows the test supplies.
let rows = [];
const database = new Module(DATABASE, module);
database.filename = DATABASE;
database.loaded = true;
database.exports = { __esModule: true, default: { query: async () => ({ rows }) } };
require.cache[DATABASE] = database;

let sdkLoadedByRequire = false;
const realRequire = Module.prototype.require;
Module.prototype.require = function recordSdkRequire(id) {
  if (id === 'expo-server-sdk') sdkLoadedByRequire = true;
  return realRequire.apply(this, arguments);
};

const consoleErrors = [];
const realConsoleError = console.error;
console.error = (...args) => {
  consoleErrors.push(args);
  realConsoleError(...args);
};

function finish(report) {
  const line = JSON.stringify({ ...report, sdkLoadedByRequire, consoleErrors });
  process.stdout.write(`${line}\n`, () => process.exit(0));
}

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  stdin += chunk;
});
process.stdin.on('end', () => {
  const call = JSON.parse(stdin);
  rows = call.tokens.map((token) => ({ expo_push_token: token }));
  const sdkEntry = require.resolve('expo-server-sdk', { paths: [path.dirname(SOURCE)] });
  const sdkManifest = path.join(path.dirname(path.dirname(sdkEntry)), 'package.json');
  const sdkVersion = JSON.parse(fs.readFileSync(sdkManifest, 'utf8')).version;
  const { sendPushToUsers } = require(SOURCE);
  sendPushToUsers(call.userIds, call.title, call.body, call.data).then(
    () => finish({ sdkVersion, outcome: 'resolved' }),
    (err) => finish({ sdkVersion, outcome: 'rejected', error: util.inspect(err, { depth: 4 }) }),
  );
});
