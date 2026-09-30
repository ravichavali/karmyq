# Sprint 131 D9 — reputation-service on ioredis 6 (supersedes #245) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move reputation-service's effective-params cache to `ioredis` 6. bull stays on ioredis 5. Pin v5's retry backoff so a Redis outage costs exactly what it costs today. A real-client gate proves what goes over the wire, and a live smoke proves that Redis, not the DB fallback, serves the cache.

**Architecture:** Dependabot #245 moves **root and** reputation to `^6.0.0`, which hoists 6 and nests bull's ioredis 5 under `node_modules/bull/` in every image that installs bull. This PR supersedes it. **Only `services/reputation-service` moves:** a nested ioredis 6 subtree under `services/reputation-service/node_modules/` is spliced into the lock in place. Root's `^5.11.1` and the hoisted `ioredis@5.11.1` that bull resolves stay untouched. `effectiveParamsCache.ts` gets an explicit v5 `retryStrategy` through a small exported factory. That factory is the seam the gate uses to observe the real client.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [Sprint 131 design](../specs/2026-09-15-sprint-131-maintenance-design.md), extended by the maintainer decision of 2026-09-28 that the queued Dependabot majors become D8+, one per PR, each planned first. Like D4–D8, this focused plan carries the design. **D9 scope decisions (maintainer, 2026-09-28, this planning chat):**
1. **"Reputation only":** ioredis 6 nested under reputation-service, spliced in place. Root and bull stay on hoisted 5. One `DIVERGENCE_ALLOWLIST` entry, removed when root moves.
2. **"Loopback RESP server":** the gate drives the **real** ioredis client against an in-test loopback server. It asserts the commands on the wire, the TTL, the handshake, quit, and the exact backoff sequence. It runs on Windows and in CI, with no Docker. Each case is proven by mutation.
3. **"API + read-only Redis TTL":** the post-deploy smoke is the standard four endpoints, plus `effective-params` (timed), plus read-only checks on the demo host. Those are a Redis `TTL`/`CLIENT LIST`/`INFO` and a container module-resolution check, and they need **per-operation maintainer authorization**.
4. **"Pin v5 behavior":** pass v5's `retryStrategy` (`Math.min(times * 50, 2000)`) explicitly. See V4 for the two v6 default changes this plan **accepts** (RESP3, `keepAlive`), and why.

---

## Global Constraints

- **Dependency lane:** held by Claude (maintainer, 2026-09-27: "Claude owns the dependency lane"; D8+ assigned 2026-09-28). The only dependency changes are reputation-service's `ioredis` range, the lock nodes that range needs, and the root `version`. **Never** run `npm install --workspace`, `npm dedupe` or a scratch lockfile regeneration in the repo. Splice in place (Task 3).
- **This is a runtime change.** Unlike D8, the nested tree ships in the production image (`services/reputation-service/Dockerfile:54`, `npm install --omit=dev`). V7 and Task 3 Step 5 prove that image install. Task 10 proves it again inside the running container.
- **No ADR, no migration, no endpoint, event or schema change.** Cache key, TTL and fallback semantics are unchanged, and the gate pins them.
- **Version** comes from `origin/master` at merge time. Master is `3f504727` = **11.72.0**, so this PR is **11.73.0** unless master moves first.
- **Branch:** `agent/claude/sprint-131-d9-ioredis-6`, cut 2026-09-28 from `origin/agent/claude/sprint-131-d8-closeout` (`974dd421`). That is `3f504727` (= `origin/master`) plus the docs-only D8 close-out, plus this plan. Both must ride in this code PR, because CLAUDE.md forbids docs-only master pushes.
- **Windows box:** use `node` for JSON and HTTP (no `jq`/`curl`). Use `--concurrency=2` for the full suite. Capture exit codes separately. The `PATH` npm is 10.8.2, and CI runs **npm 11.19.0**, so prove the lock with `npx -y npm@11.19.0 ci`. **No local Docker.**
- **reputation's `npm test` runs `unit` + `regression` only, never `tdd/`** (`package.json:13`; the D2 lesson). The gate is red in `tdd/`, then promoted by hand to `regression/` (Task 5). It is not blocking until it is promoted. `ignore-scripts=true` means the posttest promoter never runs (BUG-053). Promote **only** this file.
- **Commit before any mutation proof.** Restore from a byte copy, never `git checkout --` (S131 D4).
- **Merges need explicit per-PR maintainer authorization. Demo-host reads need their own authorization,** and you say which lane is asking (CLAUDE.md, *Parallel Development*). One merge and deploy at a time.

---

## Verified findings (read before Task 1)

Read on 2026-09-28 against `3f504727`, from the registry (`npm view`, `npm pack` of both versions), the `v6.0.0` GitHub release notes, the built sources, and the repo.

**V1: #245 is manifest mechanics, and wider than this plan.** Head `980f74a2`, 3 files: `package.json` (+1/−1), `services/reputation-service/package.json` (+1/−1) and `package-lock.json` (+61/−11). It moves **root and** reputation to `^6.0.0`, hoists `ioredis@6.0.0`, bumps the hoisted `@ioredis/commands` 1.10.0 → 2.0.0, and adds `node_modules/bull/node_modules/{ioredis@5.11.1, @ioredis/commands@1.10.0, debug, ms}`. CI is 19 pass, 2 skipping (Deploy, CodeQL). **Its green CI proves nothing about the cache client.** Every reputation test that touches the cache `jest.mock`s the whole module (`sprint-106…:69`, `sprint-112…:62`, `sprint-128-recency-window:22`, `sprint-129…:71`). The integration job does run against real Redis (`ci.yml:306`, `:336`), but the cache swallows every error (V3), so a broken client there shows up only as slowness. **Refresh at Task 1,** because Dependabot rebases.

**V2: one importer, one client.** `git grep` finds `import Redis from 'ioredis'` only at `services/reputation-service/src/services/effectiveParamsCache.ts:6`. The only other hit is a 2026-03 plan doc. The client is created lazily with no options: `new Redis(REDIS_URL)` (`:15`). It is used by `getCachedEffectiveParams` (GET, then SETEX with a 14400 s TTL, `:42`, `:49`), `invalidateEffectiveParamsCache` (DEL, `:61`) and `disconnectEffectiveParamsCache` (quit, falling back to disconnect, `:30`). Its callers are `karmaService.ts:42`, `trustEvolutionService.ts:12`, `routes/reputation.ts:606` and `scripts/backfillStanding.ts:141`. Root declares `ioredis ^5.11.1` in `dependencies` (`package.json:60`), and nothing at root imports it (follow-up, Task 6).

**V3: failures are silent by design.** Each Redis call sits in `try { … } catch { /* fall through */ }` (`:41-46`, `:48-52`, `:60-64`). An API 200 therefore **cannot** distinguish a working client from a broken one. What can: the wire (gate case B), Redis's own view (the smoke's `TTL`/`CLIENT LIST`), and latency. `ci.yml:330-333` records that an unreachable Redis costs about 298 s per match, because ioredis keeps retrying.

**V4: what ioredis 6.0.0 changes, versus 5.11.1.** From the release notes and `diff built/redis/RedisOptions.js`:

| Change | v5.11.1 | v6.0.0 | This plan |
|---|---|---|---|
| Default `retryStrategy` | `Math.min(times * 50, 2000)` | `Math.min(2 ** (times - 1) * 50, 5000) + random(0..199)` | **Pinned to v5** (decision 4). By arithmetic, with `maxRetriesPerRequest` still 20: ~10.5 s → ~73 s per failed command during an outage, or ~21 s → ~146 s per `getCachedEffectiveParams` (GET + SETEX). The gate measures the delays, not the sum |
| `protocol` | 2 (implicit) | **3** (`HELLO 3` handshake). Falls back to 2 on `NOPROTO` or `unknown command 'HELLO'` (`event_handler.js:236-240`) | **Accepted.** CI and the demo run `redis:7-alpine` (`docker-compose.yml:29`, `docker-compose.qa.yml:33`), which speaks RESP3. The smoke confirms `resp=3` live |
| `replyMapping` | — | `"legacy"` | **Accepted.** GET, SETEX and DEL reply with a bulk string or null, `OK`, and an integer in both protocols |
| `keepAlive` | 0 | 30000 | **Accepted.** A TCP keepalive only detects a dead socket sooner. Pinning 0 would preserve the weaker behavior |
| `engines.node` | `>=12.22.0` | `>=20.0.0` | No change for us (Node 24 floor, ADR-090) |
| Dependencies | `@ioredis/commands` **1.10.0**, `redis-parser` 3.0.0, … | `@ioredis/commands` **2.0.0**. `redis-parser` dropped. `debug` 4.4.3, `denque` 2.1.0, `redis-errors` 1.2.0, `cluster-key-slot` 1.1.1, `standard-as-callback` 2.1.0 unchanged | V6 |

`maxRetriesPerRequest` (20), `connectTimeout` (10000), `enableOfflineQueue` (true) and `disconnectTimeout` are identical in both versions. The cluster, sentinel and tracing fixes in the notes are not on our path, because we use one standalone client.

**V5: the import and the type are unchanged.** `built/index.d.ts` still has `export { default } from "./Redis"`, and `built/index.js:4` does `module.exports = require("./Redis").default`. Under reputation's `esModuleInterop: true` / `module: commonjs` (`tsconfig.json`), `import Redis from 'ioredis'` and the type annotation `Redis | null` keep working. **Task 3 proves this with `tsc --noEmit`,** so it is not taken on faith.

**V6: ioredis 6 cannot hoist, so its tree nests.** Root keeps `ioredis@5.11.1` hoisted, because root declares `^5.11.1` and `bull@4.16.5` needs `^5.3.2` (`package-lock.json:9707`). The expected new nodes, **to be derived by Task 3's re-resolve and never hand-built**:
- `services/reputation-service/node_modules/ioredis` 6.0.0
- `services/reputation-service/node_modules/@ioredis/commands` 2.0.0 (the hoisted copy is 1.10.0)
- `debug` 4.4.3 + `ms` 2.1.3, somewhere under the reputation subtree. The hoisted `debug` is **2.6.9** and the hoisted `ms` is 2.0.0. ioredis 5 already needs its own nested pair (`node_modules/ioredis/node_modules/{debug,ms}`).
- `denque`, `redis-errors`, `cluster-key-slot` and `standard-as-callback` resolve from the hoisted copies at the exact pinned versions. `node_modules/@redis/client/node_modules/cluster-key-slot` is 1.1.2, and it is unrelated.

**D8's lesson applies:** npm may place some of these at the **root** level in its candidate. The splice keeps the complete tree and relocates any root-level addition under reputation-service. `splice.js` throws on any shape it does not expect. Nothing outside `services/reputation-service` may change except the root `version`.

**V7: the production image installs with `npm install`, not `npm ci`, over a pruned workspace set.** The runtime stage (`Dockerfile:44-54`) copies only the root `package.json` + lock, `packages/shared/package.json` + `dist`, and reputation's `package*.json`, then runs `npm install --omit=dev`. Whether that install honors the nested node is **UNVERIFIED**, and so is the npm version bundled in `node:24-alpine`. CI's `Build Docker Images (reputation-service)` builds the image but asserts no module versions. Task 3 Step 5 therefore simulates the exact COPY set and install in a scratch dir, and Task 10 checks inside the deployed container.

**V8: the gate can observe the real client.** In v6, `setStatus("reconnecting", retryDelay)` (`event_handler.js:332`) emits `reconnecting` with the delay that `retryStrategy` returned. So the gate can collect the first N delays against a refused port in well under a second, with exact values and no jitter tolerance needed for v5's strategy. The handshake is `HELLO 3` when `protocol === 3` (`event_handler.js:14-27`).

**V9: the demo smoke route.** `GET /api/reputation/users/:userId/effective-params?communityId=` (`routes/reputation.ts:597`) requires self (`:600`) and active membership (`:605`), then calls `getCachedEffectiveParams`. On a miss it performs **one SETEX** of `trust_params:<userId>:<communityId>`, the same write any user's own request makes. Nothing else writes.

---

## Review Focus

Failures this PR must catch, most likely first. Each is pinned by a gate case:

1. **The upgrade silently changes outage cost.** v6's default backoff is about 7× slower to give up, and the cache hides it. [case C, injection I1]
2. **The client stops talking to Redis while every endpoint still returns 200.** Examples: a handshake problem, a command-shape change, a TTL no longer sent. [case B, injection I2; smoke `TTL` + `CLIENT LIST`]
3. **reputation resolves the wrong major.** A hoist change serves it 5, or serves bull 6. [case A, injection I3; the Task 3 image simulation; the Task 10 container check]
4. **The nested tree is missing from the production image.** [Task 3 Step 5, Task 10]
5. **An older Redis (no RESP3) breaks the cache.** [case D]

---

## File map

| File | Change |
|---|---|
| `services/reputation-service/tests/tdd/sprint-131-ioredis-6.test.ts` | **Create** (promoted to `tests/regression/` in Task 5). Cases A–D with a loopback RESP server |
| `services/reputation-service/src/services/effectiveParamsCache.ts` | Export `V5_RETRY_STRATEGY` and `createCacheClient(url)`. `getRedis()` uses the factory. Update the header comment |
| `services/reputation-service/package.json:27` | `ioredis` `^5.11.1` → `^6.0.0` |
| `package-lock.json` | Workspace node range, plus the **complete** ioredis 6 subtree under `services/reputation-service/node_modules/` (V6). Also root `version` |
| `tests/regression/sprint-131-workspace-declarations.test.ts:81` | `DIVERGENCE_ALLOWLIST` entry `services/reputation-service dependencies: ioredis@^6.0.0` (V6; D8 missed its equivalent in planning) |
| `services/reputation-service/CONTEXT.md` | Append a *Sprint 131 D9 — ioredis 6* section after D2 (`:1641`) |
| `apps/landing/src/data/docs/services/reputation-service.json` | Regenerated from `CONTEXT.md`. Commit the content change only (`git add -f` if needed) |
| `docs/IDEAS.md` | Root's unused `ioredis` prod dependency; bull 4 pins ioredis 5; the latent ~298 s outage cost |
| `package.json:3`, `package-lock.json` (root `version` fields) | `11.72.0` → `11.73.0` |
| `.claude/handoff/CURRENT_HANDOFF.md` | D9 state, evidence, next action |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **#245's green CI is not evidence for the cache client (V1, V3).** Every unit and regression test mocks the cache module, and the cache swallows errors. Cite the gate, the image simulation and the live `TTL`/`CLIENT LIST`, never a green check.
2. **Only reputation moves.** Do not take #245's root edit or its `node_modules/bull/node_modules/*` nodes. Root stays `^5.11.1`, and bull resolves the hoisted 5.11.1. Case A pins both halves.
3. **Pin v5's retry strategy explicitly, through the factory the gate uses.** `Math.min(times * 50, 2000)`, byte-identical to v5's default (V4). Asserting the function's values alone is not enough. Case C observes the `reconnecting` delays **of a client built by `createCacheClient`**, so it fails if the option is not passed.
4. **Accepted v6 deltas are RESP3 and `keepAlive: 30000`.** They are documented in CONTEXT.md. Do not pin `protocol: 2`: injection I2 shows that case B detects exactly that.
5. **Splice the COMPLETE subtree, relocated under reputation-service (the D8 lesson).** Never filter the candidate by prefix. Build from a byte copy of the base lock. **`npm ci` exit 0 is not evidence of a working tree.** Prove it by loading ioredis 6 from reputation's directory, `tsc --noEmit`, lock-only and installed `npm ls` diffs, a node diff with registry parity, an idempotent re-resolve, **and the Dockerfile install simulation (V7).**
6. **The gate talks only to `127.0.0.1` on an ephemeral port.** It opens no external connection, and it sends and receives only constant data.
7. **Gate cases must be able to fail.** Run I1–I3 on a committed tree, each restored from a byte copy.
8. **The smoke writes nothing beyond the one SETEX any user request makes (V9).** Every demo-host command is read-only and needs its own maintainer authorization. Never print a secret: if Redis needs AUTH, use `REDISCLI_AUTH` from the container env without echoing it.

---

### Task 1: Branch, and re-verify #245 and master

**Files:** none modified.

- [ ] **Step 1: Confirm the branch**

```bash
cd /c/Users/ravic/development/karmyq
git fetch origin
git switch agent/claude/sprint-131-d9-ioredis-6        # already cut from origin/agent/claude/sprint-131-d8-closeout in planning
git merge-base HEAD origin/master                        # must equal origin/master; if master moved, merge it in (merge commit, never rebase)
git log --oneline origin/master..HEAD                    # expect docs-only commits: D8 close-out, D9 plan
```

- [ ] **Step 2: Re-read #245 and the registry**

```bash
gh pr view 245 --json state,headRefOid,files --jq '{state,headRefOid,files:[.files[].path]}'
npm view ioredis@6 version --json; npm view ioredis@6.0.0 dependencies engines --json
npm view bull@4 version dependencies.ioredis --json      # still ^5.x? If a bull 4.x now accepts ioredis 6, stop and re-plan
```

Expected: #245 is still OPEN, with the same 3 files. If a newer 6.x exists, use the latest, re-diff `RedisOptions.js` and `event_handler.js` against 5.11.1, re-check V4, V6 and V8, and note it in the Execution notes.

- [ ] **Step 3: Baselines** (save them to `$SCRATCH`; later tasks diff against them)

```bash
cp package-lock.json "$SCRATCH/lock.base.json"
npm ls --all > "$SCRATCH/npmls.base.raw.txt" 2>&1
node -e 'const p=require("path");const s=p.resolve("services/reputation-service");console.log("rep:",require(require.resolve("ioredis/package.json",{paths:[s]})).version,"bull:",require(require.resolve("ioredis/package.json",{paths:[p.dirname(require.resolve("bull/package.json",{paths:[s]}))]})).version)'   # rep: 5.11.1 bull: 5.11.1
```

---

### Task 2: Write the gate (TDD, before any bump)

**Files:**
- Create: `services/reputation-service/tests/tdd/sprint-131-ioredis-6.test.ts`
- Modify: `services/reputation-service/src/services/effectiveParamsCache.ts` (the factory seam only, with **no** retry option yet)

- [ ] **Step 1: Add the seam without changing behavior.** In `effectiveParamsCache.ts`, add:

```ts
/** Build the cache's Redis client. Exported so the D9 gate can observe the real client's wire and retry behavior. */
export function createCacheClient(url: string = REDIS_URL): Redis {
  return new Redis(url);
}
```

Change `getRedis()` to `_redis = createCacheClient();`. That is a pure refactor. Existing suites mock the whole module, so they are unaffected. Run `npx tsc --noEmit` in the workspace and expect exit 0.

- [ ] **Step 2: Write the gate.** Design constraints:
- **Real client, fake server.** Use `node:net` `createServer` on `127.0.0.1:0`, with a minimal RESP parser for arrays of bulk strings (what ioredis sends). Record every command as `string[]`, upper-casing the name. Keep an in-memory `Map` store. Replies:
  - `HELLO` → a RESP3 map `%3\r\n+server\r\n+redis\r\n+version\r\n+7.4.0\r\n+proto\r\n:3\r\n`, unless the case sets `helloUnsupported`, which gives `-ERR unknown command 'HELLO'\r\n`.
  - `GET` → a bulk string, or null (`_\r\n` after HELLO 3, `$-1\r\n` otherwise).
  - `SETEX` → `+OK`. `DEL` → `:<n>`. `QUIT` → `+OK`, then end the socket. `CLIENT`, `SELECT`, `INFO` → `+OK`. Anything else → `-ERR`, and record it, so an unexpected command shows up in the sequence.
  - **Verify the reply formats against ioredis 6 in Task 3 Step 6.** If the client rejects one, fix the server, never the assertion, and record why.
- **Module under test:** load `effectiveParamsCache` with `jest.isolateModules` **after** setting `process.env.REDIS_URL` to the loopback URL, because the module reads it at load (`:9`). Mock only its collaborator `./trustEvolutionService`'s `getUserEffectiveParams`, returning `{ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 }` set **inside each test**, because root `resetMocks: true` applies.
- **Clean up** with `disconnectEffectiveParamsCache()` and `server.close()` in `afterEach`. Timeout 30 s per case.
- Import only `node:net`, `node:path` and the module under test. Nothing undeclared.

Cases:

- **A: the resolution split.** From `path.resolve(__dirname, '../..')`, `require.resolve('ioredis/package.json')` → major **6**. From `bull`'s directory (resolved from the same workspace) → major **5**. Also assert that the resolved reputation path contains `services/reputation-service/node_modules/ioredis` and bull's does not. That is identity, not just a version.
- **B: the wire contract on a miss, a hit, an invalidate and a disconnect.** Call `getCachedEffectiveParams('u1','c1')` twice, then `invalidateEffectiveParamsCache('u1','c1')`, then `disconnectEffectiveParamsCache()`. Assert that the **exact** recorded sequence, after dropping any leading `CLIENT` commands (record them, do not assert them), is:
  `['HELLO','3'], ['GET','trust_params:u1:c1'], ['SETEX','trust_params:u1:c1','14400','{"depth_weight":0.6,"breadth_weight":0.4,"cross_community_prior":0.5}'], ['GET','trust_params:u1:c1'], ['DEL','trust_params:u1:c1'], ['QUIT']`.
  Assert that both calls return the params object (`toEqual`), and that the DB mock was called **exactly once** (the second call was a hit).
- **C: v5 backoff against a refused port.** Get a free port by binding a server and closing it. `const c = createCacheClient('redis://127.0.0.1:<port>')`, then collect the `reconnecting` delays until 5 have arrived and `c.disconnect()`. Assert `toEqual([50, 100, 150, 200, 250])`, the exact values. Under v6's default this is `[50+j, 100+j, 200+j, 400+j, 800+j]` with jitter `j`, so it cannot match by chance.
- **D: RESP2 fallback.** Use the server with `helloUnsupported`, and run B's miss-then-hit. Assert that the recorded sequence contains `['HELLO','3']` followed by working `GET`/`SETEX`/`GET`, with correct return values. This proves an old Redis still serves the cache.

- [ ] **Step 3: Run the gate on the current tree** (ioredis 5)

```bash
npm exec --workspace=services/reputation-service -- jest tests/tdd/sprint-131-ioredis-6.test.ts; echo "exit=$?"
```

Expected red, for the right reasons, with the output recorded:
- **A red:** reputation resolves 5.
- **B red:** there is no `HELLO` on v5. Everything after `HELLO` must match, which proves the rest of the fixture is right.
- **C green:** v5's default is the same function. **This is expected.** C's job is to catch the upgrade (it goes red in Task 3 Step 6 **before** the pin), not to be red now.
- **D green or red:** record which. v5 sends no HELLO, so D's `HELLO` expectation fails.

If B fails anywhere **other than** the missing `HELLO`, fix the fixture now.

- [ ] **Step 4: Commit** (`test(reputation): ioredis wire + backoff gate, cache client factory (D9 red)`)

---

### Task 3: Bump, splice the lock, and prove the tree

**Files:** `services/reputation-service/package.json`, `package-lock.json`

- [ ] **Step 1: Manifest.** Set `"ioredis": "^6.0.0"` in reputation's `dependencies` (or the latest 6.x from Task 1).

- [ ] **Step 2: Re-resolve in a scratch copy, never in the repo** (the D8 Task 3 Step 2 recipe, verbatim):

```bash
git ls-files '*package.json' | grep -v node_modules | while read f; do mkdir -p "$SCRATCH/resolve/$(dirname "$f")"; cp "$f" "$SCRATCH/resolve/$f"; done
cp package-lock.json .npmrc "$SCRATCH/resolve/"
(cd "$SCRATCH/resolve" && npx -y npm@11.19.0 install --package-lock-only --ignore-scripts --no-audit --no-fund)
```

Record the added, removed and changed counts, and every added key. Expected: 0 removed, 1 changed (the workspace node's `dependencies`), and roughly 4 added (V6). **Any change to a pre-existing node, root `node_modules/ioredis` or `node_modules/@ioredis/commands` included, is a stop-and-re-plan.**

- [ ] **Step 3: Splice.** Copy D8's `splice.js` (the D8 plan, Task 3 Step 3) to `$SCRATCH/splice.js` with the Write tool, and make exactly these edits:
  - `WS = 'services/reputation-service'`.
  - The workspace-node guard expects `dependencies`, not `devDependencies`.
  - **Delete step 5**, the `@keyv/bigmap` nesting, unless the candidate shows a peer that the relocated layout breaks. Check with the lock-only `npm ls` in Step 4.

Run it: `node "$SCRATCH/splice.js" "$SCRATCH/lock.base.json" "$SCRATCH/resolve/package-lock.json" package-lock.json`. The candidate's node values are npm's own, so no field is hand-built. If it throws, stop and re-plan, and do not improvise a placement.

- [ ] **Step 4: Prove the lock** (reuse D8's `lsnorm.js`; each check must be able to fail):
  1. **Byte scope:** the only removed line in `git diff package-lock.json` is reputation's old `"ioredis": "^5.11.1"`. Every `+` hunk sits inside a `services/reputation-service` key.
  2. **Registry parity:** for every added node, `version`, `resolved`, `integrity`, `license`, `engines`, `dependencies` and `peerDependencies` equal `npm view <name>@<version> --json` (key-sorted). **None** is `dev: true`, because this is a runtime tree. Assert that explicitly: a `dev: true` node is omitted by `--omit=dev`.
  3. **Lock-only `npm ls`, like with like:** 0 new problem lines versus base.
  4. **Idempotency:** an npm 11.19.0 `install --package-lock-only` over the spliced lock changes 0 nodes.
  5. **Negative control:** the raw candidate, if it hoisted anything, or a hand-deleted `services/reputation-service/node_modules/@ioredis/commands` in a scratch copy, must fail at least one of 1–4. Record which.

- [ ] **Step 5: Install and run what could break, including the image install (V7)**

```bash
npx -y npm@11.19.0 ci; echo "ci exit=$?"
(cd services/reputation-service && npx tsc --noEmit; echo "tsc exit=$?")      # V5: import + type under esModuleInterop
node -e 'const p=require("path");const s=p.resolve("services/reputation-service");const r=require.resolve("ioredis",{paths:[s]});console.log(p.relative(process.cwd(),r), require(require.resolve("ioredis/package.json",{paths:[s]})).version);const b=p.dirname(require.resolve("bull/package.json",{paths:[s]}));console.log("bull ->",require(require.resolve("ioredis/package.json",{paths:[b]})).version)'
# expect services/reputation-service/node_modules/ioredis/... 6.0.0 ; bull -> 5.11.1
npm ls --all 2>&1 | node "$SCRATCH/lsnorm.js"      # no new problem lines vs Task 1 baseline
```

**Dockerfile runtime-stage simulation.** In `$SCRATCH/image/`, reproduce **exactly** `Dockerfile:44-51`:
- the root `package.json` + `package-lock.json`;
- `packages/shared/package.json` + a built `packages/shared/dist` (`npm run build --workspace=packages/shared` first, then copy);
- `services/reputation-service/package*.json`.

Then run `npx -y npm@11.19.0 install --omit=dev --ignore-scripts; echo "exit=$?"`. From `$SCRATCH/image/services/reputation-service`, run the same resolution one-liner, and expect **6.0.0 nested**, with bull → **5.11.1**. Record the npm version used. The image's own bundled npm is UNVERIFIED (V7), and Task 10's container check is the authority. Also record whether the simulated install **rewrote** the lock (node diff). A rewrite that moves ioredis would be a finding, so stop and report it.

- [ ] **Step 6: Run the gate, BEFORE the pin.**
  - **A green:** 6 nested, bull on 5.
  - **B green:** HELLO 3 plus the exact sequence. This is where the fake server's RESP3 replies get validated against the real v6 parser (the Task 2 note).
  - **C red:** the observed delays are exponential with jitter. This is the upgrade's behavior change, caught.
  - **D green:** the fallback works.

  Record the output, including C's actual delays.

- [ ] **Step 7: Update the declarations gate.** Run `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-workspace-declarations.test.ts --runInBand`. Expect **red**, naming `services/reputation-service dependencies: ioredis@^6.0.0` as stranded from root. Add that key to `DIVERGENCE_ALLOWLIST` with this reason: `'Sprint 131 D9 (maintainer 2026-09-28, "reputation only"): reputation-service alone runs ioredis 6, nested in its own node_modules; root declares ^5 and bull@4 pins ^5.3.2. Remove when root moves or its unused declaration is dropped (docs/IDEAS.md). Pinned by services/reputation-service/tests/regression/sprint-131-ioredis-6.test.ts case A.'`. Re-run: green, including "every divergence-allowlist entry is still a divergence".

- [ ] **Step 8: Commit** (`chore(reputation): ioredis 6, nested; bull stays on 5 (supersedes #245)`)

---

### Task 4: Pin v5's backoff

**Files:** `services/reputation-service/src/services/effectiveParamsCache.ts`

- [ ] **Step 1:**

```ts
/**
 * ioredis 5's default backoff. ioredis 6 changed the default to exponential with jitter
 * (`min(50 * 2^(n-1), 5000) + 0..199 ms`), so with maxRetriesPerRequest 20 a Redis outage would hold each
 * cache command about 73 s instead of about 10.5 s before the DB fallback runs. Pinned in Sprint 131 D9 so
 * the upgrade changes no runtime behavior. Gate: tests/regression/sprint-131-ioredis-6.test.ts case C.
 */
export const V5_RETRY_STRATEGY = (times: number): number => Math.min(times * 50, 2000);

export function createCacheClient(url: string = REDIS_URL): Redis {
  return new Redis(url, { retryStrategy: V5_RETRY_STRATEGY });
}
```

Update the file's header comment to note ioredis 6, RESP3, and the pinned backoff. Change nothing else. The key, TTL and every `try/catch` stay byte-identical.

- [ ] **Step 2: Verify**

```bash
cd services/reputation-service
npx tsc --noEmit; echo "tsc exit=$?"
npm exec -- jest tests/tdd/sprint-131-ioredis-6.test.ts; echo "gate exit=$?"     # A B C D all green
npm test; echo "suite exit=$?"                                                     # unit + regression unchanged
```

- [ ] **Step 3: Commit** (`fix(reputation): pin ioredis 5 retry backoff on the cache client`)

---

### Task 5: Mutation proofs and promotion

Every injection runs on the committed tree. Byte-copy the file first, restore it with `cp`, and after each restore run `git status --short` and expect it to be clean.

- [ ] **I1 (case C):** drop `{ retryStrategy: V5_RETRY_STRATEGY }` from `createCacheClient`. C goes **red**, with jittered exponential delays. A, B and D stay green. Restore.
- [ ] **I2 (case B):** pass `protocol: 2` in `createCacheClient`. B goes **red** (no `HELLO`). This proves B pins the RESP3 handshake, so a future "fix" that silently downgrades is visible. Restore.
- [ ] **I3 (case A):** rename `services/reputation-service/node_modules/ioredis` → `ioredis.off`, so reputation resolves the hoisted 5. A goes **red**. Rename it back.
- [ ] **Promote:** `git mv services/reputation-service/tests/tdd/sprint-131-ioredis-6.test.ts services/reputation-service/tests/regression/`. Do **not** run `scripts/promote-tdd-tests.js`. Re-run `npm test` in the workspace, and confirm the file now runs in the regression tier (its name appears in the output).
- [ ] **Commit** (`test(reputation): promote ioredis-6 gate; injections I1–I3 recorded`), and record I1–I3 with their outputs in the Execution notes.

---

### Task 6: Docs (CONTEXT, landing page, IDEAS)

- [ ] **Step 1: `services/reputation-service/CONTEXT.md`.** Append `## Sprint 131 D9 — ioredis 6 (2026-09-28)` after the D2 section, in its style. It covers:
  - `ioredis` 5.11.1 → 6.0.0 for the effective-params cache only, nested. bull and root stay on 5. This supersedes #245.
  - The accepted deltas: RESP3 via `HELLO 3` with automatic RESP2 fallback, and `keepAlive` 30 s.
  - The **pinned** v5 backoff and why (the outage arithmetic).
  - The new `createCacheClient` factory.
  - The gate and its four cases.
  - That no endpoint, event or schema change occurs. Also add a line under *Known Issues* that the cache's silent `catch` hides client failures (V3), and point to the gate.
- [ ] **Step 2: Landing page.** Run `cd apps/landing && npx tsx ../../scripts/generate-docs.ts`. Keep the `services/reputation-service.json` content change. Revert timestamp- and HEAD-sha-only churn **after** committing Step 1. Use `git add -f` if the file is ignored.
- [ ] **Step 3: `docs/IDEAS.md`.** Append `## [2026-09-28] D9 follow-ups`:
  - **(a)** Root declares `ioredis` in production `dependencies` and imports nothing. That lands it in every service image, which is exactly what CLAUDE.md forbids. Dropping it, or moving root to 6, retires the D9 allowlist entry.
  - **(b)** `bull@4` pins `ioredis ^5`. Moving the queue off ioredis 5 means bull → BullMQ, a separate decision.
  - **(c)** With Redis down, each cache command still costs about 10.5 s (the ~298 s CI hang, `ci.yml:330`). A fail-fast policy (`maxRetriesPerRequest`/`enableOfflineQueue`) is a behavior change worth its own plan.
- [ ] **Step 4:** No user guide, onboarding or ADR change: users see no behavior change, and the PR body says so. `services/registry.json` lists no npm dependencies, so it gets no change.
- [ ] **Step 5: Commit** (`docs(reputation): D9 ioredis 6 — CONTEXT, landing page, IDEAS`)

---

### Task 7: Version bump

- [ ] Take the version from `git show origin/master:package.json`. If it is still 11.72.0, bump to **11.73.0** in `package.json:3` and both root version fields of `package-lock.json`. Exactly 3 lines change. Run strict `npx -y npm@11.19.0 ci` and expect exit 0. Commit.

---

### Task 8: SDLC quality gates (mandatory)

- [ ] **`/simplify`** on the branch diff (one pass; the diff is small). *Verify:* each edit is applied or skipped with a reason, recorded in the Execution notes. The fake RESP server is test code: keep it minimal, but do not trade away exact-sequence assertions for brevity.
- [ ] **`/code-review high`** on the branch diff. This is a runtime change on a production path, so use high, not medium. *Verify:* each finding is fixed, or dismissed with written justification (the `review-response` skill).
- [ ] **`/security-review`** on the branch diff. Watch the loopback server (bind `127.0.0.1` only, ephemeral port, closed in `afterEach`), the new exported factory (it accepts a URL, and only the module and the test call it), and whether the new node tree adds any install script. *Verify:* findings are resolved, or dismissals are justified in writing.
- [ ] **Process check:** `npm run feedback:check`. It is advisory, and it is false-green on a committed branch, so also eyeball CONTEXT.md against the diff.

---

### Task 9: Full verification before push

```bash
npx turbo run test --concurrency=2 --force; echo "turbo exit=$?"
(cd services/reputation-service && npx tsc --noEmit; echo "tsc exit=$?")
npx -y npm@11.19.0 ci; echo "ci exit=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-131-workspace-declarations.test.ts --runInBand; echo "root gates exit=$?"
git status --short   # only intended files; no stray tdd->regression moves, no landing churn
```

Confirm that `git push` runs the pre-push suite, and that it is not silent and instant.

---

### Task 10: PR, merge, deploy, smoke

- [ ] **PR:** title `Sprint 131 D9: reputation-service on ioredis 6 (supersedes #245) — v5 backoff pinned, wire gate`. The body carries `## Summary`, `## Validation`, `## Quality gates` and `## Security dismissals` (`pr-contract.yml`). *Validation* cites:
  - the gate's red, then its pre-pin C red, then green;
  - I1–I3;
  - the lock proof;
  - the Dockerfile simulation;
  - resolution per side (reputation 6, bull 5).

  It says explicitly that a green check is not cache evidence (V1, V3), and it includes "Supersedes #245".
- [ ] **CI:** expect all pass, with Deploy and CodeQL skipping. `Test Backend Services` must show reputation's regression run including the new file. `Integration Tests` exercise reputation against real `redis-test`. **Compare their duration with a recent master run**: a large regression means the client is retrying (V3).
- [ ] **Land the handoff before asking for merge auth.** Then ask the maintainer for explicit authorization for **this** PR, and run `gh pr merge <N> --squash --admin` only on it. Try once. If the classifier refuses, hand over the command.
- [ ] **Deploy:** watch the CI/CD run through to `🎉 Demo Deployment Successful` with all 9 services healthy and no rollback.
- [ ] **Smoke, API (one login as maria.reyes).** Run `POST /api/auth/login` (200), then `/api/requests`, `/api/conversations` and `/api/reputation/karma/:userId`, all 200. Then decode the JWT for `userId` and her `communities`.
- [ ] **Smoke, demo host.** These steps are read-only. **Ask the maintainer to authorize them first, and name this lane (D9).** Take the container names from `docker ps`; they are UNVERIFIED here. Never print a secret.
  1. `docker exec <reputation> node -e` prints, from `/app/services/reputation-service`, `require.resolve('ioredis/package.json')` and its version. **Expect 6.0.0, nested.** From `/app/node_modules/bull`, expect **5.11.1**. This is the authority on V7.
  2. `redis-cli INFO server` → record `redis_version`, which confirms RESP3 support.
  3. Choose one of maria's communities where `redis-cli TTL trust_params:<userId>:<communityId>` is **`-2`** (absent). Stop if none is. Then `GET /api/reputation/users/<userId>/effective-params?communityId=<cid>` and time it. Expect 200, `success: true`, and three numeric fields. Then `TTL` again: expect **13,000–14,400**. That proves the **new** client wrote it just now. Call the endpoint a second time and time it: it should be a hit, and fast.
  4. `redis-cli CLIENT LIST` → at least one connection from the reputation container's IP with **`resp=3`**.
- [ ] **Post-merge:** #245 targets root too, so Dependabot will **not** auto-close it. Ask the maintainer whether to close it with a pointer to the merged PR. Then update the handoff and the lane-holder memory: D9 shipped, next is D10, #243 bcryptjs.

---

## Execution notes

**Task 1 refresh (2026-09-28):** master/merge-base remains `3f504727`; #245 is OPEN at `980f74a2` with the same three files. Registry: latest ioredis 6 is 6.0.0; Bull 4.16.5 requires `^5.3.2`. Installed reputation and Bull both resolve hoisted 5.11.1. The byte-copy lock baseline SHA256 is `02718B469C5DE1DCC26DFC134327E0652D181534E04D90D7B8269DBAD17D2E46`. `npm ls --all --json` has four existing problems; the lock-only form has eight. Compare each form against itself, not against the other.

**Task 2 corrections (2026-09-29):** the planned wire sequence omitted the default readiness `INFO`. ioredis 6 sends `HELLO`, client metadata, then `INFO` (`lib/redis/event_handler.ts` at tag v6.0.0; `lib/Redis.ts` `_readyCheck`). Case B now requires `HELLO 3`, `INFO`, then the exact cache sequence, ignoring only metadata `CLIENT` commands before `INFO`. The fake `INFO` response is a Redis bulk string containing `loading:0`, replacing the plan's unrealistic simple `+OK`. No production readiness option changes.

**Task 2 evidence:** reputation `tsc --noEmit` passed, as did its existing unit suite (5 tests) and regression suite (284 passed, 3 todo). The final real-client gate on v5 is A/B/D red and C green: A resolves 5; B and D lack only the required `HELLO 3`; the cache commands, values and single DB fetch match. Tests are still in TDD, not yet blocking. Test-only instrumentation delegates to the real ioredis `connect` and retains clients for unconditional cleanup. A temporary stalled `INFO`/`QUIT` fixture proved cleanup fails at its 2 s bound and Jest exits (8.72 s, no open-handle diagnostic); exact file bytes were restored. This is fixture validation, not I1–I3 (those remain pending on a committed upgraded tree).

**Host validation issue:** the first root suite selected Windows WSL `bash` and failed with access denied. A retry with Git Bash on PATH completed every direct root regression file except `sprint-122-adr-060-code-scanning-gate.test.ts`, whose synchronous child hung. That run was stopped; no full-suite pass is claimed for it. Diagnosis: Git's `bin/bash.exe` launcher prepends system tools ahead of the test's temporary `sleep` stub, so missing-analysis cases run real 30-second sleeps. Put `C:\Program Files\Git\usr\bin` **before** `C:\Program Files\Git\bin` on PATH to invoke the direct Bash executable and preserve the fixture's PATH ordering. The required root-suite rerun is in progress.

**Documentation ruling:** update reputation's registry notes with the dependency change as required by CLAUDE.md, despite Task 6's omission. Describe the retry pin as preserving outage behavior; RESP3 and 30 s keepalive are accepted runtime changes.
