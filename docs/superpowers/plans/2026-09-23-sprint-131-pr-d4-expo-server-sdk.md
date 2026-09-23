# Sprint 131 D4 — expo-server-sdk 6.1.0 → 7.2.0 (#230) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade notification-service's `expo-server-sdk` from 6.1.0 to 7.2.0, adding the first test that runs the real SDK the way production loads it, because until now nothing exercised it.

**Architecture:** The install side is Dependabot #230's commit, taken unchanged. The work that matters is a regression test that runs the real `src/lib/expoPush.ts` in a plain `node` child. The child compiles it with the service's own tsconfig (so `import()` becomes `require()`, as in the build), resolves modules from the file's real location, and substitutes only the database. The real SDK talks to a local stub of Expo's push API through `EXPO_BASE_URL`, and the child can dial nothing but loopback. The same test must pass before the bump (6.1.0) and after it (7.2.0).

**Tech Stack:** TypeScript 5 (`module: commonjs`), Node 24, Jest 30 + ts-jest, expo-server-sdk 6.1.0 → 7.2.0 (pure ESM, undici transport).

**Spec:** [Sprint 131 design](../specs/2026-09-15-sprint-131-maintenance-design.md) — row D4: "#230 expo-server-sdk 6 → 7 | notification; push payload and response handling" — plus the D4 row of `.claude/handoff/CURRENT_HANDOFF.md`, **as corrected by *Verified findings* V4 below**.

---

## Global Constraints

- **Dependency lane:** held by Claude, confirmed by the maintainer on 2026-09-23 ("You hold the dependency lane... so, proceed"). The only dependency change is Dependabot #230's commit: one manifest line and five lockfile lines. Beyond that, only the root `version` changes. Never run `npm install --workspace`, `npm dedupe` or a lockfile regeneration. Prove the lockfile with a strict `npx -y npm@11.19.0 ci`.
- **No real push notification may be sent** by any test, probe or verification step. Tests talk only to the local stub, and the live smoke test uses empty request bodies (the BUG-051 convention).
- **No ADR and no demo data operation.** The only contact with the demo host is the optional read-only container probe in Task 5, which needs its own per-operation authorization.
- **Version** comes from `origin/master` at merge time. Master is `8fbbeb5f` = **11.65.0**, so this PR is **11.66.0** unless master moves first.
- **Branch:** `agent/claude/sprint-131-d4-expo-server-sdk`, cut from the deployed `8fbbeb5f`.
- **Node floor is unchanged.** v7's `engines` is `>=22.12.0`, below our gate-locked 24 (`docs/gotchas/node-24-is-a-gate-locked-floor.md`). Do not touch any `engines` field.
- **Windows box:** use `node` for HTTP/JSON probes, not `curl`/`jq`. Run the full local suite with `--concurrency=2`. Capture exit codes separately (`| tail` masks them). Run root regression gates as `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`.
- **Landing churn:** a full test run regenerates `apps/landing/src/data/docs/`. Revert timestamp- and HEAD-sha-only churn, and keep real content changes. `services/notification-service.json` will change, because `CONTEXT.md` changes.
- **Merges need explicit per-PR maintainer authorization.** One merge and deploy at a time.

---

## Verified findings (read before Task 1)

All of these were read from source, the registry or the installed packages, or proven by probe, on 2026-09-23.

**V1 — #230 is exactly the manifest mechanics.** Head `f358f648a4c9c8d581d22abfe2cd9bacd6ed381f`, whose parent is `8fbbeb5f` (the deployed master). It touches two files:
- `services/notification-service/package.json`: `^6.1.0` → `^7.2.0`.
- `package-lock.json` (+5/−5): the package node's `version`, `resolved`, `integrity` and `engines`, plus the workspace node's range.

Every check passes except Deploy to Demo, which is skipped as on every PR. There is one importer, `src/lib/expoPush.ts`, and one declarer (`git grep` over tracked source, excluding the lockfile).

**V2 — the whole v7 change is small.** This comes from diffing the two published tarballs (`npm pack expo-server-sdk@6.1.0 expo-server-sdk@7.2.0`), not the changelog. `build/ExpoClient.js` and its `.d.ts` differ by 34 diff lines:
- `import packageJson from '../package.json' with { type: 'json' }` replaces `createRequire(import.meta.url)` + `require('../package.json')`.
- `Headers` is now imported from `undici`.
- The types gain optional message fields: `threadId`, `targetContentId`, `relevanceScore`, `filterCriteria` and `contentAvailable`.
- `engines.node` moves from `>=20` to `>=22.12.0`.

`type: module`, `exports` and the three dependencies are identical.

**V3 — the surface this service uses is unchanged.** Read from `build/ExpoClient.js` 7.2.0:
- It has both `export class Expo` and `export default Expo`, and the constructor is `constructor(options = {})`.
- `sendPushNotificationsAsync` gzips any body over 1024 bytes.
- It requires exactly one ticket per message, or throws `Expected Expo to respond with N tickets but got M`.
- It retries only a 429 (twice, with a minimum 1 s backoff). Any other non-200 throws an error carrying the first API error's `message`.
- The endpoint is `${process.env.EXPO_BASE_URL || 'https://exp.host'}/--/api/v2/push/send`, read once at module load (`build/ExpoClientValues.js`).

**V4 — production does not load the SDK with `import()`.** This corrects the handoff's D4 row and the comment at `src/lib/expoPush.ts:3`. The service compiles with `"module": "commonjs"` (`tsconfig.json:4`). Both the existing `dist/lib/expoPush.js:46` and a fresh `tsc` emit contain `const mod = await Promise.resolve().then(() => __importStar(require('expo-server-sdk')));`. A pure-ESM package loads that way only because Node can `require()` an ES module. On Node 24.11.1, `require('expo-server-sdk').__esModule === true` and `.default` is the class, for both 6.1.0 and 7.2.0, so `__importStar` passes it through unchanged.

**V5 — no test touches the SDK.** `tests/regression/sprint-131-push-internal-auth.test.ts:28` mocks `../../src/lib/expoPush` entirely, so a green suite says nothing about v7.

**V6 — a broken SDK would pass every health check.** `sendPushToUsers` is called from four event handlers in `src/events/subscriber.ts`: `provider_went_on_duty` (:370), `offer_submitted` (:390), `offer_accepted` (:409) and `offer_declined` (:428). It is also called from the internal route `src/routes/push.ts:21`. `getExpoModule()` loads the SDK lazily, on the first send, so the deploy's health checks never load it.

**V7 — CodeQL treats local input as tainted.** `gh api repos/ravichavali/karmyq/code-scanning/default-setup` returns `query_suite: extended` and `threat_model: remote_and_local`, so stdin, env, argv and file reads are taint sources. A harness that evaluates code received over stdin (`new Function`) would likely raise a code-injection alert, which the ADR-060 gate blocks. **The design below therefore sends only data to the child process, never code.** The child compiles the repo's own source from a constant path.

**V8 — the harness was prototyped before this plan was written.** The five cases in Task 1 ran in the scratchpad, first against the installed 6.1.0 and then, with the first harness design, against an extracted 7.2.0. The outcomes were identical. Each child run takes about 0.5 s, mostly loading `typescript`. Switching the child's transpile to `module: node16` (which keeps `import()` native) changed only `sdkLoadedByRequire`, to `false`, and every behavioral outcome stayed the same.

---

## Review Focus

Inputs the spec implies that a person using push would hit, most likely first. Each is pinned by a Task 1 case, noted in brackets:

1. **A recipient's device is no longer registered.** Expo answers that message with an error ticket. The other recipients must still be sent to, and the failure logged with Expo's message and details. [case 1]
2. **More than 100 recipients** (a busy community). They must be sent in chunks of at most 100, all of them, in order. [case 2]
3. **Only malformed tokens are stored** (for example `ExponentPushToken[` with no closing bracket). Nothing is sent, and nothing crashes. [case 3]
4. **Expo's API is down** (HTTP 500). `sendPushToUsers` must reject rather than swallow the error, so the calling event handler's `catch` logs `❌ Failed to process …`. [case 4]
5. **The SDK fails to load under Node's `require()`, or its default-export shape changes.** This is the actual v6→v7 risk. Every case fails, as injection I1 proves, and case 1 pins the `require()` path itself.

Deliberately not covered: the SDK's own 429 retry with backoff. It is SDK-internal and costs at least a second per retry.

---

## File map

| File | Change |
|---|---|
| `services/notification-service/tests/helpers/expo-push-child.cjs` | **Create.** Plain-Node driver: loopback-only guard, `.ts` compile hook using the service tsconfig, database substitution, report as one JSON line |
| `services/notification-service/tests/regression/sprint-131-expo-push-real-sdk.test.ts` | **Create** (starts in `tests/tdd/`). Stub Expo API plus five cases |
| `services/notification-service/src/lib/expoPush.ts:3` | Comment only: describe the real load path |
| `services/notification-service/package.json:23`, `package-lock.json` | Dependabot #230's commit, cherry-picked unchanged |
| `services/notification-service/CONTEXT.md` | Correct the push-token docs: drop the `notifications.push_tokens` table (no migration creates it), list `auth.device_push_tokens` under tables read, replace the stale "Implement Push Notifications (Mobile)" recipe; append a *Sprint 131 D4* section |
| `package.json:3`, `package-lock.json:3,9` | `11.65.0` → `11.66.0` |
| `.claude/handoff/CURRENT_HANDOFF.md` | D4 state, evidence, next action |
| `apps/landing/src/data/docs/services/notification-service.json` | Regenerated from `CONTEXT.md`; commit the content change |

---

### Task 1: Pin the real SDK path with a production-shaped test (on 6.1.0)

**Files:**
- Create: `services/notification-service/tests/helpers/expo-push-child.cjs`
- Create: `services/notification-service/tests/tdd/sprint-131-expo-push-real-sdk.test.ts` (moved to `tests/regression/` in Step 6)
- Modify: `services/notification-service/src/lib/expoPush.ts:3` (comment only)

**Interfaces:**
- Consumes: `sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void>` from `src/lib/expoPush.ts`. `pool.query` from `src/database/db.ts` (default export) is replaced.
- Produces: the child's contract, which is stdin JSON `{ tokens, userIds, title, body, data? }` → one stdout JSON line `{ sdkVersion, sdkLoadedByRequire, outcome: 'resolved' | 'rejected', error?, consoleErrors }`. The child reads `EXPO_BASE_URL` from its environment. Task 2 runs this same test again, unchanged.

- [ ] **Step 1: Write the child driver**

Create `services/notification-service/tests/helpers/expo-push-child.cjs`:

```js
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
```

- [ ] **Step 2: Write the test (TDD tier first)**

Create `services/notification-service/tests/tdd/sprint-131-expo-push-real-sdk.test.ts`:

```ts
/**
 * Sprint 131 D4 — expo-server-sdk 6 → 7 (#230), exercised through the REAL SDK, loaded the way production loads it.
 *
 * `sprint-131-push-internal-auth.test.ts` mocks `sendPushToUsers`, so before this file no test touched the SDK:
 * a green suite said nothing about a major bump. Nor does production load the SDK the way src/lib/expoPush.ts
 * reads. This service compiles with "module": "commonjs", so tsc turns its `await import('expo-server-sdk')` into
 * `require('expo-server-sdk')`, and a pure-ESM package loads that way only because Node itself can require() an
 * ES module. Jest runs its own module loader rather than Node's, so each case runs the service's code in a plain
 * `node` child (tests/helpers/expo-push-child.cjs). The child compiles expoPush.ts with this service's own
 * tsconfig, resolves every module from the file's real location, and substitutes only the database. The real SDK
 * talks to a local stub of Expo's push API through EXPO_BASE_URL. The child can dial nothing but loopback, so no
 * run can reach exp.host, and the last case proves that guard is armed.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

interface Message {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

interface ExpoRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  messages: Message[];
}

interface ChildReport {
  sdkVersion: string;
  sdkLoadedByRequire: boolean;
  outcome: 'resolved' | 'rejected';
  error?: string;
  consoleErrors: unknown[][];
}

interface PushCall {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const CHILD = path.resolve(__dirname, '..', 'helpers', 'expo-push-child.cjs');

const OFFER_RECEIVED = {
  title: 'Someone offered to help',
  body: 'You received an offer for $20. Tap to review.',
  data: { type: 'offer_received' },
};

let stub: http.Server;
let stubUrl: string;
let received: ExpoRequest[] = [];
let answer: (messages: Message[]) => { status: number; body: unknown };

const okTickets = (messages: Message[]) => ({
  status: 200,
  body: { data: messages.map((_, i) => ({ status: 'ok', id: `ticket-${i}` })) },
});

// Below Jest's 30 s testTimeout, so a stalled SDK request fails here, with the child's own output.
const CHILD_DEADLINE_MS = 20_000;
const liveChildren = new Set<ChildProcess>();

/** Run sendPushToUsers in a plain `node` child and return what it reports. */
function sendInChild(call: PushCall, { expoBaseUrl }: { expoBaseUrl?: string } = {}): Promise<ChildReport> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.EXPO_BASE_URL;
    if (expoBaseUrl) env.EXPO_BASE_URL = expoBaseUrl;
    const child = spawn(process.execPath, [CHILD], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    liveChildren.add(child);
    let stdout = '';
    let stderr = '';
    const deadline = setTimeout(() => {
      child.kill();
      reject(new Error(`push child still running after ${CHILD_DEADLINE_MS} ms; killed\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, CHILD_DEADLINE_MS);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (err) => {
      clearTimeout(deadline);
      liveChildren.delete(child);
      reject(err);
    });
    child.on('close', (exitCode) => {
      clearTimeout(deadline);
      liveChildren.delete(child);
      const lastLine = stdout.trim().split('\n').pop() ?? '';
      try {
        if (exitCode !== 0) throw new Error(`exit code ${exitCode}`);
        resolve(JSON.parse(lastLine) as ChildReport);
      } catch (err) {
        reject(new Error(`push child did not finish (${(err as Error).message})\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }
    });
    child.stdin.end(JSON.stringify({ userIds: ['user-1'], ...call }));
  });
}

beforeAll(async () => {
  stub = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      // The SDK gzips any request body over 1 KiB, so 100 messages always arrive compressed.
      const json = (req.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(raw) : raw).toString('utf8');
      const messages = JSON.parse(json) as Message[];
      received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, messages });
      const { status, body } = answer(messages);
      res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
});

afterAll(async () => {
  // Backstop for a child Jest gave up on: kill it and drop its socket, or close() waits on that socket.
  for (const child of liveChildren) child.kill();
  stub.closeAllConnections();
  await new Promise<void>((resolve) => stub.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  answer = okTickets;
});

describe('sendPushToUsers through the real expo-server-sdk (Sprint 131 D4)', () => {
  it('sends one message per valid token and logs each error ticket with its message and details', async () => {
    const unregistered = '"ExponentPushToken[aaa]" is not a registered push notification recipient';
    const details = { error: 'DeviceNotRegistered', expoPushToken: 'ExponentPushToken[aaa]' };
    answer = (messages) => ({
      status: 200,
      body: {
        data: messages.map((_, i) =>
          i === 0 ? { status: 'error', message: unregistered, details } : { status: 'ok', id: `ticket-${i}` },
        ),
      },
    });

    const report = await sendInChild(
      { tokens: ['ExponentPushToken[aaa]', 'not-a-token', 'ExponentPushToken[bbb]'], ...OFFER_RECEIVED },
      { expoBaseUrl: stubUrl },
    );

    expect(report.outcome).toBe('resolved');
    // How production loads it (see the header); changing this service's "module" setting fails here first.
    expect(report.sdkLoadedByRequire).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].method).toBe('POST');
    expect(received[0].url).toBe('/--/api/v2/push/send');
    expect(received[0].headers['content-type']).toBe('application/json');
    // Built by the SDK's own code: v7 reads this version through its new JSON import.
    expect(received[0].headers['user-agent']).toBe(`expo-server-sdk-node/${report.sdkVersion}`);
    expect(received[0].messages).toEqual([
      { to: 'ExponentPushToken[aaa]', ...OFFER_RECEIVED },
      { to: 'ExponentPushToken[bbb]', ...OFFER_RECEIVED },
    ]);
    expect(report.consoleErrors).toEqual([['[expoPush] Push ticket error:', unregistered, details]]);
  });

  it('splits more than 100 recipients into chunks of at most 100, and sends data as {} when none is given', async () => {
    const tokens = Array.from({ length: 101 }, (_, i) => `ExponentPushToken[t${i}]`);
    const title = 'Offer accepted!';
    const body = 'Your offer was accepted. Check your commitments.';

    const report = await sendInChild({ tokens, title, body }, { expoBaseUrl: stubUrl });

    expect(report.outcome).toBe('resolved');
    expect(received.map((request) => request.messages.length)).toEqual([100, 1]);
    expect(received.flatMap((request) => request.messages)).toEqual(
      tokens.map((to) => ({ to, title, body, data: {} })),
    );
    expect(report.consoleErrors).toEqual([]);
  });

  it('sends nothing when no stored token is a valid Expo push token', async () => {
    const report = await sendInChild(
      { tokens: ['not-a-token', 'ExponentPushToken[unterminated'], ...OFFER_RECEIVED },
      { expoBaseUrl: stubUrl },
    );

    expect(report.outcome).toBe('resolved');
    expect(received).toHaveLength(0);
    expect(report.consoleErrors).toEqual([]);
  });

  it('rejects when the push API answers with an error, so the event handler that called it logs the failure', async () => {
    answer = () => ({ status: 500, body: { errors: [{ code: 'INTERNAL_SERVER_ERROR', message: 'stub outage' }] } });

    const report = await sendInChild({ tokens: ['ExponentPushToken[aaa]'], ...OFFER_RECEIVED }, { expoBaseUrl: stubUrl });

    expect(report.outcome).toBe('rejected');
    expect(report.error).toContain('stub outage');
    expect(received).toHaveLength(1); // not retried: the SDK retries only a 429
  });

  it('cannot reach the real Expo service: without EXPO_BASE_URL the SDK dials exp.host and the child blocks it', async () => {
    const report = await sendInChild({ tokens: ['ExponentPushToken[aaa]'], ...OFFER_RECEIVED });

    expect(report.outcome).toBe('rejected');
    expect(report.error).toContain('egress blocked: exp.host');
    expect(received).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run it on the installed 6.1.0**

This test describes existing behavior, so it should pass on first run. Step 4 is where each assertion is shown to be capable of failing.

```bash
cd services/notification-service && npx jest --runTestsByPath tests/tdd/sprint-131-expo-push-real-sdk.test.ts; echo "exit=$?"
```

Expected: `Tests: 5 passed, 5 total`, `exit=0`. If the run fails, the error message carries the child's stdout and stderr. Read them before changing anything.

- [ ] **Step 4: Prove each assertion can fail (inject, run, restore)**

Apply each injection alone, run the Step 3 command, record the count, then restore with `git checkout -- services/notification-service/src/lib/expoPush.ts` (I1–I4) or `git checkout -- services/notification-service/tsconfig.json` (I5). Confirm `git status --short` shows no change to `src/` or `tsconfig.json` afterwards.

| # | File | Replace | With | Expected |
|---|---|---|---|---|
| I1 | `src/lib/expoPush.ts` | `    _ExpoClass = mod.default;` | `    _ExpoClass = mod;` | **5 failed** — every case rejects with `_ExpoClass is not a constructor` (the v6→v7 export-shape risk) |
| I2 | `src/lib/expoPush.ts` | `      if (ticket.status === 'error') {` | `      if (ticket.status === 'failed') {` | **1 failed** — case 1, `consoleErrors` is empty |
| I3 | `src/lib/expoPush.ts` | the line `    .filter((token: string) => Expo.isExpoPushToken(token))` | *(delete the line)* | **2 failed** — case 1 (3 messages) and case 3 (1 request) |
| I4 | `src/lib/expoPush.ts` | `  for (const chunk of chunks) {` | `  for (const chunk of chunks.slice(0, 1)) {` | **1 failed** — case 2, `[100]` instead of `[100, 1]` |
| I5 | `tsconfig.json` | `"module": "commonjs",` and `"moduleResolution": "node",` | `"module": "node16",` and `"moduleResolution": "node16",` | **1 failed** — case 1, `sdkLoadedByRequire` is `false`; every behavioral assertion still passes |

Case 5 is the guard's own proof: its error can come only from the `egress blocked:` throw in the child. **Never inject by disabling the guard**, because that would let the SDK reach the real `exp.host`.

**I6 — the deadline (plan-review finding, 2026-09-23).** It proves that a stalled push API cannot leave a child process or socket behind. The test file is untracked at this point, so `git checkout` cannot restore it: undo both edits by hand afterwards.
1. In the stub handler, delete the line `      res.end(JSON.stringify(body));`, so the stub accepts requests and never answers.
2. Set `const CHILD_DEADLINE_MS = 3_000;`.
3. Run the Step 3 command with `-t 'sends one message per valid token'`.

Expected: **1 failed** in about 3–4 s, with `push child still running after 3000 ms; killed`. Jest then exits on its own, with no "did not exit one second after the test run" warning and no open-handle report. Undo both edits and re-run Step 3: **5 passed**.

- [ ] **Step 5: Correct the load-mechanism comment**

In `services/notification-service/src/lib/expoPush.ts`, replace line 3:

```ts
// expo-server-sdk v6+ is pure ESM; dynamic import() works in CommonJS modules for ESM packages
```

with:

```ts
// expo-server-sdk is pure ESM. This service compiles with "module": "commonjs", so tsc emits the
// import() below as require('expo-server-sdk'): it loads only because Node can require() an ES module
// (v7's engines floor is Node 22.12; we run 24), and `.default` is the Expo class because Node marks
// the result __esModule. tests/regression/sprint-131-expo-push-real-sdk.test.ts runs this exact path.
```

- [ ] **Step 6: Move the test to the blocking tier by hand**

Move it with `mv`, not the promoter, which would sweep unrelated green `tdd/` files repo-wide. notification-service's `npm test` runs `tests/unit` and `tests/regression` only, so a test left in `tdd/` would not block.

```bash
cd services/notification-service
mv tests/tdd/sprint-131-expo-push-real-sdk.test.ts tests/regression/sprint-131-expo-push-real-sdk.test.ts
npm test; echo "exit=$?"
npx tsc --noEmit -p tsconfig.json; echo "tsc exit=$?"
```

Expected: the regression run lists `PASS tests/regression/sprint-131-expo-push-real-sdk.test.ts` with 5 tests, and the other regression suites (`notificationTemplates`, `sprint-81-sse-auth`, `sprint-131-push-internal-auth`) still pass. `exit=0`, `tsc exit=0`.

- [ ] **Step 7: Commit**

```bash
git add services/notification-service/tests/helpers/expo-push-child.cjs \
        services/notification-service/tests/regression/sprint-131-expo-push-real-sdk.test.ts \
        services/notification-service/src/lib/expoPush.ts
git commit -F - <<'EOF'
test(notification): run the real expo-server-sdk the way production loads it (Sprint 131 D4)

No test exercised expo-server-sdk: the BUG-051 suite mocks sendPushToUsers out. And production does not
load it with import(): this service compiles "module": "commonjs", so tsc emits require('expo-server-sdk'),
which works only because Node can require() an ES module. The new regression test runs the real
src/lib/expoPush.ts in a plain node child (Jest's loader is not production's), compiled with the service
tsconfig, database substituted, real SDK against a local stub of Expo's push API. The child can dial only
loopback, and a 20 s deadline kills a stalled child. Five cases, green on 6.1.0; five injections each
proven to fail it, and a sixth proving a stalled push API leaves no child or socket behind.

Also corrects expoPush.ts's comment, which described a dynamic import() that the build never emits.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Take Dependabot's v7 commit and prove the same test on 7.2.0

**Files:**
- Modify (via the cherry-pick): `services/notification-service/package.json:23`, `package-lock.json` (the `node_modules/expo-server-sdk` node and the notification-service workspace node)

**Interfaces:**
- Consumes: Task 1's test and child driver, unchanged.
- Produces: `expo-server-sdk@7.2.0` installed locally and locked. Task 3 documents it.

- [ ] **Step 1: Record the `npm ls` baseline**

```bash
npm ls --all 2>&1 | grep -E "^npm error (invalid|missing|extraneous|peer dep)" | sort > "$SCRATCH/npm-ls-before.txt"; cat "$SCRATCH/npm-ls-before.txt"
```

(`$SCRATCH` is the session scratchpad.) Expected: exactly the four BUG-047 baseline lines, `invalid: color-string@2.1.4`, `invalid: ms@2.0.0`, `invalid: picomatch@2.3.2` and `missing: @react-native/metro-config@*`.

- [ ] **Step 2: Re-check #230 against the current master**

```bash
gh pr view 230 --json headRefOid,state --template '{{.headRefOid}} {{.state}}{{"\n"}}'
git fetch origin master dependabot/npm_and_yarn/expo-server-sdk-7.2.0
git log -1 --format='%H parent=%P' FETCH_HEAD
```

Expected: `f358f648a4c9c8d581d22abfe2cd9bacd6ed381f OPEN`, and its parent is `8fbbeb5f…`. If Dependabot has re-pushed, use the new head, but only if its parent is the current `origin/master` and its diff is still exactly the two files.

- [ ] **Step 3: Cherry-pick it unchanged**

```bash
git cherry-pick f358f648a4c9c8d581d22abfe2cd9bacd6ed381f
git show --stat --format='%an | %s' HEAD
```

Expected: author `dependabot[bot]`. Exactly `package-lock.json | 10 +++++-----` and `services/notification-service/package.json | 2 +-`.

- [ ] **Step 4: Strict install from the lockfile, and prove the lockfile was not rewritten**

```bash
npx -y npm@11.19.0 ci; echo "ci exit=$?"
git diff --exit-code -- package-lock.json package.json services/notification-service/package.json; echo "lock untouched=$?"
```

Expected: `ci exit=0`, `lock untouched=0`. If `npm ci` fails with `EPERM` on Windows, a process is holding a file in `node_modules`. Close editors and terminals running Jest or tsc, then retry. Never fall back to `npm install`.

- [ ] **Step 5: Prove what is installed and that nothing else moved**

```bash
cd services/notification-service
echo '{"tokens":[],"userIds":["u"],"title":"t","body":"b"}' | node tests/helpers/expo-push-child.cjs
cd ../..
npm ls expo-server-sdk
npm ls --all 2>&1 | grep -E "^npm error (invalid|missing|extraneous|peer dep)" | sort | diff "$SCRATCH/npm-ls-before.txt" -; echo "npm ls problems unchanged=$?"
```

Expected:
- The child prints `"sdkVersion":"7.2.0"`, resolved from the service's real location as the build's would be. With no tokens, nothing is sent and the SDK is not loaded, so `sdkLoadedByRequire` is `false` in this probe only.
- `npm ls` shows `karmyq-notification-service` → `expo-server-sdk@7.2.0`.
- `npm ls problems unchanged=0`.

- [ ] **Step 6: The same test, now on 7.2.0**

```bash
cd services/notification-service
npx jest --runTestsByPath tests/regression/sprint-131-expo-push-real-sdk.test.ts; echo "exit=$?"
npm test; echo "service suite exit=$?"
npx tsc --noEmit -p tsconfig.json; echo "tsc exit=$?"
cd ../..
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-workspace-declarations.test.ts --runInBand; echo "declarations exit=$?"
```

Expected: `5 passed` and every exit `0`. The User-Agent assertion now matches `expo-server-sdk-node/7.2.0`, which proves v7's JSON import loaded under `require()`. v7's type additions are optional fields, and `expoPush.ts` types the SDK as `any`, so `tsc` is unaffected.

No new commit: the cherry-pick is this task's commit.

---

### Task 3: Documentation, version and handoff

**Files:**
- Modify: `services/notification-service/CONTEXT.md` (the recipe at *Implement Push Notifications (Mobile)*, and the end of the file)
- Modify: `package.json:3`, `package-lock.json:3,9`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: Tasks 1–2's verified facts (V1–V8, the injection table, the 7.2.0 run).
- Produces: `CONTEXT.md` content that the landing prebuild turns into `apps/landing/src/data/docs/services/notification-service.json` in Task 4.

- [ ] **Step 1: Correct the push-token docs in `CONTEXT.md`**

`notifications.push_tokens` exists in no migration. The generated `infrastructure/postgres/init.sql` has only `auth.device_push_tokens`, and `git grep` finds the name only in this file, its generated landing JSON and an archived doc. Three edits make the file agree with the code:

(a) In *Tables Owned by This Service*, delete the block that runs from `-- notifications.push_tokens` through its closing `);`, together with the blank line that follows it.

(b) In *Tables Read by This Service*, after the `auth.users` line, add:

```markdown
- `auth.device_push_tokens` - Expo push tokens, read by `src/lib/expoPush.ts` (auth-service writes them)
```

(c) Replace the recipe. The subsection that starts at `### Implement Push Notifications (Mobile)` and runs up to, but not including, `### Add Email Notifications` has three numbered steps. They show a `src/services/pushNotificationService.ts` that does not exist, and they read tokens from the nonexistent table. Replace that whole subsection with:

```markdown
### Push Notifications (Mobile) — already implemented

Push delivery exists; extend it rather than following an older recipe.

- **Token registration** is in auth-service: `POST /auth/push-tokens` and `DELETE /auth/push-tokens`
  (`services/auth-service/src/routes/pushTokens.ts`) write `auth.device_push_tokens`.
- **Delivery** is `sendPushToUsers()` in `src/lib/expoPush.ts`: it reads those tokens, drops any that
  `Expo.isExpoPushToken` rejects, sends in chunks of at most 100, and logs error tickets.
- **Callers** are the `provider_went_on_duty`, `offer_submitted`, `offer_accepted` and `offer_declined`
  handlers in `src/events/subscriber.ts`, plus the internal `POST /notifications/push/send` route.
- The SDK is pure ESM and reaches this CommonJS build through `require()` — see *Sprint 131 D4* below.
```

- [ ] **Step 2: Append the D4 section at the end of `CONTEXT.md`**

```markdown
## Sprint 131 D4 — expo-server-sdk 7 (2026-09-23)

`expo-server-sdk` **6.1.0 → 7.2.0** (#230). This service is its only declarer and `src/lib/expoPush.ts` its
only importer. The whole v7 code change, read from the two published packages rather than the changelog: the
SDK reads its own version through a JSON import (`with { type: 'json' }`) instead of `createRequire`; its
engines floor is Node `>=22.12.0` (was `>=20`; we run 24); and its types gain optional message fields.
Everything this service calls — the default export, a no-argument constructor, `Expo.isExpoPushToken`,
`chunkPushNotifications`, `sendPushNotificationsAsync` — is unchanged.

**How the SDK actually loads.** `expoPush.ts` says `await import('expo-server-sdk')`, but this service compiles
with `"module": "commonjs"`, so tsc emits `require('expo-server-sdk')`. A pure-ESM package loads that way only
because Node can `require()` an ES module, and `.default` is the `Expo` class because Node marks the result
`__esModule`. The comment that described a dynamic `import()` was wrong and is corrected.

`tests/regression/sprint-131-expo-push-real-sdk.test.ts` is the first test to exercise the SDK at all — the
BUG-051 suite mocks `sendPushToUsers` out. Jest's module loader is not the one production uses, so each case runs
in a plain `node` child (`tests/helpers/expo-push-child.cjs`). The child compiles `expoPush.ts` with this
service's tsconfig, resolves modules from the file's real location and substitutes only the database; the real
SDK talks to a local stub of Expo's push API through `EXPO_BASE_URL`, and the child can dial nothing but
loopback (one case proves it). Only data crosses to the child, never code. Cases: invalid tokens filtered;
error tickets logged with message and details; chunks of at most 100; nothing sent when no token is valid; an
Expo API error rejects, so the calling event handler logs it; and the SDK is reached through `require()`. The
same file passes on 6.1.0 and on 7.2.0.

The SDK loads lazily, on the first push, so a deploy's health checks never exercise it — this test is the gate.

No endpoint, payload, event or schema change. Not covered: the SDK's own retry of a 429 with backoff.
```

- [ ] **Step 3: Bump the version from master's current value**

```bash
git fetch origin master && git show origin/master:package.json | grep -m1 '"version"'
```

Expected: `"version": "11.65.0"`. Set `package.json` line 3 and `package-lock.json` lines 3 and 9, the two root entries only, to `11.66.0`. If master has moved, bump from its value instead.

```bash
grep -n '"version": "11.66.0"' package.json package-lock.json | head -3
```

Expected: `package.json:3`, `package-lock.json:3` and `package-lock.json:9`, and nothing else.

- [ ] **Step 4: Update the handoff**

In `.claude/handoff/CURRENT_HANDOFF.md`, the D4 row records:
- implementation complete on this branch;
- the three commits (Task 1, cherry-pick, Task 3);
- the 6.1.0/7.2.0 evidence, including the injection counts from Task 1 Step 4;
- the V4 correction;
- that gates, PR and CI come next.

Also update *Next unchecked action* to Task 4.

- [ ] **Step 5: Stage, run the advisory checks, commit**

`feedback:check` reads only `git diff --cached`, so stage first.

```bash
git add services/notification-service/CONTEXT.md package.json package-lock.json .claude/handoff/CURRENT_HANDOFF.md
npm run feedback:check; echo "feedback exit=$?"
node scripts/gotcha-check.js; echo "gotcha validate exit=$?"
git commit -F - <<'EOF'
docs(notification): record expo-server-sdk 7 and how the SDK really loads; v11.66.0

CONTEXT.md gains a Sprint 131 D4 section (the whole v7 change, the require() load path, what the new
real-SDK test covers) and its push-token docs now match the code: the notifications.push_tokens table
no migration creates is gone, auth.device_push_tokens is listed as read, and a recipe for a file that
does not exist is replaced with pointers to the implementation that does. Root version 11.65.0 -> 11.66.0 in package.json and
the lockfile's two root entries. Handoff: D4 implemented, evidence recorded.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Full verification, SDLC gates, PR

**Files:** only those that the gates' fixes touch, plus the regenerated `apps/landing/src/data/docs/services/notification-service.json`.

- [ ] **Step 1: Full suite, uncached**

```bash
npx turbo run test --concurrency=2 --force; echo "suite exit=$?"
git status --short
```

Expected: `suite exit=0`. In `git status`:
- Keep `apps/landing/src/data/docs/services/notification-service.json` if its diff is the `CONTEXT.md` content.
- Revert any file whose diff is only a generated timestamp or HEAD sha (normalize and compare before discarding).
- No file may have moved out of any `tests/tdd/`.

If a suite times out under load, re-run that package alone before suspecting code.

- [ ] **Step 2: Repo gates**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand; echo "drift exit=$?"
node scripts/gotcha-check.js --for services/notification-service/tests/helpers/expo-push-child.cjs services/notification-service/tests/regression/sprint-131-expo-push-real-sdk.test.ts
```

Expected: `drift exit=0`. The gotcha check names only the two entries already read, the dotenv quiet rule and the Node 24 floor.

- [ ] **Step 3: SDLC gates on the branch diff (`git diff origin/master...HEAD`)**

`/simplify` (one pass), `/code-review` at **medium** (a small, well-specified diff), then `/security-review`. Fix each finding or dismiss it with a written reason. After any fix, re-run Task 1 Step 6's commands. Commit the fixes with the finding they close in the message.

- [ ] **Step 4: Land the handoff before asking for anything**

Record the gate results in the handoff, then commit.

- [ ] **Step 5: Push and open the PR**

```bash
git push origin agent/claude/sprint-131-d4-expo-server-sdk
```

The pre-push hook must visibly run the suite. A silent, instant push means no hook ran.

Open the PR with `gh pr create --base master --title "Sprint 131 D4: expo-server-sdk 7 (#230) and the first real-SDK test (v11.66.0)" --body-file "$SCRATCH/d4-pr-body.md"`. The body copies `.github/pull_request_template.md` and fills every section: Summary, Validation (Tasks 1, 2 and 4 results), Docs updated (`CONTEXT.md`; landing service JSON), Quality gates, Security dismissals, Follow-ups and `## Lane` `claude`. `pr-contract` requires `## Summary`, `## Validation`, `## Quality gates` and `## Security dismissals`. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 6: Verify CI from logs, not ticks**

Wait for every check, then confirm three things. First, the notification-service part of Test Backend Services prints `PASS tests/regression/sprint-131-expo-push-real-sdk.test.ts`, with 5 tests. Second, Code Scanning Gate (ADR-060) passes. Third, the CodeQL check-run annotations show no new alert on the two new files. PR findings live in annotations, not in the alerts list.

- [ ] **Step 7: Handoff with the PR number and CI evidence; push; ask the maintainer for merge authorization**

---

### Task 5: Merge, deploy, live verification, close-out (on explicit authorization only)

- [ ] **Step 1: Pre-merge check**

`gh run list --branch master --limit 3` must show no deploy in flight. `origin/master` must still be `11.65.0`; otherwise re-bump first. The PR head must be green.

- [ ] **Step 2: Merge on the maintainer's explicit per-PR authorization**

With `PR` set to the number `gh pr create` printed in Task 4 Step 5: `gh pr merge "$PR" --squash --admin`, then `gh pr view "$PR" --json state,mergeCommit` must show `MERGED`.

- [ ] **Step 3: Watch the master CI/CD run through Deploy to Demo**

It must show `✅ All services healthy`, `DEPLOYMENT SUCCESSFUL` and no rollback.

- [ ] **Step 4: Live smoke with `node` fetch against `https://karmyq.com/api`**

These are BUG-051's probes. No push can be sent:
- `POST /auth/login` as `maria.reyes@test.karmyq.com` (sim password) → 200.
- Authenticated `GET /notifications/:userId`, `/notifications/:userId/unread-count` and `/notifications/:userId/preferences` → 200 each.
- Anonymous `POST /notifications/push/send` with an **empty body** → 403 `FORBIDDEN`.
- `GET /requests?limit=5&offset=0` → 200.

- [ ] **Step 5 (optional; ask first, it is a demo operation): load the SDK inside the running container**

The deploy's health checks never load the SDK (V6). This read-only probe loads it and sends nothing:

```bash
ssh ubuntu@karmyq.com "docker exec karmyq-notification-service node -e \"const path=require('path'),fs=require('fs');const e=require.resolve('expo-server-sdk');const m=require('expo-server-sdk');console.log(JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(e)),'package.json'))).version, m.__esModule, typeof m.default)\""
```

Expected: `7.2.0 true function`.

- [ ] **Step 6: Close-out**

`gh pr view 230 --json state` should show #230 closed automatically. If it is still open, report it to the maintainer rather than closing it yourself. Record D4 as shipped in the handoff on the **next** lane's branch, cut fresh from the deployed master; never make a docs-only push to master. Next is D5, node-fetch (#225).

---

## Execution notes (2026-09-23)

Five deviations from the plan above, each re-verified. The per-step evidence is in the handoff and the PR.

- **The SDK is read through its named `Expo` export, not `.default`.** This came from the `/simplify` altitude
  review. `.default` is the class only while Node marks a required ES module `__esModule`; the named export does
  not depend on that. So `expoPush.ts` changed by one token as well as its comment, and injection I1 became
  `mod.Expo` → `mod`, which still fails all 5 cases.
- **The child loads `expoPush.ts` through ts-node** (the service's declared dev loader) instead of a hand-written
  `Module._extensions` hook. This came from the `/simplify` reuse review. It was probed first: ts-node's emit
  follows the tsconfig exactly as the tsc API's does (`require()` as committed, native `import()` under
  `module: node16`), so I5 still fails only the mechanism assertion.
- **`sendInChild` uses `execFile` with its `timeout` option** instead of `spawn` plus a hand-written deadline timer.
  This came from the `/simplify` reuse and simplification reviews. I6 still holds: the child is killed at the
  deadline, and Jest exits on its own.
- **Task 2 Step 2's `git log -1 FETCH_HEAD` reads the wrong commit.** After fetching two refs it shows the first
  (master), not #230's head. The head was verified by its SHA instead.
- **The final whole-branch review strengthened case 2.** As planned, adding `return` or `break` after the
  error-ticket log still passed all five cases, although case 1's name promised "logs each error ticket". Case 1
  has a single error ticket. Case 2's stub now answers error tickets for two recipients of the *first* chunk,
  and the test asserts both are logged and the second chunk is still sent. Both mutations now fail it. I2 now
  fails 2 cases (1 and 2), not 1. Case 1's name says "an error ticket", which is what it proves.
