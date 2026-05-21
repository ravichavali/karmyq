# Sprint 62: Platform Coherence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 5 platform coherence gaps so community config, match guards, and community type actually drive behavior.

**Architecture:** Backend: fix match reject guard (request-service) + add request type validation (request-service) + apply karma multipliers (reputation-service). Frontend: provider nav re-entry (Layout) + community type awareness in Browse feed (BrowseFeed).

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### Existing files to modify

| File | Change |
|------|--------|
| `services/request-service/src/routes/matches.ts` | Expand `PUT /matches/:id/reject` guard to allow responder withdrawal |
| `services/request-service/src/routes/requests.ts` | Add `enabled_request_types` validation to `POST /requests` |
| `services/reputation-service/src/services/karmaAllocation.ts` | Add `requestType` parameter; apply karma multiplier |
| `services/reputation-service/src/` (event handler) | Fetch community config and pass multiplied pool to allocateKarma |
| `apps/frontend/src/components/Layout.tsx` | Add "Manage profile" link/button for existing provider users |
| `apps/frontend/src/components/BrowseFeed.tsx` | Add community_type awareness: banner + empty state for group communities |
| `apps/frontend/src/pages/dashboard.tsx` | Pass `community_type` down to BrowseFeed if not already |
| `docs/guides/provider-mode.md` | Document that providers can withdraw offers |
| `docs/guides/community-settings.md` | Document request type enforcement + karma multipliers |
| `docs/guides/community-types.md` | Document mutual_aid vs group behavior differences |

### Possibly new files (investigation determines)

| File | Responsibility |
|------|---------------|
| `apps/frontend/src/pages/providers/me.tsx` (if missing) | Provider profile self-management page |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Withdraw Offer guard change is one line** in `matches.ts`. Match status after withdrawal → `'cancelled'`. Verify the frontend handles `cancelled` correctly — check if `CommitmentsTab.tsx` has different UI for `cancelled` vs `rejected`.

2. **Request type enforcement is opt-in** — if `enabled_request_types` is null, empty, or not set, ALL types remain allowed. Never break communities that haven't configured this.

3. **Karma multiplier default is 1.0** — if config is missing or has no entry for the request type, multiply by 1.0 (no-op). Never fail on missing config.

4. **Investigate before adding nav link** — check what provider profile management pages exist before adding a link in Layout.tsx. A dead link is worse than no link.

5. **`community_type` is likely already available** — check `dashboard.tsx` and the community data fetch before adding a new API call to get it.

6. **Pre-existing TDD failures** — `sprint-39-provider-ux` (7 tests), `sprint-43-feed-ranking` (crashes). Do NOT fix. Ignore in output.

7. **community_configs is in `community` schema** — queries use `community.community_configs`, not `communities.community_configs`.

8. **`git add` on Windows** — `CLAUDE.md` is tracked as `claude.md` — always `git add claude.md`.

---

## Task 1: Feature branch

**Files:**
- None (git only)

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-62-platform-coherence
```

- [ ] **Read local context for both changed services**

```bash
cat services/request-service/.claude/README.md
cat services/reputation-service/.claude/README.md
cat apps/frontend/.claude/README.md
```

---

## Task 2: Fix Withdraw Offer — backend guard

**Files:**
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] **Find the reject guard in matches.ts**

```bash
grep -n "requester can reject\|requester_id !== user_id" services/request-service/src/routes/matches.ts
```

- [ ] **Update the guard to allow either match participant**

Change from:
```typescript
if (match.requester_id !== user_id) {
  return res.status(403).json({ success: false, message: 'Only the requester can reject this match.' });
}
```

To:
```typescript
if (match.requester_id !== user_id && match.responder_id !== user_id) {
  return res.status(403).json({ success: false, message: 'Only match participants can reject or withdraw.' });
}
```

- [ ] **Verify match status handling** — check what status is set after this guard. It should be `'cancelled'` for both requester rejection and responder withdrawal. If there's a separate status for `'rejected'`, verify `CommitmentsTab.tsx` handles both correctly.

- [ ] **Check CommitmentsTab.tsx for status-based UI** — if it has different UI for `rejected` vs `cancelled`, ensure the responder withdrawal path sets the right status.

- [ ] **Build check**

```bash
cd services/request-service && npm run build 2>&1 | tail -20
```

---

## Task 3: Fix Provider Mode Re-entry — investigate then implement

**Files:**
- Modify: `apps/frontend/src/components/Layout.tsx`
- Possibly create: `apps/frontend/src/pages/providers/me.tsx`

- [ ] **Investigate: what provider management pages exist?**

```bash
find apps/frontend/src/pages -name "*.tsx" | grep -i provider
grep -rn "hasProviderProfile\|providerProfile\|/providers" apps/frontend/src/pages/ apps/frontend/src/components/Layout.tsx | head -30
```

- [ ] **Find where the provider nav section is in Layout.tsx**

```bash
grep -n "hasProviderProfile\|Become a provider\|provider" apps/frontend/src/components/Layout.tsx | head -20
```

- [ ] **Add "Manage profile" entry point in Layout.tsx**

When `hasProviderProfile === true`, add a secondary navigation item or subtle link alongside the existing availability toggle that takes the user to their provider profile page.

If `/providers/[id]` exists: link to `/providers/${providerId}`.
If a provider settings tab on dashboard exists: link to `/?tab=provider-settings` or equivalent.
If no page exists: create a minimal `/providers/me` redirect page, or link to the provider profile view page.

The link must only appear when `hasProviderProfile === true` — never show it to users without a provider profile.

- [ ] **Verify the link destination renders correctly** — navigate to it in the running app; confirm it doesn't 404.

- [ ] **Build check**

```bash
cd apps/frontend && npm run build 2>&1 | tail -20
```

---

## Task 4: Fix Karma Multipliers — reputation service

**Files:**
- Modify: `services/reputation-service/src/services/karmaAllocation.ts`
- Modify: `services/reputation-service/src/` (match_completed event handler — find with grep)

- [ ] **Find the event handler that calls allocateKarma**

```bash
grep -rn "allocateKarma\|match_completed" services/reputation-service/src/ | head -20
```

- [ ] **Read karmaAllocation.ts** to understand the current signature and CommunityKarmaConfig type

- [ ] **Add requestType parameter to karmaAllocation.ts**

```typescript
// New signature
export function allocateKarma(
  configs: CommunityKarmaConfig[],
  totalPool: number,
  requestType?: string
): CommunityAllocation[]
```

- [ ] **Add multiplier lookup helper in karmaAllocation.ts**

```typescript
function getRequestTypeMultiplier(communityConfig: any, requestType?: string): number {
  if (!requestType || !communityConfig?.enabled_request_types) return 1.0;
  const entry = communityConfig.enabled_request_types.find(
    (t: any) => t.name === requestType
  );
  return entry?.karma_multiplier ?? 1.0;
}
```

- [ ] **Apply multiplier in the allocateKarma function** before distributing the pool

- [ ] **Update the event handler**: when `match_completed` fires, fetch community config (or extract it from the event payload if already present), extract `request_type`, and pass `adjustedPool = basePool * multiplier` to `allocateKarma`.

The community config fetch should reuse an existing query pattern — don't add a new DB query if the config is already available in the event payload.

- [ ] **Build check**

```bash
cd services/reputation-service && npm run build 2>&1 | tail -20
```

---

## Task 5: Fix Request Type Enforcement — request service

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Find the POST /requests handler and the community settings query**

```bash
grep -n "POST\|community_settings\|enabled_request_types\|request_type" services/request-service/src/routes/requests.ts | head -30
```

- [ ] **Extend the existing community settings query** to also fetch `enabled_request_types` from `community.community_configs`

```sql
SELECT
  cs.max_ttl_hours,
  cs.default_scope,
  cc.config->'enabled_request_types' AS enabled_request_types
FROM community.community_settings cs
LEFT JOIN community.community_configs cc ON cc.community_id = cs.community_id
WHERE cs.community_id = $1
```

If no community settings query exists, add a separate query for `community_configs` only.

- [ ] **Add validation after fetching settings** (before INSERT)

```typescript
const enabledTypes = settings?.enabled_request_types;
if (enabledTypes && Array.isArray(enabledTypes) && enabledTypes.length > 0) {
  const allowed = enabledTypes.map((t: any) => t.name);
  if (!allowed.includes(request_type)) {
    return res.status(400).json({
      success: false,
      message: `Request type '${request_type}' is not enabled in this community.`,
      error: 'REQUEST_TYPE_NOT_ENABLED'
    });
  }
}
```

- [ ] **Confirm backward compatibility** — test that a community without `community_configs` row (or with `enabled_request_types: null`) still accepts any request type.

- [ ] **Build check**

```bash
cd services/request-service && npm run build 2>&1 | tail -20
```

---

## Task 6: Community Type Differentiation — BrowseFeed

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx` (if community_type not already passed)

- [ ] **Investigate: is community_type already in dashboard state?**

```bash
grep -n "community_type\|communityType\|community\." apps/frontend/src/pages/dashboard.tsx | head -20
grep -n "community_type\|communityType" apps/frontend/src/components/BrowseFeed.tsx | head -10
```

- [ ] **Pass community_type to BrowseFeed** from dashboard.tsx if not already present

Add to BrowseFeed props:
```typescript
interface BrowseFeedProps {
  // ... existing props
  communityType?: 'mutual_aid' | 'group';
}
```

- [ ] **Add group community banner in BrowseFeed**

When `communityType === 'group'`, render a soft informational banner at the top of the feed:

```tsx
{communityType === 'group' && (
  <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3">
    This is a group community. Use the <strong>Activities</strong> tab for event coordination.
    Help requests from group members appear below.
  </div>
)}
```

- [ ] **Update BrowseFeed empty state** for group communities

When the feed is empty and `communityType === 'group'`, show:
"No requests yet. Group members can post help requests, or check the Activities tab for upcoming events."

Instead of the generic "No requests found."

- [ ] **Build check**

```bash
cd apps/frontend && npm run build 2>&1 | tail -20
```

---

## Task 7: User guides + landing page docs

**Files:**
- Modify: `docs/guides/provider-mode.md`
- Modify: `docs/guides/community-settings.md` (create if missing)
- Modify or create: `docs/guides/community-types.md`

- [ ] **Find existing guide files**

```bash
ls docs/guides/
```

- [ ] **Update provider-mode.md** — add section on withdrawing offers

Add under the "Managing Offers" or "Active Tab" section:
> **Withdrawing an offer**: If you've offered to help but need to step back, open the Active tab and click "Withdraw Offer" on the relevant request. This removes your offer and returns the request to the open pool.

- [ ] **Update or create community-settings.md** — document request type enforcement and karma multipliers

Add two sections:
1. **Enabled Request Types** — if set, only listed types can be posted in this community
2. **Karma Multipliers per Request Type** — multiply the base karma pool for specific request types to incentivize underserved needs

- [ ] **Update or create community-types.md** — explain mutual_aid vs group

Cover:
- mutual_aid: full help request + provider matching + karma flow
- group: Activities tab for coordination; help requests still available for group member needs
- How to choose: mutual_aid for neighborhood/community aid, group for organizations and event-based communities

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Verify landing build**

```bash
cd apps/landing && npm run build 2>&1 | tail -20
```

---

## Task 8: CONTEXT.md + registry.json + TDD tests

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `services/request-service/tests/tdd/sprint-62-platform-coherence.test.ts`
- Create: `apps/frontend/tests/tdd/sprint-62-platform-coherence.test.tsx`

- [ ] **Update request-service CONTEXT.md** — document the two modified endpoints:
  - `PUT /matches/:id/reject` — now accepts both requester and responder
  - `POST /requests` — now validates `request_type` against community config

- [ ] **Update reputation-service CONTEXT.md** — document the karma multiplier change in `karmaAllocation.ts`

- [ ] **Check registry.json** — no new endpoints or events, but update the modified endpoint descriptions if documented there

- [ ] **Write backend TDD tests** — `services/request-service/tests/tdd/sprint-62-platform-coherence.test.ts`

Tests to write:
```typescript
describe('Sprint 62: Withdraw Offer', () => {
  it('allows requester to reject a match', ...)
  it('allows responder to withdraw their offer', ...)
  it('rejects calls from unrelated users', ...)
})

describe('Sprint 62: Request Type Enforcement', () => {
  it('accepts request type when community has no config', ...)
  it('accepts request type when it is in enabled_request_types', ...)
  it('rejects request type when not in enabled_request_types', ...)
  it('accepts request type when enabled_request_types is empty', ...)
})
```

- [ ] **Write karma multiplier TDD tests** — `services/reputation-service/tests/tdd/sprint-62-karma-multipliers.test.ts`

```typescript
describe('Sprint 62: Karma Multipliers', () => {
  it('returns base pool when no request type provided', ...)
  it('returns base pool when community config has no enabled_request_types', ...)
  it('applies multiplier when request type matches config entry', ...)
  it('returns base pool when request type has no multiplier entry', ...)
})
```

- [ ] **Write frontend TDD tests** — `apps/frontend/tests/tdd/sprint-62-platform-coherence.test.tsx`

```typescript
describe('Sprint 62: Community Type in BrowseFeed', () => {
  it('renders without group banner for mutual_aid community', ...)
  it('renders group banner when communityType is group', ...)
  it('shows group-specific empty state for group communities', ...)
})
```

- [ ] **Run TDD tests** — confirm they pass (or document known failures)

```bash
cd services/request-service && npm run test:tdd 2>&1 | tail -30
cd services/reputation-service && npm run test:tdd 2>&1 | tail -30
cd apps/frontend && npm run test:tdd 2>&1 | tail -30
```

---

## Task 9: Type check + pre-push verification

**Files:**
- None (verification only)

- [ ] **TypeScript type check across all modified packages**

```bash
cd services/request-service && npx tsc --noEmit 2>&1 | tail -20
cd services/reputation-service && npx tsc --noEmit 2>&1 | tail -20
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Run unit + regression tests** (must pass)

```bash
npm test 2>&1 | tail -40
```

- [ ] **Run feedback check**

```bash
npm run feedback:check 2>&1 | tail -20
```

- [ ] **Run TDD tests** (informational — pre-existing failures expected)

```bash
npm run test:tdd 2>&1 | tail -30
```

- [ ] **Version bump** — update `package.json` root version to `9.29.0`

```bash
grep -n '"version"' package.json | head -3
```

- [ ] **Commit everything**

```bash
git add services/request-service/src/routes/matches.ts
git add services/request-service/src/routes/requests.ts
git add services/reputation-service/src/services/karmaAllocation.ts
git add apps/frontend/src/components/Layout.tsx
git add apps/frontend/src/components/BrowseFeed.tsx
git add apps/frontend/src/pages/dashboard.tsx
git add services/request-service/CONTEXT.md services/reputation-service/CONTEXT.md
git add services/registry.json
git add docs/guides/
git add apps/landing/src/data/docs/
git add services/request-service/tests/tdd/ services/reputation-service/tests/tdd/
git add apps/frontend/tests/tdd/
git add package.json
git add claude.md
git commit -m "feat(sprint-62): platform coherence — withdraw offer fix, karma multipliers, request type enforcement, community type differentiation, provider re-entry"
```

---

## Task 10: Merge + Deploy

- [ ] **Use the `/deploy` skill to merge and deploy**

```
/deploy
```

This skill handles:
1. Merge `feature/sprint-62-platform-coherence` to `master`
2. Push to origin (triggers GitHub Actions)
3. Monitor CI/CD
4. SSH if any migration scripts are needed (none expected this sprint)
5. Verify health at karmyq.com

- [ ] **Post-deploy verification** — navigate to karmyq.com and manually test:
  - Active tab → "Withdraw Offer" button works without 403
  - Create a request in a community with restricted request types → blocked with clear error
  - Provider navigation shows "Manage profile" link for provider users
  - Browse feed in a group community shows the group banner
