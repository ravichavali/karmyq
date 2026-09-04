# Karmyq - Mutual Aid Platform

**Version**: see [`package.json`](package.json) (source of truth) | **Status**: Demo/Development

> [`AGENTS.md`](AGENTS.md) is the cross-agent bootstrap (Codex, others) that bridges INTO this
> file. **CLAUDE.md is the source of truth**; keep the two in sync when changing global rules.
> Claude does not need to read AGENTS.md.

---

## 🚀 Session Bootstrap (do this BEFORE any work, in order)

1. **This file** — global rules; they OVERRIDE your defaults.
2. **[`.claude/handoff/CURRENT_HANDOFF.md`](.claude/handoff/CURRENT_HANDOFF.md)** — the ONLY doc
   carrying state between sessions. If it exists, follow its Quick Start; update it as you
   progress; archive it when the feature ships (create/update via the `handoff`/`update-handoff`
   skill; framework: `.claude/handoff/README.md`).
   ⚠️ **When parallel lanes are active it is a ROUTER, not the state itself** — its "Active lanes"
   table maps each branch to its own `lane-<slug>.md`. Read the router, then read and update ONLY
   your lane's file. Two machines editing one rolling handoff corrupts the one doc that carries
   all cross-session state.
3. **Persistent memory** — `MEMORY.md` index + any matching memory file (advisory; verify
   anything it names still exists).
4. **[`services/registry.json`](services/registry.json)** — services, ports, endpoints, events.
5. **Local context** for the area you'll touch (see next section).

**Then summarize before coding:** active sprint, branch, blockers, recommended first action.

**Chat cadence:** one fresh chat per sprint (planning chat produces spec + plan + handoff via the
`sprint-planning` skill; the NEXT chat executes). Same-PR polish/review follow-ups stay in the
same chat. For a long multi-PR sprint: per-PR plan files and a fresh chat per PR. Two agents on
one sprint = one chat per agent branch, orchestrated through handoff/PR state. **Two machines on
two sprints = one lane file per sprint** (see *Parallel Development*); a chat never reads or
writes the other lane's handoff.

---

## Context Follows Directory Scope

Read the LOCAL context first. **This file is global patterns only**; local checklists are mandatory
— follow them exactly.

| Working in | Read |
|---|---|
| `services/{name}/` | `services/{name}/.claude/README.md` **+** `CONTEXT.md` |
| `apps/frontend/`, `apps/mobile/` | that app's `claude.md` |
| `apps/landing/` | [`apps/claude.md`](apps/claude.md) |
| `packages/shared/` | [`packages/claude.md`](packages/claude.md) + `shared/CONTEXT.md` |
| `tests/` | [`tests/claude.md`](tests/claude.md) |
| `infrastructure/`, `scripts/` | that directory's `claude.md` |

Only the **services** carry `.claude/README.md`; everywhere else the directory-level `claude.md`
*is* the local context, and Claude auto-discovers it from the file you're editing.

---

## Development Disciplines (MUST FOLLOW)

1. **Context-driven:** read the local context for the directory before changing anything in it
   (table above — `.claude/README.md` for services, `claude.md` elsewhere).
2. **Update, don't create:** search for an existing file before creating any new one.
3. **TDD framework ([ADR-029](docs/adr/ADR-029-tdd-test-framework.md)):** unit + regression MUST
   pass before push (pre-push hook enforces; TDD tier reports only; integration blocks if a DB is
   available). `npm run hooks:install` once after clone — `.npmrc` `ignore-scripts=true`
   ([ADR-061](docs/adr/ADR-061-supply-chain-and-secrets-hardening.md)) disables auto-install.
   `git push --no-verify` emergencies only; `SKIP_PREPUSH=1` skips pre-push only.
   ⚠️ **Hooks only enforce anything after `hooks:install` has run on this clone.** Git reads only
   `core.hooksPath` when that is set, so a push that finishes silently and instantly means **no
   hook ran** — treat that silence as a red flag, not a fast machine.
4. **Fix forward, not around:** fix the original script, never a workaround copy; ADR if
   architectural.
5. **Verify before you assert:** every factual claim you write into a spec, plan, handoff or ADR
   about this repo — file path, dependency/`peerDependency`, export, endpoint route, engine range,
   CI gate behavior — is read out of the file FIRST; cite `file:line` for non-obvious ones and mark
   anything you couldn't check **UNVERIFIED**. A changelog or upgrade guide is a hypothesis;
   the manifest / `node_modules` / the compiler is evidence. Same rule for gates you write: a check
   comparing against a hand-written shadow map is **false-green** — query the live arbiter
   (registry, SDK map, upstream API) at run time and prove the check can actually fail.
6. **Docs feedback loop (MANDATORY):** every behavior change updates docs in the same PR —
   endpoint/schema/event/dependency → service `CONTEXT.md` + `services/registry.json` (+ migration
   in `infrastructure/postgres/migrations/`); shared-package export → `packages/shared/CONTEXT.md`;
   architectural decision → ADR in `docs/adr/` + its `README.md` index (lifecycle: Proposed →
   Accepted → Implemented | Superseded | Deprecated; flip to Implemented when deployed);
   cross-service change (3+ services) → ADR. Then `npm run analyze:services` if dependencies
   changed, and `npm run feedback:check` to verify.

---

## Pre-Merge Checklist (before `git push`)

Three buckets — don't hand-verify what the machine enforces:

**🤖 CI blocks on its own** (fix the failure, never `--no-verify` past it): unit + regression
tests; dependency audit ([ADR-059](docs/adr/ADR-059-dependency-security-gate.md), high+) + CodeQL
([ADR-060](docs/adr/ADR-060-code-scanning-gate.md)); PR contract headers (`pr-contract.yml`);
doc/context drift gate (`tests/regression/doc-context-drift-gate.test.ts`: CLAUDE.md service
count matches the registry, version line isn't hard-coded semver, every ADR indexed, every
landing page in `nav.json`, `jest.setup` mocks `next/router`).

**🔔 `npm run feedback:check` advises** (warn-only, but it's your to-do list for the diff):
CONTEXT.md/registry updates for changed endpoints/schema/events/deps; ADR index; skipped tests
without a justification comment.

**🧠 Only you can judge:**
- [ ] The RIGHT tests exist (coverage table below), not just a green suite
- [ ] User guide + onboarding workflow updated for behavior/UI changes (`docs/guides/`,
      `apps/frontend/src/lib/onboarding/workflows.ts`)
- [ ] Landing docs authored for new features/concepts/ADRs (formats below)
- [ ] ADR exists if architectural
- [ ] SDLC gates run on the branch diff: `/simplify`, `/code-review`, `/security-review` —
      findings resolved or dismissed with written justification. **Effort calibrated to diff
      size** (2026-07-16): one `/simplify` pass per PR for small diffs (per-task only on
      substantial tasks); `/code-review` medium for small well-specified PRs, high for
      risky/large ones. All four gates (with testing) remain mandatory every sprint.
- [ ] Handoff updated
- [ ] Vulnerability SLA: high/critical ≤ 1 week; anything ≤ 2 weeks

**Minimum test coverage for UI changes:**
| Change Type | Required Tests |
|---|---|
| New component | Renders correctly, handles edge cases |
| Conditional render (role/state gate) | Shows for authorized, hidden for unauthorized |
| API call wired to user action | Mock verifies correct payload |
| Data fetch on mount | Shows data, graceful error fallback |

**Landing docs authoring** (`apps/landing/src/data/docs/`, each wired into `nav.json`):
- **ADR** — `concepts/adr-{NNN}-{slug}.json`: `{ slug, number, title, status, description, content, filename }`
- **Concept / User Guide** — `{ slug, title, description, content }`
- **Service endpoint entry** — `{ method, path, description }`

**Quick verification:** `npm test` (blocks) → `npm run feedback:check` →
`npm run analyze:services` (if deps changed) → gates on the diff.

---

## System Architecture

### Services (10 total)
See **[services/registry.json](services/registry.json)** for the complete list. (Sprint 91 /
ADR-071 folded feed-service into request-service — the feed is `/requests/feed/*`; there is no
feed-service.)

| Service | Port | Criticality |
|---------|------|-------------|
| Auth | 3001 | Critical (7 dependents) |
| Community | 3002 | Critical (3 dependents) |
| Request | 3003 | Critical |
| Reputation | 3004 | Critical |
| Notification | 3005 | Critical |
| Messaging | 3006 | Critical |
| Social-Graph | 3010 | Critical |
| Cleanup | 3008 | Important |
| Geocoding | 3009 | Optional |
| Simulation | dev | Optional |

**Tech stack:** Node.js 24 (`node:24-alpine`, [ADR-090](docs/adr/ADR-090-container-runtime-floor.md)
— images, root `engines.node` and CI's `NODE_VERSION` are gate-locked to one major)/Express
5/TypeScript · Next.js 15 · React Native + Expo · PostgreSQL 15
(RLS) · Redis + Bull · Turborepo.

---

## Global Patterns

### Authentication
JWT payload: `{ userId, email, communities: Array<{id, name, role}> }`, header
`Authorization: Bearer <token>`.

**⚠️ The JWT field is `communities`, NOT `communityMemberships`** — the wrong field is always
`undefined` → always 403. Admin hint:
`user.role === 'admin' || (user.communities ?? []).some(m => m.role === 'admin')`.

**⚠️ Authorization decisions MUST re-derive membership from a live lookup** — the JWT claim is a
login-time snapshot (a removed member keeps the old claim until refresh; claim-only checks leak
access). Claims are cheap role hints only; anything gating visibility or writes queries current
membership.

### New service nginx routing
Add `location ~ ^/api/{prefix}(/.*)?$` to `infrastructure/nginx/nginx.conf`; proxy_pass must
strip `/api`: `proxy_pass http://your_service/{prefix}$1$is_args$args`. Takes effect on next
deploy (or manual `sudo cp` + `nginx -t` + reload on the server).

### Database
**12 live schemas + 1 reserved**, not 6. Live: `auth`, `communities`, `requests`, `reputation`,
`notifications`, `messaging`, `social_graph`, `feed`, `governance`, `feedback`, `provider`,
`events`. Reserved: **`federation`** — twelve tables created by a migration and referenced by no
service; don't build on it ([ADR-093](docs/adr/ADR-093-federation-schema-reserved.md)).
The community schema is **`communities`** (plural). Two names where the obvious guess is wrong:
`communities.members` (not `memberships`) and `requests.help_offers` (not `offers`). RLS is on —
a query that skips `setDbContext` sees nothing rather than erroring.
Details: [infrastructure/claude.md](infrastructure/claude.md).

### API Response Contract (ADR-074)
Success: `{ "success": true, "data": T, "message": "optional" }`.
Error: `{ "success": false, "message": "Human-readable", "error": "ERROR_CODE" }` (string code).

### Events
Bull queue `karmyq-events`: `match_completed` → Reputation, Notification; `karma_awarded`,
`request_created`, `user_joined_community` → Notification. Publishers/subscribers in
[services/registry.json](services/registry.json).

### Workspace dependencies
**Every workspace declares every package it imports.** Hoisting is npm's private optimization, not
a contract — bumping a package in the workspaces that declare it de-hoists it out from under the
ones that don't, breaking them. Before any bump, cross-check importers against declarers and add
the missing declarations; never pin to preserve a hoist.

**Dependency edits are surgical.** Never `npm install --workspace`, `npm dedupe`, or a lockfile
scratch-regen to fix a dependency problem — they rewrite exact pins to ranges and churn unrelated
packages. Edit `package.json` and splice `package-lock.json` in place, then prove it with strict
`npm ci`. Never add a root-level production dependency to satisfy an advisory — it lands in every
service image.

---

## Development Commands

npm scripts (full list in [`package.json`](package.json)):

| Command | Purpose |
|---------|---------|
| `npm test` | Unit + regression (**blocks push**) |
| `npm run test:tdd` / `test:integration` | WIP tests (never block) / integration (needs DB) |
| `npm run feedback:check` | Advisory doc to-do list for the diff |
| `npm run analyze:services` | Regenerate dependency graph + impact analysis |
| `npm run dashboard` / `health:check` | Service health |
| `npm run hooks:install` | Wire git hooks (once after clone) |
| `npm run dev` / `build` | Start / build all services |

**Test tiers** per workspace: `unit/` + `regression/` must pass; `tdd/` is WIP (auto-promotes
when green via `scripts/promote-tdd-tests.js`); `integration/` needs a DB. **New sprint tests
start in the changed workspace's `tests/tdd/`** (e.g. `services/request-service/tests/tdd/`),
not root. Infrastructure: `cd infrastructure/docker && docker-compose up -d postgres redis`.

### Host environments — check which machine you are on FIRST
Development runs from **two checkouts on different machines**. The gotchas below are per-host and
do not transfer; run `uname -s` before applying either set (`MINGW64_NT-*` = Windows box,
`Darwin` = Mac).

**Windows + Git Bash (primary box):** `curl` flag parsing is unreliable (spurious status `000`),
`jq` is **not installed**, and PowerShell execution policy blocks dot-sourcing helpers — use
`node -e` for HTTP probes and JSON parsing instead of `curl`/`jq`. **No local Docker** — anything
needing PostgreSQL runs in a disposable container on the demo server over an SSH tunnel.

**macOS (second checkout):** `curl` and `jq` behave normally and Docker may be available locally
for `postgres`/`redis`. Do **not** apply the Windows workarounds here — they are noise at best.
Note the root context file is git-tracked lowercase (`claude.md`); this resolves on default
case-insensitive APFS, but would silently load NOTHING on a case-sensitive volume or a Linux
devcontainer. Verify with `diskutil info / | grep -i "Case-Sensitive"` before using either.

**Both hosts:** `| tail` masks exit codes — capture the exit code separately. Don't attribute a
Turbo failure to the first-listed package; read the failing suite name out of the raw output.

---

## Documentation Map

[services/registry.json](services/registry.json) (single source of truth) · per-service
`.claude/README.md` (read first) + `CONTEXT.md` (technical) + `README.md` (human) ·
[docs/](docs/): `ARCHITECTURE.md`, `SERVICE_GOVERNANCE.md`, `CONTEXT_MANAGEMENT.md`, `adr/`.
**Generated, never hand-edit** (a hook blocks it): `services/dependency-graph.md`,
`services/impact-analysis.md`, `/dist/`, `/build/`. Also generated:
`infrastructure/postgres/init.sql` (source = `migrations/*.sql` + `scripts/regenerate-init-sql.sh`;
a drift gate enforces it) and `apps/landing/src/data/docs/` (regenerated by the landing prebuild).

---

## Creating New Services

The pre-commit hook enforces the checklist **once `npm run hooks:install` has run** (see
Discipline 3); follow [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
+ [ADR-028](docs/adr/ADR-028-npm-workspace-docker-build.md). Non-obvious must-dos: registry.json
entry FIRST (then `analyze:services` + `node scripts/generate-service-context.js`); tsconfig
`"rootDir": "./src"` + `"include": ["src/**/*"]` (build must emit `dist/index.js`, not
`dist/src/index.js`); copy a multi-stage Dockerfile from an existing TS service (build
`@karmyq/shared` first, copy `shared/dist` before prod `npm install`); `/health` endpoint; nginx
routing (above); `docker-compose.yml`; update the simulation service; ADR if architectural.

---

## Deployment

**Dev:** `npm run dev`; `pm2 restart|logs karmyq-{service}`.
**Demo (karmyq.com — demo/QA on ARM64/Oracle, NOT production, but master is protected and every
master push is a full deploy):** push to `master` → GitHub Actions tests, builds ARM64 images,
SSHes, runs `./scripts/deploy.sh`, verifies health, **rolls back on failure**
([docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)). Manual fallback:
`ssh ubuntu@karmyq.com && cd ~/karmyq && ./scripts/deploy.sh` (`SKIP_TESTS=1` emergencies).

---

## Bug Fixing (MANDATORY steps before any fix)

1. **Identify the layer** (DB/API/UI) — fix there; never client-filter a server problem.
2. **Grep ALL instances** across services, frontend, mobile, simulation — assume the bug is in
   multiple files (incl. config values, API URLs, types); fix every occurrence.
3. **Trace end-to-end** (source config → build → runtime → client); state where the bug was and
   confirm no other path reintroduces it.
4. **Never edit generated files** — fix the source.
5. **Wait for actual output** — if the user is about to paste an error, stop and wait.

Document: `CONTEXT.md` "Known Issues" → "Recent Fixes". CI issues: check Alpine compatibility,
package names/versions, env-var loading order.

---

## Pre-Commit / Pre-Push Checks

- Verify the fix end-to-end before committing; `tsc --noEmit` before pushing.
- After ANY delete/rename: grep the whole repo for orphaned references before committing.
- **Don't trust a suspiciously-green local run after deletes/renames** — Turbo's cache misses
  cross-workspace test inputs (a `tests/regression/*` test reading `apps/landing` caches a stale
  pass while CI fails). Re-run directly: `cd tests && npx jest regression/<file>` (or `--force`).

---

## Merge, Deploy & Security-Gate Discipline

- **Never force-push; never direct-push to `master`.** Broken PR base → fresh replacement PR.
- **Branch off `origin/master`, not local master** (unpushed local-master commits leak via
  squash-merge). Update a diverged PR branch with a merge commit, not rebase+force.
- **Planning commits (spec/plan/handoff) stay on the feature branch**; **no docs-only master
  pushes** — a post-merge docs push triggers a second deploy → services restart → demo 502s.
- **CodeQL:** recurring alerts here are documented false positives (e.g. `js/request-forgery` on
  `apps/frontend/src/lib/api.ts`) — surface to the user for dismissal; never loop the dismissal
  API (rate-limited; UI bulk-dismiss for >~50). The gate can false-block the fix-shipping push
  (rescan lag) — re-run after rescan, don't bypass.
- **Demo-server data ops use DB user `karmyq_prod`.**

---

## Parallel Development (two checkouts, two machines)

Work runs from **two checkouts on different machines** (Windows primary + Mac), each on its own
sprint and its own branch. There is real branch isolation, so the lane model is now the actual
mechanism — but the machines cannot see each other's working trees, so **all coordination goes
through git and PR state, never through tree hygiene.** Neither machine may assume the other is
idle.

**Serialize these four shared surfaces** — they collide even when sprint scope is fully disjoint:

| Surface | Why it collides | Rule |
|---|---|---|
| `master` merges | Every master push is a full deploy with rollback-on-failure; overlapping deploys restart services and 502 the demo | **One merge at a time.** Wait for the deploy AND health verify to finish before the next PR merges. |
| `package.json` version | One line, bumped every sprint; second merge ships a duplicate or skipped version | First PR to merge takes the bump; the second re-bumps at merge time, not at branch time. |
| `package.json` / `package-lock.json` | Lockfile conflicts cannot be resolved by regeneration (scratch-regen is forbidden — it rewrites exact pins) | **One lane at a time** may touch dependencies. Open Dependabot PRs count as that lane. |
| ADR numbers | Both lanes mint the same next number → filename AND `docs/adr/README.md` index conflict; the drift gate requires every ADR indexed | **Derive, never reserve** (below). |

**Also expect, and handle locally:**
- `apps/landing/src/data/docs/` is **git-tracked** and regenerated by `npm test` with timestamp /
  HEAD-sha churn. Two machines on two branches produce competing diffs — reverting that churn
  before committing is **mandatory** here, not advisory.
- `docs/BUGS.md` and `docs/IDEAS.md` are append-only from both lanes. Append at the end; resolve
  the trivial conflicts rather than reordering.
- **The demo server is a single shared resource** — both machines SSH as the same user and write
  as `karmyq_prod`. Demo data operations are **exclusive, and the maintainer is the lock**: every
  demo data operation already requires its own explicit per-operation authorization, so ask before
  each one and say which lane is asking. Do NOT rely on a written announcement to reserve the
  server — see *Why reservations do not work here*.
- **Persistent memory does not travel.** `MEMORY.md` and the memory files live outside the repo in
  `~/.claude/projects/<project>/memory/`. A fresh checkout starts with none of it; sync that
  directory between machines rather than duplicating it into this file.

**Split sprints on file-disjoint boundaries** — by service. Never run one lane in
`packages/shared/` while the other is in a consumer of it; a shared-package change plus an
un-updated importer is exactly the breakage the workspace-dependency rule exists to prevent.

### Why reservations do not work here — derive instead

There is **no shared mutable store between the two checkouts.** Every handoff file, including the
lane router, is a **branch-local file**: a reservation written on lane A's branch is invisible on
lane B's branch until it merges to `master`. A lane is also told to read only its own lane file, so
a reservation recorded there is written where the other lane is forbidden to look. Any protocol of
the form "announce it in the handoff" is therefore **unreliable by construction** — both lanes can
believe they hold the same resource.

So: **derive contended values from the live arbiter at the moment you need them**, exactly as
Discipline 5 requires everywhere else.

| Resource | Live arbiter — query it, do not reserve it |
|---|---|
| Next ADR number | `git fetch origin` then the **union** of `docs/adr/` on `origin/master` and the ADR files added by every **open PR** (`gh pr list` → diff). Take the next number above that union, and claim it by pushing the ADR file — first push wins. |
| Version bump | `origin/master`'s `package.json` at merge time, not at branch time. |
| Dependency / lockfile lane | `gh pr list` — is another PR (including a Dependabot PR) already touching `package.json`/`package-lock.json`? If yes, you are not the lane. |
| `master` merge slot | `gh pr list` + the latest deploy run's status. |
| Demo data operations | **The maintainer.** Ask per operation; there is no file-based lock. |

**Backstop:** the drift gate asserts ADR numbers are unique, so a genuine collision fails CI rather
than merging. Derivation narrows the race; the gate closes it.

**The router is a pointer, not a coordination store.** `CURRENT_HANDOFF.md`'s lane table tells you
which file is yours. Because it is branch-local it can be stale, and it must never be treated as
the authority on who owns a resource — the arbiters above are.

---

## Session Workflow

**Write to `CURRENT_HANDOFF.md` immediately** when sprint goals/scope are agreed, an approach is
chosen, a constraint is established, or a sprint completes — never defer to end of session (the
handoff is the only thing that travels between chats). Trigger phrases: "next sprint",
"the plan is", "we've agreed". Update status/blockers/next steps at every session end.

**Reconcile the handoff before claiming done.** After any merge, PR open/close, and at session
end, re-read `CURRENT_HANDOFF.md` end-to-end against real state (`gh pr list`, `git log`, current
branch). A handoff saying "PR N NEXT / start from master" while PR N is already open or merged is
a **blocking defect**, not a nice-to-have — fix it before reporting the work complete.

---

**Remember**: this is global context — read the local context for the area you touch (the table in
*Context Follows Directory Scope*: `.claude/README.md` for a service, that directory's `claude.md`
everywhere else).
