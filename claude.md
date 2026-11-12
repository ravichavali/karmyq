# Karmyq - Mutual Aid Platform

**Version**: see [`package.json`](package.json) (source of truth) | **Status**: Demo/Development

> [`AGENTS.md`](AGENTS.md) is the cross-agent bootstrap (Codex, others) that bridges INTO this
> file. **CLAUDE.md is the source of truth**; keep the two in sync when changing global rules.
> Claude does not need to read AGENTS.md.

---

## 🚀 Session Bootstrap (do this BEFORE any work, in order)

1. **This file** — global rules; they OVERRIDE your defaults.
2. **[`.claude/handoff/CURRENT_HANDOFF.md`](.claude/handoff/CURRENT_HANDOFF.md)** — the ONLY doc
   carrying state between sessions. Follow its Quick Start; update it as you progress; archive it
   when the feature ships (`handoff`/`update-handoff` skill; framework: `.claude/handoff/README.md`).
   ⚠️ **With parallel lanes active it is a ROUTER**: its "Active lanes" table maps each branch to a
   `lane-<slug>.md`; read and update ONLY your lane's file.
3. **Persistent memory** — `MEMORY.md` index + any matching memory file (advisory; verify
   anything it names still exists).
4. **[`services/registry.json`](services/registry.json)** — services, ports, endpoints, events.
5. **Local context** for the area you'll touch (see next section).

**Then summarize before coding:** active sprint, branch, blockers, recommended first action.

**Chat cadence:** one fresh chat per sprint — the planning chat produces spec + plan + handoff
(`sprint-planning` skill), the NEXT chat executes; same-PR polish/review follow-ups stay in the
same chat. A long multi-PR sprint gets per-PR plan files and a fresh chat per PR; two agents on one
sprint get one chat per agent branch; two machines on two sprints get one lane file per sprint.
**Small fixes may plan and execute in one chat** when well understood, with clear acceptance
criteria and no open design decision; tests, the four review gates and the handoff still apply.

---

## Context Follows Directory Scope

Read the LOCAL context first. **This file is global patterns only**; local checklists are mandatory.

| Working in | Read |
|---|---|
| `services/{name}/` | `services/{name}/.claude/README.md` **+** `CONTEXT.md` |
| `apps/frontend/`, `apps/mobile/` | that app's `claude.md` |
| `apps/landing/` | [`apps/claude.md`](apps/claude.md) |
| `packages/shared/` | [`packages/claude.md`](packages/claude.md) + `shared/CONTEXT.md` |
| `tests/` | [`tests/claude.md`](tests/claude.md) |
| `infrastructure/`, `scripts/` | that directory's `claude.md` |

Only the **services** carry `.claude/README.md`; elsewhere the directory-level `claude.md` *is* the
local context, and Claude auto-discovers it from the file you're editing.

**Also read every gotcha whose `scope` matches the paths you are about to change:**
`node scripts/gotcha-check.js --for <paths>` names them; entries live in
[`docs/gotchas/`](docs/gotchas/). Discovery answers for files that do not exist yet, so ask before
you create one.

---

## Development Disciplines (MUST FOLLOW)

1. **Context-driven:** read the local context for the directory before changing anything in it.
2. **Update, don't create:** search for an existing file before creating any new one.
3. **TDD framework ([ADR-029](docs/adr/ADR-029-tdd-test-framework.md)):** unit + regression MUST
   pass before push (pre-push hook enforces; TDD tier reports only; integration blocks if a DB is
   available). `.npmrc` `ignore-scripts=true` ([ADR-061](docs/adr/ADR-061-supply-chain-and-secrets-hardening.md))
   disables auto-install of hooks. `git push --no-verify` emergencies only; `SKIP_PREPUSH=1` skips
   pre-push only. ⚠️ **A push that finishes silently and instantly means no hook ran** — treat
   that as a red flag. Clone setup is exactly two commands, matching `README.md` and
   `CONTRIBUTING.md` verbatim:

   ```bash
   npm ci
   npm run hooks:install
   ```
4. **Fix forward, not around:** fix the original script, never a workaround copy; ADR if
   architectural.
5. **Verify before you assert:** every factual claim you write into a spec, plan, handoff or ADR
   about this repo (path, dependency, export, route, engine range, CI gate behavior) is read out
   of the file FIRST; cite `file:line` for non-obvious ones and mark anything unchecked
   **UNVERIFIED**. A changelog is a hypothesis; the manifest / `node_modules` / the compiler is
   evidence. A gate that compares against a hand-written shadow map is **false-green** — query the
   live arbiter at run time and prove the check can actually fail.
6. **Docs feedback loop (MANDATORY):** every behavior change updates docs in the same PR —
   endpoint/schema/event/dependency → service `CONTEXT.md` + `services/registry.json` (+ migration
   in `infrastructure/postgres/migrations/`); shared-package export → `packages/shared/CONTEXT.md`;
   architectural decision or a change across 3+ services → ADR in `docs/adr/` + its `README.md`
   index (Proposed → Accepted → Implemented | Superseded | Deprecated). Then
   `npm run analyze:services` if dependencies changed, and `npm run feedback:check`.

---

## Pre-Merge Checklist (before `git push`)

**🤖 CI blocks on its own** (fix the failure, never `--no-verify` past it): unit + regression;
dependency audit ([ADR-059](docs/adr/ADR-059-dependency-security-gate.md)) + CodeQL
([ADR-060](docs/adr/ADR-060-code-scanning-gate.md)); PR contract headers; the doc/context drift
gate (`tests/regression/doc-context-drift-gate.test.ts`).

**🔔 `npm run feedback:check` advises** (warn-only — your to-do list for the diff).

**🧠 Only you can judge:**
- [ ] The RIGHT tests exist — minimum UI coverage: [`apps/frontend/claude.md`](apps/frontend/claude.md)
      (last paragraph)
- [ ] User guide + onboarding workflow updated for behavior/UI changes (`docs/guides/`,
      `apps/frontend/src/lib/onboarding/workflows.ts`)
- [ ] Landing docs authored from the SOURCE, never `apps/landing/src/data/docs/` (generated); a new
      ADR's slug also goes in `ADR_GROUPS` in `scripts/generate-docs.ts` or the drift gate fails.
      Procedure: [`apps/claude.md`](apps/claude.md) → *Authoring docs*
- [ ] ADR exists if architectural
- [ ] SDLC gates on the branch diff: `/simplify`, `/code-review`, `/security-review` — findings
      resolved or dismissed with written justification. Effort calibrated to diff size: one
      `/simplify` pass per small PR; `/code-review` medium for small well-specified PRs, high for
      risky/large ones. All four gates (with testing) remain mandatory every sprint.
- [ ] Handoff updated
- [ ] Vulnerability SLA: high/critical ≤ 1 week; anything ≤ 2 weeks

**Quick verification:** `/pre-commit-check` (runs `bash scripts/pre-commit-check.sh`) →
`npm run analyze:services` (if deps changed) → gates on the diff.

---

## System Architecture

### Services (10 total)
Auth 3001 · Community 3002 · Request 3003 · Reputation 3004 · Notification 3005 · Messaging 3006 ·
Social-Graph 3010 (all Critical) · Cleanup 3008 (Important) · Geocoding 3009, Simulation (dev) —
Optional. The feed is part of request-service (`/requests/feed/*`, ADR-071); there is no
feed-service. Full list: [services/registry.json](services/registry.json).

**Tech stack:** Node.js 24 (`node:24-alpine`, [ADR-090](docs/adr/ADR-090-container-runtime-floor.md)
— images, root `engines.node` and CI's `NODE_VERSION` are gate-locked to one major)/Express
5/TypeScript · Next.js 16 · React Native + Expo · PostgreSQL 15 (RLS) · Redis + Bull · Turborepo.

---

## Global Patterns

### Authentication
JWT payload: `{ userId, email, communities: Array<{id, name, role}> }`, header
`Authorization: Bearer <token>`.

**⚠️ The JWT field is `communities`, NOT `communityMemberships`** — the wrong field is always
`undefined` → always 403. Admin hint:
`user.role === 'admin' || (user.communities ?? []).some(m => m.role === 'admin')`.

**⚠️ Authorization decisions MUST re-derive membership from a live lookup** — the JWT claim is a
login-time snapshot (a removed member keeps it until refresh). Claims are cheap role hints only;
anything gating visibility or writes queries current membership via the service's `liveRole`
module (`getLiveRole`/`isLiveAdmin`, `(communityId, userId)`, always `await`ed;
[ADR-102](docs/adr/ADR-102-live-membership-authorization.md)).
`tests/regression/sprint-134-pr-k-claim-gate.test.ts` fails on any claim read outside its allowlist.
**Platform admin is a separate, granted role** (`auth.platform_admins`, `isLivePlatformAdmin(userId)`;
[ADR-105](docs/adr/ADR-105-platform-admin-role.md)): a community admin, even a creator, is never one. No gate ORs the two.

### Database
13 live schemas + **`federation`**, which is reserved — no service uses it; don't build on it
([ADR-093](docs/adr/ADR-093-federation-schema-reserved.md)). Names where the obvious guess is wrong:
the schema is **`communities`** (plural), **`communities.members`** (not `memberships`),
**`requests.help_offers`** (not `offers`). RLS is on — a query that skips `setDbContext` sees
nothing rather than erroring. Schema table: [infrastructure/claude.md](infrastructure/claude.md).

### API Response Contract (ADR-074)
Success: `{ "success": true, "data": T, "message": "optional" }`.
Error: `{ "success": false, "message": "Human-readable", "error": "ERROR_CODE" }` (string code).

### Events
Every event is routed by `packages/shared/events/routes.ts` (ADR-101): to its one consumer's
queue, to a dedicated transport, or nowhere. **Never attach two services' workers to one Bull
queue** — Bull fails a job whose name the taking worker never registered (BUG-060).
`tests/regression/sprint-133-pr-q-event-routes.test.ts` gates it. Detail:
[packages/claude.md](packages/claude.md) → *Event routing*.

### Workspace dependencies
**Every workspace declares every package it imports.** Hoisting is npm's private optimization, not
a contract — a bump in the workspaces that declare a package de-hoists it out from under the ones
that don't. Before any bump, cross-check importers against declarers; never pin to preserve a hoist.

**Dependency edits are surgical.** Never `npm install --workspace`, `npm dedupe`, or a lockfile
scratch-regen — they rewrite exact pins and churn unrelated packages. Edit `package.json` and
splice `package-lock.json` in place, then prove it with strict `npm ci`. Never add a root-level
production dependency to satisfy an advisory — it lands in every service image.

**Dependency work needs a reason:** a security advisory (the SLA applies) or a feature that needs
the newer version — never upgrades for their own sake. Dependabot is security-only. Ask the
maintainer who holds the dependency lane before starting (see *Parallel Development*).

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Unit + regression (**blocks push**) |
| `npm run test:tdd` / `test:integration` | WIP tests (never block) / integration (needs DB) |
| `npm run feedback:check` | Advisory doc to-do list for the diff |
| `npm run analyze:services` | Regenerate dependency graph + impact analysis |
| `npm run hooks:install` | Wire git hooks (once after clone) |
| `npm run dev` / `build` | Start / build all services |

**Test tiers** per workspace: `unit/` + `regression/` must pass; `tdd/` is WIP; `integration/`
needs a DB. **New sprint tests start in the changed workspace's `tests/tdd/`** (e.g.
`services/request-service/tests/tdd/`), not root — see [`tests/claude.md`](tests/claude.md).

### Host environments — check which machine you are on FIRST
Two checkouts on different machines; their gotchas do not transfer. Run `uname -s` first
(`MINGW64_NT-*` = Windows box, `Darwin` = Mac).

**Windows + Git Bash (primary box):** `curl` flag parsing is unreliable (spurious status `000`),
`jq` is **not installed**, and PowerShell execution policy blocks dot-sourcing helpers — use
`node -e` for HTTP probes and JSON parsing. **No local Docker** — anything needing PostgreSQL runs
in a disposable container on the demo server over an SSH tunnel.

**macOS (second checkout):** `curl` and `jq` behave normally and Docker may be available locally.
Do **not** apply the Windows workarounds. The root context file is git-tracked lowercase
(`claude.md`); that resolves on default case-insensitive APFS but loads NOTHING on a
case-sensitive volume — check with `diskutil info / | grep -i "Case-Sensitive"`.

**Both hosts:** `| tail` masks exit codes — capture the exit code separately. Don't attribute a
Turbo failure to the first-listed package; read the failing suite name out of the raw output.

---

## Documentation Map

[services/registry.json](services/registry.json) (single source of truth) · per-service
`.claude/README.md` + `CONTEXT.md` + `README.md` · [docs/](docs/) (`ARCHITECTURE.md`,
`SERVICE_GOVERNANCE.md`, `adr/`) · [`docs/gotchas/`](docs/gotchas/) — durable operational facts
(ADR-097), each with a machine check or review date; add one with the `learned` skill.
**Generated, never hand-edit:** `services/dependency-graph.md`, `services/impact-analysis.md`,
`/dist/`, `/build/`, `infrastructure/postgres/init.sql` (source = `migrations/*.sql` +
`scripts/regenerate-init-sql.sh`; drift-gated) and `apps/landing/src/data/docs/`.

**New service:** follow [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md) → *Service
Creation Checklist* + [ADR-028](docs/adr/ADR-028-npm-workspace-docker-build.md); the
`services/registry.json` entry comes FIRST. nginx routing: [infrastructure/claude.md](infrastructure/claude.md).

---

## Deployment

**Dev:** `npm run dev`; `pm2 restart|logs karmyq-{service}`.
**Demo (karmyq.com — demo/QA on ARM64/Oracle, NOT production, but master is protected and every
master push is a full deploy):** merging to `master` runs GitHub Actions — tests, ARM64 images,
`./scripts/deploy.sh` over SSH, health verify, **rollback on failure**
([docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)).

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
  cross-workspace test inputs. Re-run directly: `cd tests && npx jest regression/<file>` (or `--force`).

---

## Merge, Deploy & Security-Gate Discipline

- **Never force-push; never direct-push to `master`.** Broken PR base → fresh replacement PR.
- **Branch off `origin/master`, not local master** (unpushed local-master commits leak via
  squash-merge). Update a diverged PR branch with a merge commit, not rebase+force.
- **Planning commits (spec/plan/handoff) stay on the feature branch**; **no docs-only master
  pushes** — a post-merge docs push triggers a second deploy → services restart → demo 502s.
- **Bundle by default.** Every PR costs a chat, a review round, CI, a merge slot and a deploy, so
  put work on the in-flight PR or the next product PR when it can merge in time: a dependency or
  security fix rides as that PR's first commit if it merges inside the fix's SLA; post-merge
  records, bug logs, plans and handoffs ride with the next PR; small bugs in one area ship as one
  PR. Respect the PR's agreed scope and branch ownership; record any expansion in the PR body and
  the handoff, and say in the PR body what was bundled and why any separate PR could not wait.
- **CodeQL:** recurring alerts here are documented false positives — surface them to the user for
  dismissal; never loop the dismissal API (details: `ship` skill, Phase 2).
- **Demo-server data ops use DB user `karmyq_prod`.**

---

## Parallel Development (two checkouts, two machines)

Two machines each run their own sprint on their own branch, and **coordinate only through git and
PR state** — neither may assume the other is idle. Serialize the four shared surfaces even when
scope is disjoint: **one `master` merge at a time** (wait for deploy + health); the **version bump**
re-derived from `origin/master` at merge time; **one maintainer-designated holder** of
`package.json`/`package-lock.json` (an open Dependabot PR is a queued proposal, not the holder);
**ADR numbers allocated by the maintainer**, never self-assigned. Ask the maintainer before each
demo data operation. Never "reserve" anything in a handoff — handoffs are branch-local. Split
sprints on file-disjoint boundaries, never `packages/shared/` against a consumer of it.
Memory lives outside the repo; sync it between machines.
Full rules and rationale: [`.claude/handoff/README.md`](.claude/handoff/README.md) → *Parallel
development rules*.

---

## Session Workflow

**Write to `CURRENT_HANDOFF.md` immediately** when sprint goals/scope are agreed, an approach is
chosen, a constraint is established, or a sprint completes — never defer it; the handoff is the
only thing that travels between chats. Update status/blockers/next steps at every session end.

**Reconcile the handoff before claiming done.** After any merge, PR open/close, and at session
end, re-read `CURRENT_HANDOFF.md` against real state (`gh pr list`, `git log`, current branch). A
handoff saying "PR N NEXT" while PR N is already open or merged is a **blocking defect**.

**End every chat with a next-chat prompt** — the branch or PR to pick up, the first command or
check, what the handoff names as next, and any authorization still pending. It must agree with
`CURRENT_HANDOFF.md`'s Quick Start; if the two differ, fix the handoff first.
