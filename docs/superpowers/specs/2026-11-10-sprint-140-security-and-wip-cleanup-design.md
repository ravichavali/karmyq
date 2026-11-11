# Sprint 140: Security, Identity and Focused WIP Repair — Design Spec

**Date:** 2026-11-10

**Status:** Approved for PR A execution after repo/CI review; PR B is decision-gated and later

**PR A Version:** v11.112.0 → v11.113.0, provisional; re-derive from `origin/master` at merge time

**PR A Branch:** `agent/claude/sprint-140-planning`

## Overview

The maintainer selected all four original workstreams, then approved a two-PR split after review found that the original single-PR WIP design conflicted with CI and could delay the security fix.

**PR A — deadline-safe correctness bundle:**

1. Resolve node-forge Dependabot alerts #181–#184 with a surgical 1.4.3 floor/lock update.
2. Fix BUG-100 so membership listings use authenticated identity; explicitly keep simulation nomination/ratification disabled for now.
3. Fix BUG-099's offers **All** filter and BUG-098's confirmed double-unwrapped frontend responses.
4. Repair the **eleven clear non-infrastructure WIP suites**: eight frontend, request `sprint-125-provider-reach-gate`, and root `sprint-36-commitment-depth` + `preferredProviderNotification`.

**PR B — later infrastructure/legacy cleanup:** twenty remaining suites, including `admin-schemas-api`, require explicit CI-tier and rewrite/retire decisions before implementation. It is not a hidden relocation exercise and does not hold PR A or the node-forge SLA hostage.

### Core Principle: Trust the boundary, and never call a test repaired when it has merely stopped running

Identity comes from authentication, response reads match the actual client boundary, filters mean what their labels say, and every test has an explicit executed disposition. A move into an unrun tier is retirement by another name.

## Maintainer decisions and authorization boundary

- The recorded dependency-lane authorization is accurate: **Claude owns the node-forge 1.4.3 repair only**.
- The maintainer chose **split, admin in B**: PR A has eleven clear unit/UI suites; PR B has twenty infrastructure/legacy suites, including `admin-schemas-api`.
- The maintainer chose **disable both simulation workflows for now**: set every `nominateMember` and `ratifyNomination` action weight to 0 in PR A pending the ratification-quorum decision.
- Dependabot PR **#333** was inspected read-only and must not be merged, closed or pushed. Its intended security delta is reimplemented surgically.
- Merges, deploys, demo-host reads/writes, alert dismissals and ADR-number allocation each require separate explicit authorization. None is granted.
- Issue **#329 stays open**. Re-check dismissed deepmerge alert **#178** at the next Expo SDK move or by **2026-12-01**.
- The revised planning documents are committed before execution so the implementation handoff starts clean.

## Verified baseline

On 2026-11-10, `git fetch origin` succeeded. The branch was clean at `a212cfd8`, based on `origin/master` `8aabc50c` (v11.112.0). Recent master commits were `8aabc50c`, `74c5a8e5`, `17e453f8`; only PR #333 was open. These dated observations reserve no shared resource.

| Existing behavior or state | Evidence |
|---|---|
| Root node-forge override is `>=1.4.2`; security regression still pins 1.4.2 | `package.json:67-76`; `tests/regression/sprint-131-d9-security-overrides.test.ts:44-60` |
| #181/#182/#183 medium and #184 low are node-forge, patched in 1.4.3 | GHSA-j8rw-jp99-435v, GHSA-6cv4-p8m7-4r25, GHSA-w4xr-hqv8-ch44, GHSA-6889-vf6x-f3g5; SLA 2026-11-24 |
| PR #333 changes override/lock but removes **26** unrelated `libc` entries | Fresh read-only `gh pr diff 333` parse: 26 removed entry keys, 43 removed lines including values |
| Membership route requires and queries `req.query.user_id` | `services/community-service/src/routes/communities.ts:266-288` |
| Community router is behind `authMiddleware` | `services/community-service/src/index.ts:181-188` |
| Offers **All** has empty value; omitted status defaults to active | `apps/frontend/src/pages/offers/index.tsx:37-56,100-109`; `services/request-service/src/routes/offers.ts:24-54` |
| The API interceptor replaces `response.data` with envelope `data` | `apps/frontend/src/lib/api.ts:82-91` |
| Simulation workflows omit user id and return early on the current 400 | `services/simulation-service/src/workflows/governance-nominate-workflow.ts:10-40`; `src/api-client.ts:237-243` |
| Nomination/ratification have nonzero weights and deploy restarts simulation | `services/simulation-service/src/profiles/index.ts:99-122,190-194`; `scripts/deploy.sh:369-392` |

### CI and test-tier reality

- Required CI integration runs only root `cd tests && npm run test:integration` (`.github/workflows/ci.yml:323-326`). Root Jest integration discovers only `tests/integration/**/*.integration.test.ts` (`tests/jest.integration.config.js:15-18,38,47`).
- The pre-push hook likewise runs only root integration when PostgreSQL is available (`scripts/git-hooks/pre-push:49-66`).
- `.github/workflows/test.yml:14-80` covers only auth-service; its integration command is nonblocking. Request/social-graph service integration directories are therefore not required execution merely because a script exists, and community has no integration directory.
- `sprint-117-demo-reset.integration.test.ts` intentionally stays in root `tests/tdd/`. CI invokes that exact path **last**, because it applies the destructive curated reset twice (`ci.yml:342-349`; test `:1-10,354-398`). Moving it breaks the exact-path step and risks placing the wipe in the main integration run.
- Build images require `test-integration`; deploy requires build images (`ci.yml:375-413`). Unready legacy suites cannot be moved unchanged into that required path.

### WIP baseline actually executed

Both planning and review runs of `npm run test:tdd` reported **31 failing suites / 148 failed tests**. Passing cases in partially failing suites remain covered.

| PR | Workspace | Suites |
|---|---|---|
| **A: 11** | frontend: 8 | `sprint-40-admin-connectors`, `useTrustQuestions`, `sprint-39-provider-ux`, `sprint-85-unified-feed`, `sprint-38-trust-profile`, `sprint-89-community-page-ia`, `sprint-102-community-memory-copy`, `trust-model` |
| **A** | request: 1 | `sprint-125-provider-reach-gate` — two stale membership bind-order assertions; its real-DB companion already lives in root integration |
| **A** | root: 2 | `sprint-36-commitment-depth`, `preferredProviderNotification` — pure imports/functions/templates, no live infrastructure |
| **B: 20** | request: 8 | `sprint-101-actionability-state`, `sprint-107-offered-awaiting-truth`, `sprint-89-community-pulse`, `sprint-100-pulse-truth`, `sprint-85-unified-feed`, `sprint-97-community-pulse`, `sprint-108-admin-proposed-decision`, `admin-schemas-api` |
| **B** | community: 2; social-graph: 4 | `sprint-100-split-reexecute`, `sprint-67-governance`; `sprint-66-trust-graph-visualization`, `sprint-67-ego-network`, `sprint-68-halflife`, `sprint-100-connection-reconcile` |
| **B** | root: 6 | `sprint-42-dibs`, `rateCards`, `sprint-43-feed-ranking`, `preSelectProvider`, `trust-evolution-flow`, `sprint-117-demo-reset.integration.test` |

`admin-schemas-api` is deliberately **not** in PR A. It is a 605-line API/DB scaffold with uninitialized `app`/`pool` and TODO setup (`services/request-service/tests/tdd/admin-schemas-api.test.ts:13-41,69-79,124-129`), with existing integration/E2E coverage to reconcile. Calling it a ready unit repair would hide a rewrite/retire decision inside the deadline PR.

## Scope and non-goals

PR A includes only the security delta, three bugs, the explicit simulation disablement, eleven WIP repairs, directly implicated tests/docs and two new root integration suites. PR B gets a separate plan after its decision gate.

No schema, migration, new endpoint, event, dependency other than the authorized node-forge splice, broad API-wrapper refactor, mobile work or demo operation. No class-wide `.data.data` ban or typed-wrapper expansion. No service integration moves or CI workflow changes in PR A. Because PR A changes community, request and simulation services, it requires a cross-service ADR under `CLAUDE.md`; the maintainer must separately allocate its number before that file is created. No ADR number is currently allocated or self-assigned.

## A. node-forge #181–#184 — surgical patched-floor update

Change only:

1. Root `package.json` override `"node-forge": ">=1.4.2"` → `">=1.4.3"`.
2. The single intended node-forge lock entry from 1.4.2 to 1.4.3, with matching resolved URL and integrity.
3. The existing security-floor regression's node-forge expectation and stale comment.

Raise the regression floor first and capture red against unchanged manifests, then splice in place. Do not regenerate the lock, run `npm install --workspace`/`npm dedupe`, or copy #333's 26 unrelated `libc` deletions.

Prove with `npx -y npm@11.19.0 ci`, full `npm ls --all` baseline comparison, `npm ls node-forge --all`, the normal audit and a low-severity audit. Only node-forge may differ in the resolved dependency tree. Branch audit success does not mean GitHub alerts closed before merge. Later version edits may touch the three root version fields only.

## B. BUG-100 — authenticated identity without activating governance simulation

Keep `GET /communities/my/communities`, its envelope, active membership/community filters, ordering and router auth. Use:

```ts
const userId = (req as any).user?.userId;
if (!userId) {
  return sendUnauthorized(res, 'Authentication required', { requestId: (req as any).id });
}

// Existing SQL remains unchanged; only its parameter changes:
// WHERE m.user_id = $1 AND m.status = 'active' AND c.status = 'active'
// params: [userId]
```

Legacy `user_id` is ignored whether omitted, own or foreign. Every authenticated request returns only the caller's memberships; missing identity denies before DB. Do not add a mismatch 403. Keep `communityService.getMyCommunities(userId)` and existing callers compatible; the parameter no longer has server authority.

### Required simulation containment

The current simulation calls `getCommunities()` without an id, catches the 400 and returns no communities. The security fix removes that accidental kill switch. Because the maintainer has not approved activating nomination/ratification and quorum remains open, set these to zero in `services/simulation-service/src/profiles/index.ts`:

```ts
nominateMember: { weight: 0, avgPerSession: 0.05 },
ratifyNomination: { weight: 0, avgPerSession: 0.1 },
// SOCIAL_USER:
ratifyNomination: { weight: 0, avgPerSession: 0.05 },
```

Apply zero weights to every profile entry for these actions (the two shown blocks represent all currently listed entries). Keep `avgPerSession` values unchanged for future reactivation; `selectWorkflow`'s truthy-weight guards (`:193-194`) exclude zero-weight actions. Do not delete workflows or change governance production routes. Add tests that every profile has zero weights and the selector cannot return either disabled action. Document that reactivation requires a separate maintainer/product decision.

Real BUG-100 integration creates two users with disjoint memberships and proves omitted/own/foreign behavior and denial. Simulation tests prove containment without contacting the demo.

## C. BUG-099 — explicit all with stable parameter numbering

The offers page option becomes `<option value="all">All</option>`, so the existing truthy param construction sends `status=all`. Omitted status still defaults to `active` for simulation, mobile and other clients.

Keep `$1` as status and `$2` as viewer for every request. For exact `all`, bind `null`; otherwise bind the requested/default status:

```ts
const { community_id, status = 'active', type, limit = 50, offset = 0 } = req.query;
const viewerId = (req as any).user?.userId ?? null;
const statusParam = status === 'all' ? null : status;

// Query fragment:
// WHERE ($1::text IS NULL OR o.status = $1)
//   AND <existing offerReadableSql('o', '$2')>
//   AND <existing Sprint 139 owner/status/expiry OR>

const params: any[] = [statusParam, viewerId];
let paramCount = 3;
```

The null-aware predicate removes only status filtering for `all`; it does not drop a SQL fragment or renumber viewer/community/type/limit/offset parameters. All other statuses retain equality semantics. Keep the audience and expiry predicates as outer mandatory ANDs, and preserve ordering, pagination and envelope.

**All** may return readable active, matched and withdrawn together. It does not expose outsider rows, override Sprint 139 expiry visibility or permit new holds on expired offers. Tests pin exact SQL/params for omitted/active/matched/withdrawn/all with optional filters, mixed-status UI rendering, and real audience/expiry behavior.

## D. BUG-098 — consume the intercepted response exactly once

Leave the interceptor unchanged. After interception, `response.data` is already the payload.

| Consumer | Required read |
|---|---|
| `pages/admin/trust-questions/index.tsx:44` | `res.data.questions` |
| `pages/settings/preferences.tsx:115-137` | `prefsResponse.data.preferences`, `interestsResponse.data.interests`; no unwrapped `data.success` guard |
| Preferences add-interest `:194-205` | `response.data.isNew`, `response.data.id` and payload fields |
| `contexts/MessagingContext.tsx:199-200,223-228,298-299` | Conversation/message arrays or objects from `response.data` |
| `components/InlineChat.tsx:60-61` | `response.data.conversation_id` |
| `components/FloatingChat.tsx:52-54` | `response.data` conversation array |

`useTrustQuestions` already reads `res.data.questions`; repair only its mock to `{ data: { questions } }`.

Three valid lookalikes stay unchanged:

- `pages/invite/[code].tsx:50` — raw Axios helper (`api.ts:900-901`).
- `api.ts:144` — raw Axios refresh fallback.
- `hooks/useMessaging.ts:163-178` — raw `fetch`, then `data.data.messages`.

Trace any remaining occurrence before changing it; defensive fallbacks are not automatically defects. Tests mock the actual boundary and prove rendered/state outcomes. No global gate or wrapper rewrite.

## E. PR A — eleven unit/UI repairs, with explicit `git mv` promotion

Repair tests/source according to the current intended contract, never whichever output happens to make a suite green.

- **Frontend eight:** diagnose each stale mock/import/DOM/UI assertion from live failure and current source. Coordinate `useTrustQuestions` with section D. Preserve all passing cases and run each suite directly.
- **Request Sprint 125:** the only observed failures are at `:104` and `:268`. Current membership SQL binds `[COMMUNITY, VIEWER]`, not `[VIEWER, COMMUNITY]`; update those two expectations and retain every authorization, reach, route-order and real-DB companion assertion. This is unrelated to BUG-099.
- **Root Sprint 36:** current sorter takes `created_at`, preserves generic item type, sorts proposed → matched → completed and same-tier `created_at` ascending (`apps/frontend/src/utils/commitmentSort.ts:1-14`). Replace stale `updated_at` fixtures/expectations accordingly; do not weaken production types.
- **Root preferred-provider notification:** current template deliberately classifies pre-selection as high-priority with `{ in_app: true, push: true, email: false }` (`notificationTemplates.ts:217-226`). Update the stale push expectation only after confirming that current policy; preserve title/body/actionUrl and other channels.

Use **`git mv` only** for each exact green file promoted to its blocking regression tier. Never run `node scripts/promote-tdd-tests.js` directly: it sweeps every green service/app `.test.ts` (`scripts/promote-tdd-tests.js:22-35,84-107`). It ignores `.tsx`, so frontend TSX promotion is always an explicit `git mv`. Host `ignore-scripts=true` was observed, but snapshot/reconcile after every full `npm test` anyway.

PR A does **not** require `npm run test:tdd` to exit 0 on Windows. Twenty known PR-B suites remain visible, including the intentionally DB-dependent Sprint 117 reset. PR A requires its eleven suites and all new tests green/promoted, required unit/regression green, and no new/unclassified TDD failure.

## F. PR B — twenty suites, decision gate before implementation

PR B starts in a later planning chat on a fresh branch from then-current `origin/master`. No test moves or CI edits are authorized by PR A's execution plan.

Two maintainer-approved design artifacts are required first:

1. **CI execution design:** decide whether and how service integration tiers become required CI jobs/steps, with correct env, discovery and blocking semantics. Merely moving tests into request/community/social-graph `tests/integration` is forbidden until those tiers actually run in required CI. Account for pre-push behavior separately.
2. **Per-suite rewrite/repair/retire ledger:** every one of the twenty suites gets a named disposition. Legacy live-service tests must gain self-contained fixtures and current routes before joining required root integration; simulation-seeded accounts are absent from CI. `sprint-42-dibs` and `preSelectProvider` currently call nonexistent `/community/my`; `rateCards` also depends on simulation seed data.

`sprint-117-demo-reset` stays at its exact TDD path and runs last by the dedicated CI step. It is never moved into the main integration glob. Local Windows TDD may continue to report its missing-DB failure; CI is its blocking execution environment.

Obsolete tests may be **retired only with separate written maintainer approval**, after documenting the removed/obsolete contract and replacement coverage. No general deletion authorization is granted. `admin-schemas-api` specifically requires a rewrite-versus-retire decision against existing `services/request-service/tests/integration/dynamic-schemas.test.ts`, live-role integration and `tests/e2e/admin/schema-management.spec.ts` coverage.

## Documentation updates for PR A

- `docs/guides/community-admin-guide.md`: authenticated membership privacy and repaired trust-question admin surface.
- `docs/guides/fulfilling-requests-guide.md`: explicit All, default Active, unchanged audience/expiry.
- `docs/guides/profile-guide.md`: restored preferences behavior in user language.
- `docs/guides/testing-guide.md`: eleven PR-A repairs, twenty visible PR-B suites, no unrun-tier moves, exact `git mv` promotion and Sprint 117 exception.
- Simulation CONTEXT and relevant demo/governance docs: nomination/ratification simulation weights deliberately zero pending a separate decision; production endpoints remain.
- Affected community/request/frontend/notification/simulation/root CONTEXT; `services/registry.json` only for actual membership/offer contract descriptions, no invented edges.
- `docs/BUGS.md`: mark BUG-098/099/100 fixed only after branch proof; record eleven repaired suites and twenty deferred, never claim all WIP green.
- Relevant existing onboarding copy only; regenerate landing docs and remove metadata-only churn.
- A maintainer-numbered cross-service ADR plus `docs/adr/README.md` index entry, because PR A changes community, request and simulation services. Keep it Proposed until deployed; no number may be self-assigned.

## Acceptance and required evidence

| Area | Required evidence |
|---|---|
| node-forge | Floor test red/green, strict npm 11.19.0 ci, full tree comparison, only intended lock delta, normal + low audit, no #333 merge/dismissal |
| BUG-100 + simulation | Own/foreign/omitted identity and no-DB denial; real two-user root integration; all nominate/ratify weights zero and selector exclusion; no demo activation claim |
| BUG-099 | Stable `$1`/`$2` and optional params; default active; mixed all; real audience/expiry; UI sends `all` |
| BUG-098 | Confirmed consumers read once; preferences/messaging state proven; three valid lookalikes preserved |
| PR-A WIP | Exactly eleven named suites repaired, direct green proof and explicit `git mv` into blocking regression; no test-count/assertion loss |
| Deferred WIP | Twenty named suites remain visible and assigned to PR B; no service-tier move, Sprint 117 move or unready root-integration addition |
| Release A | Required unit/regression/type checks and four SDLC gates green; new root integration green in CI; TDD warnings honestly limited to known PR-B set; one PR, then stop |

## Critical implementation notes

1. Commit revised planning docs before Task 1; then reuse the existing branch for PR A, one editor, no rebase/force-push/master push.
2. Security is first implementation commit. No dependency scope expansion.
3. BUG-100 ignores legacy id; PR A simultaneously prevents accidental simulation governance activation with zero weights.
4. BUG-099 uses null `$1` for all, stable `$2` viewer and unchanged optional numbering.
5. BUG-098 preserves interceptor and all three raw-client lookalikes.
6. Eleven PR-A suites are repaired and promoted with exact `git mv`; never run the broad promoter directly.
7. Twenty PR-B suites remain visible. No unrun service-tier move, no Sprint 117 move, no unchanged legacy root-integration move.
8. No merge, deploy, demo operation, dismissal or ADR number without separate authorization. #329 stays open; #178 due 2026-12-01.
