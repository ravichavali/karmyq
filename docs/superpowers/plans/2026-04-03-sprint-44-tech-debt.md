# Sprint 44: Tech Debt + Architecture Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Resolve security vulnerabilities, clean TypeScript/lint warnings, propagate structured
logging into all service route handlers, and produce an expert-contribution gap analysis document.

**Architecture:** No new services or schema changes. Work spans all 11 services (logging
adoption), the three GitHub Actions workflow files (Node.js bump), and produces one new
architecture review document. No DB migrations required.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, React Native + Expo, PostgreSQL 15,
GitHub Actions CI.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `docs/architecture/expert-contribution-gaps.md` | Gap analysis — five areas, current state, gap, priority, next step |
| `apps/landing/src/data/docs/concepts/observability-logging.json` | Landing page concept page for structured logging |
| `tests/tdd/sprint-44-logging.test.ts` | Smoke test: requestLoggingMiddleware attaches logger to req |

### Existing files to modify

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | `NODE_VERSION: '20.x'` → `'24.x'` |
| `.github/workflows/test.yml` | `node-version: '18'` → `'24'` (two occurrences) |
| `.github/workflows/e2e-tests.yml` | `node-version: '18'` → `'24'` |
| `services/notification-service/src/notificationTemplates.ts` | Fix unused `data` param |
| `services/feed-service/src/feed.ts` | Remove unused `feedComposer` import |
| `services/feed-service/src/feedComposer.ts` | Fix unused `userBehavior` param |
| `services/cleanup-service/src/` middleware helpers | Fix unused `res`/`error` params |
| `scripts/generate-docs.ts` | Fix implicit `any` on `match` |
| `services/social-graph-service/src/index.ts` | Add createLogger + requestLoggingMiddleware |
| `services/cleanup-service/src/index.ts` | Add createLogger + requestLoggingMiddleware |
| `services/simulation-service/src/index.ts` | Add createLogger + requestLoggingMiddleware |
| All service route files (11 services) | Replace console.error in catch blocks with req.logger |
| `apps/frontend/src/pages/_app.tsx` | Add global error boundary |
| `apps/landing/src/data/docs/nav.json` | Add observability-logging concept entry |
| `services/social-graph-service/CONTEXT.md` | Note structured logging now active |
| `services/cleanup-service/CONTEXT.md` | Note structured logging now active |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **req.logger availability** — `req.logger` is attached by `requestLoggingMiddleware`. In
   catch blocks where `req` is not in scope (event callbacks, startup, cron handlers), use the
   module-level `logger` created via `createLogger('service-name')`.

2. **console.* scope rule** — Route handler `catch` blocks must use `req.logger` or module
   `logger`. Startup `console.log('Server started...')` and one-off debug logs are fine as-is.

3. **npm audit --force risk** — Run `npm test` after `--force`. If failures, `git diff
   package-lock.json` to find the culprit. Fix the API break or revert that single package and
   document in gap analysis as deferred debt.

4. **Node 24 compatibility** — Check for native addon failures in CI after bumping. Unlikely to
   break but watch the first CI run after merge.

5. **Gap analysis is docs only** — Task 9 writes `expert-contribution-gaps.md`. Do NOT start
   fixing identified gaps in this sprint.

---

## Task 1: Create sprint branch

**Files:** None

- [ ] Create and check out the sprint branch

```bash
git checkout -b feature/sprint-44-tech-debt
```

- [ ] **Verify:** `git branch` shows `* feature/sprint-44-tech-debt`

---

## Task 2: npm audit fix (safe, non-breaking)

**Files:**
- Modify: `package-lock.json` (auto-updated)

- [ ] Run auto-fix at repo root

```bash
cd /c/Users/ravic/development/karmyq
npm audit fix
```

- [ ] Run tests to verify nothing broke

```bash
npm test
```

- [ ] **Verify:** `npm audit` shows reduced vulnerability count; `npm test` passes

- [ ] Commit

```bash
git add package-lock.json package.json
git commit -m "fix(deps): resolve auto-fixable npm audit vulnerabilities"
```

---

## Task 3: npm audit fix --force + API break fixes

**Files:**
- Modify: `package-lock.json`, any service files with API breaks

- [ ] Run force fix

```bash
npm audit fix --force
```

- [ ] Run tests immediately

```bash
npm test
```

- [ ] If tests fail: identify breaking package via `git diff package-lock.json | grep '"version"'`,
  then fix the calling code. Repeat until tests pass.

- [ ] If a fix is too invasive (>30 min), revert that single package:

```bash
npm install <package>@<previous-version>
```
  Note the reverted package in a comment for Task 9 (gap analysis).

- [ ] **Verify:** `npm audit` shows 0 fixable vulnerabilities; `npm test` passes

- [ ] Commit

```bash
git add -A
git commit -m "fix(deps): force-resolve remaining vulnerabilities, fix API breaks"
```

---

## Task 4: Bump Node.js to 24 in all GitHub Actions workflows

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/e2e-tests.yml`

- [ ] Update `ci.yml`: change `NODE_VERSION: '20.x'` to `NODE_VERSION: '24.x'`

- [ ] Update `test.yml`: change both `node-version: '18'` occurrences to `node-version: '24'`

- [ ] Update `e2e-tests.yml`: change `node-version: '18'` to `node-version: '24'`

- [ ] **Verify:** `grep -n "node-version\|NODE_VERSION" .github/workflows/*.yml` shows only `24`

- [ ] Commit

```bash
git add .github/workflows/ci.yml .github/workflows/test.yml .github/workflows/e2e-tests.yml
git commit -m "ci: bump Node.js to 24 in all workflow files"
```

---

## Task 5: Fix all TypeScript warnings

**Files:**
- Modify: `services/notification-service/src/notificationTemplates.ts`
- Modify: `services/feed-service/src/feed.ts`
- Modify: `services/feed-service/src/feedComposer.ts`
- Modify: `services/cleanup-service/src/` (middleware helpers — locate with grep)
- Modify: `scripts/generate-docs.ts`
- Modify: any additional files surfaced by tsc

- [ ] Run tsc across all services to list all warnings

```bash
cd /c/Users/ravic/development/karmyq
npx tsc --noEmit -p services/notification-service/tsconfig.json 2>&1 | grep "warning\|error"
npx tsc --noEmit -p services/feed-service/tsconfig.json 2>&1 | grep "warning\|error"
npx tsc --noEmit -p services/cleanup-service/tsconfig.json 2>&1 | grep "warning\|error"
```

- [ ] Fix each warning:
  - Unused param: rename to `_paramName`
  - Unused import: remove the import line
  - Implicit any: add explicit type annotation

- [ ] Run tsc again to confirm zero warnings

```bash
for svc in auth community request reputation notification messaging social-graph feed cleanup; do
  echo "=== $svc ==="
  npx tsc --noEmit -p services/$svc-service/tsconfig.json 2>&1 | grep -c "error\|warning" || echo "clean"
done
```

- [ ] **Verify:** No TS warnings output from any service

- [ ] Commit

```bash
git add -A
git commit -m "fix(ts): eliminate all TypeScript unused-param and implicit-any warnings"
```

---

## Task 6: Fix mobile lint

**Files:**
- Modify: `apps/mobile/` (specific files TBD from lint output)

- [ ] Run mobile lint to see current errors

```bash
cd /c/Users/ravic/development/karmyq/apps/mobile
npm run lint 2>&1 | head -60
```

- [ ] Fix each lint error (likely unused imports/vars — remove or prefix `_`)

- [ ] **Verify:**

```bash
npm run lint
echo "Exit code: $?"
```
  Must exit 0.

- [ ] Commit

```bash
git add apps/mobile/
git commit -m "fix(mobile): resolve pre-existing lint failures"
```

---

## Task 7: Wire structured logging into all service route handlers

**Files:**
- Modify: `services/social-graph-service/src/index.ts`
- Modify: `services/cleanup-service/src/index.ts`
- Modify: `services/simulation-service/src/index.ts`
- Modify: all `services/*/src/routes/*.ts` files with console.error in catch blocks

- [ ] Add logger to the 3 uncovered services (same pattern as auth-service):

```typescript
// In index.ts — add after other imports
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';

// After app = express()
const logger = createLogger('social-graph-service'); // adjust name per service
app.use(requestLoggingMiddleware(logger));
```

- [ ] Grep for all console.error in route handlers

```bash
grep -rn "console\.error" services/*/src/routes/ | grep -v "\.js:"
```

- [ ] For each hit, replace with structured logger call:

```typescript
// Before
console.error('Error fetching connections:', error);

// After
req.logger?.error('Error fetching connections', {
  service: 'social-graph-service',
  endpoint: 'GET /connections/:userId',
  error: error instanceof Error ? error.message : String(error)
});
```

- [ ] For catches where `req` is not in scope, use module-level logger:

```typescript
// In event handler / cron / startup
logger.error('Event processing failed', {
  service: 'cleanup-service',
  step: 'processExpiredRequests',
  error: error instanceof Error ? error.message : String(error)
});
```

- [ ] Run tests

```bash
npm test
```

- [ ] **Verify:** `grep -rn "console\.error" services/*/src/routes/` returns zero route-handler catch blocks

- [ ] Commit

```bash
git add services/
git commit -m "feat(observability): propagate structured logger into service route handlers"
```

---

## Task 8: Frontend error boundary + critical path logging

**Files:**
- Modify: `apps/frontend/src/pages/_app.tsx`

- [ ] Read `apps/frontend/src/pages/_app.tsx` to check for existing error boundary

- [ ] If no error boundary exists, add one wrapping the page tree:

```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error', {
      component: info.componentStack?.split('\n')[1]?.trim(),
      error: error.message,
      stack: info.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

  Wrap the component tree in `_app.tsx` with `<ErrorBoundary>`.

- [ ] Grep for `console.error` in API call failure handlers (fetch/axios catch blocks):

```bash
grep -rn "console\.error" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -i "fetch\|api\|axios\|error"
```

  Replace with structured objects: `console.error('message', { service, endpoint, error: err.message })`

- [ ] **Verify:** `npm run build` in frontend passes; no new TS errors

- [ ] Commit

```bash
git add apps/frontend/src/pages/_app.tsx apps/frontend/src/
git commit -m "feat(observability): add frontend error boundary and structured API error logging"
```

---

## Task 9: Architecture review + gap analysis document

**Files:**
- Create: `docs/architecture/expert-contribution-gaps.md`

- [ ] Read these files to understand current state of each area:
  - `services/community-service/src/routes/` — admin routes, community_configs
  - `infrastructure/postgres/init.sql` — community_configs table schema
  - `docs/adr/ADR-044-trust-evolution.md` (or similar) — trust questionnaire
  - `docs/adr/ADR-032-server-driven-ui-schema.md` — request type schemas
  - `docs/adr/ADR-048-feed-ranking-v2.md` — feed weights
  - `services/auth-service/src/routes/` — provider profile routes
  - `apps/frontend/src/pages/admin/` or similar — admin UI pages

- [ ] Write `docs/architecture/expert-contribution-gaps.md` covering all five areas:

```markdown
# Expert Contribution Gaps — Sprint 44 Architecture Review

**Date**: 2026-04-03
**Author**: Sprint 44 review
**Purpose**: Identify where domain experts still require developer involvement.
             Feeds Sprint 45+ prioritization.

---

## 1. Trust Model Configuration (ADR-044)
## 2. Feed Weight Configuration (ADR-048)
## 3. Request Type Schemas (ADR-032)
## 4. Provider Directory Self-Management
## 5. Observability Access

[Each section: Current State / Gap / Priority / Recommended Next Step]

---

## Summary Priority Matrix

| Area | Priority | Sprint |
|------|----------|--------|
...

## Deferred Dependency Upgrades (npm)

[List any packages reverted in Task 3 that still need fixing]
```

- [ ] **Verify:** File is committed and readable; all 5 areas covered

- [ ] Commit

```bash
git add docs/architecture/expert-contribution-gaps.md
git commit -m "docs: Sprint 44 architecture review — expert contribution gaps analysis"
```

---

## Task 10: Landing page docs + CONTEXT.md updates

**Files:**
- Create: `apps/landing/src/data/docs/concepts/observability-logging.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/cleanup-service/CONTEXT.md`

- [ ] Create the observability concept page:

```json
{
  "slug": "observability-logging",
  "title": "Observability & Logging",
  "description": "How Karmyq services emit structured logs and how errors are surfaced across the platform.",
  "content": "# Observability & Logging\n\n## Structured Logger\n\nAll Karmyq backend services use a shared structured logger from `@karmyq/shared/utils/logger`. Each service creates a named logger instance and mounts `requestLoggingMiddleware` on startup.\n\n## Error Shape\n\nRoute handler errors are logged with context:\n\n```json\n{\n  \"service\": \"auth-service\",\n  \"endpoint\": \"POST /login\",\n  \"step\": \"verifyPassword\",\n  \"error\": \"Invalid credentials\"\n}\n```\n\n## Frontend Error Boundary\n\nA global error boundary in `_app.tsx` catches unhandled React render errors and logs `{ component, error, stack }` before showing a friendly fallback.\n\n## Known Gap\n\nThere is no in-app admin-facing error dashboard. Operators currently require server access (`pm2 logs`) to diagnose issues. This is tracked as a Sprint 45+ priority in the [Expert Contribution Gaps](../concepts/observability-logging) review.\n"
}
```

- [ ] Add entry to nav.json under "Concepts":

```json
{ "slug": "observability-logging", "title": "Observability & Logging" }
```

- [ ] Update `services/social-graph-service/CONTEXT.md` — add to "Recent Changes":
  "Sprint 44: Added structured logging via `@karmyq/shared/utils/logger`. Route handler errors
  now emit `{ service, endpoint, error }` objects."

- [ ] Same update for `services/cleanup-service/CONTEXT.md`

- [ ] **Verify:** `npm run feedback:check` passes

- [ ] Commit

```bash
git add apps/landing/ services/social-graph-service/CONTEXT.md services/cleanup-service/CONTEXT.md
git commit -m "docs: add observability concept page and update service CONTEXT.md files"
```

---

## Task 11: Logging smoke test + final verification

**Files:**
- Create: `tests/tdd/sprint-44-logging.test.ts`

- [ ] Write the smoke test:

```typescript
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import express from 'express';
import request from 'supertest';

describe('requestLoggingMiddleware', () => {
  it('attaches logger to req', async () => {
    const app = express();
    const logger = createLogger('test-service');
    app.use(requestLoggingMiddleware(logger));
    app.get('/test', (req: any, res) => {
      expect(req.logger).toBeDefined();
      res.json({ ok: true });
    });

    await request(app).get('/test').expect(200);
  });

  it('logger has error method', () => {
    const logger = createLogger('test-service');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.info).toBe('function');
  });
});
```

- [ ] Run all test tiers

```bash
npm test              # Must pass
npm run test:tdd      # Must pass
npm run feedback:check # Must pass
```

- [ ] Run tsc across all services — confirm zero new errors

```bash
cd /c/Users/ravic/development/karmyq
npx tsc --noEmit -p services/auth-service/tsconfig.json 2>&1 | grep -c "error" || echo "0"
# Repeat for all services or use turbo
```

- [ ] **Verify:** All three npm commands above exit 0

- [ ] Commit

```bash
git add tests/tdd/sprint-44-logging.test.ts
git commit -m "test: add logging middleware smoke test for Sprint 44"
```

---

## Task 12: Merge + Deploy

**Files:** None

- [ ] Update `package.json` version: `9.10.0` → `9.11.0`

```bash
npm version minor --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to v9.11.0 for Sprint 44"
```

- [ ] Merge to master and push

```bash
git checkout master
git merge feature/sprint-44-tech-debt
git push origin master
```

- [ ] Monitor GitHub Actions for the CI/CD run

- [ ] If deploy fails, SSH to diagnose:

```bash
ssh ubuntu@karmyq.com
pm2 logs --lines 50
```

- [ ] **No DB migration required for this sprint** — services restart cleanly

- [ ] Use the `/deploy` skill if manual intervention is needed

- [ ] **Verify:** All services pass health checks post-deploy

```bash
npm run health:check
```
