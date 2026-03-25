# Admin & Moderator Connector Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make admin connector tools (boost, propose match) visible to members in the feed and commitments; fix provider availability toggle placement; fix geo community list returning empty.

**Architecture:** Extends existing admin action infrastructure (Sprint 36) — no new services or endpoints, only adds `admin_proposed` column to matches, wires boost into curated feed scoring, and surfaces both in the frontend. Two targeted bug fixes close cold-start UX gaps.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260325-admin-proposed-match.sql` | Adds `admin_proposed BOOLEAN DEFAULT FALSE` to `requests.matches` |
| `apps/frontend/tests/tdd/sprint-40-admin-connectors.test.tsx` | TDD tests for new frontend behavior |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` | Add `is_boosted`, `boosted_expires_at` to curated SELECT; add +30 boost to feedScore |
| `services/request-service/src/routes/adminActions.ts` | Set `admin_proposed = TRUE` in propose-match INSERT |
| `services/request-service/src/routes/matches.ts` | Add `m.admin_proposed` to GET /matches SELECT |
| `services/community-service/src/routes/communities.ts` | Fallback when geo query returns 0 rows |
| `apps/frontend/src/types/feed-items.ts` | Add `is_boosted?`, `boosted_expires_at?` to `OpenRequestData` |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Add "Community Pick" badge |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Add "Suggested by admin" label for `admin_proposed` matches |
| `apps/frontend/src/components/ProviderDashboardCard.tsx` | Add availability toggle |
| `apps/frontend/src/pages/dashboard.tsx` | Pass `providerId` + `isAvailable` props to ProviderDashboardCard |
| `apps/frontend/src/pages/communities/index.tsx` | Handle `fallback: true` in geo response |
| `services/request-service/CONTEXT.md` | Document admin_proposed field + boost scoring |
| `services/community-service/CONTEXT.md` | Document geo fallback behavior |
| `services/registry.json` | Update request-service match endpoint notes |
| `apps/landing/src/data/docs/guides/admin-community.json` | Add "Acting as a Connector" section |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Boost is in DB but NOT in curated SQL.** The curated endpoint does not SELECT `r.is_boosted` or `r.boosted_expires_at`. Add them — without this the frontend can't show the badge or float the request.

2. **Boost scoring: flat +30 after weighted score.** After the existing multi-factor weighted score is computed, check `if (request.is_boosted && new Date(request.boosted_expires_at) > new Date())` — add 30 to feedScore, cap at 100. Do NOT inject it into the existing weighted formula.

3. **admin_proposed migration must run before service restarts.** The INSERT in `adminActions.ts` will fail if the column doesn't exist. Migration first, then code change.

4. **GET /matches SELECT**: Look for the query in `services/request-service/src/routes/matches.ts`. The SELECT already includes `req_user.name as requester_name`, etc. Add `m.admin_proposed` to the SELECT list. Also confirm CommitmentsTab Match type includes `admin_proposed?: boolean`.

5. **Geo fallback**: In `services/community-service/src/routes/communities.ts`, if the geo query returns 0 rows, re-run the default query (no lat/lng filter) and set `fallback: true` in the response: `{ success: true, data: { communities: [...], fallback: true } }`.

6. **Provider toggle props**: `dashboard.tsx` already computes `isProviderMode` from `useProvider()`. The hook returns `providerProfiles` — pass `providerProfiles[0]?.id` and `providerProfiles[0]?.is_available` as new props to `ProviderDashboardCard`. The card must guard against undefined profile.

7. **`providerService.updateAvailability` exists** in `api.ts`. Use it directly in the toggle click handler.

8. **"Community Pick" badge expiry**: `const boostActive = data.is_boosted && data.boosted_expires_at && new Date(data.boosted_expires_at) > new Date()`. Badge style: `bg-teal-100 text-teal-700 border-teal-200`.

---

## Task 1: Feature branch + migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260325-admin-proposed-match.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-40-admin-connectors
```

- [ ] **Write migration**

```sql
-- Sprint 40: Add admin_proposed flag to matches
-- Lets the frontend distinguish admin-suggested matches from self-initiated ones

ALTER TABLE requests.matches
  ADD COLUMN IF NOT EXISTS admin_proposed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN requests.matches.admin_proposed IS
  'TRUE when the match was created by a community admin via POST /requests/:id/propose-match';
```

- [ ] **Verify migration syntax is valid**

```bash
# Dry-run check (no DB required)
grep -c "ALTER TABLE" infrastructure/postgres/migrations/20260325-admin-proposed-match.sql
```

---

## Task 2: Curated feed returns boost data + scores boosted requests higher

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Find the curated feed SQL SELECT** — search for `FROM requests.help_requests` in the curated route (line ~383). Add `r.is_boosted`, `r.boosted_expires_at` to the SELECT clause.

The existing SELECT likely ends around `r.required_skills`. Add:
```sql
r.is_boosted,
r.boosted_expires_at,
```

- [ ] **Add boost scoring after the weighted feedScore calculation**

After the line that sets `feedScore:` (around line 560–576), add the boost bonus:

```typescript
// Boost bonus: active admin boost floats request higher
const boostActive = request.is_boosted &&
  request.boosted_expires_at &&
  new Date(request.boosted_expires_at) > new Date();
const boostBonus = boostActive ? 30 : 0;
const finalFeedScore = Math.min(100, feedResult.score + boostBonus);
```

Then use `finalFeedScore` instead of `feedResult.score` when setting the returned `feedScore`.

Apply the same pattern in the sister-community scoring block (around line 600–623).

- [ ] **Add `is_boosted` and `boosted_expires_at` to the returned item object** so frontend receives them.

- [ ] **Build check**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 3: FeedItem shows "Community Pick" badge for boosted requests

**Files:**
- Modify: `apps/frontend/src/types/feed-items.ts`
- Modify: `apps/frontend/src/components/Feed/FeedItem.tsx`

- [ ] **Add fields to `OpenRequestData` type** in `feed-items.ts`:

```typescript
is_boosted?: boolean;
boosted_expires_at?: string;
```

- [ ] **Add "Community Pick" badge in FeedItem** — in the badge/pill row (near the urgency badge), add:

```tsx
{(() => {
  const boostActive = data.is_boosted &&
    data.boosted_expires_at &&
    new Date(data.boosted_expires_at) > new Date();
  return boostActive ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-teal-100 text-teal-700 border-teal-200">
      Community Pick
    </span>
  ) : null;
})()}
```

Place this after the urgency badge, before the "New - no offers yet" badge.

- [ ] **TypeScript check**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 4: propose-match sets admin_proposed; GET /matches returns it

**Files:**
- Modify: `services/request-service/src/routes/adminActions.ts`
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] **Update the INSERT in `adminActions.ts`** (around line 153) to set `admin_proposed = TRUE`:

```sql
INSERT INTO requests.matches (request_id, responder_id, status, admin_proposed)
VALUES ($1, $2, 'proposed', TRUE)
RETURNING *
```

- [ ] **Add `m.admin_proposed` to the GET /matches SELECT** in `matches.ts`. Find the query that returns match data (around line 27 where `requester_name` is aliased). Add `m.admin_proposed` to the SELECT list.

- [ ] **Confirm the returned match object includes `admin_proposed`** — check around line 76 where response fields are mapped. Add `admin_proposed: result.rows[0].admin_proposed`.

- [ ] **Build check**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 5: CommitmentsTab shows "Suggested by admin" for admin_proposed matches

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Find the Match type/interface** used in CommitmentsTab. It may be inline or in a types file. Add `admin_proposed?: boolean` to it.

- [ ] **Add "Suggested by admin" label** in the match card render. For each match where `m.admin_proposed === true`, add a label below the match title/description:

```tsx
{m.admin_proposed && (
  <p className="text-xs text-teal-700 font-medium mt-1">
    Suggested by your community admin
  </p>
)}
```

Show this for both "I'm Helping" (proposed, the responder sees it) and "I Asked For Help" (proposed, the requester sees it) cards.

- [ ] **TypeScript check**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 6: Provider Availability Toggle on ProviderDashboardCard

**Files:**
- Modify: `apps/frontend/src/components/ProviderDashboardCard.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] **Update `ProviderDashboardCardProps`** to accept `providerId: string` and `isAvailable: boolean` (both optional, guard against undefined):

```typescript
interface ProviderDashboardCardProps {
  activeCommitments?: number;
  providerId?: string;
  isAvailable?: boolean;
}
```

- [ ] **Add toggle to the card** — add below the stat cells, a row with an available/unavailable toggle:

```tsx
{providerId && (
  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
    <span className="text-sm text-text-muted">Availability</span>
    <button
      onClick={async () => {
        try {
          await providerService.updateAvailability(providerId, !isAvailable)
          // optimistic update handled by parent re-fetch or local state
        } catch { /* silent — user sees no change */ }
      }}
      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
        isAvailable
          ? 'bg-success-light text-green-700'
          : 'bg-surface text-text-muted border border-border'
      }`}
    >
      {isAvailable ? 'Available' : 'Unavailable'}
    </button>
  </div>
)}
```

- [ ] **Import `providerService`** from `../../lib/api` if not already imported in the card.

- [ ] **Update `dashboard.tsx`** to pass the new props:

```tsx
<ProviderDashboardCard
  activeCommitments={...}
  providerId={providerProfiles[0]?.id}
  isAvailable={providerProfiles[0]?.is_available}
/>
```

The `providerProfiles` array is already available via `useProvider()` in dashboard.tsx.

- [ ] **Handle optimistic update** — after toggle, the card should immediately flip the button label. Add local state in the card (`const [available, setAvailable] = useState(isAvailable ?? false)`) and update on click before the API call. Sync from prop via `useEffect`.

- [ ] **TypeScript check**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 7: Geo community list bug fix

**Files:**
- Modify: `services/community-service/src/routes/communities.ts`
- Modify: `apps/frontend/src/pages/communities/index.tsx`

**Root cause**: The geo query filters `WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`. Seed communities have no coordinates → 0 rows returned → list appears empty.

**Fix strategy**: Two-part. Backend adds graceful fallback; frontend shows a message.

- [ ] **Community service: fallback when geo returns 0 rows**

After the geo query executes (around line 69), check if `result.rows.length === 0`. If so, run the default query (no lat/lng filter, same member count enrichment) and include `fallback: true` in the response:

```typescript
if (geoResult.rows.length === 0) {
  // Fall back to all active communities
  const fallbackResult = await query(`...default community SELECT...`);
  return res.json({
    success: true,
    data: {
      communities: fallbackResult.rows,
      fallback: true
    }
  });
}
```

- [ ] **Frontend: show fallback message in `communities/index.tsx`**

Add a state: `const [geoFallback, setGeoFallback] = useState(false)`.

When `response.data.fallback === true`, set `setGeoFallback(true)`.

Render a notice above the community list when `geoFallback && discoveryMode === 'geography'`:

```tsx
{geoFallback && (
  <p className="text-sm text-text-muted text-center py-2">
    Showing all communities — we couldn't narrow results by location.
  </p>
)}
```

- [ ] **Build check**

```bash
cd services/community-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

---

## Task 8: User guides + landing docs

**Files:**
- Modify: `apps/landing/src/data/docs/guides/admin-community.json`

- [ ] **Read the current `admin-community.json`** to understand its structure and existing content.

- [ ] **Add "Acting as a Connector" section** to the guide's `content` field. Insert after the existing boost/admin-actions content. The section should cover:
  - **Spotlight a request (Boost)**: Click the ⚡ Boost button on any open request. It rises in member feeds with a "Community Pick" badge for 48 hours. Use this for requests that need urgent community attention.
  - **Suggest a helper (Propose a Match)**: Click the "Propose a Match" option for any open request. Select a community member from the picker. They'll see "Suggested by your community admin" in their Commitments and can Accept or Decline.
  - **When to use each**: Boost = surface the need. Propose = connect the people.

- [ ] **Write in direct, human voice.** Avoid: "It's worth noting", "users may leverage", "facilitate". Use: "Click", "You'll see", "This tells".

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
git add -f apps/landing/src/data/docs/
```

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `request-service/CONTEXT.md`**:
  - In "API Endpoints": Note that `GET /requests/curated` now returns `is_boosted` and `boosted_expires_at`; active boost adds +30 to feedScore
  - In "Database Schema": Note `requests.matches.admin_proposed BOOLEAN DEFAULT FALSE`
  - In "Recent Changes": "Sprint 40 — admin_proposed match field; boost affects curated feed ranking"

- [ ] **Update `community-service/CONTEXT.md`**:
  - In "API Endpoints": Note that `GET /communities?mode=geography` falls back to all communities when 0 geo results; returns `fallback: true` in response
  - In "Recent Changes": "Sprint 40 — geo mode graceful fallback"

- [ ] **Update `services/registry.json`**:
  - In `request-service.apis.provides`: Update curated endpoint description to note boost scoring
  - In `request-service.apis.provides`: Note `admin_proposed` field on matches endpoint

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 10: TDD tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-40-admin-connectors.test.tsx`

- [ ] **Write tests for each new frontend behavior**. Cover:

```typescript
describe('Sprint 40: Admin Connector Tools', () => {
  describe('FeedItem Community Pick badge', () => {
    it('shows "Community Pick" badge when is_boosted=true and not expired', () => { ... })
    it('hides badge when is_boosted=false', () => { ... })
    it('hides badge when boosted_expires_at is in the past', () => { ... })
  })

  describe('CommitmentsTab admin_proposed label', () => {
    it('shows "Suggested by your community admin" when admin_proposed=true', () => { ... })
    it('hides label when admin_proposed=false or undefined', () => { ... })
  })

  describe('ProviderDashboardCard availability toggle', () => {
    it('renders Available button when isAvailable=true', () => { ... })
    it('renders Unavailable button when isAvailable=false', () => { ... })
    it('calls updateAvailability with flipped value on click', () => { ... })
    it('does not render toggle when providerId is undefined', () => { ... })
  })

  describe('Geo community fallback', () => {
    it('shows fallback message when response.fallback=true in geography mode', () => { ... })
    it('does not show fallback message in non-geography mode', () => { ... })
  })
})
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

---

## Task 11: Final type check + pre-push verification

- [ ] **Full TypeScript check across all modified services**

```bash
cd services/request-service && npx tsc --noEmit
cd ../../services/community-service && npx tsc --noEmit
cd ../../apps/frontend && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Verify admin boost appears in feed** — if running locally, boost a request as admin and confirm it appears with "Community Pick" badge in the member feed

- [ ] **Verify geo fallback** — visit `/communities` in geography mode; confirm list is not empty (shows all communities with fallback message)

---

## Task 12: Merge + Deploy

- [ ] **Run pre-commit check skill** (`/pre-commit-check`) to verify all checklist items pass

- [ ] **Commit all changes**

```bash
git add -A
git commit -m "feat: Sprint 40 — Admin Connector Tools + Provider Toggle + Geo Fix v9.15.0"
```

- [ ] **Merge to master and push**

```bash
git checkout master
git merge feature/sprint-40-admin-connectors
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch the deploy pipeline for test failures or build errors

- [ ] **Run migration on demo server** (required — new DB column)

```bash
# SSH to demo server
ssh ubuntu@karmyq.com
# Copy migration file
scp infrastructure/postgres/migrations/20260325-admin-proposed-match.sql ubuntu@karmyq.com:~/

# On the server:
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /home/ubuntu/20260325-admin-proposed-match.sql
```

- [ ] **Use the `/deploy` skill** if manual deploy steps are needed after migration

- [ ] **Smoke test on karmyq.com**:
  - Admin boosts a request → member feed shows "Community Pick" badge
  - Admin proposes a match → requester's CommitmentsTab shows "Suggested by admin"
  - Provider mode dashboard shows availability toggle
  - Communities → Geography tab shows communities (not empty)
