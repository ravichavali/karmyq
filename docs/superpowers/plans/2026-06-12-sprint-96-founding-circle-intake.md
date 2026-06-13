# Founding-Circle Backend Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `/join` mailto with a real persisted founding-circle submission via a public
`POST /founding-circle/submissions` in auth-service, with honeypot + validation, cross-origin
landing → API wiring, and success/error UI — persist-only, no email notify.

**Architecture:** A new unauthenticated route in auth-service writes to a new
`auth.founding_circle_submissions` table; the static `karmyq.org` landing page POSTs to it
cross-origin (CORS + nginx) instead of opening a mailto, keeping the visible contact fallback.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (static export), PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260612-founding-circle-submissions.sql` | Create `auth.founding_circle_submissions` table + index (IF NOT EXISTS). |
| `services/auth-service/src/routes/foundingCircle.ts` | `POST /founding-circle/submissions` route: validation, honeypot, persist. |
| `services/auth-service/src/database/foundingCircleDb.ts` | Insert helper for submissions (parameterized). |
| `services/auth-service/tests/unit/foundingCircle.test.ts` | Unit tests for `validateSubmission`: validation, honeypot drop, length caps. |
| `services/auth-service/tests/tdd/foundingCircle.route.test.ts` | Route-level supertest tests (isolated app, **mocked** DB insert) — see Task 7. |
| `apps/landing/src/lib/submitFoundingCircle.ts` | Browser `fetch` client to the intake endpoint. |
| `apps/landing/tests/submitFoundingCircle.test.ts` | Pure-TS Jest test for the client (mocked `fetch`) — see Task 6. |
| `docs/adr/ADR-076-founding-circle-intake.md` | **Source** ADR (the landing concept JSON is generated from this). |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Mirror the new table into the `auth` schema block. |
| `services/auth-service/src/index.ts` | Mount `app.use('/founding-circle', foundingCircleRoutes)` (global limiter only). |
| `services/auth-service/CONTEXT.md` | Document new endpoint + new table. |
| `services/registry.json` | Add endpoint to auth-service `apis.provides`. |
| `infrastructure/nginx/nginx.conf` | Add `location ~ ^/api/founding-circle(/.*)?$` → auth_service. |
| `apps/landing/src/components/landing/JoinForm.tsx` | POST instead of mailto; honeypot; `id="join-form"`; success/error states; keep contact fallback. |
| `apps/landing/src/lib/landingContent.ts` | **Copy swap** in `thinking` (Task 8) **+ retire the two `joinContent.lanes[*]` mailto CTAs → `#join-form`** (Task 6). |
| `scripts/generate-docs.ts` | Add `'adr-076-founding-circle-intake'` to `ADR_GROUPS` so the ADR shows in the curated Technical nav. |
| `.env.demo` (deploy) | Add `https://karmyq.org`,`https://www.karmyq.org` to `ALLOWED_ORIGINS` **and** `NEXT_PUBLIC_API_URL=https://karmyq.com/api`. |
| Root `package.json` + `package-lock.json` | Version bump `11.4.0` → `11.5.0` in **both** (lock root `version` field at line ~3). |

### Generated (do not hand-edit — produced by `npm run` docs generation, commit with `git add -f`)
| File | Produced by |
|------|-------------|
| `apps/landing/src/data/docs/concepts/adr-076-founding-circle-intake.json` | `generateConcepts()` reads `docs/adr/ADR-076-*.md`. |
| `apps/landing/src/data/docs/nav.json` | Regenerated from `ADR_GROUPS`; **top-level** path, not `concepts/nav.json`. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **No email infrastructure exists** — persist-only by decision. Do not add an email send.
2. **Cross-origin is the whole game.** Landing (`karmyq.org`) → API (`karmyq.com`). The POST fails
   in-browser unless `ALLOWED_ORIGINS` in `.env.demo` includes `https://karmyq.org` (+ `www`).
3. **Static export** (`output: 'export'`) — no Next API routes; submit is a client `fetch` to
   `NEXT_PUBLIC_API_URL`.
4. **Honeypot = silent success.** Non-empty `website` field → return success **without persisting**.
5. **Canonical error contract (ADR-074):** `{ success:false, message, error:"CODE" }` via shared
   `sendValidationError` / `sendError`. Never a literal object in `error`.
6. **Do not add auth middleware** to the endpoint — it is public.
7. **Mount without `rateLimiters.standard`** — rely on the app-wide `globalRateLimiter` only.
8. **Mirror schema** in both the migration file and `init.sql`; guard with `IF NOT EXISTS`.
9. **Landing generated docs are gitignored** — `git add -f` new `apps/landing/src/data/docs/*` and
   re-verify `nav.json` after editing (it has silently reverted before).
10. **Keep the visible `contact@karmyq.org` fallback** in the form at all times.
11. **auth-service tests are service-local** (`services/auth-service/tests/{unit,tdd}`).

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260612-founding-circle-submissions.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] Create branch `feature/sprint-96-founding-circle-intake` from `master`.

- [ ] Write the migration (idempotent, `IF NOT EXISTS`):

```sql
-- 20260612-founding-circle-submissions.sql
CREATE TABLE IF NOT EXISTS auth.founding_circle_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) NOT NULL,
  lens          VARCHAR(200),
  contribution  TEXT,
  concern       TEXT,
  source_page   VARCHAR(64)  NOT NULL DEFAULT 'join',
  status        VARCHAR(24)  NOT NULL DEFAULT 'new',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_founding_circle_status_created
  ON auth.founding_circle_submissions (status, created_at DESC);
```

- [ ] Mirror the same `CREATE TABLE` + index into `infrastructure/postgres/init.sql` inside the
  `auth` schema block.

- [ ] Verify the migration applies cleanly against a local/demo DB.

```bash
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/20260612-founding-circle-submissions.sql
psql "$DATABASE_URL" -c "\d auth.founding_circle_submissions"
```

---

## Task 2: Unit tests first (TDD) — validation + honeypot

**Files:**
- Create: `services/auth-service/tests/unit/foundingCircle.test.ts`

- [ ] Write unit tests for a pure `validateSubmission(body)` helper (written in Task 3) BEFORE the
  route exists. Cover:
  - valid body → `{ ok: true, value }`
  - missing/blank `email` → validation error
  - malformed `email` → validation error
  - `email` > 320 chars, `lens` > 200, `contribution`/`concern` > 4000 → validation error
  - non-empty `website` honeypot → `{ ok: true, drop: true }` (silent drop signal)
  - extra/unknown fields ignored

- [ ] Run — tests fail (helper not implemented yet).

```bash
cd services/auth-service && npx jest tests/unit/foundingCircle.test.ts
```

---

## Task 3: Validation helper + DB insert

**Files:**
- Create: `services/auth-service/src/database/foundingCircleDb.ts`
- Create (helper): validation in `services/auth-service/src/routes/foundingCircle.ts` (or a small `validateSubmission`)

- [ ] Implement `validateSubmission(body)` returning `{ ok, value?, drop?, error? }`:
  - trims strings; enforces required `email` + email-shape regex; enforces length caps;
  - honeypot: if `website` non-empty → `{ ok: true, drop: true }`.

- [ ] Implement `insertFoundingCircleSubmission(db, value)` — parameterized INSERT returning `id`.

- [ ] Run Task 2 unit tests — now green.

```bash
cd services/auth-service && npx jest tests/unit/foundingCircle.test.ts
```

- [ ] Run `/simplify` on the diff so far.

---

## Task 4: Route + mount

**Files:**
- Create: `services/auth-service/src/routes/foundingCircle.ts`
- Modify: `services/auth-service/src/index.ts`

- [ ] Implement `POST /founding-circle/submissions`. Use the **exact** shared helper signatures
  (verified in `packages/shared/utils/response.ts`):
  - parse → `validateSubmission`;
  - on validation error → `sendValidationError(res, message, undefined, { requestId: req.id })`
    (emits `{ success:false, message, error:'VALIDATION_ERROR' }`);
  - on `drop` (honeypot) → `sendSuccess(res, { id: null, received: true }, 201, { requestId: req.id })`
    with **no DB write** (silent success — do not reveal filtering);
  - else insert → `sendSuccess(res, { id }, 201, { requestId: req.id })`. **Note:** `sendSuccess`
    emits `{ success:true, data, meta }` with **no top-level `message`** field — do not expect one;
  - wrap DB errors → `sendInternalError(res, 'Could not save submission', err, { requestId: req.id })`
    (emits `error:'INTERNAL_ERROR'`). Do **not** call `sendError` with message-first arg order;
    its signature is `sendError(res, code, message, statusCode, details?, options?)`.

- [ ] Mount in `index.ts`: `app.use('/founding-circle', foundingCircleRoutes);` (no
  `rateLimiters.standard` — global limiter already applies). Place near the other `app.use` route
  mounts.

- [ ] Type check.

```bash
cd services/auth-service && npx tsc --noEmit
```

- [ ] Run `/simplify` on the diff.

---

## Task 5: nginx routing + CORS

**Files:**
- Modify: `infrastructure/nginx/nginx.conf`

- [ ] Add a routing block mirroring the existing `/api/users` block, stripping `/api`:

```nginx
location ~ ^/api/founding-circle(/.*)?$ {
    proxy_pass http://auth_service/founding-circle$1$is_args$args;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- [ ] Note in the plan/handoff that **`.env.demo` `ALLOWED_ORIGINS` must add
  `https://karmyq.org,https://www.karmyq.org`** (applied at deploy, Task N+1). nginx.conf change
  takes effect on next deploy.

---

## Task 6: Landing client + JoinForm wiring + retire stray `/join` mailto CTAs

**Files:**
- Create: `apps/landing/src/lib/submitFoundingCircle.ts`
- Create: `apps/landing/tests/submitFoundingCircle.test.ts`
- Modify: `apps/landing/src/components/landing/JoinForm.tsx`
- Modify: `apps/landing/src/lib/landingContent.ts` (the two `joinContent.lanes[*].cta` mailto links)

- [ ] `submitFoundingCircle({ email, lens, contribution, concern, website })`:
  - resolve base = `process.env.NEXT_PUBLIC_API_URL` with a **production-safe** fallback of
    `https://karmyq.com/api` (NOT `localhost`/relative — the static bundle is served from
    `karmyq.org`, so an unset/relative base would POST to `karmyq.org/api`, which does not exist).
    A `localhost` default is acceptable only when `process.env.NODE_ENV !== 'production'`.
  - `POST ${base}/founding-circle/submissions` with JSON body;
  - return `{ ok: true }` on 2xx, else `{ ok: false, message }` (network error or non-2xx).

- [ ] **Write `apps/landing/tests/submitFoundingCircle.test.ts` (pure TS, mocked `global.fetch`)** —
  the landing jest harness matches `**/tests/**/*.test.ts` via ts-jest. Cover: base-URL selection
  from `NEXT_PUBLIC_API_URL`; **production fallback** to `https://karmyq.com/api` when unset; POSTs
  the correct JSON payload to `…/founding-circle/submissions`; 2xx → `{ ok:true }`; non-2xx →
  `{ ok:false, message }`; network throw → `{ ok:false, message }`. Run it explicitly so
  `--passWithNoTests` can't mask a no-op.

```bash
cd apps/landing && npx jest tests/submitFoundingCircle.test.ts
```

- [ ] Rework `JoinForm.tsx`:
  - add `status: 'idle' | 'submitting' | 'success' | 'error'` + `errorMsg` state;
  - add a visually-hidden honeypot input named `website` (`tabIndex={-1}`, `aria-hidden`,
    `autoComplete="off"`, off-screen styling — not `display:none` so some bots still fill it);
  - give the form root `id="join-form"` (anchor target for the lane CTAs below);
  - `handleSubmit` → `submitFoundingCircle`; on success show a confirmation and clear fields; on
    error show inline error;
  - **keep** the visible `contact@karmyq.org` fallback paragraph;
  - disable submit button while `submitting`.

- [ ] **Retire the stray `/join` mailto CTAs** (they render as visible `LaneCard` buttons *outside*
  `JoinForm` and would compete with the real form). In `landingContent.ts`:
  - `joinContent.lanes[0]` ("For specialists") `cta.href` `mailto:…specialist` → `#join-form`
    (relabel e.g. "Write your note");
  - `joinContent.lanes[2]` ("For organizers") `cta.href` `mailto:…organizer` → `#join-form`
    (relabel e.g. "Write your note");
  - leave `lanes[1]` ("For builders") GitHub link unchanged.
  - **Acceptance:** no `mailto:` remains in `joinContent.lanes` or the primary `/join` body **except
    the JoinForm fallback paragraph**. The **global footer `Contact` link** (`Footer.tsx`, rendered
    on every route via `PageShell`) is a separate shared `mailto:contact@karmyq.org` and is
    **allowed** — do not touch it.
  - Grep-verify (scoped to the join content file, which excludes the footer):
    `grep -n "mailto:" apps/landing/src/lib/landingContent.ts` shows no `mailto:` under
    `joinContent.lanes` afterward.

- [ ] Build the landing app to confirm static export still succeeds.

```bash
cd apps/landing && npm run build
```

- [ ] Run `/simplify` on the diff.

---

## Task 7: Route-level tests (supertest + mocked DB)

**Files:**
- Create: `services/auth-service/tests/tdd/foundingCircle.route.test.ts`

> **Why route-level, not a real DB:** auth-service has **no integration test-DB harness**
> (`tests/integration/*` are `expect(true).toBe(true)` placeholders, and `src/index.ts` calls
> `start()` unconditionally so it can't be imported). The existing pattern
> (`tests/regression/auth.routes.test.ts`) builds an isolated `express()` app, mounts the router,
> and `jest.mock`s the DB module + event publisher with supertest. Follow that exact pattern.

- [ ] Mock the insert helper (`jest.mock('../../src/database/foundingCircleDb')`), build an isolated
  `express()` app, mount `foundingCircleRoutes`, and assert via supertest:
  - valid body → `201`, `res.body.success === true`, `res.body.data.id` present, insert called once;
  - honeypot (`website` non-empty) → `2xx`, `res.body.success === true`, insert **not** called;
  - malformed/empty email → `400`, `res.body.error === 'VALIDATION_ERROR'`, insert **not** called;
  - over-length field → `400`.
- [ ] Real persistence (row actually lands in `auth.founding_circle_submissions`) is verified by the
  migration (Task 1) + **post-deploy DB validation** (Task 12), not by an in-repo integration DB test.

```bash
cd services/auth-service && npx jest tests/tdd/foundingCircle.route.test.ts
```

---

## Task 8: Landing copy swap (folded-in content change)

**Files:**
- Modify: `apps/landing/src/lib/landingContent.ts`

- [ ] In the `thinking` section ("Trust when you can afford to."), replace the existing two `p()`
  blocks + `star()` + `p()` (currently lines ~108–116) with the new copy. Final block order:
  `p`, `p`, `star`, `p`.

  - **p (1):** `Think of your most reliable friend. The one who shows up at 2am. You didn't get there by saving them for emergencies — you got there by calling on each other for things big and small, until the trust was deep enough to hold the 2am call. Trace any friendship like that backwards and you find the same thing: small mutual dependence, repeated, until it became something you could stake everything on.`
  - **p (2):** `That logic applies at the community scale, and we've abandoned it. The contracts, ratings, background checks, and platform guarantees we layer over modern life aren't worthless — but they're substitutes, and leaning on them lets the underlying muscle go slack.`
  - **star:** `Crisis doesn't create trust. It reveals the trust that was already there — or exposes its absence.`
  - **p (3):** `That's the real risk. Not that people are bad — the evidence runs the other way. It's that trust takes time to build, and we keep waiting until we need it. By then it's too late to start. Karmyq isn't a substitute for institutions, and it isn't a bet that people are angels. It's the practice ground for the relationships you can't summon on demand — built now, while there's no emergency, so they're there when there is.`

- [ ] Grep-verify the old sentences ("showed up at 2am", "stop deferring to inferior systems") are
  gone from `landingContent.ts`. Note: `apps/landing/src/data/docs/services.json` is a generated
  copy and will refresh on the docs regen / next build — do not hand-edit it.

```bash
cd apps/landing && npm run build   # confirm copy renders + export still builds
```

---

## Task 9: Docs — ADR-076 (generated) + CONTEXT + registry

**Files:**
- Create (source): `docs/adr/ADR-076-founding-circle-intake.md` + index entry in `docs/adr/README.md`
- Modify (source): `scripts/generate-docs.ts` — add `'adr-076-founding-circle-intake'` to `ADR_GROUPS`
- Modify: `services/auth-service/CONTEXT.md`, `services/registry.json`
- Generated (commit with `git add -f`): `apps/landing/src/data/docs/concepts/adr-076-*.json`, `apps/landing/src/data/docs/nav.json`

> **No separate "Join the circle" user guide exists** in `docs/guides/`. The public `/join` copy
> lives in `apps/landing/src/lib/landingContent.ts` (updated in Tasks 6 & 8); **ADR-076 is the docs
> artifact** for this sprint. Do not invent a new guide file.

> **Do NOT hand-author the ADR concept JSON or edit `nav.json` directly.** `generateConcepts()`
> reads `docs/adr/ADR-*.md` and writes `concepts/<slug>.json`; the curated nav is rebuilt from
> `ADR_GROUPS`. The landing `prebuild` regenerates both, so any hand edits are overwritten. The
> real `nav.json` is at `apps/landing/src/data/docs/nav.json`, **not** `concepts/nav.json`.

- [ ] Write `docs/adr/ADR-076-founding-circle-intake.md`: public unauthenticated intake in
  auth-service; cross-origin static-landing → API pattern (CORS + nginx); honeypot anti-spam;
  **persist-only / no email transport yet** and why; future notify path. Match the heading/Status
  format the generator parses (see an existing ADR md like `ADR-075-*.md`).
- [ ] Add `'adr-076-founding-circle-intake'` to the appropriate `ADR_GROUPS` block in
  `scripts/generate-docs.ts` (e.g. near `adr-075-karmyq-org-multi-route-relaunch`).
- [ ] Regenerate docs and confirm the ADR + nav entry are produced:

```bash
npx tsx scripts/generate-docs.ts   # or: npm run docs:generate (check package.json for the script name)
grep -l "adr-076" apps/landing/src/data/docs/concepts/adr-076-founding-circle-intake.json
grep "adr-076" apps/landing/src/data/docs/nav.json
```

- [ ] Update auth-service `CONTEXT.md` (API Endpoints + Database Schema) and `registry.json`
  (`apis.provides`).
- [ ] `git add -f` the generated `apps/landing/src/data/docs/concepts/adr-076-*.json` and
  `nav.json`; re-grep both after staging (nav.json has silently reverted before).

```bash
npm run feedback:check
```

---

## Task 10: SDLC quality gates

- [ ] **`/simplify`** — final pass on the whole branch diff (reuse, altitude, dead code).

```bash
# /simplify on the branch diff
```

- [ ] **`/code-review`** — resolve correctness/logic findings (validation edges, honeypot logic,
  CORS, error shapes).

```bash
# /code-review on the branch diff
```

- [ ] **`/security-review`** — public unauthenticated write endpoint is the focus: input
  validation, injection (parameterized SQL), CORS scoping, no PII leakage, honeypot behavior.
  Resolve real findings; justify dismissals in writing. Expect the recurring
  `js/request-forgery` FP on `apps/frontend/src/lib/api.ts` if touched (it isn't here).

```bash
# /security-review on the branch diff
```

---

## Task 11: Version bump + final verification

**Files:**
- Modify: root `package.json` (`11.4.0` → `11.5.0`)
- Modify: `package-lock.json` (root `version` field at line ~3, `11.4.0` → `11.5.0` — in place)

- [ ] Bump version in **both** `package.json` and `package-lock.json` (do not scratch-regen the
  lock on Windows — edit the root `version` field in place; see the lockfile gotcha in memory).
- [ ] Full verification:

```bash
npm test                    # unit + regression (must pass)
npm run test:tdd            # TDD (report)
npm run feedback:check      # docs complete
cd services/auth-service && npx tsc --noEmit
cd apps/landing && npm run build
npm audit --package-lock-only --audit-level=high
```

---

## Task 12: Merge + Deploy

Use the `/deploy` skill.

- [ ] Open one PR (copy `.github/pull_request_template.md` into the body). Cross-agent review:
  the agent that did not author the branch reviews it.
- [ ] **Before/at deploy — `.env.demo` on the demo server (two env changes, both required):**
  1. add `https://karmyq.org,https://www.karmyq.org` to `ALLOWED_ORIGINS` (CORS for the cross-origin POST);
  2. set `NEXT_PUBLIC_API_URL=https://karmyq.com/api` — **deploy.sh sources `.env.demo` (`set -a`)
     before building the landing bundle, so this is baked in at build time.** Without it the static
     `/join` form silently POSTs to a localhost/default base and submissions never arrive.
  Also ensure the migration runs
  (`run-migration.sh 20260612-founding-circle-submissions.sql`). nginx.conf reloads via deploy.sh.
- [ ] Merge to master → monitor GitHub Actions auto-deploy → SSH only if the migration/env step
  needs manual application.
- [ ] **Post-deploy human validation (real browser):** submit the `/join` form on `karmyq.org` →
  confirm `201`, confirm a row in `auth.founding_circle_submissions`, confirm the success state
  renders, confirm a honeypot-filled request does not persist, confirm the new "2am" copy renders
  on the story page, confirm the `contact@karmyq.org` fallback is still visible, and confirm the
  lane CTAs ("For specialists" / "For organizers") now scroll to the form (no `mailto:` left in the
  `/join` body/lanes except the single JoinForm fallback line — the global footer `Contact` link is
  expected and allowed).
