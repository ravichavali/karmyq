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
3. **Persistent memory** — `MEMORY.md` index + any matching memory file (advisory; verify
   anything it names still exists).
4. **[`services/registry.json`](services/registry.json)** — services, ports, endpoints, events.
5. **Local context** for the area you'll touch (see next section).

**Then summarize before coding:** active sprint, branch, blockers, recommended first action.

**Chat cadence:** one fresh chat per sprint (planning chat produces spec + plan + handoff via the
`sprint-planning` skill; the NEXT chat executes). Same-PR polish/review follow-ups stay in the
same chat. For a long multi-PR sprint: per-PR plan files and a fresh chat per PR. Two agents on
one sprint = one chat per agent branch, orchestrated through handoff/PR state.

---

## Context Follows Directory Scope

Read the LOCAL context first: `services/{name}/.claude/README.md` (+ `CONTEXT.md`) for a service,
`apps/frontend/.claude/README.md` for frontend, `apps/mobile/.claude/README.md` for mobile,
`tests/.claude/README.md` for tests. **This file is global patterns only.** Local checklists are
mandatory — follow them exactly.

---

## Development Disciplines (MUST FOLLOW)

1. **Context-driven:** read the local `.claude/README.md` before changes.
2. **Update, don't create:** search for an existing file before creating any new one.
3. **TDD framework ([ADR-029](docs/adr/ADR-029-tdd-test-framework.md)):** unit + regression MUST
   pass before push (pre-push hook enforces; TDD tier reports only; integration blocks if a DB is
   available). `npm run hooks:install` once after clone — `.npmrc` `ignore-scripts=true`
   ([ADR-061](docs/adr/ADR-061-supply-chain-and-secrets-hardening.md)) disables auto-install.
   `git push --no-verify` emergencies only; `SKIP_PREPUSH=1` skips pre-push only.
4. **Fix forward, not around:** fix the original script, never a workaround copy; ADR if
   architectural.
5. **Docs feedback loop (MANDATORY):** every behavior change updates docs in the same PR —
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
Schema-prefixed tables: `auth.*`, `communities.*`, `requests.*`, `reputation.*`,
`notifications.*`, `messaging.*`.

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

---

## Documentation Map

[services/registry.json](services/registry.json) (single source of truth) · per-service
`.claude/README.md` (read first) + `CONTEXT.md` (technical) + `README.md` (human) ·
[docs/](docs/): `ARCHITECTURE.md`, `SERVICE_GOVERNANCE.md`, `CONTEXT_MANAGEMENT.md`, `adr/`.
**Generated, never hand-edit** (a hook blocks it): `services/dependency-graph.md`,
`services/impact-analysis.md`, `/dist/`, `/build/`.

---

## Creating New Services

Pre-commit hook enforces the checklist; follow [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
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

## Session Workflow

**Write to `CURRENT_HANDOFF.md` immediately** when sprint goals/scope are agreed, an approach is
chosen, a constraint is established, or a sprint completes — never defer to end of session (the
handoff is the only thing that travels between chats). Trigger phrases: "next sprint",
"the plan is", "we've agreed". Update status/blockers/next steps at every session end.

---

**Remember**: this is global context — read the local `.claude/README.md` for the area you touch.
