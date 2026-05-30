# Request Service Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the request service — remove dead code and stale logic, standardize response formats, extract oversized route handlers, delete never-implemented TDD tests — then fix the deployed Withdraw Offer bug via deploy, audit and polish the request UX, and ship updated docs.

**Architecture:** The request service has 6,799 lines across 24 files with a dead service class (`matchService.ts`), three never-implemented TDD placeholder test files, inconsistent response formats, and a 562-line inline curated feed handler. No schema changes. No new features. Cleanup only.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### Files to delete
| File | Reason |
|------|--------|
| `services/request-service/src/services/matchService.ts` | Dead — no routes call it; stale `rejectMatch` causes confusion |
| `services/request-service/tests/tdd/dynamic-schemas-api.test.ts` | Placeholder, never implemented, pool uninitialized |
| `services/request-service/tests/tdd/schema-caching.test.ts` | Placeholder, never implemented, pool+Redis uninitialized |
| `services/request-service/tests/tdd/schema-fallback.test.ts` | Placeholder, never implemented, pool uninitialized |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/matches.ts` | Remove commented-out dead code; remove debug console.log |
| `services/request-service/src/routes/requests.ts` | Extract curated feed logic into helper; standardize error responses |
| `services/request-service/src/routes/admin-schemas.ts` | Remove stale JSDoc comments |
| `apps/frontend/src/components/CommitmentsTab.tsx` | UX polish — replace alert() with inline errors; verify labels |
| `apps/landing/src/data/docs/guides/help-requests.json` | Update content |
| `apps/landing/src/data/docs/guides/match-lifecycle.json` | Update content for two-phase completion + withdraw |
| `apps/landing/src/data/docs/services/request-service.json` | Remove dead find-candidates endpoint entry |
| `scripts/generate-docs.ts` | Ensure guide slugs registered (GUIDE_ORDER, GUIDE_LABELS, GUIDE_SLUGS) |
| `services/request-service/CONTEXT.md` | Update to reflect simplified structure |
| `package.json` | Bump version 10.1.0 → 10.2.0 |
| `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` | Update version check to 10.2.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **matchService.ts is NOT called by routes** — confirm with `grep -rn "matchService\|new MatchService\|from.*matchService" services/request-service/src` before deleting. If anything imports it, fix that import first, then delete.

2. **Delete means delete** — do not comment out placeholder TDD tests; delete the files with `rm`. Commented-out tests still show in CI output.

3. **Response format helpers**: `sendSuccess`, `sendInternalError`, `sendNotFound` are from `@karmyq/shared/utils/response` and `HTTP_STATUS` for status codes. Do not change HTTP behavior, just the call style.

4. **admin-schemas.ts auth is at app level** — `index.ts` applies `...adminAuth` at mount. Do not add middleware inside the route file.

5. **nav.json revert bug** — `scripts/generate-docs.ts` regenerates nav.json. Add slugs to `GUIDE_ORDER`, `GUIDE_LABELS`, `GUIDE_SLUGS` in that file first; regenerate with `npx ts-node scripts/generate-docs.ts`; then `git add -f` the output files.

6. **Version invariant test**: After bumping `package.json` to 10.2.0, update `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` — it asserts `pkg.version === '10.1.0'`.

7. **Withdraw Offer bug is fixed by deploying** — the local `routes/matches.ts` reject handler already checks both participants. No code change needed; the deploy in the final task pushes the fix live.

8. **Solo dev — no worktrees**: Work on `feature/sprint-73-request-simplification` directly.

---

## Task 1: Feature branch + baseline

**Files:**
- Branch: `feature/sprint-73-request-simplification`

- [ ] **Create branch**

```bash
git checkout -b feature/sprint-73-request-simplification
```

- [ ] **Establish baseline test count** — run tests, record how many pass/fail before any changes

```bash
cd services/request-service && npx jest --no-coverage 2>&1 | tail -10
```

- [ ] **Confirm matchService is unused** — no routes should import it

```bash
grep -rn "matchService\|new MatchService\|from.*matchService\|from.*services/match" services/request-service/src --include="*.ts"
```

Expected: zero results (only the file itself and its own imports).

---

## Task 2: Delete dead code — matchService + placeholder TDD tests

**Files:**
- Delete: `services/request-service/src/services/matchService.ts`
- Delete: `services/request-service/tests/tdd/dynamic-schemas-api.test.ts`
- Delete: `services/request-service/tests/tdd/schema-caching.test.ts`
- Delete: `services/request-service/tests/tdd/schema-fallback.test.ts`

- [ ] **Delete matchService.ts**

```bash
rm services/request-service/src/services/matchService.ts
```

- [ ] **Delete the three never-implemented TDD test files**

```bash
rm services/request-service/tests/tdd/dynamic-schemas-api.test.ts
rm services/request-service/tests/tdd/schema-caching.test.ts
rm services/request-service/tests/tdd/schema-fallback.test.ts
```

- [ ] **Verify no import errors** — TypeScript must still compile

```bash
cd services/request-service && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Run tests — remaining TDD tests should now pass or fail cleanly**

```bash
cd services/request-service && npx jest --no-coverage 2>&1 | tail -15
```

---

## Task 3: Simplify matches.ts — remove dead code + debug log

**Files:**
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] **Remove the two commented-out dead code blocks** — the `find-candidates` endpoint and its import comments at the top of the file

Look for:
```typescript
// Temporarily commented out - matching feature
// import { findMatches } from '@karmyq/shared/matching';
// import type { UserProfile } from '@karmyq/shared/matching';
```
and
```typescript
// Temporarily disabled - matching feature needs Docker rebuild
// GET /matches/find-candidates/:request_id - Find potential helpers...
/*
router.get('/find-candidates/:request_id', ...
*/
```

Delete both blocks entirely.

- [ ] **Remove the debug console.log in GET /**

Find and delete:
```typescript
    // Debug: Log first match to verify data structure
    if (result.rows.length > 0) {
      console.log('Sample match data:', {
        id: result.rows[0].id,
        ...
      });
    }
```

- [ ] **Standardize GET /:id and POST / error responses** — these handlers use raw `res.status().json({ success: false })`. Replace with `sendSuccess` / `sendInternalError` to match the rest of the file.

For example, in `GET /:id`:
```typescript
// Before
res.json({ success: true, data: result.rows[0] });
// After
sendSuccess(res, result.rows[0]);
```

- [ ] **Verify compilation**

```bash
cd services/request-service && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 4: Simplify requests.ts — extract curated feed + standardize responses

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Extract the curated feed handler body into a `buildCuratedFeed` helper function** at the top of the file (before the router)

The `GET /curated` route handler is ~562 lines. The goal is:

```typescript
// Helper function (extracted, ~550 lines)
async function buildCuratedFeed(params: { userId: string; communityId: string; ... }, queryFn: typeof query): Promise<CuratedFeedResult> {
  // ... all the existing logic ...
}

// Route handler (thin wrapper, ~20 lines)
router.get('/curated', async (req: Request, res: Response) => {
  try {
    const result = await buildCuratedFeed({ ...req.query, ...req.user }, query);
    sendSuccess(res, result);
  } catch (error: any) {
    sendInternalError(res, 'Failed to fetch curated feed', ...);
  }
});
```

This does not reduce line count significantly but makes the route list scannable — you can see at a glance what routes exist without scrolling through 562 lines of business logic.

- [ ] **Standardize the remaining raw `res.status().json()` calls** in this file — convert to `sendSuccess` / `sendInternalError` / `sendNotFound`

Look for patterns like:
```typescript
return res.status(404).json({ success: false, message: '...' });
return res.status(400).json({ success: false, message: '...' });
res.json({ success: true, data: ... });
```

- [ ] **Verify compilation**

```bash
cd services/request-service && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Run unit + regression tests** — nothing should break

```bash
cd services/request-service && npx jest --testPathPattern="unit|regression" --no-coverage 2>&1 | tail -15
```

---

## Task 5: Verify two-phase-completion and providers-api TDD tests

**Files:**
- Modify: `services/request-service/tests/tdd/providers-api.test.ts` (if fixes needed)
- Modify: `services/request-service/tests/tdd/two-phase-completion.test.ts` (if fixes needed)

- [ ] **Run both tests individually and read output**

```bash
cd services/request-service && npx jest tests/tdd/two-phase-completion.test.ts --no-coverage --verbose 2>&1 | tail -30
cd services/request-service && npx jest tests/tdd/providers-api.test.ts --no-coverage --verbose 2>&1 | tail -30
```

- [ ] **If two-phase-completion passes**: no action needed — it was already solid.

- [ ] **If two-phase-completion fails**: read the failure, trace to the route, fix the test mock or the assertion. The implementation in `routes/matches.ts` is the source of truth.

- [ ] **If providers-api passes**: no action needed.

- [ ] **If providers-api fails**: read the failure. Common causes: JWT mock not matching, response envelope format mismatch, or missing mock return value. Fix the test to match the actual route behavior — do NOT change route behavior to match the test.

- [ ] **Record final pass/fail status** for both tests.

---

## Task 6: Frontend UX audit + CommitmentsTab polish

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Replace `alert()` error calls with inline error state** — the three `catch` blocks in CommitmentsTab use `alert(err.response?.data?.message || 'Failed to...')`. This is jarring UX.

Add a `const [error, setError] = useState<string | null>(null)` and render a dismissible error banner at the top of the component. Replace each `alert()` with `setError(...)`.

- [ ] **Verify "Withdraw Offer" vs "Decline" labels are correct in context**

The `Withdraw Offer` label appears for helpers on proposed matches (correct — the helper is withdrawing their own offer). The `Decline` label appears for requesters declining a proposed helper (also correct). Verify both render in the right contexts by reading the conditional logic and confirming against the match data shape.

- [ ] **Review empty state messages** — if `helping` or `requested` arrays are empty, what does the user see? If it's a blank tab, add a brief empty state:
  - Helping tab: "No active commitments. Browse the feed to find requests you can help with."
  - Requested tab: "No active requests. Post a request when you need help."

- [ ] **Review status labels** — confirm that the text shown for each match status (`proposed`, `matched`, `completed`) matches what a non-technical user would understand. Update any that feel too technical.

- [ ] **Run TypeScript check on frontend**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 7: Request creation flow UX audit

**Files:**
- Modify: `apps/frontend/src/components/` (request creation wizard — find the relevant file)
- Modify: `apps/frontend/src/pages/` (if request creation is a page)

- [ ] **Find the request creation component**

```bash
grep -rn "create.*request\|post.*request\|RequestForm\|CreateRequest\|new request" apps/frontend/src --include="*.tsx" -l | head -10
```

- [ ] **Review form field labels** — categories and request types should use plain language. Replace any that feel technical or generic (e.g., "request_type: 'general'" → label "General Help" or "Other").

- [ ] **Review submission confirmation** — after a request is posted, what does the user see? Verify there's a clear success state and a way to view the new request.

- [ ] **Spot-check the "Post a request" flow end-to-end** — read through the component(s) and verify the flow is coherent. Note any issues. Fix any that are straightforward (label changes, copy improvements). Defer any that require backend changes.

---

## Task 8: User guides + landing docs

**Files:**
- Modify: `apps/landing/src/data/docs/guides/help-requests.json`
- Modify or create: `apps/landing/src/data/docs/guides/match-lifecycle.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json`
- Modify: `scripts/generate-docs.ts` (if any new guide slugs added)

- [ ] **Update `help-requests.json`** — add a section explaining the two-phase completion flow (both parties must mark Done before karma is awarded) and the Withdraw Offer behavior (helpers can withdraw a proposed offer at any time).

- [ ] **Update or create `match-lifecycle.json`** — if it doesn't exist, create it. Cover: proposed → accepted → both-mark-done → completed. Explain the waiting state ("Waiting for the other party to confirm").

- [ ] **Update `request-service.json`** endpoint list** — remove the `find-candidates` entry if present (it was never deployed).

- [ ] **If new guide slugs added, register them in `generate-docs.ts`**

```bash
grep -n "GUIDE_ORDER\|GUIDE_LABELS\|GUIDE_SLUGS" scripts/generate-docs.ts
```

Add new slugs to all three constants.

- [ ] **Regenerate nav.json**

```bash
npx ts-node scripts/generate-docs.ts
```

- [ ] **Stage generated files** (they're gitignored, so force-add)

```bash
git add -f apps/landing/src/data/docs/
```

---

## Task 9: CONTEXT.md + registry.json + version bump

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `package.json`
- Modify: `services/community-service/tests/regression/sprint-71-v10-polish.test.ts`

- [ ] **Update `services/request-service/CONTEXT.md`**
  - Remove any mention of `matchService.ts` from the service structure section
  - Add "Recent Changes" entry for Sprint 73: simplified routes, deleted stale service class and placeholder tests
  - Update test counts if the section exists

- [ ] **Update `services/registry.json`**
  - Remove the `find-candidates` endpoint from the request service's `apis.provides` list if it's there

- [ ] **Bump version in root `package.json`** from `10.1.0` to `10.2.0`

- [ ] **Update the version invariant test**

Open `services/community-service/tests/regression/sprint-71-v10-polish.test.ts` and update the version assertion from `'10.1.0'` to `'10.2.0'`.

- [ ] **Run feedback:check**

```bash
npm run feedback:check
```

---

## Task 10: Final verification

**Files:** None (verification only)

- [ ] **Full unit + regression test suite must pass**

```bash
npm test 2>&1 | tail -20
```

- [ ] **TDD tests — run and confirm only expected failures remain**

```bash
npm run test:tdd 2>&1 | tail -20
```

Expected: `two-phase-completion` and `providers-api` pass (or are documented). The three placeholder files are deleted. Pre-existing failures (sprint-39, sprint-43, sprint-68, sprint-67, social-graph tests) are unchanged.

- [ ] **TypeScript compile check across all services**

```bash
cd services/request-service && npx tsc --noEmit && echo "✅ request-service OK"
cd apps/frontend && npx tsc --noEmit && echo "✅ frontend OK"
```

- [ ] **Feedback loop check**

```bash
npm run feedback:check
```

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(request-service): Sprint 73 — simplify routes, delete dead code, UX polish v10.2.0"
```

---

## Task 11: Merge + Deploy

**Files:** None

- [ ] **Merge to master**

```bash
git checkout master
git merge feature/sprint-73-request-simplification
```

- [ ] **Push — triggers GitHub Actions CI/CD**

```bash
git push origin master
```

- [ ] **Monitor GitHub Actions** — CI must go green before calling the sprint done

- [ ] **Verify Withdraw Offer bug is fixed on karmyq.com** — after deploy completes, SSH to verify:

```bash
ssh ubuntu@karmyq.com
curl -s http://localhost:3003/health | python3 -m json.tool
```

Then test in the browser: log in as a helper, find a proposed match in CommitmentsTab → Helping tab, click "Withdraw Offer". Should succeed (no "Only the requester" error).

- [ ] **Use `/deploy` skill** if manual steps are needed (SSH, migration scripts, pm2 restarts).
