# Unified Feed — Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the unified feed's first vertical slice — a canonical `request` card + a server-computed
`decision` top band on Dashboard Home, served from `GET /requests/curated?view=home` — landing the
urgency/status/`match_score` reconciliations the card depends on and verify-locking Withdraw-Offer.

**Architecture:** Extend `request-service`'s curated handler to return a `UnifiedFeedItem` union
(`request | decision | activity | story`, with `request`+`decision` populated S85) carrying a server-computed
action-altitude `priority`; the frontend renders one canonical `RequestCard` and a `DecisionBand` on
Dashboard Home, replacing `BrowseFeed`'s bespoke card. Community Feed view, texture layer, and legacy
retirement are Sprint 86.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql` | Idempotent migration: urgency `critical→urgent` + CHECK; status `pending→proposed` + CHECK. |
| `apps/frontend/src/types/unified-feed.ts` | `UnifiedFeedItem` union, `RequestCardData`, `DecisionData`, status-token + urgency types, `match_score` normalizer. |
| `apps/frontend/src/components/feed/RequestCard.tsx` | The one canonical request card. |
| `apps/frontend/src/components/feed/DecisionBand.tsx` | The "needs your response" top band. |
| `apps/frontend/src/components/feed/UnifiedFeed.tsx` | Dashboard Home container (decision band + ranked cards + caught-up end-state). |
| `services/request-service/tests/unit/curated-view-home.test.ts` | Unit test for the union shape + server-side priority ordering. |
| `services/request-service/tests/regression/sprint-85-withdraw-offer.test.ts` | Locks: responder can withdraw own proposed match. |
| `services/request-service/tests/tdd/sprint-85-unified-feed.test.ts` | Integration test for `view=home`. |
| `apps/frontend/tests/tdd/sprint-85-request-card.test.tsx` | RequestCard + DecisionBand rendering/action tests. |
| `docs/adr/ADR-066-unified-feed-model.md` | The architectural decision. |
| `apps/landing/src/data/docs/concepts/adr-066-unified-feed-model.json` | Landing mirror of ADR-066. |
| `apps/landing/src/data/docs/concepts/unified-feed.json` | "One feed, two views" concept page. |
| `apps/landing/src/data/docs/guides/dashboard-home.json` | User guide for the redesigned Dashboard Home. |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` | `handleCuratedFeed` gains `view=home`: returns `{ items: UnifiedFeedItem[] }`, adds `decision` items, normalizes `match_score` to 0–100 + `match_reason`, computes server-side `priority`. |
| `services/request-service/src/routes/matches.ts` | Verify (not change) the reject guard allows both participants; ensure clean rebuild purges stale `dist`. |
| `apps/frontend/src/lib/api.ts` | `getCuratedRequests` gains `view` param; typed to `UnifiedFeedItem[]`. |
| `apps/frontend/src/pages/dashboard.tsx` | Mount `UnifiedFeed`; thread on-duty + browse-mode state. |
| `apps/frontend/src/components/BrowseFeed.tsx` | Card replaced by canonical `RequestCard`. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update dashboard/browse workflow for decision band + canonical card. |
| `services/request-service/CONTEXT.md` | `view=home` param, union shape, vocab reconciliation, status CHECK. |
| `services/registry.json` | Note `view` param on `/requests/curated`. |
| `apps/landing/src/data/docs/services/request-service.json` | Document `view=home`. |
| `apps/landing/src/data/docs/nav.json` | Add ADR-066, unified-feed concept, dashboard-home guide entries. |
| `package.json` (root) | Version 10.8.0 → 10.9.0. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Source of truth is `request-service`, not the Feed service** — extend `/requests/curated` with `view=home`;
   do not route Dashboard Home through Feed service 3007 this sprint. (Open question 7.4.1 — decided.)
2. **Withdraw-Offer already works at the backend** (Sprint 62: `PUT /matches/:id/reject` allows both
   participants, [matches.ts:408](../../../services/request-service/src/routes/matches.ts#L408)). The stale
   `'Only the requester can reject this match'` string lives only in `dist/`/`coverage/` artifacts — **never edit
   those**; a clean rebuild purges them. S85 = wire decision-band Withdraw to `rejectMatch(matchId)` + regression
   test that the **responder** can withdraw + confirm deploy runs current `src`.
3. **`request_type` is the 5-value `request_type_enum`** and is already canonical. The 6 payload subtypes are a
   **separate `payload` concept** — do not migrate or conflate. No `request_type` DB change.
4. **Urgency: map `critical → urgent` before the CHECK; use `??`/`!= null` not `||`** for defaults (0 is valid).
5. **`match_score` is one 0–100 integer scale** + a `match_reason` string; normalize at the API boundary so the
   card never sees 0–1.
6. **Status token: `proposed` replaces `pending`** on `help_requests` only. Grep ALL services + frontend +
   simulation for `status = 'pending'` writes/reads on `help_requests` and update them. The `dibs`/`offers`
   tables keep their own `pending` lifecycle — do NOT migrate those.
7. **JWT field `communities`** (not `communityMemberships`); **schema `communities.communities`** (plural);
   **API unwrap `res.data`** not `res.data.data`; **`trust_edges_live` is a VIEW** (read-only).
8. **Action altitude is server-side** — compute `priority` in the curated handler; client renders in array
   order. Leave `CommitmentsTab` working unchanged (it stays home of the action handlers the band reuses).
9. **ADR-066 is reserved** for the Unified Feed Model.
10. **Pre-existing TDD failures are not S85 regressions** (see handoff). A *new* failure is real.

---

## Task 1: Feature branch + vocabulary reconciliation (migration + ALL producers, atomic)

> **⚠️ The urgency CHECK and every urgency producer MUST ship in the same branch.** Three urgency
> vocabularies exist today — if the CHECK lands without fixing the producers, request creation and admin
> triage will write a rejected value and 500. This task reconciles the DB **and** all producers together.

**Files:**
- Create: `infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql`
- Modify (urgency producers/validators/types/labels): `services/request-service/src/routes/requests.ts`
  (VALID_URGENCY validator ~line 1297), `services/request-service/src/routes/adminActions.ts`
  (critical-handling ~line 215), `apps/frontend/src/components/RequestWizard.tsx` (UrgencyLevel
  `normal|urgent|critical` ~line 15/363), `apps/frontend/src/components/community/tabs/BrowseTab.tsx`
  (triage dropdown + color map ~line 186/443/465), `apps/frontend/src/lib/api.ts` (triage urgency type ~line 524)

- [ ] Create branch `git checkout -b feature/sprint-85-unified-feed-dashboard-home`
- [ ] **Dry-run first** — before writing the migration, inspect real values so the CHECK won't reject a live row:

```bash
# Against demo DB (or local): list every distinct value to confirm the mapping is total
psql "$DATABASE_URL" -c "SELECT status, count(*) FROM requests.help_requests GROUP BY status;"
psql "$DATABASE_URL" -c "SELECT urgency, count(*) FROM requests.help_requests GROUP BY urgency;"
```

- [ ] **Canonical scale = `urgent | high | medium | low`.** Mapping for migration AND every producer:
  `critical → urgent`, `normal → medium` (RequestWizard's third vocabulary). No `request_type` change.
- [ ] **Grep every urgency producer/validator/type/label** and reconcile to the canonical scale — do this
  BEFORE adding the CHECK so nothing writes a rejected value:

```bash
# Find every urgency vocabulary site across backend + frontend + simulation (expect the 3 vocabularies)
grep -rn "critical\|'normal'\|\"normal\"\|VALID_URGENCY\|UrgencyLevel" services apps/frontend/src --include=*.ts --include=*.tsx | grep -i urgen
```
  - `requests.ts` VALID_URGENCY → `['urgent','high','medium','low']` (drop `critical`; accept `urgent`).
  - `adminActions.ts` triage → treat `urgent` as the top tier; remove the `critical` special-case.
  - `RequestWizard.tsx` → emit `low|medium|high|urgent` (map the old `normal`→`medium`, `critical`→`urgent`).
  - `BrowseTab.tsx` triage `<option>`s + the urgency→color map → canonical four; drop the `critical` option.
  - `api.ts` triage urgency type → `'urgent' | 'high' | 'medium' | 'low'`.
- [ ] **Write the idempotent migration** (urgency `critical→urgent` + CHECK; status `pending→proposed` + CHECK;
  no `request_type` change). Guards: `DROP CONSTRAINT IF EXISTS` before each `ADD CONSTRAINT`. Include the
  `cancelled` status in the allowed set so existing cancelled requests pass.
- [ ] **Verify** — migration re-runnable, no producer still emits a rejected value, both apps type-check:

```bash
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/20260603-feed-vocab-reconciliation.sql  # idempotent: no error
psql "$DATABASE_URL" -c "SELECT DISTINCT status, urgency FROM requests.help_requests;"  # all within CHECK sets
grep -rn "'critical'\|\"critical\"\|'normal'\|\"normal\"" services/request-service/src apps/frontend/src | grep -i urgen \
  && echo "FAIL: stale urgency vocab remains" || echo "OK: no stale critical/normal urgency producers"
cd services/request-service && npx tsc --noEmit && cd ../../apps/frontend && npx tsc --noEmit
```

- [ ] **`/simplify`** the producer-reconciliation diff.

---

## Task 2: Shared unified-feed types + match-score normalizer (TDD)

**Files:**
- Create: `apps/frontend/src/types/unified-feed.ts`
- Create: `apps/frontend/tests/tdd/sprint-85-request-card.test.tsx` (normalizer unit cases first)

- [ ] **Write tests first** for the `match_score` normalizer and status-token mapper:
  - `normalizeMatchScore(0.42)` → `42`; `normalizeMatchScore(42)` → `42`; `normalizeMatchScore(undefined)` → `null`
  - status mapper: `'pending' → 'proposed'`, others pass through; assert the exact reconciled token set
- [ ] **Define the union** `UnifiedFeedItem = request | decision | activity | story` with a server `priority:number`,
  `RequestCardData` (reconciled `urgency`, `status` token, `match_score:number|null`, `match_reason:string`,
  trust/Karma signals, polymorphic `payload`), and `DecisionData` (the match/dibs/offer + the owed action).
- [ ] **Verify**

```bash
cd apps/frontend && npx tsc --noEmit && npm test -- sprint-85-request-card
```

- [ ] **`/simplify`** the new types file.

## Task 3: Backend — `view=home` union endpoint with server-side action altitude (TDD)

**Files:**
- Create: `services/request-service/tests/unit/curated-view-home.test.ts`
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Write the unit test first**: `GET /requests/curated?view=home` returns `{ items }` where items are the
  union; `decision` items rank above `request` items by `priority`; `match_score` is 0–100 int (never 0–1);
  absent `view` still returns the legacy request array (back-compat). Assert exact priority ordering and exact
  normalized score values (no shallow truthiness — per the robust-testing standard).
- [ ] **Implement** `view=home` in `handleCuratedFeed`: build `decision` items from the member's matches/dibs/offers
  needing a response (reuse the same data `CommitmentsTab` reads), normalize `match_score`, compute `match_reason`,
  assign server-side `priority` (decisions > fillable requests), return the union. Keep `view` absent → legacy shape.
- [ ] **Grep + reconcile** every `status = 'pending'` write/read on `help_requests` across services/frontend/simulation
  → `'proposed'` (leave `dibs`/`offers` `pending` alone).
- [ ] **"Designed to forget" — make the prior-interaction signal decayed (manifesto/ADR-066 promise 1 & 3).**
  Today `handleCuratedFeed` feeds `scorePriorInteraction(...)` from `social_graph.connections.type`
  (`'exchange' | 'community'`, ~requests.ts:459/545) — a binary-ish category, NOT a half-life-decayed weight.
  Change the prior-interaction input to read the **decayed** edge weight (`trust_edges_live.current_weight`
  or the ADR-011 / `20260526-interaction-halflife` decayed value), so feed ranking reflects relationship
  *shape*, not raw history. **Read `trust_edges_live`, never write it** (it's a VIEW).
- [ ] **Assert it in the unit test**: prove the prior-interaction component reads the decayed weight (e.g. two
  requesters with equal raw interaction counts but different recency/decayed weights rank differently; a fully
  decayed edge contributes ~0). No raw-count assertion that would pass on undecayed data.
- [ ] **Verify**

```bash
cd services/request-service && npx tsc --noEmit && npm test -- curated-view-home
```

- [ ] **`/simplify`** the curated handler diff.

## Task 4: Backend — verify-lock Withdraw-Offer

**Files:**
- Create: `services/request-service/tests/regression/sprint-85-withdraw-offer.test.ts`
- Modify (verify only): `services/request-service/src/routes/matches.ts`

- [ ] **Confirm** the reject guard allows both participants (no code change expected — it does as of Sprint 62).
- [ ] **Write a regression test**: the **responder** (helper) of a `proposed` match can `PUT /matches/:id/reject`
  → 200, match `rejected`, request reopened if no other proposed matches; a non-participant → 403.
- [ ] **Clean rebuild** to purge the stale `dist` guard string; confirm `src` is the deployed truth.

```bash
cd services/request-service && rm -rf dist && npm run build && npm test -- sprint-85-withdraw-offer
grep -rn "Only the requester can reject" services/request-service/src || echo "OK: not in src"
```

## Task 5: Frontend — canonical `RequestCard` (TDD)

**Files:**
- Create: `apps/frontend/src/components/feed/RequestCard.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-85-request-card.test.tsx`

- [ ] **Extend the test**: card renders title/requester/community, the trust-path + Karma badges, the canonical
  status token, the explainable match score (`42% · 2nd-degree trust`), the polymorphic `payload` (commitment
  legibility), and an inline **Offer to Help** that calls `createMatch({ request_id, responder_id })` with the
  correct args (mock verifies payload). Assert hidden Offer when `requester_id === currentUserId`.
- [ ] **Implement** `RequestCard` absorbing `RequestPayloadRenderer`, trust/Karma badges, status token, inline
  offer (optimistic remove + "Offer sent → Track in Helping" banner). Source the renderer from the existing
  `Feed/FeedItem` code path — **borrow, don't delete** it this sprint.
- [ ] **Verify**

```bash
cd apps/frontend && npx tsc --noEmit && npm test -- sprint-85-request-card
```

- [ ] **`/simplify`** RequestCard.

## Task 6: Frontend — `DecisionBand` (TDD)

**Files:**
- Create: `apps/frontend/src/components/feed/DecisionBand.tsx`
- Modify: `apps/frontend/tests/tdd/sprint-85-request-card.test.tsx`

- [ ] **Extend the test**: the band renders `decision` items and exposes the right action per kind — accept/decline
  offer (as requester), **withdraw own offer** (as responder → `rejectMatch(matchId)`), accept/decline dibs, mark
  done. Mock verifies each action calls the correct service fn with the right id. Empty band → renders nothing.
- [ ] **Implement** `DecisionBand`, reusing the action handlers' API calls from `CommitmentsTab` (do not duplicate
  business logic — extract shared handlers if needed). Withdraw wired to `requestService.rejectMatch(matchId)`.
- [ ] **Verify**

```bash
cd apps/frontend && npx tsc --noEmit && npm test -- sprint-85-request-card
```

- [ ] **`/simplify`** DecisionBand.

## Task 7: Frontend — wire `UnifiedFeed` into Dashboard Home

**Files:**
- Create: `apps/frontend/src/components/feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`, `apps/frontend/src/components/BrowseFeed.tsx`,
  `apps/frontend/src/lib/api.ts`

- [ ] **`getCuratedRequests`** gains `view` param; typed to `UnifiedFeedItem[]`; unwrap `res.data` (not `res.data.data`).
- [ ] **Build `UnifiedFeed`**: fetch `view=home`, render `DecisionBand` on top + ranked `RequestCard`s below (array
  order = server priority), and the **"You're caught up — browse communities"** end-state when no requests remain.
  Preserve the on-duty Community/Provider/Both filter + the `FilterChipRow`.
- [ ] **Mount** `UnifiedFeed` on the dashboard Browse/Home surface; replace `BrowseFeed`'s bespoke card with the
  canonical `RequestCard` (fold `BrowseFeed` into `UnifiedFeed` or keep as a thin wrapper).
- [ ] **Verify**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```

- [ ] **`/simplify`** the dashboard wiring diff.

## Task 8: Version bump + ADR-066 + user/concept/landing docs

**Files:**
- Create: `docs/adr/ADR-066-unified-feed-model.md`,
  `apps/landing/src/data/docs/concepts/adr-066-unified-feed-model.json`,
  `apps/landing/src/data/docs/concepts/unified-feed.json`,
  `apps/landing/src/data/docs/guides/dashboard-home.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json`,
  `apps/landing/src/data/docs/services/request-service.json`,
  `apps/frontend/src/lib/onboarding/workflows.ts`, root `package.json`

- [ ] **Bump** root `package.json` 10.8.0 → 10.9.0.
- [ ] **Write ADR-066** (Unified Feed Model, status `Implemented`): one model / two views, the feed-item union,
  server-side action altitude, the chosen source-of-truth endpoint (`request-service` `view=home`), the vocab
  reconciliation (urgency / status `proposed` / `match_score` 0–100 + reason; `request_type` enum canonical vs
  payload subtype), and the deferred Community Feed/texture/retirement (S86). Add to `docs/adr/README.md` index.
- [ ] **ADR-066 must record the manifesto promises as binding constraints** (see spec "Manifesto Alignment"):
  (a) "designed to forget" — no permanent public ledger of acts; feed history is decayed/relationship-shaped only;
  (b) no broadcast reputation feed — `match_reason`/items explain *connection*, never publish a member's act
  history; (c) `feed_weight_prior_interaction` must read the half-life-decayed signal (ADR-011 /
  `20260526-interaction-halflife`), not a raw count — **verify this in the curated handler**; (d) sovereignty
  framing is "own rules, own context, own trust model" — do NOT claim per-community "instances".
- [ ] **Landing docs** (`git add -f` — dir is gitignored): ADR-066 JSON, `unified-feed` concept, `dashboard-home`
  guide, `request-service.json` `view=home` param; add all to nav.json. **Grep-verify nav.json didn't revert**
  (run generate-docs from `apps/landing/`; re-apply if reverted).
- [ ] **Onboarding** `workflows.ts` updated for the new decision band + canonical card.
- [ ] **Verify**

```bash
cd apps/landing && node scripts/generate-docs.ts 2>/dev/null || npm run generate-docs
grep -c "adr-066\|unified-feed\|dashboard-home" apps/landing/src/data/docs/nav.json   # entries present
```

## Task 9: CONTEXT.md + registry.json + TDD integration test

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json`
- Create: `services/request-service/tests/tdd/sprint-85-unified-feed.test.ts`

- [ ] **CONTEXT.md**: `view=home` param, `UnifiedFeedItem` shape, vocab reconciliation + status CHECK, Recent Fixes
  (withdraw verify-lock).
- [ ] **registry.json**: note the `view` param on `/requests/curated` (no new endpoint/event).
- [ ] **Integration test** `tests/tdd/sprint-85-unified-feed.test.ts`: `view=home` returns the union with decisions
  ranked above requests against seeded data.
- [ ] **Verify**

```bash
npm run feedback:check
npm run analyze:services
```

## Task 10: SDLC quality gates

- [ ] **`/simplify`** — final pass on the whole branch diff (reuse, altitude, the duplicate card consolidation).
- [ ] **`/code-review`** — resolve correctness/logic findings before merge.

```bash
# run /code-review on the branch diff; fix findings
```

- [ ] **`/security-review`** — resolve real findings; justify any dismissal in writing. Expect the recurring
  `js/request-forgery` FP on `apps/frontend/src/lib/api.ts` (env-var baseURL) — dismiss as false positive.

```bash
# run /security-review on the branch diff
```

## Task 11: Final type check + pre-push verification

- [ ] **Verify the full gate**

```bash
npx tsc --noEmit                                   # all workspaces clean
npm test                                            # unit + regression green (no NEW failures vs handoff list)
npm run test:tdd                                    # report (pre-existing failures OK)
npm run feedback:check                              # docs complete
npm audit --package-lock-only --audit-level=high   # ADR-059 gate clean
```

- [ ] Confirm no NEW TDD failure vs the handoff's pre-existing list.

## Task 12: Merge + Deploy

- [ ] Use the **`/deploy`** skill: merge to `master`, push, monitor GitHub Actions ("Deploy to Demo").
- [ ] **Confirm the migration applied automatically — do NOT rerun it manually.** `deploy.sh` Step 6 runs
  `scripts/apply-migrations.sh` before service deployment, so the new migration ships with the deploy. Verify it
  registered and took effect (only apply manually if deploy *skipped* migrations, e.g. an emergency `SKIP_TESTS`/
  partial run):

```bash
# On demo (or via the deploy logs): confirm the migration is recorded + the CHECKs are live
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations WHERE version LIKE '20260603%';"   # registered
psql "$DATABASE_URL" -c "SELECT DISTINCT status, urgency FROM requests.help_requests;"      # within CHECK sets
```

- [ ] **Validate on demo** (human validation step): API smoke (`GET /requests/curated?view=home` returns the union),
  DB check (`SELECT DISTINCT status, urgency` within CHECK sets), UI check (Dashboard Home shows the decision band +
  canonical cards + caught-up end-state; responder can withdraw an offer from the band).
