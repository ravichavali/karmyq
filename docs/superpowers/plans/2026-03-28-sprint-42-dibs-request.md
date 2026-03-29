# Sprint 42: Direct "Dibs" Request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow requesters to send a scheduled request privately to one trusted provider for first right of refusal before it broadcasts publicly.

**Architecture:** New `requests.dibs` table + `dibs_pending` request status gate the request from the public feed during the private window. A scoring service ranks prior-interaction providers to surface the best candidate. Dibs endpoints live in request-service alongside the existing offer routes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260328-help-requests-scheduled-for.sql` | Add `scheduled_for` column + `dibs_pending` enum value |
| `infrastructure/postgres/migrations/20260328-dibs.sql` | Create `requests.dibs` table + indexes |
| `services/request-service/src/services/dibsScoringService.ts` | Score + rank provider candidates for dibs |
| `services/request-service/src/db/dibsDb.ts` | DB queries for dibs CRUD |
| `services/request-service/src/routes/dibs.ts` | Dibs endpoints (candidate, submit, accept, decline) |
| `services/cleanup-service/src/jobs/expireDibs.ts` | Cron job: expire pending dibs + revert request to open |
| `tests/tdd/sprint-42-dibs.test.ts` | TDD integration test for dibs lifecycle |
| `tests/unit/request-service/dibsScoringService.test.ts` | Unit tests for scoring algorithm |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/index.ts` | Mount dibs router |
| `services/request-service/src/routes/requests.ts` | Accept + store `scheduled_for` on creation |
| `services/cleanup-service/src/index.ts` | Register `expireDibs` cron job |
| `services/notification-service/src/handlers/` | Handle `dibs_submitted`, `dibs_accepted`, `dibs_declined`, `dibs_expired` events |
| `apps/frontend/src/components/requests/RideRequestForm.tsx` | Sync `departure_time` → `scheduled_for` |
| `apps/frontend/src/components/requests/EventRequestForm.tsx` | Sync `event_date` → `scheduled_for` |
| `apps/frontend/src/app/requests/new/page.tsx` | Post-creation dibs prompt |
| `apps/frontend/src/components/commitments/CommitmentsTab.tsx` | Add "Dibs Requests" section for providers |
| `services/request-service/CONTEXT.md` | Document new endpoints + schema |
| `services/cleanup-service/CONTEXT.md` | Document expireDibs job |
| `services/registry.json` | New endpoints + `dibs_*` events |
| `apps/landing/src/data/docs/guides/dibs-request.json` | New user guide |
| `apps/landing/src/data/docs/guides/making-requests.json` | Add scheduled requests section |
| `apps/landing/src/data/docs/guides/provider-mode.json` | Add "Responding to Dibs" section |
| `scripts/generate-docs.ts` | Add dibs-request to GUIDE_ORDER/LABELS/SLUGS |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`scheduled_for` is a new column on `help_requests`** — separate from type-specific payload fields (`departure_time`, `event_date`). For typed requests, set both: `scheduled_for` is the canonical field for dibs; payload fields drive type-specific display. Set `scheduled_for = NULL` for generic/borrow requests (ASAP).

2. **Dibs window formula has no floor** — `expires_at = created_at + 0.20 × (scheduled_for − created_at)`. If the window is tiny because the requester scheduled close, that's their cost. Do not add a minimum.

3. **`dibs_pending` must be excluded from public feed** — Every query that fetches `status = 'open'` requests for the public feed, curated feed, or provider notifications must explicitly exclude `dibs_pending`. Check feed-service and the `provider_went_on_duty` notification query.

4. **One dibs per request, no retry** — `UNIQUE(request_id)` on `requests.dibs`. Once any terminal state is reached (accepted/declined/expired), the request is either matched or permanently public. No re-dibs mechanism.

5. **Verify the provider user_id field in `requests.matches`** — Before writing the prior-interaction query, read `services/request-service/src/db/` to confirm whether the field is `helper_id` or `responder_id`. The handoff says `helper_id`; the research found `responder_id`. One of them is wrong — read the source.

6. **Dibs acceptance skips `provider.offers`** — Accept writes directly to `requests.matches` with `status = 'matched'` and `helper_id = provider_user_id`. The Sprint 41 offer flow is unchanged for the public broadcast path.

7. **Scoring gate: `priorInteractions >= 1` required** — Providers with zero prior completed interactions with the requester are not dibs-eligible. If no eligible candidates exist, return `{ data: null }` and skip the post-creation prompt entirely.

8. **Provider must be `is_available = true`** — Gate the candidate query on `provider.providers.is_available = true`. Off-duty providers are never surfaced for dibs.

9. **Enum migration order** — `ADD VALUE IF NOT EXISTS 'dibs_pending'` must be in the first migration file (before table creation). PostgreSQL enum alterations don't roll back cleanly inside transactions — run in a separate migration file if needed.

---

## Task 1: Feature branch + DB migrations

**Files:**
- Create: `infrastructure/postgres/migrations/20260328-help-requests-scheduled-for.sql`
- Create: `infrastructure/postgres/migrations/20260328-dibs.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-42-dibs-request
```

- [ ] **Write migration 1 — `scheduled_for` column + `dibs_pending` enum**

```sql
-- infrastructure/postgres/migrations/20260328-help-requests-scheduled-for.sql
ALTER TYPE request_status_enum ADD VALUE IF NOT EXISTS 'dibs_pending' AFTER 'open';

ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_help_requests_scheduled_for
  ON requests.help_requests(scheduled_for)
  WHERE scheduled_for IS NOT NULL;
```

- [ ] **Write migration 2 — `requests.dibs` table**

```sql
-- infrastructure/postgres/migrations/20260328-dibs.sql
CREATE TABLE IF NOT EXISTS requests.dibs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  requester_id     UUID NOT NULL,
  provider_user_id UUID NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_dibs_provider_pending
  ON requests.dibs(provider_user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dibs_expires_at
  ON requests.dibs(expires_at) WHERE status = 'pending';
```

- [ ] **Verify migration syntax**

```bash
cd infrastructure/postgres && cat migrations/20260328-help-requests-scheduled-for.sql && cat migrations/20260328-dibs.sql
```

---

## Task 2: TDD tests (write before implementation)

**Files:**
- Create: `tests/tdd/sprint-42-dibs.test.ts`
- Create: `tests/unit/request-service/dibsScoringService.test.ts`

- [ ] **Write unit tests for scoring algorithm**

```typescript
// tests/unit/request-service/dibsScoringService.test.ts
describe('dibsScoringService', () => {
  it('scores trust score at 50% weight', () => { ... });
  it('caps prior interactions at 3', () => { ... });
  it('adds 15pts for direct exchange connection', () => { ... });
  it('adds 10pts for indirect connection', () => { ... });
  it('excludes providers with zero prior interactions', () => { ... });
  it('excludes off-duty providers (is_available = false)', () => { ... });
  it('returns null when no eligible candidates', () => { ... });
});
```

- [ ] **Write TDD integration tests for dibs lifecycle**

```typescript
// tests/tdd/sprint-42-dibs.test.ts
describe('Dibs lifecycle', () => {
  it('POST /requests/:id/dibs rejects ASAP requests (no scheduled_for)', () => { ... });
  it('POST /requests/:id/dibs rejects provider with no prior interaction', () => { ... });
  it('POST /requests/:id/dibs creates dibs record + sets status to dibs_pending', () => { ... });
  it('dibs window = 20% of lead time (no floor)', () => { ... });
  it('PUT /requests/dibs/:id/accept creates matches record + sets status to matched', () => { ... });
  it('PUT /requests/dibs/:id/decline reverts request to open', () => { ... });
  it('expired dibs reverts request to open', () => { ... });
  it('second dibs on same request is rejected (unique constraint)', () => { ... });
  it('dibs_pending request does not appear in public feed', () => { ... });
});
```

- [ ] **Verify tests are in the right location and are picked up**

```bash
cd c:/Users/ravic/development/karmyq && npm run test:tdd -- --testPathPattern="sprint-42" 2>&1 | head -20
```

---

## Task 3: `scheduled_for` in request creation API

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Read the existing request creation route** to understand the current payload handling

- [ ] **Add `scheduled_for` to the create request handler** — accept it as an optional top-level body field, store it on `help_requests`. For ride/event types, also accept it derived from `departure_time`/`event_date` if not explicitly provided.

```typescript
// In create request handler — extract scheduled_for
const { type, title, description, communities, payload, scheduled_for } = req.body;

// For typed requests, fall back to payload datetime if scheduled_for not set
const resolvedScheduledFor =
  scheduled_for ??
  payload?.departure_time ??
  payload?.event_date ??
  null;
```

- [ ] **Pass `scheduled_for` to the DB insert** — add column to the INSERT statement

- [ ] **Verify `scheduled_for` is returned in GET /requests/:id response**

---

## Task 4: Dibs DB layer + scoring service

**Files:**
- Create: `services/request-service/src/db/dibsDb.ts`
- Create: `services/request-service/src/services/dibsScoringService.ts`

- [ ] **Read `services/request-service/src/db/` files** to confirm `helper_id` vs `responder_id` field name in matches

- [ ] **Write `dibsDb.ts`** — DB queries only, no business logic

```typescript
// Key functions:
export async function getEligibleCandidates(requestId: string, requesterId: string, communityIds: string[])
export async function createDibs(requestId, requesterId, providerUserId, expiresAt)
export async function getDibsById(dibsId: string)
export async function updateDibsStatus(dibsId: string, status: 'accepted' | 'declined' | 'expired')
export async function getExpiredPendingDibs(): Promise<Array<{id, request_id}>>
```

- [ ] **Write `dibsScoringService.ts`** — scoring algorithm

```typescript
// Score = trustScore * 0.50 + min(priorInteractions, 3) * 11.67 + trustGraphBonus
// trustGraphBonus: 15 if direct exchange connection, 10 if indirect, 0 otherwise
// Only providers with priorInteractions >= 1 are eligible

export async function rankCandidates(requestId: string, requesterId: string): Promise<ScoredCandidate[]>
// Returns [] if no eligible candidates
```

- [ ] **Run unit tests** — they should pass now

```bash
npm run test:unit -- --testPathPattern="dibsScoring"
```

---

## Task 5: Dibs endpoints

**Files:**
- Create: `services/request-service/src/routes/dibs.ts`
- Modify: `services/request-service/src/routes/index.ts`

- [ ] **Write `GET /requests/:id/dibs-candidate`**

Validates: authenticated user is the requester. Calls `rankCandidates()`. Returns top 5.

- [ ] **Write `POST /requests/:id/dibs`**

Validates:
- Request has `scheduled_for` set — else 400 `ASAP_NOT_ELIGIBLE`
- No existing dibs on this request — else 409 `DIBS_ALREADY_SENT`
- Provider has prior completed interaction — else 403 `NO_PRIOR_INTERACTION`
- Provider `is_available = true` — else 422 `PROVIDER_NOT_AVAILABLE`

On success:
```typescript
const leadTime = scheduledFor.getTime() - now.getTime();
const expiresAt = new Date(now.getTime() + leadTime * 0.20);

await createDibs(requestId, requesterId, providerUserId, expiresAt);
await db.query(`UPDATE requests.help_requests SET status = 'dibs_pending' WHERE id = $1`, [requestId]);
await publishEvent('dibs_submitted', { dibsId, requestId, providerUserId, expiresAt });
```

- [ ] **Write `PUT /requests/dibs/:id/accept`**

Validates: authenticated user's provider record matches `provider_user_id`, status = 'pending', `expires_at > NOW()`.

On success:
```typescript
await updateDibsStatus(dibsId, 'accepted');
await db.query(`
  INSERT INTO requests.matches (request_id, helper_id, status)
  VALUES ($1, $2, 'matched')
`, [requestId, providerUserId]);
await db.query(`UPDATE requests.help_requests SET status = 'matched' WHERE id = $1`, [requestId]);
await publishEvent('dibs_accepted', { dibsId, requestId, providerUserId });
```

- [ ] **Write `PUT /requests/dibs/:id/decline`**

On success:
```typescript
await updateDibsStatus(dibsId, 'declined');
await db.query(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`, [requestId]);
await publishEvent('dibs_declined', { dibsId, requestId, providerUserId });
```

- [ ] **Mount router in index.ts**

```typescript
import dibsRouter from './dibs';
router.use('/', dibsRouter);
```

- [ ] **Verify routes are reachable**

```bash
curl -s http://localhost:3003/health
```

---

## Task 6: Dibs expiry in cleanup service

**Files:**
- Create: `services/cleanup-service/src/jobs/expireDibs.ts`
- Modify: `services/cleanup-service/src/index.ts`

- [ ] **Write `expireDibs.ts`** cron job

```typescript
export async function expireDibs() {
  const expired = await db.query(`
    SELECT id, request_id
    FROM requests.dibs
    WHERE status = 'pending' AND expires_at < NOW()
  `);

  for (const row of expired.rows) {
    await db.query(`UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1`, [row.id]);
    await db.query(`UPDATE requests.help_requests SET status = 'open' WHERE id = $1`, [row.request_id]);
    await publishEvent('dibs_expired', { dibsId: row.id, requestId: row.request_id });
  }

  return expired.rowCount;
}
```

- [ ] **Register in cleanup-service `index.ts`** — run every 5 minutes alongside existing cron jobs

```typescript
import { expireDibs } from './jobs/expireDibs';
cron.schedule('*/5 * * * *', expireDibs);
```

---

## Task 7: Notification events for dibs transitions

**Files:**
- Modify: `services/notification-service/src/handlers/` (find existing event handler file)

- [ ] **Read the existing event handler** to understand the pattern (e.g., how `offer_submitted` is handled)

- [ ] **Add handlers for all four dibs events**

| Event | Recipient | Message |
|-------|-----------|---------|
| `dibs_submitted` | Provider | "[Name] wants your help first — respond by [time]" |
| `dibs_accepted` | Requester | "[Name] accepted your dibs request" |
| `dibs_declined` | Requester | "[Name] passed — your request is now public" |
| `dibs_expired` | Requester | "Your dibs window closed — request is now public" |

- [ ] **Verify event names match what request-service publishes** (grep across both services)

```bash
grep -r "dibs_" services/request-service/src services/notification-service/src
```

---

## Task 8: `dibs_pending` excluded from public feed

**Files:**
- Modify: `services/feed-service/src/` (find feed query)
- Modify: `services/notification-service/src/` (find `provider_went_on_duty` handler query)

- [ ] **Grep for queries that fetch `status = 'open'` requests**

```bash
grep -r "status.*=.*'open'" services/feed-service/src services/notification-service/src services/request-service/src
```

- [ ] **Add `AND status = 'open'` (not `!= 'dibs_pending'`)** to every public-facing query that lists open requests. Explicit equality is safer than exclusion lists.

- [ ] **Verify the curated feed endpoint also excludes dibs_pending** — check `GET /requests/curated` in request-service

---

## Task 9: Frontend — request creation + dibs prompt

**Files:**
- Modify: `apps/frontend/src/components/requests/RideRequestForm.tsx`
- Modify: `apps/frontend/src/components/requests/EventRequestForm.tsx`
- Modify: `apps/frontend/src/app/requests/new/page.tsx` (or equivalent creation page)

- [ ] **Read the existing RideRequestForm and EventRequestForm** to understand current field structure

- [ ] **Add `scheduled_for` sync** — when `departure_time` / `event_date` changes, also set `scheduled_for` in the form payload before submission

- [ ] **After successful request creation**, if `scheduled_for` is set: call `GET /requests/:id/dibs-candidate`. If a candidate is returned, show the dibs prompt:

```tsx
// Non-blocking bottom sheet / modal
<DibsPrompt
  candidate={topCandidate}       // { displayName, trustScore, priorInteractions, score }
  onSend={() => postDibs(requestId, candidate.providerUserId)}
  onSkip={() => router.push('/requests')}
/>
```

If no candidate (null response), navigate to requests list directly.

- [ ] **DibsPrompt shows**: candidate name, trust score, prior interaction count, estimated dibs window duration. Two buttons: "Send Dibs" and "Post Publicly".

---

## Task 10: Frontend — CommitmentsTab provider dibs section

**Files:**
- Modify: `apps/frontend/src/components/commitments/CommitmentsTab.tsx`

- [ ] **Read the existing CommitmentsTab** to understand section structure

- [ ] **Add a new API call**: `GET /requests/dibs/pending-for-provider` — fetch dibs records where `provider_user_id = me` and `status = 'pending'`

  > Note: This endpoint may not exist yet. If not, add it in Task 5 alongside the other dibs routes. The frontend task depends on it — check before implementing.

- [ ] **Add "Dibs Requests" section** above "Offers Submitted":

```tsx
{pendingDibs.length > 0 && (
  <section>
    <h3>Dibs Requests</h3>
    {pendingDibs.map(dibs => (
      <DibsCard
        key={dibs.id}
        requestTitle={dibs.requestTitle}
        scheduledFor={dibs.scheduledFor}
        expiresAt={dibs.expiresAt}      // drives countdown timer
        onAccept={() => acceptDibs(dibs.id)}
        onDecline={() => declineDibs(dibs.id)}
      />
    ))}
  </section>
)}
```

- [ ] **Countdown timer**: show "Expires in Xh Ym" — recalculate every minute. When expired, remove from list.

- [ ] **Add dibs status badge to requester's request cards**: if request has `status = 'dibs_pending'`, show "Awaiting [Name]" with time remaining.

---

## Task 11: User guides + landing page docs

**Files:**
- Create: `apps/landing/src/data/docs/guides/dibs-request.json`
- Modify: `apps/landing/src/data/docs/guides/making-requests.json`
- Modify: `apps/landing/src/data/docs/guides/provider-mode.json`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create new guide: `dibs-request.json`**

```json
{
  "slug": "dibs-request",
  "title": "Sending a Private Request (Dibs)",
  "description": "Give a trusted provider first right of refusal before your request goes public.",
  "content": "# Sending a Private Request (Dibs)\n\n..."
}
```

Content should cover: what dibs is, eligibility (scheduled requests + prior interaction required), how the window works, what happens on accept/decline/expiry.

- [ ] **Update `making-requests.json`** — add "Scheduled Requests" section and link to dibs guide

- [ ] **Update `provider-mode.json`** — add "Responding to Dibs" section explaining the CommitmentsTab dibs section and the time pressure

- [ ] **Add to `scripts/generate-docs.ts`** — add `dibs-request` to GUIDE_ORDER, GUIDE_LABELS, GUIDE_SLUGS

- [ ] **Regenerate docs**

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Force-add generated files** (landing docs are gitignored by default)

```bash
git add -f apps/landing/src/data/docs/
```

---

## Task 12: CONTEXT.md + registry.json + TDD tests

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/cleanup-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `request-service/CONTEXT.md`** — add to "API Endpoints":

```
GET  /requests/:id/dibs-candidate  Returns top-scored dibs candidate for a scheduled request
POST /requests/:id/dibs            Send dibs to a specific provider (scheduled requests only)
PUT  /requests/dibs/:id/accept     Provider accepts dibs → creates matches record
PUT  /requests/dibs/:id/decline    Provider declines dibs → request reverts to open
```

Add to "Database Schema": `requests.dibs` table description + `scheduled_for` column on `help_requests`.

- [ ] **Update `cleanup-service/CONTEXT.md`** — document `expireDibs` cron job (every 5 min)

- [ ] **Update `services/registry.json`** — add 4 new endpoints to request-service `apis.provides`, add `dibs_submitted`, `dibs_accepted`, `dibs_declined`, `dibs_expired` to events section

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Run TDD tests** — should be further passing now

```bash
npm run test:tdd -- --testPathPattern="sprint-42"
```

---

## Task 13: Final type check + pre-push verification

- [ ] **TypeScript check across modified services**

```bash
cd services/request-service && npx tsc --noEmit
cd ../cleanup-service && npx tsc --noEmit
cd ../notification-service && npx tsc --noEmit
```

- [ ] **Run unit + regression tests** (must pass)

```bash
cd c:/Users/ravic/development/karmyq && npm test
```

- [ ] **Run TDD tests** (must pass)

```bash
npm run test:tdd
```

- [ ] **Run feedback check** (must pass)

```bash
npm run feedback:check
```

- [ ] **Run analyze:services** (check for new circular dependencies)

```bash
npm run analyze:services
```

- [ ] **Fix any failures before proceeding to Task 14**

---

## Task 14: Merge + Deploy

> Use the `/deploy` skill for this task.

- [ ] **Commit all changes**

```bash
git add services/request-service services/cleanup-service services/notification-service \
        services/feed-service infrastructure/postgres/migrations \
        apps/frontend/src/components/requests apps/frontend/src/components/commitments \
        apps/frontend/src/app/requests tests/ \
        apps/landing/src/data/docs services/registry.json scripts/generate-docs.ts
git commit -m "feat(dibs): Sprint 42 — direct dibs request flow (scheduled-only)"
```

- [ ] **Merge to master + push**

```bash
git checkout master && git merge feature/sprint-42-dibs-request && git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for test failures or Docker build errors

- [ ] **SSH to demo server and run migrations** (after deploy succeeds)

```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /tmp/20260328-help-requests-scheduled-for.sql
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /tmp/20260328-dibs.sql
```

Copy migrations to server first:
```bash
scp infrastructure/postgres/migrations/20260328-*.sql ubuntu@karmyq.com:/tmp/
```

- [ ] **Verify health after deploy**

```bash
npm run health:check
```
