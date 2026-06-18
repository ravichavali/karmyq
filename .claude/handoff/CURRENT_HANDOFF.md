# Sprint 106 — Post-Facelift Correctness & Link-Up Clarity — IMPLEMENTED, PENDING VALIDATION + MERGE (v11.13.0 → v11.14.0)

> **STATUS (2026-06-18):** Sprint 106 implementation is COMPLETE on branch
> `feature/sprint-106-correctness-linkup`. All four bugs fixed + the bounded link-up legibility fix
> shipped. Tasks 1–11 done; automated verification green. Remaining: **human browser validation**
> (deploy gate), open PR, Admin-merge, CI deploy v11.14.0. Do NOT self-merge.
>
> **What shipped:** BUG-014 (feed ranker carries persisted `request_type` enum, not `category`);
> BUG-013 (durable symmetric `rate` decision for both parties + `POST /reputation/feedback`
> participant/completed/counterparty hardening); BUG-015 (DecisionBand relocated from Browse to the
> Helping tab); BUG-016 (header breathing-room pass); link-up (nav label unified to "Service
> Providers" + provider directory line now names the community↔provider relationship for all viewers).
>
> **Verification:** request-service blocking 152/152 + sprint-106 7/7; reputation-service blocking 5/5
> + sprint-106 8/8; frontend at master baseline (38 pre-existing failures, 0 new) + sprint-106/band
> suites green; all three `tsc --noEmit` clean. SDLC gates all run: testing, `/simplify` (1 fix),
> `/code-review` (no findings — cross-schema grant concern refuted by single `karmyq_user` role with
> full grants), `/security-review` (no findings; the BUG-013 hardening itself closes a pre-existing
> rating-write IDOR).
>
> **Known pre-existing (NOT S106):** `apps/frontend/tests/tdd/sprint-85-unified-feed.test.tsx` →
> "optimistically removes a card" fails on master too (stale `request_type:'service'` test data
> expects "Offer to help" but the label is now "Offer service"). Left untouched (out of scope).
> **Skipped per judgment:** the optional `tests/tdd/sprint-106-integration.test.ts` — a DB-dependent
> smoke test would only fail in the no-DB agent environment; unit/component coverage across 3 layers
> is sufficient.

---

## Quick Start (remaining work)

1. Read this handoff.
2. Branch `feature/sprint-106-correctness-linkup` is implemented and committed.
3. Open a PR (copy `.github/pull_request_template.md` into the body); do NOT self-merge.
4. Human browser validation (see Task 11 in the plan), then Admin-merge → CI deploys v11.14.0.
5. Do NOT stage `scripts/founding-circle-submissions.sh` — it is local untracked work.

---

## Sprint Goal

Close BUG-013…016 from S105 validation and ship one bounded fix for the community↔service-provider
link-up confusion, fixing each at its correct layer, then deploy v11.14.0.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-18-sprint-106-correctness-linkup-design.md`
- Plan: `docs/superpowers/plans/2026-06-18-sprint-106-correctness-linkup.md`
- Bug log: `docs/BUGS.md` (BUG-013, BUG-014, BUG-015, BUG-016 — all `planned (Sprint 106)`)
- Link-up idea: `docs/IDEAS.md` [2026-06-08] ux

---

## Scope (confirmed with maintainer)

**In scope:** the 4 open bugs + a bounded community↔service-provider link-up cleanup (diagnose + one
contained fix). BUG-013 starts investigate-first. BUG-015 resolved as: move "Needs your response" to
the **Helping** tab.

**Out of scope:** "platform forgets" visible decay; responder Home actionability for `proposed`
matches; Dibs server-side relationship routing; member forget/export; service consolidation; mobile
parity; any provider↔community model rework (flag for re-scope if the link-up fix needs it).

---

## The Bugs (diagnosed during planning)

| Bug | Root cause | Fix layer | Decision |
|-----|-----------|-----------|----------|
| **BUG-014** "Offer help" on provider feed | `basicFeedRanker.ts:131` projects `category` (mixed-vocab) as `request_type` → service asks never read `'service'`. Helper `getOfferActionLabel` is correct. | **Backend** feed ranker | Carry persisted `request_type` enum; grep all projection sites |
| **BUG-013** rating asymmetry | `DecisionBand.tsx:88` only unlocks rating for whoever clicks the final `mark_done`; the other party gets no `rate` affordance. Write path = reputation-service `POST /reputation/feedback` (already accepts any user; no participant/completed check) | **Backend decisions feed + frontend** (+ reputation hardening) | Surfacing-only on the write side; surface a durable `rate` decision for BOTH parties on `fully_completed`-unrated matches; harden `POST /feedback` with participant + completed-match checks |
| **BUG-015** band placement | DecisionBand mounts in Browse `UnifiedFeed` (`dashboard.tsx:216-232`); it's commitment work | **Frontend** | Move band to top of **Helping** tab; remove from Browse |
| **BUG-016** squished header | `kq-topbar` packs wordmark + 4 nav links + bell + availability + avatar on one row (`Layout.tsx:115-164`) | **Frontend chrome** | Breathing-room pass within A-plus tokens |

**Link-up cleanup:** diagnose where provider↔community reads confusing (nav split, onboarding,
provider-in-community discoverability); ship ONE contained legibility fix; STOP + flag if it needs a
model/multi-flow change.

---

## Critical Implementation Notes (copied from spec)

1. **BUG-014 is a backend seam, not a copy fix.** Helper is correct. Fix `basicFeedRanker.ts:131` to
   carry the persisted `request_type` enum, not `category`. Grep every feed/projection site (browsable
   filtering lives in ~4 places). Never client-side patch.
2. **BUG-013 is investigate-first.** Task 1 reproduces the rating lifecycle (match/rating DB state →
   decisions feed → DecisionBand) and confirms whether the rating write path already accepts both
   roles BEFORE coding. Surfacing-only vs write-path decided by the finding.
3. **Rating symmetric + durable.** Both participants get a rate affordance until each rates; survives
   reload. One-sided done must not prompt.
4. **BUG-015 relocates, doesn't duplicate.** Move to Helping, remove from Browse; preserve ranking,
   actions, rate affordance.
5. **BUG-016 chrome-only**, A-plus tokens, no nav-information change.
6. **Link-up cleanup bounded** — one contained fix or flag for re-scope.
7. **Semantic + accessible** on every touched surface: tokenized colors, focus, keyboard, tap targets,
   not color-only.
8. **useRouter test mock is global** (`jest.setup.js`) — no per-file router mocks.
9. **No docs-only push to master** — fold docs into the PR. `nav.json` silently reverts; grep-verify.
10. **Verify before claiming done** — run actual suites; deploy sprint needs human browser validation.

---

## Implementation Tasks (see plan for detail)

1. Branch, baseline, BUG-013 rating-lifecycle investigation + link-up diagnosis (record findings here).
2. TDD — BUG-014 feed-ranker request_type.
3. Implement BUG-014 fix.
4. TDD — BUG-013 rating symmetry.
5. Implement BUG-013 rating symmetry.
6. TDD + implement BUG-015 — relocate band to Helping.
7. TDD + implement BUG-016 header + link-up legibility fix.
8. Docs — guides, landing, onboarding, ADR-080 (if warranted), version bump to 11.14.0.
9. CONTEXT.md + registry.json + integration test + `feedback:check`.
10. SDLC quality gates (`/simplify`, `/code-review`, `/security-review`).
11. Final pre-push verification + human browser validation.
12. Merge + Deploy (v11.14.0).

---

## Task 1 Findings

- **Rating write path:** reputation-service `POST /reputation/feedback` (`reputation.ts:292`), via
  `reputationService.submitFeedback()` (`apps/frontend/src/utils/completion.ts:44` → `api.ts:732`).
  NOT a request-service route.
- **Accepts both roles?** Yes — already accepts any authenticated user; no role gate. Double-submission
  guard is per `(fromUserId, match_id)`, so both parties can rate the same match independently. ⇒
  BUG-013 is **surfacing-only on the write side**; the fix is a durable `rate` decision + DecisionBand
  rendering. **Recommended added hardening:** the handler does not check participant/completed — add
  participant + completed-match validation while we are in this flow (`/security-review` gate).
- **Link-up contained fix chosen:** **Service Providers directory legibility.** The community↔provider
  relationship is only stated inside the provider-only "My Provider Presence" card
  (`providers/index.tsx`); a non-provider browsing the directory gets no cue these are the same
  neighbours from their communities. Nav is also inconsistent — desktop says "Providers"
  (`Layout.tsx:144`) while mobile menu + page `<title>` say "Service Providers". ONE contained fix:
  (a) a directory-level relationship line visible to ALL viewers on the Service Providers page, and
  (b) unify the desktop nav label to "Service Providers". No data-model or flow change. Deeper
  facet-switching / provider-scoping work (IDEAS 2026-05-06, 2026-05-17) remains flagged for re-scope.

---

## Carry-Forward / Known Issues

- **Reconnect CTA remains deferred:** restore only after real peer messaging or a directed-ask flow.
- **Responder Home actionability** ([IDEAS 2026-06-15]): `proposed` matches don't surface as
  actionable on responder Home — bigger than S106 scope; deferred.
- **Dibs server-side relationship routing** ([IDEAS 2026-06-09]) remains open.
- **"Platform forgets" visible decay** ([IDEAS 2026-06-04]) remains a future multi-sprint arc.
- **Member forget/export** privacy follow-on remains open.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is known/recurring — dismiss as FP.
- **Pre-existing security drift:** Dependabot/CodeQL alerts follow ADR-059/ADR-060 SLA.
- **BUG-004** (logo "green dot") is `cannot-reproduce`; **BUG-009/BUG-010** were S100 scope.

---

## Multi-Sprint Arc

- **S102 (done):** Visible Memory + Re-warm First Step (v11.11.0).
- **S103 (done):** Governance + Intake Clarity (v11.12.0).
- **S104 (done):** UI Facelift Research — A-plus verdict, ADR-079 Proposed, no deploy.
- **S105 (done):** UI Facelift Implementation — A-plus rollout, ADR-079 Implemented (v11.13.0).
- **S106 (this sprint):** Post-Facelift Correctness & Link-Up Clarity — BUG-013…016 + bounded link-up,
  deploy v11.14.0.
- **Deferred:** "platform forgets" visible decay; responder Home actionability; Dibs relationship
  routing; member forget/export; Service Consolidation Phase 2; mobile parity.

---

## Persistent Context

### Multi-agent PR process — live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR/branch/commit reviews it when
  two models are available.

### Architecture Gotchas

- **Frontend is Pages Router** (`apps/frontend/src/pages`), not App Router.
- **category vs request_type seam:** `help_requests.category` is mixed-vocab (enum on new rows, skill
  tokens on old/seed/sim rows). Never pass `category` where `request_type` (the enum) is expected —
  this is exactly the BUG-014 root cause.
- **Feed query surfaces:** browsable-request filtering lives in ~4 places; the feed ranker projection
  (`basicFeedRanker.ts`) is a separate seam. Change ALL relevant sites.
- **Design token system:** CSS-variable backed, in `apps/frontend/src/styles/globals.css` +
  `apps/frontend/tailwind.config.js`; per-community skins via `ThemeContext`/ThemeProvider.
- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored — `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-079 is the last; next free = **080**.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps — use `res.data`, not
  `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`.
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev — no worktrees:** work directly on feature branches.
- **request-service serves the feed** (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs and landing docs.
- No docs-only push to `master`; master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts — always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router
  mock.
- `npm audit --package-lock-only --audit-level=high` is blocked by tenant policy in-agent (exports
  private dep metadata externally); rely on the CI ADR-059 gate, don't work around it locally.

### Deploy Drift Watch

`karmyq.org` / demo live content has drifted from `master` before. Confirm the latest deploy
succeeded and live content matches `master` before judging by live content.
