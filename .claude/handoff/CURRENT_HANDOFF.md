# Sprint 101 - Actionability + State Truth - IMPLEMENTED, AWAITING PR/DEPLOY

> **STATUS (2026-06-15):** Sprint 101 is **implemented** on branch
> `feature/sprint-101-actionability-state-truth` (root version bumped to `11.10.0`). All 14 plan tasks
> are complete; local verification is green except for pre-existing/DB-gated failures (see below).
> Remaining: open the PR, pass CI, get Admin approval, merge to `master`, and run post-deploy
> validation.
>
> **What shipped this sprint:**
> - Request-service: `fetchOfferedAwaiting` returns `{count, items}`; `view=home` curated response now
>   carries `offeredAwaitingItems` (deduped preview, same predicate as the count). `GET /requests/:id`
>   is now the canonical viewer-aware read — derives `viewer_relation`
>   (`own_request|already_offered|can_offer|not_actionable`) + `viewer_match` + `payload_type`
>   server-side, and returns expired-open asks (finite state) instead of 404.
> - Frontend: `OfferedAwaitingPanel` (item-level Home preview); `/requests/[id]` restored as a real
>   detail/action page (no more redirect shim); community open-asks + BrowseTab copy point at the
>   detail action path; `MyRequestsTab` empty-offer copy is lifecycle-aware; `CommunityDepthGraph`
>   ring ordering is deterministic (membership→degree→name).
> - Docs: 6 user guides, onboarding `feed` workflow, frontend + request-service CONTEXT, registry, and
>   regenerated landing JSON.
>
> **Verification:** `npm test` (25 tasks) pass; cross-cutting `tests/regression` (sprint-75/76) pass;
> frontend tsc + request-service tsc clean; `npm audit --audit-level=high` clean (21 moderate within
> ADR-059 SLA). New Sprint 101 TDD: 3 frontend suites + touched regressions all green. The
> request-service TDD (`sprint-101-actionability-state.test.ts`) is DB-backed — it runs in CI / the
> deploy integration step (no local DB here). Pre-existing unrelated TDD failures persist and were
> confirmed on `master`: `sprint-38-trust-profile`, `sprint-39-provider-ux`, `sprint-40-admin-connectors`,
> `trust-model`, `useTrustQuestions`, and the one `sprint-85-unified-feed` "optimistically removes a
> card" case (verified failing on master's UnifiedFeed).
>
> **SDLC gates:** `/simplify`, `/code-review`, `/security-review` all run on the branch diff.
>
> **Cross-agent review (Codex) — both findings resolved:**
> - **High (write-path eligibility):** `GET /requests/:id` derived `can_offer`, but `POST /matches`
>   still trusted a client `responder_id` and only checked `status='open'` — a stale tab/forged body
>   could offer on expired-open / non-member / duplicate asks or as another user. Fixed: `POST /matches`
>   now derives the responder from the JWT (ADR-064) and enforces the same `can_offer` predicate
>   (typed errors `REQUEST_NOT_OPEN` / `OWN_REQUEST` / `NOT_COMMUNITY_MEMBER` / `ALREADY_OFFERED`);
>   admin propose-match keeps its own route; DB-backed TDD added. CI Integration Tests verify it.
> - **Medium (silent no-op):** the detail Offer button no longer reads `localStorage.user` or sends
>   `responder_id` — it calls `createMatch({ request_id })` and the server derives the responder.
> - **Open product question for maintainer:** the membership requirement matches the approved
>   `can_offer` spec but narrows cross-community (trust-network tier) offers vs. prior behavior —
>   intentional, flagged in the PR for confirmation.
>
> **Important carry-forward:** 19-21 moderate dependency advisories remain within ADR-059 SLA. They
> are secondary unless a low-risk cleanup naturally fits; high/critical audit gate remains blocking.

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-101-actionability-state-truth`.
3. Open plan: `docs/superpowers/plans/2026-06-15-sprint-101-actionability-state-truth.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Make every request surface state the lifecycle truth and offer the next real action: Home pending
offers become item-level, community ask clicks open real detail/action, completed asks stop saying
"No offers yet," and graph-crossing work stays bounded to simple deterministic improvements.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-15-sprint-101-actionability-state-truth-design.md`
- Plan: `docs/superpowers/plans/2026-06-15-sprint-101-actionability-state-truth.md`

---

## Scope

### In Scope

- **Per-item proposed-offer surfacing (G1 follow-up):** keep the Home `offeredAwaiting` count, add
  `offeredAwaitingItems`, and render a compact Home preview of the actual asks waiting on requesters.
- **Real request detail action route:** replace `/requests/[id]` redirect shim with a viewer-aware
  detail page. Community open ask cards should open detail and offer action where eligible.
- **State-aware Asks copy:** "No offers yet" appears only for open asks; completed/matched/cancelled
  asks use lifecycle-true copy.
- **Community Home/open-asks copy:** replace unclear "calm queue" copy with literal open-ask/action
  language.
- **Router test guardrail:** preserve the global `apps/frontend/jest.setup.js` `next/router` mock;
  avoid scattered per-test mocks except when a custom spy is needed.
- **Bounded graph layout spike:** try simple deterministic ordering only; document if crossings are
  inherent and not worth hand-placement.
- **Docs/onboarding/context:** update affected user guides, onboarding copy, frontend context, and
  request-service API docs/registry when response contracts change.

### Out of Scope

- Broad research-first UI facelift.
- Full dependency-advisory cleanup unless low-risk and non-disruptive.
- "Platform forgets" visible-decay delivery.
- Manual graph layouts or tedious per-community graph tuning.
- New service or schema changes.

---

## Critical Implementation Notes

1. **Do not scatter router mocks.** `RequestCard` and `/requests/[id]` use Next routing. The global
   `apps/frontend/jest.setup.js` `next/router` mock already exists; preserve it and use per-file mocks
   only when a test needs a custom `push`/`replace` spy.
2. **Keep keyboard navigation guarded.** Click `stopPropagation` is not enough: `RequestCard`
   `onKeyDown` must keep `e.target === e.currentTarget` so Enter/Space on inner controls does not
   also navigate.
3. **Request detail is the action surface.** Do not send community open-ask clicks to Asks/Helping as
   a substitute for detail. `/requests/[id]` should show the ask and the next valid action.
4. **Pending responder offers are not decisions.** They await the requester. Surface them as "offered
   awaiting" items, not in the "Needs your response" decision band.
5. **Count and items must agree.** `offeredAwaiting` should count distinct open asks; preview items
   should be selected from the same predicate and deduped by request.
6. **State copy must be lifecycle-aware.** "No offers yet" is valid only for an open ask. Completed,
   matched, cancelled, or expired asks need different copy.
7. **Open-asks semantics stay community-wide.** The pulse/open-asks page includes own asks and
   already-offered asks for count reachability; action eligibility is handled by the detail page.
8. **No client-side truth workaround for server state.** Viewer relation (`own_request`,
   `already_offered`, `can_offer`, `not_actionable`) must be derived server-side for request detail.
   `can_offer` means the ask is open, unexpired, not the viewer's own request, the viewer has no live
   proposed/matched responder match, and the viewer is an active member of at least one request
   community. Expired or non-member open asks are `not_actionable`, not optimistic buttons that 403.
9. **Graph layout is bounded.** Try deterministic ordering only if it is simple and formulaic. Do not
   hand-place nodes or invent a tedious pattern.
10. **Docs are part of done.** User guides, onboarding copy, frontend context, and API docs (if
    contracts change) ship with the sprint.
11. **Moderate dependency advisories remain secondary.** Clean them only if low-risk and not at the
    expense of the product truth work; high/critical audit gate still blocks per ADR-059.

---

## Tester Accounts

```text
maria.reyes@test.karmyq.com / password123        # rich state (15 communities, providers, trust)
aisha.white6964@test.karmyq.com / password123    # simpler member (Berkeley Community Care)
```

Useful validation flows:

- Maria Dashboard Home should show pending offered items, not only one aggregate count.
- A community open ask should open `/requests/[id]` and show detail/action.
- Offering from detail should move the item to awaiting response / Helping.
- Expanding a completed Asks item should not say "No offers yet."

---

## Previous Sprint State

- **Sprint 100 (v11.9.0) deployed + validated.** PR #89 merged (squash `4c2af914`); CI/CD deploy
  succeeded. Dependency-audit gate was unblocked first via PR #90.
- What shipped: pulse distinct helpers; reachable open-asks view; single caught-up message; clickable
  cards; labelled avatar; Home offered-awaiting count; split partial-unique-index fix; faster sim.
- Known/flagged: moderate advisories remain; pre-existing frontend TDD failures (trust-profile,
  provider-ux, admin-connectors, trust-model) were confirmed unrelated in Sprint 100.
- Audit log: `docs/bugs/sprint-100-pulse-truth-actionability.md`.

---

## Multi-Sprint Arc

- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99 (done):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100 (done):** Pulse Truth + Feed Actionability (v11.9.0).
- **S101 (this sprint):** Actionability + State Truth (v11.10.0).
- **S102+ candidates:** research-first UI facelift; founding-circle review/notify surface;
  community/provider link-up clarity; "platform forgets" visible-decay delivery.
- **Deferred:** Service Consolidation Phase 2 (geocoding -> client-side, ADR-071); mobile parity.

---

## Persistent Context

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models
  are available.

### Architecture Gotchas

- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-078 shipped in S100; next free ADR = **079** if this sprint needs one.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use
  `res.data`, not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.
- **Pulse single source of truth:** `fetchCommunityPulse` feeds both the in-feed ActivityCard and
  `GET /pulse`.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts — always grep-verify after editing.
- Widely-rendered components using `useRouter` need the global `apps/frontend/jest.setup.js` router
  mock. Do not patch many test files with duplicate router mocks.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
