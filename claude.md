# Karmyq - Mutual Aid Platform

**Version**: see [`package.json`](package.json) (source of truth — currently 11.x) | **Status**: Demo/Development

> **Multi-agent note:** [`AGENTS.md`](AGENTS.md) is the shared cross-agent bootstrap (Codex,
> Claude, others). It points every agent at this file, the skill system, the handoff, and
> memory. **This file (`CLAUDE.md`) remains the source of truth** — if the two ever disagree,
> `CLAUDE.md` wins. Keep them in sync when you change global rules.

---

## 🚀 Starting a New Conversation? (Sprint Session Bootstrap)

**This is the canonical session-start protocol for every agent.** [`AGENTS.md`](AGENTS.md)
adapts non-Claude agents (Codex, others) *into* this protocol — it does not define a separate
one. Claude Code auto-loads this file directly; non-Claude agents reach it via `AGENTS.md`.
The reference is one-way: `AGENTS.md` bridges into `CLAUDE.md`; Claude does **not** need to read
`AGENTS.md` for process rules (it's the cross-agent adapter, not a second rulebook).

### One chat per sprint (the cadence)

Run a fresh conversation per sprint so each chat is a bounded execution window instead of an
ever-growing context pile. Rule of thumb:

| Situation | Action |
|-----------|--------|
| New sprint, or a new architectural direction | **New chat** |
| Same PR's polish / review follow-up cycle | **Same chat** (continuing is more efficient) |
| Major context confusion or model drift | **New chat** |
| 2+ agents working the same sprint concurrently | **One chat per agent branch**; Claude orchestrates through handoff/PR state |

Sprint planning produces the spec + plan + handoff (via the `sprint-planning` skill) in one
chat; the **next** chat executes from the handoff. Don't open a new chat for every small PR
comment.

### Bootstrap — do this BEFORE any work, in order

1. **This file (`CLAUDE.md`)** — global rules; they OVERRIDE your defaults.
2. **[`.claude/handoff/CURRENT_HANDOFF.md`](.claude/handoff/CURRENT_HANDOFF.md)** — the ONLY doc
   that carries state between sessions. **CHECK FOR HANDOFF FIRST**: `cat .claude/handoff/CURRENT_HANDOFF.md`.
   If one exists, follow its Quick Start.
3. **Persistent memory** — the `MEMORY.md` index plus any memory file matching the task
   (advisory only; verify any file/flag/function it names still exists before relying on it).
4. **[`services/registry.json`](services/registry.json)** — services, ports, endpoints, events.
5. **Local context** for the area you'll touch — `services/<name>/.claude/README.md` (+ `CONTEXT.md`),
   `apps/frontend/.claude/README.md`, etc.

**Then summarize before coding:** state the active sprint, branch, blockers, and your
recommended first action. **Do not start implementation until that summary is complete.**

### Handoffs

**What is a handoff?**
- A detailed implementation plan left by the previous conversation
- Contains context, file paths, code patterns, and a ready-to-execute plan
- Enables seamless continuation of work across conversations

**If a handoff exists:**
1. Read the handoff document (you'll find everything you need)
2. Follow the "Quick Start" section to begin implementation
3. Update the handoff as you make progress
4. When feature is complete, archive or delete it

**If no handoff exists:**
- Proceed with normal development workflow (see below)

**Creating a handoff for the next conversation:**
- Ask: "Create a handoff document for the next conversation"
- Include: context, current state, implementation plan, success criteria
- Use template: `.claude/handoff/TEMPLATE.md`

See [`.claude/handoff/README.md`](.claude/handoff/README.md) for complete handoff framework documentation.

---

## 🎯 Working in This Codebase? START HERE

### **Context Follows Directory Scope**

When working in a specific area, **GO TO THE LOCAL CONTEXT FIRST**:

```
Working in a service?
→ Read: services/{service-name}/.claude/README.md

Working in frontend?
→ Read: apps/frontend/.claude/README.md

Working in mobile?
→ Read: apps/mobile/.claude/README.md

Writing tests?
→ Read: tests/.claude/README.md
```

**This file (root CLAUDE.md) is for global patterns only.**

---

## Development Disciplines (MUST FOLLOW)

### 1. Context-Driven Development
- **ALWAYS** read local `.claude/README.md` before making changes
- Local context has mandatory checklists - follow them EXACTLY
- When in doubt: `cat .claude/README.md`

### 2. Update, Don't Create
- Before creating ANY new file: Search for existing
- If exists: UPDATE it with date stamp
- Only create if truly novel topic

### 3. Git Hooks & TDD Framework (Automatic)
Git hooks automatically run checks on commit/push:
- **Pre-commit**: Service analysis & documentation checks
- **Pre-push**: Unit + regression tests (MUST pass), TDD tests (informational), integration tests (if DB available)

**IMPORTANT**: Unit + regression tests MUST pass before push. This is a core tenant of our TDD framework ([ADR-029](docs/adr/ADR-029-tdd-test-framework.md)).

```bash
npm run hooks:install  # Install/update hooks — RUN THIS AFTER CLONE
git commit             # Hooks run automatically
git push               # Runs unit+regression (blocks if fails), TDD (reports only)
git push --no-verify   # Emergency only - skips all hooks
SKIP_PREPUSH=1 git push # Skip pre-push checks only
```

> **⚠️ Hooks no longer auto-install on `npm install`.** `.npmrc` sets `ignore-scripts=true` (supply-chain hardening, [ADR-061](docs/adr/ADR-061-supply-chain-and-secrets-hardening.md)), which disables all lifecycle scripts including the root `postinstall`. After cloning, run `npm run hooks:install` once to wire up the git hooks.

See [Testing section](#testing-tdd-framework) below for complete TDD workflow.

### 4. Fix Forward, Not Around
- BAD: Create workaround (seed-v3.sh)
- GOOD: Fix the original script
- Document why in ADR if architectural

### 5. Feedback Loops (NEW)
Changes trigger documentation updates:
- New endpoint → Update CONTEXT.md + registry.json
- New dependency → Update registry.json + run analyze:services
- Fix bug → Document in CONTEXT.md "Recent Fixes"
- Find bug → Add to CONTEXT.md "Known Issues"

Run feedback loop check:
```bash
npm run feedback:check
```

### 6. Documentation Updates (MANDATORY)

Every code change that modifies behavior MUST include documentation updates:

#### Service changes
- New/modified endpoint → Update service `CONTEXT.md` "API Endpoints" section
- New/modified endpoint → Update `services/registry.json` "apis.provides"
- Schema change → Update service `CONTEXT.md` "Database Schema" section
- Schema change → Create migration in `infrastructure/postgres/migrations/`
- New event → Update `services/registry.json` "events" section
- New dependency → Update `services/registry.json` "dependencies" section

#### Shared package changes
- New export → Update `packages/shared/CONTEXT.md`
- New matching type → Update type definitions in `matching/types.ts`
- New event type → Update `services/registry.json` "events" section

#### Concept/architecture changes (ADRs)
- New architectural decision → Create ADR in `docs/adr/` + update `docs/adr/README.md` index
- Modified system behavior → Update `docs/ARCHITECTURE.md` if applicable
- ADR implementation deployed → Update ADR status from `Accepted` → `Implemented`
- ADR status lifecycle: `Proposed` → `Accepted` → `Implemented` | `Superseded` | `Deprecated`
- New trust/matching/feed pattern → Create or update relevant ADR
- Significant cross-service change (3+ services) → Create ADR documenting the decision

#### After all changes
- Run `npm run analyze:services` if service dependencies changed
- Run `npm run feedback:check` to verify all documentation updates are included
- Docs site auto-regenerates on next deploy (pre-build step)

---

## Pre-Merge Checklist (before `git push`)

This checklist exists because code used to ship while tests and docs were left as
"follow-ups that never happen." But most mechanical checks are now **automated** — so don't
hand-verify those. Spend your attention on the **🧠 human-judgment** items; the machine catches
the rest and tells you exactly what it found.

> **Three buckets:** 🤖 the build enforces · 🔔 `feedback:check` advises · 🧠 only you can judge.

### 🤖 Automated — CI blocks the merge (do NOT re-check these by hand)

These fail the build on their own. If one fires, the failure message says what to fix — fix it,
don't `--no-verify` past it.

- **Unit + regression tests** pass; TDD reported (pre-push hook + CI, [ADR-029](docs/adr/ADR-029-tdd-test-framework.md)).
- **Dependency audit** ([ADR-059](docs/adr/ADR-059-dependency-security-gate.md), blocks at `--audit-level=high`) + **CodeQL** ([ADR-060](docs/adr/ADR-060-code-scanning-gate.md)).
- **PR contract** headers present (`pr-contract.yml`).
- **Doc/context drift gate** (`tests/regression/doc-context-drift-gate.test.ts`): CLAUDE.md service count matches the registry, the version line isn't a hard-coded semver, every ADR is in the `docs/adr/README.md` index, every landing concept/guide has a `nav.json` entry, and `jest.setup` mocks `next/router`.

### 🔔 Advisory — `npm run feedback:check` surfaces these (read the output, act if relevant)

`feedback:check` is **warn-only**: it never blocks, but its report is your to-do list for this
diff. Don't ignore it. It flags:

- `CONTEXT.md` / `services/registry.json` updates needed for changed endpoints, schema, events, or dependencies.
- ADR index reminders; shared-package `CONTEXT.md`; migration schema docs.
- **Tests skipped without a justification** (`describe.skip` / `it.skip` / `xit` with no comment on the same line or the line above) — remove the skip or document why. *(Warn-first heuristic line scan; it may occasionally flag a skip token inside a string — it's advisory, so just confirm and move on.)*

### 🧠 Human judgment — YOU must verify (cannot be automated)

The machine checks that tests *pass* and docs are *wired up*; only you can judge whether the
*right* work was done.

- [ ] **The right tests exist** for the new/changed behavior (see the coverage table below) — not just that the suite is green.
- [ ] **User-facing guide + onboarding workflow** content updated for any behavior/UI change (`docs/guides/`, `apps/frontend/src/lib/onboarding/workflows.ts`).
- [ ] **Landing docs authored** for new features / concepts / ADRs — the nav *wiring* is gated (🤖 above), but the *content* is yours (formats below).
- [ ] **An ADR exists** if this is an architectural decision.
- [ ] **`/simplify`, `/code-review`, `/security-review`** run on the branch diff; real findings resolved, false positives dismissed with written justification. (These four — with testing — are the standing SDLC quality gates.)
- [ ] **Handoff updated** (status, next steps, success criteria).
- [ ] **Vulnerability SLA** respected: no high/critical open > 1 week; no finding of any severity open > 2 weeks.

**Minimum test coverage for UI changes:**
| Change Type | Required Tests |
|---|---|
| New component | Renders correctly, handles edge cases |
| Conditional render (role/state gate) | Shows for authorized, hidden for unauthorized |
| API call wired to user action | Mock verifies call made with correct payload |
| Data fetch on mount | Shows fetched data, falls back gracefully on error |

**Landing docs authoring** — when a change touches the public docs site (`apps/landing/`):
add/update a **User Guide** (`guides/`) for a new feature or workflow, a **Concept page**
(`concepts/`) for a new platform concept, an **ADR JSON** (`concepts/`) for a new ADR, and a
**service JSON** (`services/`) for new/changed endpoints — each wired into `nav.json` (the drift
gate verifies that wiring). File formats:

```json
// ADR file (apps/landing/src/data/docs/concepts/adr-{NNN}-{slug}.json)
{
  "slug": "adr-{NNN}-{slug}",
  "number": "{NNN}",
  "title": "ADR-{NNN}: Title",
  "status": "proposed | accepted | implemented | superseded | deprecated",
  "description": "**Status**: Implemented",
  "content": "# ADR-{NNN}: Title\n\n...(full markdown content)...",
  "filename": "ADR-{NNN}-{slug}.md"
}
```
```json
// Concept / User Guide file
{
  "slug": "concept-or-guide-slug",
  "title": "Page Title",
  "description": "One-sentence summary shown in nav and previews.",
  "content": "# Title\n\n...(full markdown content)..."
}
```
```json
// Service endpoint entry
{
  "method": "GET | POST | PUT | DELETE",
  "path": "/path/:param",
  "description": "One-sentence description of what the endpoint does."
}
```

### Quick verification before push

```bash
npm test                 # unit + regression (BLOCKS)
npm run feedback:check    # advisory to-do list for this diff (never blocks)
npm run analyze:services  # if service dependencies changed
# then, on the diff: /simplify, /code-review, /security-review
```

---

## System Architecture

### Services (10 total)
See **[services/registry.json](services/registry.json)** for complete list.

> **Sprint 91 (ADR-071):** feed-service was folded into request-service as a `/requests/feed/*`
> view layer (11→10 services). The feed is now served by request-service; there is no feed-service.

| Service | Port | Criticality | Dependents |
|---------|------|-------------|------------|
| Auth | 3001 | Critical | 7 services |
| Community | 3002 | Critical | 3 services |
| Request | 3003 | Critical | 0 services |
| Reputation | 3004 | Critical | 0 services |
| Notification | 3005 | Critical | 0 services |
| Messaging | 3006 | Critical | 0 services |
| Social-Graph | 3010 | Critical | 0 services |
| Cleanup | 3008 | Important | 0 services |
| Geocoding | 3009 | Optional | 0 services |
| Simulation | dev | Optional | 0 services |

**Governance Tools**:
```bash
npm run analyze:services  # Generate dependency graph, impact analysis
npm run dashboard         # Real-time service health monitoring
npm run health:check      # Check all critical services
```

### Tech Stack
- **Backend**: Node.js/Express/TypeScript
- **Frontend**: Next.js 14
- **Mobile**: React Native + Expo
- **Database**: PostgreSQL 15 with RLS
- **Cache/Queue**: Redis + Bull
- **Build**: Turborepo
- **Governance**: Service Registry + Auto-analysis

---

## Global Patterns

### Authentication
All services use JWT with standardized payload:
```typescript
{
  userId: string,
  email: string,
  communities: Array<{id: string, name: string, role: string}>  // ← field is 'communities', NOT 'communityMemberships'
}
```

Header: `Authorization: Bearer <token>`

**⚠️ Common mistake:** The JWT field is `communities`, not `communityMemberships`. Every new service's auth middleware MUST check `user.communities` to read membership roles. Using `communityMemberships` will always be `undefined` → always 403.

**Checking admin role in middleware:**
```typescript
const memberships = user.communities ?? [];
const isAdmin = user.role === 'admin' || memberships.some(m => m.role === 'admin');
```

**⚠️ Authorization vs. identity — derive membership from live data, not stale JWT claims.** The
`communities` claim is fine for *cheap* role hints inside a single request, but **authorization
decisions** (can this viewer see/act on this resource?) MUST be re-derived from a live membership
lookup. A JWT is a snapshot from login time — a user removed from a community still carries the
old `communities` claim until their token refreshes, so a claim-only check leaks access. (Caught
as a P2 stale-JWT bug in review.) When the answer gates visibility or a write, query current
membership; don't trust the token.

**New service nginx routing checklist:**
- Add `location ~ ^/api/{your-prefix}(/.*)?$` block to `infrastructure/nginx/nginx.conf`
- The proxy_pass path must strip `/api` prefix: `proxy_pass http://your_service/{your-prefix}$1$is_args$args`
- Changes to nginx.conf take effect on next deploy (deploy.sh copies and reloads), or manually: `sudo cp infrastructure/nginx/nginx.conf /etc/nginx/sites-available/karmyq && sudo nginx -t && sudo systemctl reload nginx`

### Database Schema
Tables use schema prefixes:
- `auth.users`, `auth.sessions`
- `community.communities`, `community.members`
- `requests.help_requests`, `requests.matches`
- `reputation.karma_records`
- `notifications.notifications`
- `messaging.conversations`

### API Response Format
ALL endpoints MUST return:
```json
{
  "success": boolean,
  "data": T,
  "message": "optional"
}
```

Errors:
```json
{
  "success": false,
  "message": "Human-readable error",
  "error": "ERROR_CODE"
}
```

### Event-Driven Communication
Services communicate via Bull queue (`karmyq-events`):
- `match_completed` → Reputation, Notification
- `karma_awarded` → Notification
- `request_created` → Notification
- `user_joined_community` → Notification

See [services/registry.json](services/registry.json) for event publishers/subscribers.

---

## Development Commands

### Infrastructure
```bash
# Start PostgreSQL + Redis
cd infrastructure/docker && docker-compose up -d postgres redis

# View all service health
npm run dashboard

# Check critical services
npm run health:check
```

### Building
```bash
# Build all services
npm run build

# Build specific service
cd services/auth-service && npm run build
```

### Testing (TDD Framework)

**Core Tenant**: Unit + regression tests MUST ALWAYS pass. See [ADR-029](docs/adr/ADR-029-tdd-test-framework.md).

#### Test Directory Structure

Every service/app has three test tiers:
```
tests/
  ├── unit/         # Unit tests (mocked, fast, must pass)
  ├── regression/   # Locked-in behavior (must pass)
  ├── tdd/          # Work-in-progress (can fail)
  └── integration/  # Integration tests (require DB)
```

#### Test Commands

```bash
# Run unit + regression (MUST pass before push)
npm test

# Run individual tiers
npm run test:unit        # Unit tests only
npm run test:regression  # Regression tests only
npm run test:tdd         # TDD/WIP tests (can fail)

# Integration tests (requires database)
npm run test:integration

# E2E tests
cd tests && npm run test:e2e

# Coverage
npm run test:coverage

# Auto-promote passing TDD tests to regression
node scripts/promote-tdd-tests.js
```

#### TDD Workflow

**Writing new tests**:
1. Create test in `tests/tdd/` directory
2. Write test first (TDD approach)
3. Implement feature until test passes
4. Test auto-promotes to `regression/` (or move manually)
5. Now test MUST pass forever (locked in)

**Test states**:
- `tdd/` → Can fail, won't block commits/pushes
- `regression/` → Must pass, blocks push if fails
- `unit/` → Must pass, fast isolated tests

**Pre-push hook behavior**:
1. ✅ Runs unit + regression → **BLOCKS if fails**
2. ✅ Runs TDD tests → Reports but **NEVER blocks**
3. ✅ Runs integration tests → **BLOCKS if fails** (only if DB available)

See [ADR-029](docs/adr/ADR-029-tdd-test-framework.md) for complete framework details.

### Git Hooks
```bash
# Install git hooks (runs automatically on npm install)
npm run hooks:install

# Hooks run automatically on commit/push
# Pre-commit: Service analysis & documentation checks
# Pre-push: Unit tests (+ integration tests if DB available)

# Skip hooks when needed
git commit --no-verify
git push --no-verify
SKIP_PREPUSH=1 git push
```

### Service Governance
```bash
# Generate dependency graph + impact analysis
npm run analyze:services

# Interactive health dashboard
npm run dashboard

# Check for context updates needed
npm run feedback:check

# Generate .claude/README.md for services
node scripts/generate-service-context.js
```

---

## Documentation Structure

```
CLAUDE.md                           ← You are here (global context)

services/
  registry.json                     ← Single source of truth for services
  dependency-graph.md               ← Generated dependency diagram
  impact-analysis.md                ← Generated impact radius report
  {service-name}/
    .claude/README.md               ← LOCAL CONTEXT (read first!)
    CONTEXT.md                      ← Technical reference
    README.md                       ← Human-readable overview

apps/
  frontend/.claude/README.md        ← Frontend-specific context
  mobile/.claude/README.md          ← Mobile-specific context

docs/
  README.md                         ← Documentation index
  ARCHITECTURE.md                   ← System architecture
  SERVICE_GOVERNANCE.md             ← Governance framework
  CONTEXT_MANAGEMENT.md             ← This context system
  adr/                              ← Architecture Decision Records
```

---

## Creating New Services

**MANDATORY Checklist** (enforced by pre-commit):

1. [ ] Add entry to `services/registry.json`
2. [ ] Run `npm run analyze:services` (check for circular deps)
3. [ ] Run `node scripts/generate-service-context.js`
4. [ ] Create service using generated `.claude/README.md` template
5. [ ] **Configure TypeScript correctly** (see ADR-028):
   - [ ] Set `"rootDir": "./src"` in tsconfig.json
   - [ ] Set `"include": ["src/**/*"]` (exclude tests)
   - [ ] Verify build produces `dist/index.js` not `dist/src/index.js`
6. [ ] **Configure Dockerfile** (copy from existing TypeScript service):
   - [ ] Build shared package before service
   - [ ] Copy shared/dist BEFORE npm install in production stage
   - [ ] Use multi-stage build pattern
7. [ ] Add health check endpoint `/health`
8. [ ] Add to `docker-compose.yml`
9. [ ] Add database schema to `infrastructure/postgres/init.sql` (if needed)
10. [ ] Update simulation service to test new endpoints
11. [ ] Run `npm run health:check` to verify
12. [ ] Document in ADR if architectural decision

See:
- [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
- [docs/adr/ADR-028-npm-workspace-docker-build.md](docs/adr/ADR-028-npm-workspace-docker-build.md)

---

## Deployment

### Development
```bash
# Start all services
npm run dev

# Restart specific service (pm2)
pm2 restart karmyq-{service-name}

# View logs
pm2 logs karmyq-{service-name}
```

### Demo Environment (ARM64 / Oracle Cloud)

> **Note:** karmyq.com is a **demo/QA environment**, not production. Treat it accordingly.

**Option 1: Automatic Deployment (Recommended)**
```bash
# Simply push to master - GitHub Actions handles deployment
git push origin master
```

GitHub Actions automatically:
1. Runs tests + builds images
2. SSH to karmyq.com
3. Runs `./scripts/deploy.sh`
4. Verifies health
5. **Rolls back on any failure**

**Setup:** See [docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)

**Option 2: Manual Deployment**
```bash
# SSH to demo server:
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy.sh

# Skip tests for emergency deploys
SKIP_TESTS=1 ./scripts/deploy.sh
```

**Deployment Script Automatically:**
1. Saves current commit for rollback
2. Pulls latest code from master
3. Installs git hooks
4. **Runs integration tests** (with auto-rollback on failure)
5. Loads `.env.demo`
6. Builds Docker images (ARM64)
7. Deploys via docker-compose
8. Verifies health

**Safety Features:**
- ✅ Integration tests run against demo DB before deployment
- ✅ Auto-rollback to previous commit if tests fail
- ✅ `SKIP_TESTS=1` flag for emergency deploys
- ✅ Hooks installed automatically on server
- ✅ GitHub Actions runs full test suite before deployment

---

## Common Workflows

### Adding a New Endpoint
1. Read service's `.claude/README.md`
2. Update `src/routes/{name}.ts`
3. Update `CONTEXT.md` "API Endpoints" section
4. Update `services/registry.json` "apis.provides"
5. Run `npm run analyze:services`
6. Run tests
7. Document in frontend if consumed

### Fixing a Bug
1. Document bug in service `CONTEXT.md` "Known Issues"
2. Write failing test
3. Fix bug
4. Verify test passes
5. Remove from "Known Issues", add to "Recent Fixes"
6. Commit with reference to issue

### Changing Database Schema
1. Update `infrastructure/postgres/init.sql`
2. Create migration in `infrastructure/postgres/migrations/`
3. Update service `CONTEXT.md` "Database Schema"
4. Document in ADR if significant
5. Test migration locally
6. Deploy with migration

---

## Reference

### Key Documents
- **Service Registry**: [services/registry.json](services/registry.json)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Governance**: [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
- **Context System**: [docs/CONTEXT_MANAGEMENT.md](docs/CONTEXT_MANAGEMENT.md)
- **Roadmap**: [docs/archive/gemini-review/roadmap.md](docs/archive/gemini-review/roadmap.md)

### ADRs (Architecture Decision Records)
- [ADR-001](docs/adr/ADR-001-postgresql-schemas.md): PostgreSQL Schemas
- [ADR-004](docs/adr/ADR-004-microservices-event-driven.md): Microservices + Event-Driven
- [ADR-011](docs/adr/ADR-011-reputation-decay.md): Reputation Decay System
- [Full list](docs/adr/)

---

## Getting Help

### Debugging
1. Check service health: `npm run dashboard`
2. View logs: `pm2 logs {service-name}`
3. Check dependencies: `npm run analyze:services`
4. Read service `.claude/README.md` for troubleshooting

### Understanding the System
1. Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. View dependency graph: [services/dependency-graph.md](services/dependency-graph.md)
3. Check impact analysis: [services/impact-analysis.md](services/impact-analysis.md)
4. Read service-specific docs in `services/{name}/.claude/README.md`

---

## Bug Fixing

**MANDATORY steps before writing any fix:**

1. **Identify the layer** — is this a DB, API, or UI bug? Apply the fix at the correct layer. Never add client-side filters/workarounds for server-side problems.
2. **Find ALL instances** — use `Grep` to search the entire codebase for the pattern before touching anything. Assume the same bug exists in multiple files (services, frontend, mobile, simulation). Fix every occurrence.
3. **Trace end-to-end** — after the fix, mentally trace the full data flow: source config → build/template → runtime → client. State explicitly where the bug was and confirm no other path reintroduces it.
4. **Never edit generated files** — `/dist/`, `/build/`, `dependency-graph.md`, `impact-analysis.md` are build artifacts. Find the source and edit that instead. (A hook will block you if you try.)
5. **Wait for actual output** — if the user says they're about to paste error output, stop and wait. Do not guess from symptoms.

---

## Pre-Commit Checks

- After making changes, always verify the fix works end-to-end before committing.
- For TypeScript projects, run `tsc --noEmit` before pushing. CI failures from type errors are avoidable.
- For generated/build-time files, never hand-edit them — fix the source template instead.
- **After deleting or renaming any component/section/export, `Grep` the whole repo for every
  reference before committing** — orphaned references compile-pass locally and only blow up in CI.
- **Don't trust a suspiciously-green local test run after deletes/renames.** Turbo's cache only
  tracks a task's declared inputs, so cross-workspace regression tests (e.g. a `tests/regression/*`
  test that reads files in `apps/landing`) cache a stale pass while CI fails fresh. Re-run the
  affected suite directly (`cd tests && npx jest regression/<file>`) or bust the cache with
  `--force` before pushing. (See memory: *Turbo cache hides cross-workspace test failures*.)

---

## Merge, Deploy & Security-Gate Discipline

This codifies recurring merge/deploy friction so it doesn't recur. **karmyq.com is a demo env, but
master is protected and every master push is a full deploy** — treat it accordingly.

**Branch & push hygiene:**
- **Never force-push and never direct-push to `master`** — branch protection is enforced and a
  blocked force-push just costs a recovery detour. If a PR's branch base is broken, open a **fresh
  replacement PR** rather than trying to force-push the fix.
- **Branch off `origin/master`, not local `master`** — an unpushed local-master commit leaks onto
  master via a new branch's squash-merge. Update a diverged PR branch with a **merge commit**, not
  rebase + force (force is policy-blocked here).
- **Keep planning commits (spec/plan/handoff) on the feature branch only** — never let them orphan
  on master; relocating an orphaned commit requires a branch-topology reset.
- **No docs-only pushes to master** — fold docs into the PR. A separate post-merge handoff push
  triggers a *second* deploy → services restart → demo transiently 502s.

**Security gates (ADR-059 deps audit + ADR-060 CodeQL):**
- **Recurring CodeQL alerts on this repo are documented false positives** (e.g. `js/request-forgery`
  on `apps/frontend/src/lib/api.ts`, an env-var-driven axios baseURL). **Surface them to the user
  for dismissal — do not loop the dismissal API** (rate-limited; use the UI bulk-dismiss for any
  rule class with >~50 alerts).
- The CodeQL gate can false-block the very push that ships the fix (rescan lag + re-fingerprinted
  alerts) — **re-run the gate after the rescan completes**, don't `--no-verify` past it.

**Environment:**
- Use the prod DB user **`karmyq_prod`** for demo-server data operations, not a default/dev user.

---

## Project Architecture

This is a TypeScript monorepo with multiple services. When fixing a value (API URLs, config, types), grep across **all** services to find every occurrence before making changes. Primary languages: TypeScript, with Shell scripts for CI/CD and deployment. When fixing CI issues, check Alpine Linux compatibility, correct package names/versions, and environment variable loading order.

---

## Session Workflow

Update handoff documents (`CURRENT_HANDOFF.md`) at the end of every session with current status, blockers, and next steps. Follow the established handoff framework in `.claude/handoff/`.

### Write to the handoff immediately — not at end of session

The handoff is the only thing that travels between conversations. If a new chat opens before we wrap up, anything not yet written to the handoff is lost.

**Write to `CURRENT_HANDOFF.md` immediately whenever:**
- Sprint goals or scope are agreed upon ("we'll do X in the next sprint")
- An architectural decision or approach is chosen ("we'll use gap analysis, not fix everything")
- A constraint or framing is established ("deliverable is a doc, not implementations")
- A sprint is marked complete and the next sprint direction is known

**The pattern to follow:**
1. User agrees on next sprint direction → update handoff before moving on
2. Sprint completes + deploys → update handoff title, status, and "Next Sprint" goals before closing
3. Never leave a "we just decided" moment unwritten

**Trigger phrase to watch for:** Any sentence containing "next sprint", "before we start", "the plan is", or "we've agreed" should prompt an immediate handoff write — don't defer it.

---

**Remember**: This is global context. For specific areas, **read the local `.claude/README.md` first!**


