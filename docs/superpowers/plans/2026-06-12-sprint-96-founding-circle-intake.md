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
| `services/auth-service/tests/unit/foundingCircle.test.ts` | Unit tests: validation, honeypot drop, length caps, success shape. |
| `services/auth-service/tests/tdd/foundingCircle.integration.test.ts` | TDD integration: POST persists / honeypot no-persist / bad email 400. |
| `apps/landing/src/lib/submitFoundingCircle.ts` | Browser `fetch` client to the intake endpoint. |
| `docs/adr/ADR-076-founding-circle-intake.md` | ADR: public intake in auth-service, cross-origin static→API, persist-only. |
| `apps/landing/src/data/docs/concepts/adr-076-founding-circle-intake.json` | Landing copy of ADR-076. |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Mirror the new table into the `auth` schema block. |
| `services/auth-service/src/index.ts` | Mount `app.use('/founding-circle', foundingCircleRoutes)` (global limiter only). |
| `services/auth-service/CONTEXT.md` | Document new endpoint + new table. |
| `services/registry.json` | Add endpoint to auth-service `apis.provides`. |
| `infrastructure/nginx/nginx.conf` | Add `location ~ ^/api/founding-circle(/.*)?$` → auth_service. |
| `apps/landing/src/components/landing/JoinForm.tsx` | POST instead of mailto; honeypot; success/error states; keep contact fallback. |
| `apps/landing/src/lib/landingContent.ts` | **Copy swap** in `thinking` section (Task 8). |
| `apps/landing/src/data/docs/concepts/nav.json` | Add ADR-076 entry. |
| `.env.demo` (deploy) | Add `https://karmyq.org`,`https://www.karmyq.org` to `ALLOWED_ORIGINS`. |
| Root `package.json` | Version bump `11.4.0` → `11.5.0`. |

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

- [ ] Implement `POST /founding-circle/submissions`:
  - parse → `validateSubmission`;
  - on validation error → `sendValidationError(res, msg, …)`;
  - on `drop` (honeypot) → `sendSuccess`/`sendCreated` with a synthetic id, **no DB write**;
  - else insert + return `201 { success:true, data:{ id }, message:'Submission received' }`;
  - wrap DB errors → `sendError(... 'INTERNAL_ERROR')` (ADR-074 shape).

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

## Task 6: Landing client + JoinForm wiring

**Files:**
- Create: `apps/landing/src/lib/submitFoundingCircle.ts`
- Modify: `apps/landing/src/components/landing/JoinForm.tsx`

- [ ] `submitFoundingCircle({ email, lens, contribution, concern, website })`:
  - `POST ${process.env.NEXT_PUBLIC_API_URL}/founding-circle/submissions` with JSON body;
  - return `{ ok: true }` on 2xx, else `{ ok: false, message }`.
  - Default base URL for local dev if env unset.

- [ ] Rework `JoinForm.tsx`:
  - add `status: 'idle' | 'submitting' | 'success' | 'error'` + `errorMsg` state;
  - add a visually-hidden honeypot input named `website` (`tabIndex={-1}`, `aria-hidden`,
    `autoComplete="off"`, off-screen styling — not `display:none` so some bots still fill it);
  - `handleSubmit` → `submitFoundingCircle`; on success show a confirmation and clear fields; on
    error show inline error;
  - **keep** the visible `contact@karmyq.org` fallback paragraph;
  - disable submit button while `submitting`.

- [ ] Build the landing app to confirm static export still succeeds.

```bash
cd apps/landing && npm run build
```

- [ ] Run `/simplify` on the diff.

---

## Task 7: TDD integration test

**Files:**
- Create: `services/auth-service/tests/tdd/foundingCircle.integration.test.ts`

- [ ] Integration test (uses the auth-service test DB harness): POST valid body → row persisted +
  `201`; honeypot body → `2xx` and **no** new row; malformed email → `400` with canonical error
  shape.

```bash
cd services/auth-service && npx jest tests/tdd/foundingCircle.integration.test.ts
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

## Task 9: Docs — ADR-076 + landing guide + CONTEXT + registry

**Files:**
- Create: `docs/adr/ADR-076-founding-circle-intake.md` + index entry in `docs/adr/README.md`
- Create: `apps/landing/src/data/docs/concepts/adr-076-founding-circle-intake.json`
- Modify: `apps/landing/src/data/docs/concepts/nav.json` (add ADR-076)
- Modify: landing "Join the circle" guide if copy implies email-only path
- Modify: `services/auth-service/CONTEXT.md`, `services/registry.json`

- [ ] Write ADR-076: public unauthenticated intake in auth-service; cross-origin static-landing →
  API pattern (CORS + nginx); honeypot anti-spam; **persist-only / no email transport yet** and
  why; future notify path.
- [ ] Add the landing ADR JSON (per CLAUDE.md ADR JSON schema) + nav.json entry.
- [ ] Update auth-service `CONTEXT.md` (API Endpoints + Database Schema) and `registry.json`
  (`apis.provides`).
- [ ] `git add -f` the generated landing docs; grep-verify nav.json kept the new entry.

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

- [ ] Bump version.
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
- [ ] **Before/at deploy:** add `https://karmyq.org,https://www.karmyq.org` to `ALLOWED_ORIGINS`
  in `.env.demo` on the demo server (CORS), and ensure the migration runs
  (`run-migration.sh 20260612-founding-circle-submissions.sql`). nginx.conf reloads via deploy.sh.
- [ ] Merge to master → monitor GitHub Actions auto-deploy → SSH only if the migration/env step
  needs manual application.
- [ ] **Post-deploy human validation (real browser):** submit the `/join` form on `karmyq.org` →
  confirm `201`, confirm a row in `auth.founding_circle_submissions`, confirm the success state
  renders, confirm a honeypot-filled request does not persist, confirm the new "2am" copy renders
  on the story page, and confirm the `contact@karmyq.org` fallback is still visible.
