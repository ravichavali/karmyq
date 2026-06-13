# Release Readiness Data Quality + Functional Bug Bash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Run `/simplify` after each implementation task.

**Goal:** Make the release demo path truthful and stable by auditing live/demo data quality, fixing
the highest-risk first-run bugs, documenting a rich tester account, and validating the full
signup-to-help flow before v11.6.0 deploy.

**Architecture:** Sprint 97 is audit-first. It adds repeatable demo data-quality checks, then fixes
frontend loading/terminal-state bugs and a request-service community pulse query bug without adding
new product surfaces. Demo data repair, if needed, is idempotent SQL rather than manual DB poking.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/bugs/sprint-97-release-readiness.md` | Audit findings, triage decisions, fixed/deferred bug list, and tester-account evidence. |
| `scripts/audit-demo-data.sql` | Repeatable SQL checks for demo data quality: membership counts, pulse helper membership, request/community links, provider readiness, tester ranking. |
| `tests/tdd/sprint-97-dashboard-community-load.test.tsx` | TDD/regression coverage for the dashboard not showing a false zero-community state during membership load. |
| `tests/tdd/sprint-97-feed-terminal-state.test.tsx` | TDD/regression coverage for the feed terminal note after "Show more open requests." |
| `services/request-service/tests/tdd/sprint-97-community-pulse.test.ts` | TDD coverage for excluding non-member helpers from community pulse helper names. |
| `infrastructure/postgres/migrations/20260613-demo-data-quality-repair.sql` | Optional, only if audit finds release-blocking demo data drift that needs an idempotent DB repair. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Keep membership-loading separate from auth loading; prevent false no-community state before `getMyCommunities` resolves. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Render a clear finite terminal note after the widened `minScore=0` feed. |
| `services/request-service/src/routes/requests.ts` | Scope `fetchCommunityPulse` recent helper names to active members of the pulse community. |
| `docs/guides/getting-started-guide.md` | Add/tighten release-demo walkthrough. |
| `docs/guides/demo-data.md` | Document tester account and data-quality audit checklist. |
| `docs/guides/dashboard-home.md` | Document the widened feed terminal state. |
| `docs/guides/finding-communities-guide.md` | Clarify membership loading/no-community state behavior. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update feed/community onboarding copy if the final copy changes user guidance. |
| `services/request-service/CONTEXT.md` | Document the community pulse helper-membership fix under Recent Fixes. |
| `apps/frontend/CONTEXT.md` | Document dashboard bootstrap and feed terminal-state fixes. |
| `services/registry.json` | Update only if endpoint behavior descriptions need clarification; no new endpoint planned. |
| `apps/landing/src/data/docs/*` | Generated docs output after source guide updates; force-add changed generated JSON. |
| `package.json`, `package-lock.json` | Version bump `11.5.0` -> `11.6.0`. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Mark Sprint 97 execution status and next steps throughout implementation. |

---

## Critical Implementation Notes

1. **Audit first.** Do not jump straight into the three known fixes before running the release
   data-quality queries; the point of Sprint 97 is to find launch-risk bugs, not only fix the
   examples already noticed.
2. **No founding-circle admin screen in this sprint.** Direct DB queries are sufficient for release
   week; keep this sprint on data quality and functional demo bugs.
3. **Tester account:** use `maria.reyes@test.karmyq.com` / `password123` as the primary rich-state
   tester unless the audit finds it broken. Keep `aisha.white6964@test.karmyq.com` / `password123`
   as a simpler member-only fallback.
4. **Dashboard bug is a loading-state bug until proven otherwise.** Fix the false empty state at
   the frontend state boundary; do not paper over it with a timeout.
5. **Pulse helper names must not lie.** Prefer joining `communities.members` on
   `m.responder_id = members.user_id`, `members.community_id = $1`, `members.status='active'`.
6. **Data repairs must be idempotent.** If demo data needs repair, write SQL that can run twice
   safely and document exactly what it changes.
7. **Do not hand-edit generated landing docs.** Update `docs/guides/*` and `scripts/generate-docs.ts`
   if needed; generated `apps/landing/src/data/docs/*` is wiped by the generator and must be
   committed with `git add -f` when changed.
8. **Robust tests are required.** Cover the actual bug conditions: async dashboard community load,
   non-member helper excluded from pulse, and widened feed terminal copy.
9. **Use live demo validation at the end.** The human checklist must hit API, DB, and UI on
   `karmyq.com` after deploy.
10. **Version bump:** root `package.json` and `package-lock.json` move `11.5.0` -> `11.6.0`.

---

## Task 1: Branch, audit log, and live data-quality script

**Files:**
- Create: `docs/bugs/sprint-97-release-readiness.md`
- Create: `scripts/audit-demo-data.sql`

- [ ] Create the feature branch from current `master`.

```bash
git checkout -b feature/sprint-97-release-readiness-data-quality
```

- [ ] Create `docs/bugs/sprint-97-release-readiness.md` with this starting structure:

```markdown
# Sprint 97 Release Readiness Bug Log

**Date opened:** 2026-06-13
**Release target:** v11.6.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`
**Fallback tester:** `aisha.white6964@test.karmyq.com` / `password123`

## Release-Critical Flow Checklist

- [ ] Signup/login
- [ ] Join existing community
- [ ] Create community
- [ ] Dashboard membership bootstrap
- [ ] Create request
- [ ] Browse feed + Show more terminal state
- [ ] Dibs/matching
- [ ] Provider offers
- [ ] Community Home/People/Connected/Stewardship
- [ ] karmyq.org -> karmyq.com/docs handoff

## Findings

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| BUG-097-001 | High | Dashboard | False no-community state before memberships finish loading. | Fix |
| BUG-097-002 | High | Community pulse | Recent helper names can include non-members of the displayed community. | Fix |
| BUG-097-003 | Medium | Feed | Widened feed lacks clear terminal copy. | Fix |

## Tester Account Evidence

`maria.reyes@test.karmyq.com`: 15 active communities, 28 trust edges, 33 connections, 19 created
requests, 418 responder matches, 704 requester-side matches, 4 provider profiles, provider
availability true.
```

- [ ] Create `scripts/audit-demo-data.sql`:

```sql
\echo '1. Communities where current_members differs from active member rows'
SELECT
  c.id,
  c.name,
  c.current_members,
  COUNT(m.id) FILTER (WHERE m.status = 'active') AS active_member_rows
FROM communities.communities c
LEFT JOIN communities.members m ON m.community_id = c.id
GROUP BY c.id, c.name, c.current_members
HAVING c.current_members IS DISTINCT FROM COUNT(m.id) FILTER (WHERE m.status = 'active')
ORDER BY ABS(c.current_members - COUNT(m.id) FILTER (WHERE m.status = 'active')) DESC;

\echo '2. Recent pulse helpers who are not active members of the pulse community'
SELECT
  rc.community_id,
  c.name AS community_name,
  u.name AS helper_name,
  u.email AS helper_email,
  COUNT(*) AS completed_matches_in_window
FROM requests.matches match
JOIN requests.request_communities rc ON match.request_id = rc.request_id
JOIN communities.communities c ON c.id = rc.community_id
JOIN auth.users u ON u.id = match.responder_id
LEFT JOIN communities.members member
  ON member.community_id = rc.community_id
 AND member.user_id = match.responder_id
 AND member.status = 'active'
WHERE match.status = 'completed'
  AND match.completed_at >= NOW() - INTERVAL '7 days'
  AND member.id IS NULL
GROUP BY rc.community_id, c.name, u.name, u.email
ORDER BY completed_matches_in_window DESC, c.name, u.name;

\echo '3. Open requests without an active request_communities community'
SELECT
  hr.id,
  hr.title,
  hr.requester_id,
  hr.status,
  COUNT(rc.community_id) AS linked_communities
FROM requests.help_requests hr
LEFT JOIN requests.request_communities rc ON rc.request_id = hr.id
LEFT JOIN communities.communities c ON c.id = rc.community_id AND c.status = 'active'
WHERE hr.status = 'open'
  AND hr.expired = FALSE
GROUP BY hr.id, hr.title, hr.requester_id, hr.status
HAVING COUNT(c.id) = 0
ORDER BY hr.created_at DESC;

\echo '4. Rich tester ranking'
WITH member_counts AS (
  SELECT user_id, COUNT(DISTINCT community_id) AS active_communities
  FROM communities.members
  WHERE status = 'active'
  GROUP BY user_id
),
trust_counts AS (
  SELECT user_id, COUNT(*) AS trust_edges, ROUND(SUM(raw_weight)::numeric, 2) AS trust_weight
  FROM (
    SELECT user_id_a AS user_id, raw_weight FROM social_graph.trust_edges
    UNION ALL
    SELECT user_id_b AS user_id, raw_weight FROM social_graph.trust_edges
  ) edges
  GROUP BY user_id
),
connection_counts AS (
  SELECT user_id, COUNT(*) AS connections
  FROM (
    SELECT user_a_id AS user_id FROM social_graph.connections
    UNION ALL
    SELECT user_b_id AS user_id FROM social_graph.connections
  ) connections
  GROUP BY user_id
),
request_counts AS (
  SELECT requester_id AS user_id, COUNT(*) AS requests_created
  FROM requests.help_requests
  GROUP BY requester_id
),
responder_counts AS (
  SELECT responder_id AS user_id, COUNT(*) AS responder_matches
  FROM requests.matches
  GROUP BY responder_id
),
requester_match_counts AS (
  SELECT hr.requester_id AS user_id, COUNT(m.id) AS requester_matches
  FROM requests.help_requests hr
  JOIN requests.matches m ON m.request_id = hr.id
  GROUP BY hr.requester_id
),
profile_counts AS (
  SELECT user_id, COUNT(*) FILTER (WHERE is_active) AS provider_profiles, BOOL_OR(is_available) AS provider_available
  FROM requests.provider_profiles
  GROUP BY user_id
)
SELECT
  u.name,
  u.email,
  COALESCE(mc.active_communities, 0) AS active_communities,
  COALESCE(tc.trust_edges, 0) AS trust_edges,
  COALESCE(tc.trust_weight, 0) AS trust_weight,
  COALESCE(cc.connections, 0) AS connections,
  COALESCE(rc.requests_created, 0) AS requests_created,
  COALESCE(rsc.responder_matches, 0) AS responder_matches,
  COALESCE(rqc.requester_matches, 0) AS requester_matches,
  COALESCE(pc.provider_profiles, 0) AS provider_profiles,
  COALESCE(pc.provider_available, false) AS provider_available
FROM auth.users u
LEFT JOIN member_counts mc ON mc.user_id = u.id
LEFT JOIN trust_counts tc ON tc.user_id = u.id
LEFT JOIN connection_counts cc ON cc.user_id = u.id
LEFT JOIN request_counts rc ON rc.user_id = u.id
LEFT JOIN responder_counts rsc ON rsc.user_id = u.id
LEFT JOIN requester_match_counts rqc ON rqc.user_id = u.id
LEFT JOIN profile_counts pc ON pc.user_id = u.id
WHERE u.email LIKE '%@test.karmyq.com'
ORDER BY (
  COALESCE(mc.active_communities, 0) * 10
  + COALESCE(tc.trust_edges, 0) * 2
  + COALESCE(cc.connections, 0) * 2
  + (COALESCE(rsc.responder_matches, 0) + COALESCE(rqc.requester_matches, 0)) * 3
  + COALESCE(rc.requests_created, 0)
  + COALESCE(pc.provider_profiles, 0) * 8
) DESC
LIMIT 10;
```

- [ ] Run it against the live demo DB and paste summary findings into the bug log.

```bash
scp scripts/audit-demo-data.sql ubuntu@karmyq.com:/tmp/audit-demo-data.sql
ssh ubuntu@karmyq.com "docker cp /tmp/audit-demo-data.sql karmyq-postgres:/tmp/audit-demo-data.sql && docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f /tmp/audit-demo-data.sql'"
```

- [ ] Run `/simplify` on the audit script and bug log before moving on.

---

## Task 2: TDD - dashboard must not flash false no-community state

**Files:**
- Create: `tests/tdd/sprint-97-dashboard-community-load.test.tsx`
- Implementation target: `apps/frontend/src/pages/dashboard.tsx`

- [ ] Write a failing test that mocks a logged-in user and a delayed `communityService.getMyCommunities`
  promise. Assert the zero-community heading is not rendered while the promise is unresolved.

```tsx
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../../apps/frontend/src/pages/dashboard';
import { communityService } from '../../apps/frontend/src/lib/api';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), isReady: true, query: {} }),
}));

jest.mock('../../apps/frontend/src/lib/api', () => ({
  communityService: { getMyCommunities: jest.fn() },
}));

jest.mock('../../apps/frontend/src/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, providerServiceTypes: [] }),
}));

jest.mock('../../apps/frontend/src/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}));

jest.mock('../../apps/frontend/src/components/Feed/UnifiedFeed', () => () => <div data-testid="feed" />);
jest.mock('../../apps/frontend/src/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('../../apps/frontend/src/components/WelcomeModal', () => () => null);
jest.mock('../../apps/frontend/src/components/SpeedDialFab', () => () => null);
jest.mock('../../apps/frontend/src/components/RequestWizard', () => () => null);
jest.mock('../../apps/frontend/src/components/OnboardingOverlay', () => () => null);

describe('Sprint 97 dashboard community loading', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Maria' }));
  });

  it('keeps loading instead of showing no-community state while memberships are still loading', async () => {
    let resolveCommunities!: (value: any) => void;
    (communityService.getMyCommunities as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveCommunities = resolve;
      })
    );

    render(<Dashboard />);

    expect(screen.queryByText("You haven't joined a community yet")).not.toBeInTheDocument();
    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();

    resolveCommunities({ data: { communities: [{ id: 'c1', name: 'Berkeley Community Care' }] } });

    await waitFor(() => expect(screen.getByTestId('feed')).toBeInTheDocument());
    expect(screen.queryByText("You haven't joined a community yet")).not.toBeInTheDocument();
  });
});
```

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd tests
npx jest tdd/sprint-97-dashboard-community-load.test.tsx --runInBand
```

- [ ] Run `/simplify` before implementing the fix.

---

## Task 3: Fix dashboard membership bootstrap

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Test: `tests/tdd/sprint-97-dashboard-community-load.test.tsx`
- Documentation target: `apps/frontend/CONTEXT.md`

- [ ] In `dashboard.tsx`, introduce an explicit membership loading state or keep `loading=true`
  until `fetchCommunities` resolves. The simplest safe pattern:

```tsx
const [authReady, setAuthReady] = useState(false)
const [communitiesLoading, setCommunitiesLoading] = useState(false)

const fetchCommunities = async (userId: string) => {
  try {
    setCommunitiesLoading(true)
    setCommunityLoadError(null)
    const communitiesRes = await communityService.getMyCommunities(userId)
    setUserCommunities(communitiesRes?.data?.communities || [])
  } catch (err) {
    setCommunityLoadError('We could not load your communities. You can retry now.')
    console.error('Failed to load communities', { error: err instanceof Error ? err.message : String(err) })
  } finally {
    setCommunitiesLoading(false)
  }
}
```

- [ ] Ensure the first `useEffect` sets `authReady=true` only after auth storage has been parsed or
  the redirect path has completed. Do not set a render-ready state immediately after calling
  `fetchCommunities`.

- [ ] Replace `if (!user || loading)` with a condition that includes membership loading:

```tsx
if (!user || !authReady || communitiesLoading) {
  return <LoadingDashboard />
}
```

Keep the loading JSX inline if no existing `LoadingDashboard` component exists; do not add a
component unless it makes the code clearer.

- [ ] Ensure the zero-community block is gated by:

```tsx
!communitiesLoading && !communityLoadError && userCommunities.length === 0
```

- [ ] Run the focused dashboard test.

```bash
cd tests
npx jest tdd/sprint-97-dashboard-community-load.test.tsx --runInBand
```

- [ ] Run relevant frontend unit tests.

```bash
npm run test:unit
```

- [ ] Run `/simplify` on the dashboard diff.

---

## Task 4: TDD - community pulse excludes non-member helpers

**Files:**
- Create: `services/request-service/tests/tdd/sprint-97-community-pulse.test.ts`
- Implementation target: `services/request-service/src/routes/requests.ts`

- [ ] Write a test around the query behavior. Prefer extracting `fetchCommunityPulse` to an
  exported helper module if direct route testing is too heavy. The test data must include:
  - community A
  - a completed match attached to community A
  - responder user active in community B but not community A
  - an active community A helper
  - expected pulse only names the active community A helper

Example assertion shape:

```ts
expect(pulse?.recentHelpers).toEqual([{ name: 'David Park', count: 1 }]);
expect(pulse?.recentHelpers.map((h) => h.name)).not.toContain('Chen Johansson');
```

- [ ] If using mocked DB rows, assert the generated SQL contains the membership join:

```ts
expect(executedSql).toContain('JOIN communities.members');
expect(executedSql).toContain('member.status');
```

Prefer a real DB-backed service-local test if the request-service test harness already supports it.

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd services/request-service
npm run test:tdd -- sprint-97-community-pulse.test.ts
```

- [ ] Run `/simplify` before implementing the fix.

---

## Task 5: Fix community pulse recent-helper membership scope

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`
- Test: `services/request-service/tests/tdd/sprint-97-community-pulse.test.ts`
- Documentation target: `services/request-service/CONTEXT.md`

- [ ] Update the recent helpers query inside `fetchCommunityPulse(communityId)`:

```sql
SELECT u.name, COUNT(*)::int AS help_count
  FROM requests.matches m
  JOIN requests.request_communities rc ON m.request_id = rc.request_id
  JOIN communities.members member
    ON member.community_id = rc.community_id
   AND member.user_id = m.responder_id
   AND member.status = 'active'
  JOIN auth.users u ON m.responder_id = u.id
  WHERE rc.community_id = $1 AND m.status = 'completed'
    AND m.completed_at >= NOW() - INTERVAL '7 days'
  GROUP BY u.name
  ORDER BY help_count DESC
  LIMIT 3
```

- [ ] Consider whether `helpedThisWeek` should count all completed exchanges attached to the
  community, or only exchanges with active member helpers. For release, leave the count unchanged
  unless it also creates visible falsehood; fix the named helper list first.

- [ ] Run the focused pulse test.

```bash
cd services/request-service
npm run test:tdd -- sprint-97-community-pulse.test.ts
```

- [ ] Run request-service unit/regression tests.

```bash
cd services/request-service
npm test
```

- [ ] Run `/simplify` on the request-service diff.

---

## Task 6: TDD - feed terminal state after showing more

**Files:**
- Create: `tests/tdd/sprint-97-feed-terminal-state.test.tsx`
- Implementation target: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`

- [ ] Write a failing test that mocks two sequential feed responses:
  - first response: one request item
  - after clicking "Show more open requests": same rendered request list and no additional items
  - expected: bottom note says "That's everyone for now" or equivalent finite copy

Example assertion shape:

```tsx
expect(screen.queryByText(/that's everyone/i)).not.toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /show more open requests/i }));
expect(await screen.findByText(/that's everyone/i)).toBeInTheDocument();
```

- [ ] Run the focused test and confirm it fails before implementation.

```bash
cd tests
npx jest tdd/sprint-97-feed-terminal-state.test.tsx --runInBand
```

- [ ] Run `/simplify` before implementing the fix.

---

## Task 7: Fix widened feed terminal copy

**Files:**
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Test: `tests/tdd/sprint-97-feed-terminal-state.test.tsx`
- Documentation target: `docs/guides/dashboard-home.md`, `apps/frontend/CONTEXT.md`

- [ ] Add a terminal note rendered after request cards only when:
  - `showingMoreOpen === true`
  - loading/error are false
  - no type or urgency filter is active
  - `noCommunities` is false

Suggested copy:

```tsx
{showingMoreOpen && activeType === 'all' && activeUrgency === 'all' && !noCommunities && (
  <div className="kq-finite-state py-6 text-center text-sm text-text-subtle">
    That's everyone for now. We'll let you know when a neighbour needs you.
  </div>
)}
```

- [ ] Keep the existing empty-state copy for the case where widened feed returns zero request cards.

- [ ] Run the focused feed test.

```bash
cd tests
npx jest tdd/sprint-97-feed-terminal-state.test.tsx --runInBand
```

- [ ] Run relevant frontend tests.

```bash
npm run test:unit
```

- [ ] Run `/simplify` on the feed diff.

---

## Task 8: Data repair, if audit requires it

**Files:**
- Optional create: `infrastructure/postgres/migrations/20260613-demo-data-quality-repair.sql`
- Modify: `docs/bugs/sprint-97-release-readiness.md`

- [ ] If Task 1 finds membership count drift, create an idempotent repair migration:

```sql
-- 20260613-demo-data-quality-repair.sql
UPDATE communities.communities c
SET current_members = counts.active_count
FROM (
  SELECT community_id, COUNT(*)::int AS active_count
  FROM communities.members
  WHERE status = 'active'
  GROUP BY community_id
) counts
WHERE counts.community_id = c.id
  AND c.current_members IS DISTINCT FROM counts.active_count;

UPDATE communities.communities c
SET current_members = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM communities.members m
  WHERE m.community_id = c.id
    AND m.status = 'active'
)
AND c.current_members IS DISTINCT FROM 0;
```

- [ ] If no release-blocking data repair is needed, do not create the migration. Instead record
  "No DB repair migration required" in the bug log with the audit output summary.

- [ ] If a migration is created, run it on a local/demo DB and re-run `scripts/audit-demo-data.sql`.

- [ ] Run `/simplify` on the data repair/bug-log diff.

---

## Task 9: Docs, guide updates, generated landing docs

**Files:**
- Modify: `docs/guides/getting-started-guide.md`
- Modify: `docs/guides/demo-data.md`
- Modify: `docs/guides/dashboard-home.md`
- Modify: `docs/guides/finding-communities-guide.md`
- Optional modify: `apps/frontend/src/lib/onboarding/workflows.ts`
- Generated modify: `apps/landing/src/data/docs/*`

- [ ] Update `docs/guides/demo-data.md` with:
  - `maria.reyes@test.karmyq.com` / `password123`
  - evidence counts from the live query
  - fallback `aisha.white6964@test.karmyq.com` / `password123`
  - how to run `scripts/audit-demo-data.sql`

- [ ] Update `docs/guides/getting-started-guide.md` with a compact release-demo path:
  login/register -> join/create community -> create ask -> browse/respond -> open community page.

- [ ] Update `docs/guides/dashboard-home.md` with the "Show more open requests" terminal state.

- [ ] Update `docs/guides/finding-communities-guide.md` so it matches the fixed dashboard
  no-community behavior.

- [ ] Update onboarding workflow copy only if the changed copy would otherwise contradict the
  product guidance.

- [ ] Regenerate landing docs using the existing pipeline.

```bash
npm run build --workspace apps/landing
```

- [ ] Force-add changed generated docs.

```bash
git add -f apps/landing/src/data/docs
```

- [ ] Run `/simplify` on docs/onboarding copy.

---

## Task 10: CONTEXT, registry check, and version bump

**Files:**
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Optional modify: `services/registry.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Add `apps/frontend/CONTEXT.md` Recent Changes entry for Sprint 97:
  dashboard membership bootstrap no longer shows false zero-community state; UnifiedFeed shows
  finite terminal copy after widening.

- [ ] Add `services/request-service/CONTEXT.md` Recent Fixes entry for Sprint 97:
  community pulse recent helper names are scoped to active community membership.

- [ ] Check whether `services/registry.json` endpoint descriptions need a behavior clarification.
  If no endpoint list changes, leave it untouched.

- [ ] Bump root `package.json` version `11.5.0` -> `11.6.0`.

- [ ] Bump root `package-lock.json` root version `11.5.0` -> `11.6.0` in place.

- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md` with implementation progress and any new
  findings from the audit.

- [ ] Run feedback loop check.

```bash
npm run feedback:check
```

- [ ] Run `/simplify` on docs/version changes.

---

## Task 11: SDLC quality gates

**Files:**
- Entire branch diff.

- [ ] Run final `/simplify` on the whole diff. Resolve simplification findings or record why a
  finding is intentionally left.

```bash
git diff --stat
```

- [ ] Run `/code-review` on the branch diff. Fix correctness, race, data-integrity, and missing-test
  findings before proceeding.

```bash
git diff -- apps/frontend services/request-service tests docs scripts infrastructure
```

- [ ] Run `/security-review` on the branch diff. Resolve real findings. Record false positives with
  justification in the PR body Security dismissals section.

```bash
npm audit --package-lock-only --audit-level=high
```

- [ ] Run the Sprint 97 root TDD tests directly instead of trusting Turbo cache.

```bash
cd tests
npx jest tdd/sprint-97-dashboard-community-load.test.tsx tdd/sprint-97-feed-terminal-state.test.tsx --runInBand
```

---

## Task 12: Final verification

**Files:**
- Entire branch.

- [ ] Type-check the frontend and changed services.

```bash
npx tsc --noEmit
```

- [ ] Run unit + regression suite.

```bash
npm test
```

- [ ] Run TDD suite.

```bash
npm run test:tdd
```

- [ ] Run feedback and docs checks.

```bash
npm run feedback:check
```

- [ ] Run service analysis if `services/registry.json` or service dependencies changed.

```bash
npm run analyze:services
```

- [ ] Run landing build/export if docs generated output or landing handoff was touched.

```bash
npm run build --workspace apps/landing
```

- [ ] Update the bug log with final fixed/deferred status.

---

## Task 13: Merge + Deploy

**Files:**
- PR body: `.github/pull_request_template.md`
- Handoff: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Create a PR from `feature/sprint-97-release-readiness-data-quality` to `master`.
  `gh pr create` does not auto-apply the template, so copy `.github/pull_request_template.md`
  into the PR body and fill every section.

- [ ] Complete cross-agent review, `/code-review`, and `/security-review` per the PR contract.

- [ ] After Admin authorization, merge to `master` and push. CI/CD is the primary deploy path.

- [ ] Monitor GitHub Actions until the v11.6.0 deploy is green.

- [ ] If a DB repair migration was created, confirm the deploy/migration path applied it or run the
  approved one-time migration on the demo server, then re-run `scripts/audit-demo-data.sql`.

---

## Task 14: Sprint 97 Post-Deploy Validation (Human Checklist)

### 1. Tester account login (2 min)

Open `https://karmyq.com/login` and sign in:

```text
maria.reyes@test.karmyq.com / password123
```

Expected: dashboard loads without the false "You haven't joined a community yet" empty state.

### 2. Community pulse check (2 min)

Open:

```text
https://karmyq.com/communities/12dbd705-8c7a-4ba8-a8d2-fcf1aee4e27f
```

Expected: the pulse does not name `Chen Johansson` unless he is now an active member of that exact
community. People tab remains internally consistent with the pulse.

### 3. Feed terminal check (2 min)

On Dashboard Home, click **Show more open requests**.

Expected: after the widened feed renders, the bottom of the feed clearly says there are no more
open asks/that everyone is shown.

### 4. API smoke (2 min)

```bash
curl -H "Authorization: Bearer $TOKEN" "https://karmyq.com/api/requests/community/12dbd705-8c7a-4ba8-a8d2-fcf1aee4e27f/pulse" | jq '.data.recentHelpers'
```

Expected: all returned helper names are active members of that community.

### 5. DB audit (3 min)

```bash
ssh ubuntu@karmyq.com "docker cp /tmp/audit-demo-data.sql karmyq-postgres:/tmp/audit-demo-data.sql && docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f /tmp/audit-demo-data.sql'"
```

Expected: no release-blocking rows remain in membership-count drift or pulse-helper nonmember
sections; any intentional leftovers are recorded in `docs/bugs/sprint-97-release-readiness.md`.
