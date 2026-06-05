# Core Help-Loop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved warm-commons/calm behavior help loop by building the shared shell and re-skinning Dashboard Home plus Community Home on top of it.

**Architecture:** The request-service remains the feed source-of-truth. Backend work is limited to moving impression logging into reusable helpers so `view=home` and `view=community` union responses log request impressions before returning; frontend work builds a small shell CSS/component layer and applies it to the unified feed surfaces without replacing the feed model.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `apps/frontend/src/styles/karmyq-shell.css` | Production shell tokens/classes extracted from approved Sprint 87 mockups. |
| `apps/frontend/src/utils/matchSignal.ts` | Map numeric match score/reason into member-facing qualitative copy. |
| `apps/frontend/tests/tdd/sprint-88-request-card-shell.test.tsx` | TDD coverage for relationship-led card order, `KarmaBadge` removal, qualitative match signal. |
| `apps/frontend/tests/tdd/sprint-88-unified-feed-show-more.test.tsx` | TDD coverage for default `minScore=30`, show-more re-fetch, and finite caught-up state. |
| `apps/frontend/tests/tdd/sprint-88-community-home-shell.test.tsx` | TDD coverage for Community Home feed shell, texture, admin altitude separation, empty KPI handling. |
| `services/request-service/tests/tdd/sprint-88-curated-feed-controls.test.ts` | TDD coverage for `minScore=0` parsing and deterministic union impression logging. |

### Existing files to modify

| File | Change |
|---|---|
| `package.json` | Version `10.11.0` -> `10.12.0`. |
| `apps/frontend/src/pages/_app.tsx` | Import `karmyq-shell.css`. |
| `apps/frontend/src/components/Layout.tsx` | Align chrome with one quiet notification affordance. |
| `apps/frontend/src/pages/dashboard.tsx` | Warm Home header and feed framing; pass any required shell props. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Curated default, show-more behavior, finite states, shell layout. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Relationship-led hierarchy; remove `KarmaBadge`; qualitative match signal; human labels. |
| `apps/frontend/src/components/Feed/DecisionBand.tsx` | Warm action band; mobile wrapping; quiet error/status treatment. |
| `apps/frontend/src/components/Feed/ActivityCard.tsx` | Shell styling for community texture. |
| `apps/frontend/src/components/Feed/StoryCard.tsx` | Shell styling for community texture. |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Community Home shell and admin/member altitude cleanup. |
| `apps/frontend/src/components/SpeedDialFab.tsx` | Clear mobile bottom nav and card CTAs. |
| `apps/frontend/src/components/RequestWizard.tsx` | Copy polish only; preserve type picker. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update help-loop onboarding copy. |
| `apps/frontend/src/types/unified-feed.ts` | Add frontend-only view helper types if needed. |
| `services/request-service/src/routes/requests.ts` | Log request impressions for union feed views. |
| `services/request-service/CONTEXT.md` | Document S88 impression logging fix. |
| `services/registry.json` | Refresh `/requests/curated` behavior description if needed. |
| `apps/frontend/CONTEXT.md` | Document S88 shell/feed behavior. |
| `apps/landing/src/data/docs/guides/*.json` | Update member help-loop/user guide. |
| `apps/landing/src/data/docs/concepts/*.json` | Update/add warm help-loop concept if needed. |
| `apps/landing/src/data/docs/services/request-service.json` | Update endpoint behavior text if changed. |
| `apps/landing/src/data/docs/nav.json` | Register any new/changed guide/concept entries. |
| `docs/design/sprint-87/sprint-88-recommendation.md` | Append implementation follow-through note after execution. |

---

## Critical Implementation Notes (read before Task 2)

1. **PR #69 must merge/deploy first.** Sprint 88 builds from the approved Sprint 87 artifacts and version `10.11.0`; do not start production edits on the Sprint 87 branch.
2. **Branch:** use `feature/sprint-88-core-help-loop-redesign`; agents do not commit to `master` directly.
3. **Dashboard Home and Community Home are both in scope.** Community Home is not deferred to Sprint 89; Sprint 89 handles broader community sovereignty beyond the feed.
4. **No schema change expected.** Fix impression logging by reusing existing scored request rows before the union return paths; log request items only, never decisions/activity/story texture.
5. **`minScore` default stays 30, but `0` is valid.** "Show more open requests" intentionally lowers/removes the threshold after user action; parse `minScore` with an explicit finite check, not `parseInt(...) || 30`.
6. **Remove `KarmaBadge` from `RequestCard`.** Per-person score display is banned on help cards; do not replace it with another numeric person score.
7. **Keep `TrustPathBadge` and promote it.** Relationship/path reason leads the card above title and match signal.
8. **Match % becomes qualitative copy.** Do not render `68% Match` as a leading card element; map it to quiet labels and keep raw values out of the primary hierarchy.
9. **Use global JWT truth:** membership is `user.communities`, not `communityMemberships`; the request-service local README is stale here.
10. **API unwrap rule:** frontend `createApiClient` already unwraps response envelopes; consume `res.data`, not `res.data.data`.
11. **Payload seam:** keep using `payload_type` derived via ADR-067 normalization; never render raw `generic` or mixed `category` tokens as user-facing labels.
12. **Mobile is part of done.** The FAB must not overlap card CTAs; decision-band text wraps rather than truncates; tap targets stay at least 40px.
13. **Do not rewrite admin management.** Community admin all-status tools remain separate altitude; only remove empty/noisy KPI presentation and align styling where it shares the surface.
14. **Docs are in scope.** This sprint ships real behavior changes, so user guides, frontend context, request-service context, and landing docs must be updated.

---

## Task 1: Branch and metadata

**Files:**
- Modify: `package.json`

- [ ] Ensure PR #69 is merged/deployed before branching.

```bash
git branch --show-current
git status --short
```

Expected: current branch is clean. If still on `feature/sprint-87-product-truth-and-ux-reset`, do not edit; merge/deploy PR #69 first.

- [ ] Create the Sprint 88 branch.

```bash
git checkout -b feature/sprint-88-core-help-loop-redesign
```

- [ ] Bump root version from `10.11.0` to `10.12.0` in `package.json`.
- [ ] Verify the current metadata.

```bash
git diff -- package.json
git grep -n '"version": "10.12.0"' -- package.json
```

- [ ] Run `/simplify` on the metadata diff.

## Task 2: Write backend TDD for minScore and union impressions

**Files:**
- Create: `services/request-service/tests/tdd/sprint-88-curated-feed-controls.test.ts`
- Reference: `services/request-service/tests/tdd/sprint-85-unified-feed.test.ts`
- Reference: `services/request-service/tests/integration/sprint-86-community-feed.test.ts`

- [ ] Add a pure/parser test proving an absent or invalid `minScore` defaults to `30`, while `minScore=0` returns `0`.
- [ ] Add a route-level or helper-level test proving `GET /requests/curated?minScore=0` can include a scored request below 30. This guards the existing bug where `parseInt("0") || 30` silently keeps the curated threshold.
- [ ] Add deterministic unit coverage for union impression logging by mocking `query` and invoking the extracted logging helper with already-scored request rows.
- [ ] Assert the exact `INSERT INTO requests.feed_events` SQL shape and flattened values: `userId`, `request.id`, `feedScore`, 1-based rank, and `sourceTier`.
- [ ] Assert non-request union items are never passed to the logging helper. Do not make this a real-DB + `setTimeout` test; if a full route/DB smoke is desired later, place it in `tests/integration/`.

- [ ] Run the new test and confirm it fails because union paths return before impression logging.

```bash
cd services/request-service
npm run test:tdd -- sprint-88-curated-feed-controls.test.ts
```

Expected: FAIL on `minScore=0` parsing and/or missing union impression logging.

## Task 3: Implement minScore parsing and union impression logging

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`
- Test: `services/request-service/tests/tdd/sprint-88-curated-feed-controls.test.ts`

- [ ] Replace the current `parseInt(req.query.minScore as string) || 30` behavior with parsing that honors zero.

```ts
function parseMinScore(value: unknown): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 30;
}
```

- [ ] Use `const minMatchScore = parseMinScore(req.query.minScore);` inside `handleCuratedFeed`.
- [ ] Export the parser only if needed for the TDD test; otherwise test through the route/helper seam used by the existing request-service tests.

- [ ] Extract the existing legacy impression insert block into a helper near `handleCuratedFeed`.

```ts
export function logRequestImpressions(req: Request, userId: string, requests: any[]): void {
  setImmediate(() => {
    void (async () => {
      try {
        if (requests.length === 0) return;
        const placeholders = requests
          .map((_: any, i: number) => `($${i * 5 + 1}, $${i * 5 + 2}, 'impression', $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
          .join(', ');
        const flatValues = requests.flatMap((r: any, idx: number) => [
          userId,
          r.id,
          r.feedScore,
          idx + 1,
          r.sourceTier,
        ]);
        await query(
          `INSERT INTO requests.feed_events (user_id, request_id, event_type, feed_score, feed_rank, source_tier)
           VALUES ${placeholders}
           ON CONFLICT DO NOTHING`,
          flatValues
        );
      } catch (e: any) {
        (req as any).logger?.error('feed-impression-log failed', e instanceof Error ? e : new Error(String(e)), {
          service: 'request-service',
          step: 'feed-impression-log',
        });
      }
    })();
  });
}
```

- [ ] Call `logRequestImpressions(req, userId, filteredRequests)` before the `view=home` return, before the `view=community` return, and after the legacy response.
- [ ] Keep `respondHomeFeed` and `respondCommunityFeed` response shapes unchanged.
- [ ] Run the new TDD test.

```bash
cd services/request-service
npm run test:tdd -- sprint-88-curated-feed-controls.test.ts
```

Expected: PASS.

- [ ] Run nearby unit/integration tests.

```bash
cd services/request-service
npm run test:unit -- curated-view-home.test.ts community-texture.test.ts
npm run test:integration -- sprint-86-community-feed.test.ts
```

- [ ] Run `/simplify` on the backend diff.

## Task 4: Add shell CSS and qualitative match helper

**Files:**
- Create: `apps/frontend/src/styles/karmyq-shell.css`
- Create: `apps/frontend/src/utils/matchSignal.ts`
- Modify: `apps/frontend/src/pages/_app.tsx`
- Test: `apps/frontend/tests/tdd/sprint-88-request-card-shell.test.tsx`

- [ ] Create the production shell CSS using the approved tokens from `docs/design/sprint-87/presentation-rules.md`.
- [ ] Include classes for `.kq-page`, `.kq-page-header`, `.kq-card`, `.kq-path-badge`, `.kq-pill`, `.kq-action-band`, `.kq-finite-state`, and `.kq-quiet-meta`.
- [ ] Import the shell CSS from `_app.tsx` after global Tailwind styles.
- [ ] Add `matchSignal.ts` with deterministic labels.

```ts
export function describeMatchSignal(score?: number | null, reason?: string | null): string | null {
  if (score == null) return reason || null;
  if (score >= 75) return reason ? `strong fit · ${reason}` : 'strong fit';
  if (score >= 50) return reason ? `good match · ${reason}` : 'good match';
  if (score >= 30) return reason ? `nearby fit · ${reason}` : 'nearby fit';
  return reason ? `may still help · ${reason}` : 'may still help';
}
```

- [ ] Write unit tests for `describeMatchSignal` in the request-card TDD file.
- [ ] Run the frontend TDD test.

```bash
cd apps/frontend
npm run test:tdd -- sprint-88-request-card-shell.test.tsx
```

Expected: helper tests pass; component tests may still fail until Task 5.

## Task 5: Redesign `RequestCard`

**Files:**
- Modify: `apps/frontend/src/components/Feed/RequestCard.tsx`
- Modify: `apps/frontend/src/types/unified-feed.ts` if helper typing is needed
- Test: `apps/frontend/tests/tdd/sprint-88-request-card-shell.test.tsx`

- [ ] Write component tests that render a request with `requester_id`, `match_score`, `match_reason`, `payload_type`, and `currentUserId`.
- [ ] Assert the card renders `TrustPathBadge`/relationship area before the title, does not render `KarmaBadge` output, and does not render text matching `/\d+%/`.
- [ ] Assert raw labels such as `generic` are not shown as the member-facing type label.
- [ ] Remove the `KarmaBadge` import and JSX.
- [ ] Move `RequestTrustBadge` to the top of the card, before the ask/title.
- [ ] Replace match percent JSX with `describeMatchSignal(data.match_score, data.match_reason)`.
- [ ] Keep exactly one primary action for non-own requests: `Offer to help`.
- [ ] Run request-card TDD.

```bash
cd apps/frontend
npm run test:tdd -- sprint-88-request-card-shell.test.tsx
```

Expected: PASS.

- [ ] Run `/simplify` on the `RequestCard` diff.

## Task 6: Add curated default and show-more behavior

**Files:**
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Test: `apps/frontend/tests/tdd/sprint-88-unified-feed-show-more.test.tsx`

- [ ] Write tests that mock `requestService.getCuratedRequests`.
- [ ] Assert initial Home fetch includes `{ view: 'home', minScore: 30 }`.
- [ ] Assert Community fetch includes `{ view: 'community', minScore: 30, community_id }`.
- [ ] Assert clicking `Show more open requests` re-fetches with `{ minScore: 0 }` and renders newly returned below-threshold request data, not just that the call args changed.
- [ ] Add state:

```ts
const [showingMoreOpen, setShowingMoreOpen] = useState(false);
const minScore = showingMoreOpen ? 0 : 30;
```

- [ ] Pass `minScore` into `requestService.getCuratedRequests`; do not omit the param for show-more because omission intentionally means backend default `30`.
- [ ] Render the show-more control at the caught-up boundary when not already expanded and the user is not blocked by filters/no communities.
- [ ] Keep provider browse-mode filtering Home-only and Community view unfiltered by provider mode.
- [ ] Run TDD.

```bash
cd apps/frontend
npm run test:tdd -- sprint-88-unified-feed-show-more.test.tsx
```

Expected: PASS.

- [ ] Run `/simplify` on `UnifiedFeed`.

## Task 7: Warm Dashboard Home and decision band

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/components/Feed/DecisionBand.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`
- Test: `apps/frontend/tests/tdd/sprint-85-unified-feed.test.tsx`
- Test: `apps/frontend/tests/tdd/sprint-86-decision-band-expand.test.tsx`

- [ ] Update Dashboard Home copy to use an eyebrow, serif headline, and one-line lede; avoid "Dashboard" as the primary human-facing title.
- [ ] Align `DecisionBand` with `.kq-action-band`; ensure decision titles wrap on mobile rather than relying on `truncate`.
- [ ] Keep `DecisionBand` empty render as `null`.
- [ ] Update onboarding copy to mention finite queue, relationship-led cards, and quiet notification behavior.
- [ ] Keep top chrome to one quiet notification affordance; avoid count-badge pressure.
- [ ] Run existing feed/decision tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-85-unified-feed.test.tsx sprint-86-decision-band-expand.test.tsx
```

- [ ] Run `/simplify` on Dashboard/Layout/DecisionBand diffs.

## Task 8: Warm Community Home and admin altitude

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/BrowseTab.tsx`
- Modify: `apps/frontend/src/components/Feed/ActivityCard.tsx`
- Modify: `apps/frontend/src/components/Feed/StoryCard.tsx`
- Test: `apps/frontend/tests/tdd/sprint-88-community-home-shell.test.tsx`

- [ ] Write tests that render `BrowseTab` for member and admin/mod contexts.
- [ ] Assert member Community Home shows the unified feed as the primary surface.
- [ ] Assert admin management remains present for admin/mod but separate from the member feed.
- [ ] Suppress empty KPI tiles when stats/trust/metrics are absent; show meaningful empty text instead of rows of zeros.
- [ ] Apply shell classes to community request, activity, and story cards.
- [ ] Humanize headings: "Community requests" may become "Ways neighbours can help here"; admin list may become "Steward requests".
- [ ] Run the Community Home TDD.

```bash
cd apps/frontend
npm run test:tdd -- sprint-88-community-home-shell.test.tsx
```

Expected: PASS.

- [ ] Run `/simplify` on Community Home diffs.

## Task 9: Mobile, copy, and production-truth bug fixes

**Files:**
- Modify: `apps/frontend/src/components/SpeedDialFab.tsx`
- Modify: `apps/frontend/src/components/RequestWizard.tsx`
- Search/modify: components rendering community names and fission/fusion names

- [ ] Fix mobile FAB spacing so it clears bottom nav and the last card CTA.
- [ ] Polish RequestWizard copy only; keep the emoji-led type picker.
- [ ] Search for em-dash mojibake and cumulative fission/fusion name rendering.

```bash
rg -n "â|— Group|Group A|Group B|fission|fusion|community_name|communityName" apps/frontend/src services/community-service/src
```

- [ ] Fix the source of mojibake and cumulative "Group A - Group B" display names where they render on S88 surfaces.
- [ ] Do not change database history unless a separate data repair is explicitly required and approved.
- [ ] Verify no obvious mojibake remains.

```bash
rg -n "â|— Group A|— Group B" apps/frontend/src
```

- [ ] Run `/simplify` on these polish diffs.

## Task 10: Frontend verification

**Files:**
- Test: frontend unit/regression/TDD suites affected by S88

- [ ] Run focused frontend TDD tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-88-request-card-shell.test.tsx sprint-88-unified-feed-show-more.test.tsx sprint-88-community-home-shell.test.tsx
```

- [ ] Run existing adjacent TDD tests.

```bash
cd apps/frontend
npm run test:tdd -- sprint-85-unified-feed.test.tsx sprint-85-request-card.test.tsx sprint-86-unified-feed-community.test.tsx sprint-86-decision-band-expand.test.tsx sprint-86-payload-renderer-guard.test.tsx
```

- [ ] Run frontend unit/regression.

```bash
cd apps/frontend
npm run test:unit
npm run test:regression
```

- [ ] Run type check from root.

```bash
npx tsc --noEmit
```

## Task 11: Docs and service registry

**Files:**
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/guides/*.json`
- Modify: `apps/landing/src/data/docs/concepts/*.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `docs/design/sprint-87/sprint-88-recommendation.md`

- [ ] Update `apps/frontend/CONTEXT.md` with S88 shell, card hierarchy, curated default/show more, Dashboard Home, Community Home, and mobile/FAB behavior.
- [ ] Update `services/request-service/CONTEXT.md` with the union impression logging fix.
- [ ] Refresh the `/requests/curated` description in `services/registry.json` only if the current text does not mention union impression logging.
- [ ] Update landing user guide docs for the member help loop.
- [ ] Update/add the warm help-loop concept page and nav entry if it does not already exist.
- [ ] Update request-service landing docs if endpoint behavior text changed.
- [ ] Append an implementation note to `docs/design/sprint-87/sprint-88-recommendation.md`.
- [ ] Verify docs/nav integrity.

```bash
rg -n "Core Help-Loop|show more open|minScore|KarmaBadge|view=home|view=community" apps/frontend/CONTEXT.md services/request-service/CONTEXT.md services/registry.json apps/landing/src/data/docs docs/design/sprint-87/sprint-88-recommendation.md
```

- [ ] If `apps/landing/src/data/docs/` is edited, remember it is gitignored and must be force-added later.
- [ ] Run `/simplify` on docs diffs.

## Task 12: SDLC quality gates

**Files:**
- Review: whole branch diff

- [ ] Run final `/simplify` on the whole branch diff.

```bash
git diff --stat
git diff --check
```

- [ ] Run `/code-review` on the whole branch diff and fix correctness findings.

```bash
git diff --name-only
```

- [ ] Run `/security-review` on the whole branch diff and resolve real findings. Record any false-positive dismissal in the PR body Security dismissals section.

```bash
npm audit --package-lock-only --audit-level=high
```

Expected: no high/critical vulnerabilities.

## Task 13: Final verification

**Files:**
- Verify: whole repo

- [ ] Run request-service tests.

```bash
cd services/request-service
npm run test:unit
npm run test:regression
npm run test:tdd -- sprint-88-curated-feed-controls.test.ts
```

- [ ] Run frontend tests.

```bash
cd apps/frontend
npm run test:unit
npm run test:regression
npm run test:tdd -- sprint-88-request-card-shell.test.tsx sprint-88-unified-feed-show-more.test.tsx sprint-88-community-home-shell.test.tsx
```

- [ ] Run root gates.

```bash
npm test
npm run feedback:check
npx tsc --noEmit
```

- [ ] Run landing build if landing docs changed.

```bash
cd apps/landing
npm run build
```

- [ ] Human validation checklist:
  - Dashboard Home shows warm shell, relationship-led cards, no `KarmaBadge`, no leading match percent.
  - Community Home uses the same shell and includes the "show more open requests" affordance.
  - `view=home` and `view=community` both add `requests.feed_events` impression rows for request items.
  - Mobile feed has no FAB/CTA overlap.
  - Empty terminal state reads finite and calm.
  - No em-dash mojibake or cumulative fission/fusion display names appear on the checked surfaces.

## Task 14: Merge and deploy

**Files:**
- PR: `.github/pull_request_template.md`
- Handoff: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md` with completion state, blockers, validation results, and next sprint direction.
- [ ] Create the PR using `.github/pull_request_template.md` as the body; fill every section.
- [ ] Ensure docs generated under `apps/landing/src/data/docs/` are staged with `git add -f`.
- [ ] After maintainer authorization ("pull it in"), merge per the multi-agent PR process.
- [ ] Use `/deploy` to monitor GitHub Actions Deploy-to-Demo.
- [ ] Verify demo health and manually smoke Dashboard Home + Community Home after deploy.
