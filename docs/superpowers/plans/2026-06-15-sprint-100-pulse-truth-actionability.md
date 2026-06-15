# Pulse Truth + Feed Actionability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the community pulse tell the truth (distinct helpers, reachable open asks, exchanges
that actually show up as connections), collapse the engagement-y empty state to one honest "you're
caught up" message, make request cards actionable and legible, and fold in four functional items
(BUG-009 pulse gap, proposed-match surfacing on Home, BUG-010 split failure, sim liveliness).

**Architecture:** Server-side truth repairs in request-service (pulse query, open-asks reachability)
and social-graph-service (connection reconciliation from `request_communities`, ADR-078), plus
contained frontend changes to `CommunityPulse`, `UnifiedFeed`, and the canonical `RequestCard`.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/adr/ADR-078-community-connection-reconciliation.md` | **Source** ADR: community trust edge/connection derives from `request_communities` at completion, not the event payload (landing JSON is generated from this — never hand-write the JSON) |
| `scripts/backfill-community-connections.sql` | Idempotent backfill of missing connections/trust edges for historical completed matches (before/after counts; NOT a migration) |
| `services/request-service/tests/tdd/sprint-100-pulse-truth.test.ts` | Distinct-helper count + open-asks reachability semantics |
| `services/social-graph-service/tests/tdd/sprint-100-connection-reconcile.test.ts` | match_completed → connection + community trust edge derived from request communities |
| `apps/frontend/tests/tdd/sprint-100-request-card-clickable.test.tsx` | Card navigates to /requests/[id]; Offer still fires (stopPropagation) |
| `apps/frontend/tests/tdd/sprint-100-empty-state.test.tsx` | Empty dashboard feed shows single "You're caught up"; no Show-more button |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` | `helpedThisWeek` → `COUNT(DISTINCT responder_id)`; open-asks reachability feed mode |
| `services/request-service/src/utils/queryBuilder.ts` | Open-asks/`includeAll` query surface (check all feed surfaces) |
| `services/social-graph-service/src/events/subscriber.ts` | Derive community(ies) from `request_communities`; don't depend on payload `community_id` |
| `services/social-graph-service/src/services/trustEdgeService.ts` | Support multi-community edge creation per completed match |
| `apps/frontend/src/components/community/CommunityPulse.tsx` | Open-asks row → link; copy "across the community" |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Collapse empty state to "You're caught up" (no Show-more); read-only community-wide open-asks path; surface `proposed` matches (G1) |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Clickable body → /requests/[id]; clarify asker avatar (label + tooltip) |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update feed-walkthrough copy (drop "Show more open requests" two-step) |
| `services/simulation-service/src/workflows/*` + sim config | Raise pace + spread requests across more test users (G3) |
| `services/community-service` (or fission path) | BUG-010 split fix (exact file frozen in Task 1) |
| `docs/adr/README.md` | Add ADR-078 to the ADR index (required by the ADR process) |
| `scripts/generate-docs.ts` | Register `adr-078-community-connection-reconciliation` in `ADR_GROUPS` (Trust & Reputation group); add the community/feed guide to `GUIDE_ORDER`/`GUIDE_LABELS`/`GUIDE_SLUGS` if a new guide page is created |
| `docs/guides/*.md` | **Source** community/feed user guide(s) — the landing guide JSON regenerates from these |
| root `package.json` + `package-lock.json` | `11.8.0` → `11.9.0` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Audit first, freeze second.** Task 1 confirms the live state on community
   `308f7192-5c60-4c52-b7e8-56ead255ba52` (and BUG-009 `eb32c151…`, BUG-010 `446c2c65…`) before any patch.
2. **Fix at the source, not the client.** F1/F2/G1 are data/API truth bugs — fix the query and event
   path; never mask with client-side filters.
3. **Distinct, not raw.** `helpedThisWeek` must `COUNT(DISTINCT responder_id)` over the same member-scoped,
   completed-in-7-days subset used for `recentHelpers`, so the headline can't exceed the named helpers.
4. **Connection reconciliation derives from `request_communities`** at completion — never depend on the
   `match_completed` payload carrying `community_id`.
5. **Backfill is a script, not a migration** — idempotent, with before/after counts.
6. **`trust_edges_live` is a VIEW** — write through the trust-edge service/store, never INSERT/UPDATE it.
7. **Open-asks reachability includes own + offered**, rendered read-only (no Offer button on your own ask).
8. **Empty-state copy is verbatim**; remove the Show-more button there; update onboarding copy in the same change.
9. **Clickable card must `stopPropagation`** on the Offer button + inner links/badges.
10. **Trace ALL feed/query surfaces** (incl. `queryBuilder.ts`) before patching feed behavior (S92 BUG-002).
11. **Pulse is the single source of truth** for the in-feed ActivityCard and `GET /pulse` — keep one aggregation.
12. **G1 right-size; G2 reproduce-first; G3 bounded tuning** (see spec §Folded-in scope).
13. **Withdraw-Offer is OUT of scope** — verified already fixed; IDEAS entry annotated resolved.
14. **Version bump** `11.8.0` → `11.9.0`; **ADR-078** is the next free ADR.

---

## Task 1: Branch + live-data investigation (freeze the fix list)

**Files:**
- Create: feature branch `feature/sprint-100-pulse-truth-actionability`
- Create: `docs/bugs/sprint-100-pulse-truth-actionability.md` (audit log)

- [ ] Create the feature branch from `master`.
- [ ] Against the live demo (read `reference_demo_ux_audit_access.md` for SSH + container psql), confirm for community `308f7192-5c60-4c52-b7e8-56ead255ba52` and BUG-009 `eb32c151-9953-409f-87ad-9abed720e4f4`:
  - `helpedThisWeek` raw match count vs `COUNT(DISTINCT responder_id)` and the named-helper count.
  - Whether completed matches in those communities have `social_graph.connections` rows and community trust edges; how many are missing.
  - What the "1 open ask" actually is (own / already-offered / fillable) and how `openAsks` diverges from the member feed.
- [ ] **G1:** confirm Maria's `proposed` responder-match count and where (if anywhere) they currently surface on Home/Helping; decide the contained fix (band/query) vs. documented follow-up.
- [ ] **G2:** reproduce BUG-010 split on `446c2c65-64e1-4e8e-9d87-54671939a4da`; capture the exact server error + stack; name the exact file/layer to fix.
- [ ] **G3:** read the simulation request/provider distribution + pace config; identify the exact knobs to raise pace and spread requests across more users.
- [ ] Write findings + the **frozen fix list** (exact files, exact decisions) into the audit log.

```bash
git checkout -b feature/sprint-100-pulse-truth-actionability
```

---

## Task 2: TDD — pulse truth (RED)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-100-pulse-truth.test.ts`

- [ ] Write failing tests asserting `fetchCommunityPulse`:
  - returns `helpedThisWeek === COUNT(DISTINCT responder_id)` (one responder with 3 completed matches → `1`, not `3`), never exceeding `recentHelpers.length` when helpers are capped.
  - `openAsks` counts community-wide open+unexpired requests (incl. own/offered) — the reachable count.

```bash
cd services/request-service && npx jest tests/tdd/sprint-100-pulse-truth.test.ts   # RED
```

---

## Task 3: Pulse "neighbours helped" → distinct responders

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] Change `exchanges_completed_week` to `COUNT(DISTINCT m.responder_id)` over the existing member-scoped, completed-in-7-days subset (the same join feeding `recentHelpers`).
- [ ] Verify Task 2 distinct-count tests pass.
- [ ] `/simplify` on the diff.

```bash
cd services/request-service && npx jest tests/tdd/sprint-100-pulse-truth.test.ts
```

---

## Task 4: Connection reconciliation (ADR-078)

**Files:**
- Modify: `services/social-graph-service/src/events/subscriber.ts`, `services/social-graph-service/src/services/trustEdgeService.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-100-connection-reconcile.test.ts`
- Create: `docs/adr/ADR-078-community-connection-reconciliation.md`

- [ ] TDD (RED): a `match_completed` whose payload omits `community_id` still produces a community trust edge for each community in the request's `request_communities`, plus the `social_graph.connections` row.
- [ ] On `match_completed`, look up the request's communities (`requests.request_communities`) and create/upsert a trust edge for each — independent of the payload's `community_id`.
- [ ] Write ADR-078 documenting the decision + the divergence it closes.
- [ ] Verify reconcile tests pass; `/simplify`.

```bash
cd services/social-graph-service && npx jest tests/tdd/sprint-100-connection-reconcile.test.ts
```

---

## Task 5: Backfill historical connections/trust edges

**Files:**
- Create: `scripts/backfill-community-connections.sql`

- [ ] Idempotent script: for every `requests.matches` with `status='completed'`, ensure connection + community trust edge per `request_communities` community; upsert / `ON CONFLICT DO NOTHING`.
- [ ] Print BEFORE and AFTER counts; safe to re-run. **Not** placed in `infrastructure/postgres/migrations/`.
- [ ] Dry-run mentally / against a copy; document expected row deltas in the audit log.

---

## Task 6: Open-asks reachability (F2)

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`, `services/request-service/src/utils/queryBuilder.ts`, `apps/frontend/src/components/community/CommunityPulse.tsx`, `apps/frontend/src/components/Feed/UnifiedFeed.tsx`

- [ ] Backend: add a read-only community-wide open-asks mode (`includeAll`) returning all open+unexpired asks in the community (own + offered included), reusing the curated query path. Check **all** feed surfaces.
- [ ] Frontend: make the `CommunityPulse` open-asks row a link to that view; copy → "N open asks across the community".
- [ ] Frontend: `UnifiedFeed` renders own/offered asks read-only (no Offer button) in the open-asks view.
- [ ] Test the count is reachable (pulse number === rows shown in the open-asks view); `/simplify`.

---

## Task 7: Collapse empty state + clarify card (F3, F4, F5)

**Files:**
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`, `apps/frontend/src/components/Feed/RequestCard.tsx`, `apps/frontend/src/lib/onboarding/workflows.ts`
- Create: `apps/frontend/tests/tdd/sprint-100-empty-state.test.tsx`, `apps/frontend/tests/tdd/sprint-100-request-card-clickable.test.tsx`

- [ ] **F3 (RED→GREEN):** replace the dashboard empty state with the single verbatim message (heading "You're caught up"; body "No direct matches for you right now — but your communities may still have open asks waiting. Browse to lend a hand."; CTA "Browse communities"); remove the "Show more open requests" button from that empty state.
- [ ] Update `workflows.ts` feed-walkthrough copy to match (drop the two-step language).
- [ ] **F4 (RED→GREEN):** `RequestCard` body links to `/requests/[id]`; Offer button + inner links/badges `stopPropagation`.
- [ ] **F5:** asker avatar gets an accessible label + tooltip (e.g. `aria-label`/`title` "Asked by {name}").
- [ ] Verify both frontend tests pass; `/simplify`.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-100-empty-state.test.tsx tests/tdd/sprint-100-request-card-clickable.test.tsx
```

---

## Task 8: G1 — surface proposed matches on responder Home

**Files:**
- Modify: feed/Home surface frozen in Task 1 (likely `services/request-service/src/routes/requests.ts` decisions/band + `apps/frontend/src/components/Feed/*`)

- [ ] TDD first: a responder with outstanding `proposed` matches sees them as actionable items on Home (and/or Helping), per the Task 1 decision.
- [ ] Implement the contained surfacing fix; trace all feed/query surfaces before patching.
- [ ] If full surfacing exceeds the contained scope, ship the contained part and document the remainder in the audit log as an S101 follow-up.
- [ ] `/simplify`.

---

## Task 9: G2 — BUG-010 community split failure

**Files:**
- Modify: fission/split path frozen in Task 1

- [ ] Reproduce against `446c2c65…` + logs (systematic-debugging); write a RED regression test for the captured failure.
- [ ] Fix at the correct layer; verify the test passes.
- [ ] If genuinely not reproducible, document the investigation in the audit log and mark BUG-010 accordingly (do not blind-edit).

---

## Task 10: G3 — simulation pace / liveliness

**Files:**
- Modify: `services/simulation-service/src/workflows/*` + simulation config (see `services/simulation-service/CONTEXT.md`)

- [ ] Raise the simulation pace and spread fresh requests across more test users (bounded config/distribution change; no schema change).
- [ ] Verify locally that activity distributes across multiple accounts, not just early users.
- [ ] `/simplify`.

---

## Task 11: Docs — guides, landing, ADR, onboarding

> **Landing docs are GENERATED.** `apps/landing/src/data/docs/` (incl. `nav.json`) is wiped and
> rebuilt by `scripts/generate-docs.ts` (`fs.rmSync(OUT_DIR)` at ~L637). **Never hand-edit the JSON or
> nav.json** — edit the markdown sources + the generator's registries, then regenerate and force-add
> the output. (`apps/landing/src/data/docs/` is gitignored → `git add -f`.)

**Files:**
- Create: `docs/adr/ADR-078-community-connection-reconciliation.md` (if not already created in Task 4)
- Modify: `docs/adr/README.md` (ADR index entry), `scripts/generate-docs.ts` (`ADR_GROUPS` + `GUIDE_*` registries)
- Modify/Create: `docs/guides/*.md` (community/feed user guide source)
- Modify: service `CONTEXT.md` (request-service, social-graph-service)

- [ ] Write/update the community/feed user guide **source** in `docs/guides/*.md`: pulse numbers (distinct helpers, open asks across the community), reachable open-asks view, calm caught-up state, clickable cards. Remove "show more open requests" language. If it's a new guide page, register it in `GUIDE_ORDER`/`GUIDE_LABELS`/`GUIDE_SLUGS`.
- [ ] Add the ADR-078 **source** markdown (`docs/adr/ADR-078-*.md`) and add it to `docs/adr/README.md`.
- [ ] Register `adr-078-community-connection-reconciliation` in `ADR_GROUPS` (Trust & Reputation group) in `scripts/generate-docs.ts`.
- [ ] Regenerate landing docs (`npx ts-node scripts/generate-docs.ts` or the documented command); **grep-verify** ADR-078 + the guide appear in the generated `nav.json` after regen (nav.json silently reverts).
- [ ] `git add -f apps/landing/src/data/docs/` to commit the regenerated output.
- [ ] Onboarding `workflows.ts` already updated in Task 7 — confirm it matches shipped behavior.
- [ ] Update request-service + social-graph-service `CONTEXT.md` (pulse semantics, open-asks mode, connection reconciliation).

---

## Task 12: CONTEXT/registry + TDD integration test

**Files:**
- Modify: `services/registry.json`
- Create/Modify: `tests/tdd/` integration test for the pulse-truth + connection-reconcile flow

- [ ] Update `services/registry.json` for any new/changed endpoint or feed mode.
- [ ] Add a `tests/tdd/` integration test asserting: completed match → pulse distinct count + visible connection (end-to-end).
- [ ] `npm run analyze:services` if service dependencies changed.

---

## Task 13: SDLC quality gates

- [ ] **`/simplify`** — final pass on the whole branch diff (altitude, reuse, dead nudge copy removed).

```bash
# /simplify on the branch diff
```

- [ ] **`/code-review`** — resolve correctness/logic findings (pulse query, event reconciliation, feed surfaces, stopPropagation).

```bash
# /code-review on the branch diff
```

- [ ] **`/security-review`** — resolve real findings; the `apps/frontend/src/lib/api.ts` request-forgery hit is a known FP (justify dismissal).

```bash
# /security-review on the branch diff
```

---

## Task 14: Final verification

- [ ] `tsc --noEmit` clean across touched services + frontend.
- [ ] `npm test` (unit + regression) green; `npm run test:tdd` green or documented.
- [ ] `npm run feedback:check` passes.
- [ ] `npm audit --package-lock-only --audit-level=high` clean.

```bash
npm test && npm run test:tdd && npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

---

## Task 15: Merge + Deploy

- [ ] Open PR (copy `.github/pull_request_template.md` into the body); cross-agent review per protocol.
- [ ] Merge to master; monitor GitHub Actions "Deploy to Demo" (use the `/deploy` skill).
- [ ] **Post-deploy, run the backfill script** (`scripts/backfill-community-connections.sql`) against the demo DB and record before/after counts.
- [ ] Post-deploy validation (below); update handoff with final status + S101 direction.

### Post-deploy validation
1. Community `308f7192…` + BUG-009 `eb32c151…`: pulse "N neighbours" === distinct helpers === named, and "How we're connected" now shows the matching relationships.
2. Pulse open-asks row navigates to a reachable community-wide open-asks view; count matches rows shown.
3. Dashboard empty state shows the single "You're caught up" message; no "Show more open requests".
4. A community request card is clickable → `/requests/[id]`; Offer still works; avatar reads as the asker.
5. G1: a responder with `proposed` matches sees them actionable on Home/Helping.
6. G2: split works on `446c2c65…` (or documented not-reproducible).
7. G3: sample 3+ demo accounts — activity is distributed, not just Maria.
