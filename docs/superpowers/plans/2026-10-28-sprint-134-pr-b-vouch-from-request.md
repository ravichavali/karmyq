# Vouch from a Completed Exchange (Sprint 134 PR B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A participant who opens a completed ask, usually from the completion notification, sees each partner from
that exchange and can rate it and vouch for the partner's skills right there. Partner status and vouch eligibility
come only from the server.

**Architecture:** `GET /requests/:id` gains a viewer-scoped `viewer_partners` projection: a scalar subquery inside the
existing `requestReadableSql`-guarded statement, filtered per exchange by `matchParticipantSql`. The request page renders
a new `CompletedExchangePanel` in its action zone. The panel reuses `RatingPrompt`/`submitExchangeRating` and
`MemberSkills`, which gets an `endorsableOnly` mode that filters on the server's `can_endorse`/`endorsed_by_me` flags.
The `match_completed` notification copy changes to match. No new event, queue, table or migration.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-10-28-sprint-134-pr-b-vouch-from-request-design.md`](../specs/2026-10-28-sprint-134-pr-b-vouch-from-request-design.md)
(exposure matrix, layout decision, reference products).

**Branch:** `agent/claude/sprint-134-pr-b-vouch-from-request` (exists; first commits are the #322 post-merge record,
BUG-074 and these planning docs). **Version:** 11.103.0 → **11.104.0**, provisional; re-derive at merge.

**Stopping point (standing rule, 2026-10-22):** run all gates, push the handoff marking the PR "open, awaiting maintainer
merge", open the PR, report the link and **stop**. No CI watch, no merge ask, no post-merge work in the executing chat.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-134-pr-b-viewer-partners.test.ts` | Mocked route tests: exact SQL fragments of the partner subquery; `viewer_partners` defaults to `[]`; wire shape |
| `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts` | Real-SQL exposure matrix over HTTP, plus the cross-service proof that a listed partner's skill is endorsable and the panel's rating payload is accepted (CI-only) |
| `apps/frontend/src/components/requests/CompletedExchangePanel.tsx` | One block per completed exchange: partner sentence, rating prompt, endorsable skills |
| `apps/frontend/tests/tdd/sprint-134-pr-b-completed-exchange.test.tsx` | UI coverage-table tests for MemberSkills `endorsableOnly`, the panel and the page wiring |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` (detail route, ~1595-1687) | `viewer_partners` scalar subquery in the SELECT list; strip and default it in the response |
| `apps/frontend/src/components/skills/MemberSkills.tsx` | Optional `endorsableOnly` and `heading` props; default behaviour unchanged |
| `apps/frontend/src/pages/requests/[id].tsx` | `viewer_partners` on `RequestDetail`; render the panel in the action zone |
| `services/notification-service/src/templates/notificationTemplates.ts:78-87` | `match_completed` title, body and CTA copy |
| `apps/frontend/src/components/NotificationItem.tsx:89-90` | `match_completed` CTA "Rate Helper" → "Rate & vouch" |
| `services/notification-service/tests/regression/notificationTemplates.test.ts` | Assert the new copy exactly |
| `docs/adr/ADR-100-skill-visibility-and-endorsements.md` | Amendment section (no new number) |
| `docs/guides/profile-guide.md`, `match-lifecycle.md`, `fulfilling-requests-guide.md`, `managing-commitments-guide.md` | Request page as the close-out surface |
| `docs/concepts/skill-endorsements.md` | Where to vouch; partner-exposure rule |
| `apps/frontend/src/lib/onboarding/workflows.ts:25` | Vouching sentence |
| `services/request-service/CONTEXT.md`, `services/notification-service/CONTEXT.md`, `services/registry.json` | Endpoint field, copy, registry description |
| `docs/IDEAS.md` | 2026-10-13 "Vouch from the request page" → done in Sprint 134 PR B |
| `package.json`, `package-lock.json` | Root version occurrences only |
| `.claude/handoff/CURRENT_HANDOFF.md` | PR B state at every stopping point |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Partner status is per exchange, not per read.** The partner subquery filters `pm.status = 'completed'` AND
   `matchParticipantSql('r', 'pm', '$2')` (`services/request-service/src/db/directedAudience.ts:20`). Partner is
   `CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END`. Never derive it from
   `requestReadableSql`. That grants reads to historical helpers and the preferred provider, who are **not** partners.
2. **Keep it inside the existing guarded statement.** Add `viewer_partners` as a scalar subquery in the SELECT list of
   the detail query (`requests.ts:1615-1650`), so it needs no GROUP BY change: it references only grouped `r.id` and
   `r.requester_id`. It reads `requests.matches`, `auth.users`, `feedback.feedback` and `requests.request_communities`,
   not `requests.help_requests`, so the directed-surface scanner sees no new read. Run its gate:
   `services/request-service/tests/regression/sprint-132-directed-audience-gate.test.ts`.
3. **`$2` stays uuid-only.** Every new use of `$2` compares it with a uuid column. A text cast or a `$2 IS NULL` test
   can raise "inconsistent types deduced for parameter $2" (the L2 CI failure). A NULL viewer already yields no rows
   through `=`.
4. **`rated_by_me` mirrors the dashboard's rate decision** (`requests.ts:1053-1056`). `feedback.feedback` has RLS
   ENABLEd without FORCE and a `community_isolation` policy (init.sql:6691, 6697), as `requests.matches` does. Both run
   behind the same `dbContextMiddleware` (`services/request-service/src/index.ts:128-135`). CI's real-SQL test is the
   arbiter. The demo role's RLS bypass is **UNVERIFIED** (it would need a demo-host read).
5. **No client eligibility.** The vouch row filters only on `can_endorse`/`endorsed_by_me` from
   `GET /auth/skills/users/:userId` (`services/auth-service/src/routes/skills.ts:14-40`). That route uses the same
   `completedPairSql` + `skillVisibleToSql` as `POST /endorsements` (`skills.ts:96-107`). A 404, an error or no
   endorsable skill renders nothing.
6. **Vouch attribution is unchanged (ADR-100):** the most recent completed match of the pair, possibly another request.
   Do not add a `match_id` input to `POST /endorsements`.
7. **The rating write is unchanged.** `POST /reputation/feedback` validates participant, counterparty, completed status
   and community (`services/reputation-service/src/routes/reputation.ts:347-370`). The panel sends `{ match_id,
   to_user_id: partner.user_id, community_id: rating_community_id, rating }` via `submitExchangeRating`
   (`apps/frontend/src/utils/completion.ts`), which is best-effort. A null `rating_community_id` hides the prompt.
8. **Ratings stay private (ADR-036).** Expose only whether the viewer rated.
9. **Several completed matches exist (BUG-074)**, possibly the same partner twice. Rate per match; vouch once per
   distinct partner (the newest entry). Do not fix BUG-074 here.
10. **The existing page tests mock `@/lib/api` with `requestService` only**
    (`apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx:23-33`, plus the sprint-116/132 regression page
    tests). The panel must not render, and must not call `skillsService`/`reputationService`, when `viewer_partners`
    is absent or empty.
11. **Frontend Jest clears nothing between tests**: `mockReset` in `beforeEach` (`sprint-133-vouch.test.tsx:19-21`).
    The API client already unwraps the envelope (`res.data`).
12. **No JWT claim reads** (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`). Use `req.user.userId` only.
13. **Real SQL is CI-only here.** CI's integration job starts auth, reputation, request and the rest
    (`.github/workflows/ci.yml:306`). Follow `tests/integration/sprint-133-request-detail-visibility.integration.test.ts`
    and `tests/integration/sprint-133-endorsement-trust.integration.test.ts`. Use explicit `::varchar` casts on
    parameters compared with `requests.matches.status` (L2 lesson). Check every fixture column against `init.sql`
    (`requests.provider_profiles` needs `user_id`, `service_type`, `display_name`: init.sql:2570-2580).
14. **Version** re-derived at merge; root version occurrences only; no dependency change.
15. **`npm test` regenerates `apps/landing/src/data/docs/`**: revert timestamp and HEAD-sha churn before committing.
16. **The TDD promoter sweeps every green `tdd/` file repo-wide**: restore unrelated promotions to keep the PR scoped.
    Run a single Jest file with `--runTestsByPath` or `--testPathPatterns` (plural, Jest 30).
17. **Ask before**: any merge ("admin merge, yes/no?"), any demo-host operation, any CodeQL dismissal. PR B needs no
    ADR number (ADR-100 amendment). It should not touch `apps/frontend/src/lib/api.ts`. If it does, expect the
    `js/request-forgery` re-raise after merge.

---

## Task 1: Baseline and version

**Files:** Modify: `package.json`, `package-lock.json` (root version occurrences only)

- [ ] Confirm branch and base: `git status -sb` (clean, on `agent/claude/sprint-134-pr-b-vouch-from-request`),
  `git fetch origin`, `git log --oneline origin/master -1`. If master moved past `4ee38e82`, merge `origin/master` in
  (merge commit, never rebase).
- [ ] Bump the root version 11.103.0 → 11.104.0, provisional. Edit only the root `version` in `package.json` and the
  root-package occurrences in `package-lock.json`; confirm with `git diff --stat`.
- [ ] Baseline the suites you will touch:

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-133-request-detail-visibility.test.ts tests/regression/sprint-132-directed-audience-gate.test.ts
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/regression/sprint-133-vouch.test.tsx tests/tdd/sprint-101-request-detail-action.test.tsx
npm exec --workspace=services/notification-service -- jest --runTestsByPath tests/regression/notificationTemplates.test.ts
```

Expected: all green before any change.

---

## Task 2: Request-service TDD tests (red)

**Files:** Create: `services/request-service/tests/tdd/sprint-134-pr-b-viewer-partners.test.ts`

Mirror the harness in `services/request-service/tests/regression/sprint-133-request-detail-visibility.test.ts:1-60`
(mocked `database/db`, an express app that injects `req.user`). These tests pin the SQL contract and wire shape. The
semantics are proven by Task 3's real SQL, and the test header must say so. Do not claim audience proof from mocks.

- [ ] **Exact SQL fragments.** Capture the SQL of the detail query (the one containing `requestReadableSql`'s
  `/* request-readable */` marker). Assert it contains, verbatim:
  - `/* match-participant */ (r.requester_id = $2 OR pm.responder_id = $2)`
  - `pm.status = 'completed'`
  - `CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END`
  - `AS viewer_partners`
  - `LIMIT 20`

  Also assert that the partner subquery text (from `AS viewer_partners` back to its opening `(SELECT`) does **not**
  contain `request-readable`, so partner status cannot be derived from read permission. Use exact-string expectations,
  not counts.
- [ ] **Default.** A mocked row without `viewer_partners` → response `data.viewer_partners` is `[]` (`toEqual([])`).
- [ ] **Pass-through.** A row with two partner objects → the response array deep-equals them, in order. The raw
  `viewer_match_id`/`viewer_match_status` columns are still stripped; `viewer_relation` is unchanged for the scenario
  (e.g. `own_request` for the requester on a completed ask, `not_actionable` for a completed helper).
- [ ] Run and confirm **red** for the right reason (the fragments are missing):

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-134-pr-b-viewer-partners.test.ts
```

---

## Task 3: Real-SQL integration matrix (CI-only)

**Files:** Create: `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts`

Fixture, all with `randomUUID()`:
- Users R (requester), A and B (completed helpers), C (rejected helper), P (preferred provider), M (community member),
  X (member of another community).
- Community `Cm` with R, A, B, C, P and M active; `OTHER` with X.
- A `requests.provider_profiles` row for P, with Q's `preferred_provider_id` pointing at it.
- Request Q: community scope, in `Cm`.
- Matches on Q: A `completed` (`completed_at` = t1), B `completed` (t2 > t1), C `rejected`.
- One `auth.user_tags` skill row for B (`tag_type = 'skill'`).

Insert matches directly with literal statuses. Check every column against `init.sql` first.

- [ ] **Exposure matrix** (`GET /requests/:Q` with each user's JWT; the token carries `communities: []`, never claims):
  - R → 200; `viewer_partners.map(p => p.user_id)` **equals** `[B, A]`; names match; `rated_by_me` false for both;
    `rating_community_id === Cm` for both.
  - A → `[R]` exactly; B → `[R]` exactly (never each other).
  - C → 200 (readable as an any-status responder) and `[]`.
  - P → 200 (readable as preferred provider) and `[]`.
  - M → 200 (community member) and `[]`.
  - X → 404 (unchanged read boundary).
- [ ] **Rating round trip through the real write path.** As A, `POST {REPUTATION}/reputation/feedback` with exactly the
  panel's payload `{ match_id: A's match, to_user_id: R, community_id: Cm, rating: 5 }` → 200. Then A's
  `viewer_partners[0].rated_by_me` is `true`, and R's entries are still `false`.
- [ ] **Vouch eligibility matches the listing.**
  - As R, `GET {AUTH}/auth/skills/users/:B` → B's skill has `can_endorse: true`. Then
    `POST {AUTH}/auth/skills/endorsements { tag_id }` → 201.
  - As M (not a partner of B), the same GET gives `can_endorse: false`, and the POST → 404.
  - As A (not B's partner), the GET gives `can_endorse: false`.

  This proves the prompt's source flag agrees with the endpoint, both ways.
- [ ] Teardown in FK order, as in the sprint-133 detail test: endorsements, feedback, tags, matches, provider profile,
  request communities, requests, members, communities, users.
- [ ] `tsc` for the tests project on this file only:

```bash
npx tsc --noEmit -p tests/tsconfig.json 2>&1 | grep "sprint-134-pr-b" ; echo "grep exit $?"
```

Expected: no diagnostics for this file (grep exit 1). **Not run locally** (no Postgres here). Record it as CI-only in
the handoff and the PR.

---

## Task 4: Implement `viewer_partners` (green)

**Files:** Modify: `services/request-service/src/routes/requests.ts` (detail route)

- [ ] Add the subquery to the SELECT list, after `viewer_match.status AS viewer_match_status`. `matchParticipantSql` is
  already imported (used at `requests.ts:1051`); confirm the import.

```sql
        viewer_match.status AS viewer_match_status,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'match_id', p.id, 'user_id', p.partner_id, 'name', p.partner_name,
            'completed_at', p.completed_at, 'rated_by_me', p.rated_by_me,
            'rating_community_id', p.rating_community_id)
            ORDER BY p.completed_at DESC NULLS LAST, p.id DESC), '[]'::jsonb)
         FROM (
           SELECT pm.id, pm.completed_at, partner.id AS partner_id, partner.name AS partner_name,
             EXISTS (SELECT 1 FROM feedback.feedback pf
                     WHERE pf.request_match_id = pm.id AND pf.from_user_id = $2) AS rated_by_me,
             (SELECT MIN(prc.community_id::text) FROM requests.request_communities prc
              WHERE prc.request_id = r.id) AS rating_community_id
           FROM requests.matches pm
           JOIN auth.users partner
             ON partner.id = CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END
           WHERE pm.request_id = r.id AND pm.status = 'completed'
             AND ${matchParticipantSql('r', 'pm', '$2')}
           ORDER BY pm.completed_at DESC NULLS LAST, pm.id DESC
           LIMIT 20
         ) p) AS viewer_partners
```

- [ ] In the handler: `const { viewer_match_id, viewer_match_status, viewer_partners, ...request } = row;` and add
  `viewer_partners: viewer_partners ?? []` to `data`. Extend the route's header comment with one line: partners are
  completed exchanges where the viewer is a participant, never read permission.
- [ ] Green, with the gates that read this file:

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-134-pr-b-viewer-partners.test.ts tests/regression/sprint-133-request-detail-visibility.test.ts tests/regression/sprint-132-directed-audience-gate.test.ts tests/regression/sprint-132-review-surface-gate.test.ts
npx tsc --noEmit -p services/request-service
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-134-pr-k-claim-gate.test.ts
```

- [ ] Commit (`feat(requests): viewer_partners on the detail read`).

---

## Task 5: Frontend TDD tests (red)

**Files:** Create: `apps/frontend/tests/tdd/sprint-134-pr-b-completed-exchange.test.tsx`

Mock `@/lib/api` with `requestService.getRequest`, `skillsService.{getUserSkills,endorse,withdrawEndorsement}`,
`reputationService.submitFeedback`, and `requestService.getRequestRelationshipContext` (reject 404). Use a local
`next/router` mock with `query.id`, as in the sprint-101 test. `mockReset` everything in `beforeEach`.

Coverage table → cases:
- [ ] **New component renders + edge cases (MemberSkills `endorsableOnly`):**
  - Only `can_endorse || endorsed_by_me` skills are listed; a `can_endorse:false, endorsed_by_me:false` skill is absent.
  - The heading appears only when at least one skill is listed.
  - Renders **nothing** (no "No shared skills", no "Loading skills…") when none are endorsable, while loading, on a
    404, and on a network error.
  - Default mode is unchanged: the existing `sprint-133-vouch.test.tsx` stays green untouched.
- [ ] **Conditional render (shown for authorized, hidden for unauthorized):**
  - Requester on a completed ask with two partners → two blocks, "<Name> helped with this ask.", newest first.
  - Completed helper → one block, "You helped <Name> with this ask."
  - Non-participant (`viewer_partners: []`) and an absent field → no panel, and **`getUserSkills` and
    `submitFeedback` are never called**.
  - The same partner in two entries → vouch skills rendered **once**; a rating prompt for each unrated entry.
  - `rated_by_me: true` → no rating prompt; `rating_community_id: null` → no rating prompt.
- [ ] **API call wired to user action (mock verifies payload):**
  - Clicking ★4 → `submitFeedback` called once with exactly
    `{ match_id, to_user_id: partner.user_id, community_id: rating_community_id, rating: 4 }`, and the prompt is
    replaced by "Thanks — ratings stay private.".
  - Skip → no call; the prompt hides.
  - Vouch → `endorse('tag-1')`.
- [ ] **Data fetch on mount (data path + graceful error):** skills load → chips; `getUserSkills` rejects → the panel
  still shows the partner sentence and rating, and the vouch row is absent, with no error text.
- [ ] Run, confirm **red** (component/props missing):

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-134-pr-b-completed-exchange.test.tsx
```

---

## Task 6: `MemberSkills` endorsable-only mode

**Files:** Modify: `apps/frontend/src/components/skills/MemberSkills.tsx`

- [ ] Signature `MemberSkills({ userId, endorsableOnly = false, heading }: { userId: string; endorsableOnly?: boolean;
  heading?: string })`.
- [ ] `const shown = endorsableOnly ? skills.filter(s => s.can_endorse || s.endorsed_by_me) : skills`. While
  `loading`, or when `shown` is empty: `endorsableOnly ? null : <existing text>`. Render `heading` (a `<p
  className="mb-2 text-sm text-text">`) above the list only when `shown` is non-empty. Map over `shown`. Toggle and
  reload logic unchanged.
- [ ] Comment: the filter reads only the server's ADR-100 flags; the client adds no eligibility rule.
- [ ] Verify: the Task 5 MemberSkills cases are green; `sprint-133-vouch.test.tsx`,
  `sprint-133-skills-discovery.test.tsx` and `sprint-119-trust-card-community.test.tsx` are still green.

---

## Task 7: `CompletedExchangePanel` + page wiring

**Files:** Create: `apps/frontend/src/components/requests/CompletedExchangePanel.tsx`;
Modify: `apps/frontend/src/pages/requests/[id].tsx`

- [ ] Component (shape; match surrounding idiom and Tailwind tokens):

```tsx
import { useState } from 'react'
import MemberSkills from '@/components/skills/MemberSkills'
import RatingPrompt from '@/components/RatingPrompt'
import { submitExchangeRating } from '@/utils/completion'

export interface ViewerPartner {
  match_id: string
  user_id: string
  name: string
  completed_at: string | null
  rated_by_me: boolean
  rating_community_id: string | null
}

// Sprint 134 PR B: the server lists only exchanges this viewer took part in (viewer_partners), and
// MemberSkills shows only skills the server says POST /endorsements would accept.
export default function CompletedExchangePanel({ partners, viewerIsRequester }: {
  partners: ViewerPartner[]; viewerIsRequester: boolean
}) {
  const [closed, setClosed] = useState<Record<string, 'rated' | 'skipped'>>({})
  // Rate per exchange; vouch once per person (BUG-074 can leave one partner with two completed matches).
  const vouchOn = new Set(partners.filter((p, i) => partners.findIndex(q => q.user_id === p.user_id) === i).map(p => p.match_id))
  const rate = async (p: ViewerPartner, rating: number | null) => {
    await submitExchangeRating({ matchId: p.match_id, toUserId: p.user_id, communityId: p.rating_community_id, rating })
    setClosed(prev => ({ ...prev, [p.match_id]: rating === null ? 'skipped' : 'rated' }))
  }
  return <section aria-label="Your completed exchange" className="mt-4 space-y-4">
    {partners.map(p => <div key={p.match_id} className="space-y-2">
      <p className="text-sm text-text">{viewerIsRequester ? `${p.name} helped with this ask.` : `You helped ${p.name} with this ask.`}</p>
      {!p.rated_by_me && p.rating_community_id && !closed[p.match_id] && <RatingPrompt onRate={r => rate(p, r)} />}
      {closed[p.match_id] === 'rated' && <p className="text-xs text-text-muted">Thanks — ratings stay private.</p>}
      {vouchOn.has(p.match_id) && <MemberSkills userId={p.user_id} endorsableOnly heading={`Vouch for a skill you saw ${p.name} use:`} />}
    </div>)}
  </section>
}
```

  `RatingPrompt` is right-aligned (`justify-end`) for cards. If it reads wrong in the action zone, adjust it with a prop
  rather than forking the component, and keep its DecisionBand/CommitmentsTab rendering unchanged.
- [ ] Page: add `viewer_partners?: ViewerPartner[]` (type import) to `RequestDetail`. Inside the action zone, after the
  relation-specific blocks and before `{error && …}`:
  `{(detail.viewer_partners ?? []).length > 0 && <CompletedExchangePanel partners={detail.viewer_partners!}
  viewerIsRequester={detail.viewer_relation === 'own_request'} />}`.
  Leave the existing relation lines as they are.
- [ ] Verify: the Task 5 file is fully green, and the existing page tests are unchanged and green:

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-134-pr-b-completed-exchange.test.tsx tests/tdd/sprint-101-request-detail-action.test.tsx tests/regression/sprint-116-pre-offer-surface.test.tsx tests/regression/sprint-132-ask-to-borrow.test.tsx
npx tsc --noEmit -p apps/frontend
```

- [ ] Commit (`feat(frontend): rate and vouch from a completed request`).

---

## Task 8: Completion notification copy

**Files:** Modify: `services/notification-service/src/templates/notificationTemplates.ts:78-87`,
`apps/frontend/src/components/NotificationItem.tsx:89-90`,
`services/notification-service/tests/regression/notificationTemplates.test.ts`

- [ ] Test first: assert `match_completed.title({})` is `'Exchange completed'`,
  `body({ request_title: 'Hang a fan' })` is exactly
  `'Your exchange for "Hang a fan" is complete. Rate it and vouch for skills you saw.'`, `ctaLabel` is
  `'Rate & vouch'`, `actionUrl({ request_id: 'r1' })` is `'/requests/r1'`, and priority/channels are unchanged. Red
  first.
- [ ] Change the template, then the frontend `getCtaLabel` case. Grep for leftovers (bug-fix rule: every instance):

```bash
grep -rn "Rate Helper\|Leave a Rating" services apps tests --include=*.ts --include=*.tsx | grep -v node_modules
```

  Expected: no hits outside historical docs. If a frontend test asserts the old CTA, update it.
- [ ] Verify `npm exec --workspace=services/notification-service -- jest --runTestsByPath
  tests/regression/notificationTemplates.test.ts` is green, then commit.

---

## Task 9: Guides, concept, onboarding, ADR-100 amendment

**Files:** see the File Map docs rows.

- [ ] `docs/guides/profile-guide.md` "Vouching for skills": first path is the completed request page (from the
  "Exchange completed" notification). Then the Helping tab card and the People tab. Keep the active co-membership
  requirement.
- [ ] `docs/guides/match-lifecycle.md` and `docs/guides/fulfilling-requests-guide.md`: after both sides mark done, the
  request page offers a private rating and vouching for your partner's skills. Each participant sees only their own
  partner. `managing-commitments-guide.md`: one line, only if it describes rating.
- [ ] `docs/concepts/skill-endorsements.md`: where you can vouch; the partner rule (only the two people in an exchange
  see each other there).
- [ ] `apps/frontend/src/lib/onboarding/workflows.ts:25`: "…you can vouch for their skills from the completed request
  page or their card in the Helping tab…". Update any onboarding test that pins this string.
- [ ] ADR-100: add `## Amendment — Sprint 134 PR B: vouching from a completed exchange (2026-10-28)`. Record:
  - the exposure rule (completed + participant per exchange; read permission is not partner status);
  - the request page as a vouch and rating surface;
  - eligibility stays in `GET /skills/users/:id` / `POST /endorsements`;
  - attribution unchanged;
  - no new event or queue; the "you were vouched for" notification is still a later dedicated-queue item.

  Add a status-line suffix if the ADR's convention does so. No new number, no `ADR_GROUPS` change.
- [ ] `docs/IDEAS.md` 2026-10-13: mark "Vouch from the request page" done in Sprint 134 PR B. Append-only style:
  annotate it, don't delete it.
- [ ] Regenerate landing docs with `npm run generate-docs --workspace=apps/landing` (`npx tsx ../../scripts/generate-docs.ts`,
  also the landing `prebuild`). Check the changed pages, then revert timestamp and HEAD-sha churn. Drift gate:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts
```

---

## Task 10: CONTEXT.md, registry, TDD promotion

- [ ] `services/request-service/CONTEXT.md` § `GET /requests/:id` (~line 830): document `viewer_partners` (shape,
  ordering, cap, exposure matrix summary, `[]` default). Add a dated Recent Fixes / changelog line.
- [ ] `services/registry.json` `/requests/:id` (line 389): append "viewer_partners lists completed exchanges only to their
  participants". `services/notification-service/CONTEXT.md`: the `match_completed` copy.
- [ ] Run `npm test` once and let `scripts/promote-tdd-tests.js` promote the three new tdd files. **Restore any other
  file it promoted** (`git status`), and revert landing churn.
- [ ] `npm run feedback:check` (advisory; it reads `git diff --cached`, so stage first), `node scripts/gotcha-check.js`,
  `npm run analyze:services` only if dependencies changed (they should not).

---

## Task 11: SDLC quality gates

- [ ] **Testing:** the TDD files were red before the implementation (Tasks 2, 5, 8), green after, and promoted;
  `npm test` green.
- [ ] **`/simplify`** on the branch diff (one pass; the diff is small). Apply or justify each finding in the handoff.
  Verification: findings listed with a disposition.
- [ ] **`/code-review` medium** on the branch diff. It touches a read boundary, so escalate to **high** if it finds
  anything in the projection. Resolve correctness findings; re-run the root gates afterwards
  (`npm test --workspace=tests`). Verification: findings + fixes recorded.
- [ ] **`/security-review`** on the branch diff. Focus: can any non-participant obtain a partner id or name; can the
  rating or vouch path be driven for someone else (both endpoints unchanged and server-validated); XSS via partner
  name (React-escaped). Verification: findings or "no findings" recorded.
- [ ] process-reviewer (`pre-commit-check` skill) before the final commit.

---

## Task 12: Final verification

- [ ] `npx tsc --noEmit` for request-service, notification-service, frontend; strict root compiler changed-path filter
  empty.
- [ ] `npm test` (27/27 expected; note Turbo cache counts), then re-run the root tests workspace directly
  (`npm test --workspace=tests`), because Turbo can replay a stale cross-workspace pass.
- [ ] `git diff origin/master --stat`: no `infrastructure/`, no lockfile beyond the root version, no `api.ts`.
- [ ] Landing churn reverted; tree clean after the final commit.

---

## Task 13: Open the PR and stop

- [ ] Re-derive the version from `origin/master` (`git show origin/master:package.json`); re-bump if master moved.
- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md`: *PR B state* (commits, gates, CI-only integration note), PR sequence
  row "open, awaiting maintainer merge"; push.
- [ ] Open the PR with the contract headers `pr-contract.yml` requires. Include the exposure matrix, test evidence
  (marking real SQL as CI-only), gate dispositions and **human validation** for the maintainer on karmyq.com after
  deploy:
  - As a requester, open a completed ask from the "Exchange completed" notification: partner shown, rate once (the
    prompt does not return after reload), vouch for a skill and see the count.
  - As that ask's helper: only the requester is shown.
  - As a community member who can read the ask: no panel.
  - The notification shows the new copy for a newly completed exchange.
- [ ] Report the link and **stop**. The next chat does CI red, the post-merge deploy check, the CodeQL master re-check
  (including the `/language:actions` "Unknown Error" carried from `4ee38e82`) and the post-merge record.
  Merge/deploy goes through CI/CD after the maintainer merges (`feedback_deploy_cicd_first`).
