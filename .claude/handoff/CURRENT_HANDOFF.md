# Sprint 117 — Controlled Demo Reset and Curated Fixtures — IN PROGRESS

> **STATUS (2026-07-02):** Sprint 116 merged on `master` (`f02f736e`, v11.25.3). Sprint 117
> execution is underway on `agent/codex/sprint-117-curated-demo-reset` (Claude executing the
> Codex-authored plan via `superpowers:executing-plans`).
>
> **Tasks 1–6 of 14 COMPLETE, committed, all green.** Latest commit `886c70f6`.
> - T1/T2: deterministic curated manifest + compiler (`services/simulation-service/src/fixtures/curatedDemo/{types,manifest,compiler}.ts`) — 36 people, 6 communities, semantic-key UUIDs, one-anchor ages, fail-closed validation. 3/3 green.
> - T3/T4: complete fail-closed `tablePolicy.ts` (every managed base table + public.geocoding_cache classified; views excluded) and guarded `resetCoordinator.ts` (dry-run default; ordered fingerprint→disable→pause→backup→lock→txn) + `baselineWriter.ts` (savepoint-fixpoint DELETE reset that honors ON DELETE SET NULL; FK-ordered source inserts) + `resetDemoData.ts` CLI. 8/8 green.
> - T5/T6: fixture-only `packages/shared/src/projections/completedExchange.ts` — equivalence-locked to production `computeRawWeight` + `allocateKarma` (cross-workspace gate `tests/tdd/sprint-117-projection-equivalence.test.ts`). Exported from `@karmyq/shared` (main + subpath); baseline writer inserts projections grouped by community. 4/4 green.
>
> **KEY DECISIONS MADE DURING EXECUTION (carry forward):**
> - `SemanticKey` is a plain `string` (not a template literal) so the compiler — not the type system — rejects dangling refs at runtime (the RED contract passes literal `'missing'`).
> - Reset uses **DELETE + savepoint fixpoint**, NOT `TRUNCATE CASCADE`: UI-schema/config catalogs carry `ON DELETE SET NULL` audit FKs to `auth.users`, so CASCADE would wipe seed data. `preserve` = `federation.local_instance`, `communities.config_templates`, `requests.ui_schemas`/`ui_schema_versions`/`validation_rules`. `feedback_categories`→reset, `interaction_weights`→reseed (community-scoped child).
> - `bcryptjs` is lazy-`require`d in the default deps factory (it is hoisted via auth-service) to avoid cross-platform lock churn; unit tests inject a fake hasher.
> - The equivalence test must run via the tests workspace: `cd tests && npx jest tdd/<file>` (root `npx jest tests/tdd/...` is NOT discovered by root testMatch).
> - Projection allocates each match across ALL `communityConfigs` passed (locked contract); baseline writer therefore groups events by community so demo karma stays in the community where help happened.
>
> **REMAINING: Tasks 7–14.** T7/T8 (API verifier + story lifecycle + configPublisher + rotation + health + api-client reads + rehearse wrapper) are the largest. T9 (protected-core simulator exclusion via `getProtectedFixtureEmails()` + legacy reset replacement). T10 (migrated-DB double-reset integration test + CI wiring — Docker-less locally, CI-only). T11 (docs + v11.26.0). T12/T13 (SDLC gates + final verify). **T14 (PR/merge/deploy/controlled reset) STOPS for explicit Admin authorization — do not self-merge or self-deploy.**

## Quick Start

1. Read this handoff and confirm the shared working tree is clean.
2. Check out the existing branch:
   `git switch agent/codex/sprint-117-curated-demo-reset`
3. Open the plan:
   `docs/superpowers/plans/2026-07-02-sprint-117-curated-demo-reset.md`
4. Use `superpowers:executing-plans` and execute Task 1 inline. Do not spawn subagents unless the
   maintainer explicitly requests multi-agent work.
5. Run `/simplify` after every implementation task and `/pre-commit-check` before every commit.

## Sprint Goal

Replace fragile additive demo rehearsal with a guarded full demo-data reset, deterministic age-aware
curated fixtures, server-generated Maria story IDs, and privacy-scoped API verification while
preserving a mutable ambient simulation population.

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-07-02-sprint-117-curated-demo-reset-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-sprint-117-curated-demo-reset.md`
- Branch: `agent/codex/sprint-117-curated-demo-reset`
- Design commit: `da3dc15e`
- Latest `origin/master` incorporated: `91ad5260` (#135) via merge commit `ad76a585`.
- Plan + handoff commit: `6ed5b024`
- Version target: `v11.25.3 → v11.26.0`
- Planned demo downtime: approved.
- Full deployed reset: in scope, but merge/deploy still require explicit Admin authorization.

## What Planning Established

### Architecture

- A typed manifest is authoritative for a compact 36-person, six-community historical baseline.
- Historical UUIDs derive from semantic keys; all timestamps derive from one UTC reset anchor.
- Completed exchange projections are rebuilt through fixture-only timestamp-aware functions, not
  hand-authored trust edges or scores. Cross-workspace regressions pin raw-weight and karma-allocation
  equivalence to production without refactoring live event handlers.
- The guarded reset is dry-run by default and requires an explicit demo fingerprint, advisory lock,
  paused simulator/cleanup, verified backup, and one PostgreSQL transaction.
- Live Maria requests/match/provider offer are created through ordinary APIs and accepted only after
  authoritative privacy-scoped readback.
- Maria is the public narrative identity and is active/member-only/non-admin. The entire protected
  story core is excluded from simulation; separate ambient personas may evolve after validation.
- Time continues normally. Durable history supports the story; aging examples transition naturally;
  finite live stories rotate explicitly before their 60-day request TTL becomes unsafe.
- Health is read-only. Rotation is explicit. Neither auto-repairs nor triggers a full reset.
- Reset coverage includes federation base tables; only `federation.local_instance` is preserved.
  Views are inventoried separately and never classified/truncated.

### Cross-agent plan review (approved with fixes; folded in)

- **Fixed:** added `federation.*` to managed-table coverage with explicit preserve/reset policy.
- **Fixed:** catalog query is base-table-only; views such as `trust_edges_live` are excluded.
- **Fixed:** added raw-weight equivalence against production `computeRawWeight` plus multi-community
  karma allocation equivalence against production `allocateKarma`.
- **Risk reduction accepted:** removed the planned production trust/karma/request event refactor.
  Historical projection stays fixture-only, so Sprint 117 remains one cohesive PR without changing
  live reputation/event behavior.
- **Fixed:** the destructive twice-applied reset integration test is blocking in CI's migrated
  PostgreSQL job and promotes before deploy; the live demo is not its first execution.
- **Planned docs fix:** correct stale `community.*` schema examples in `claude.md` during Task 11.

### Fixture behavior matrix

- Maria rich story: path degree ≤2, ≥3 shared people, ≥4 visible one-hop people per side.
- Provider story: valid active provider with truthful lower overlap.
- Direct, indirect, no-path, cross-community, sister-community, platform, and denial cases.
- Redundant triangles, bridge, sparse edges, and isolate.
- ≥5 active people wherever ADR-082 permits a community aggregate.
- Open/proposed/matched/completed/rejected/declined/cancelled/expired/forgotten lifecycle texture.
- Similar/unrelated history for server-owned dibs routing.
- Relative ages around 7/14/30/60/180-day and six-month behavior.
- Recent pulse, retention transparency, memory/decay, provider, governance, and activity surfaces.

### Delivery order (one branch / one PR / 14 tasks)

1. Manifest/compiler RED tests.
2. Manifest/compiler implementation.
3. Reset-safety RED tests.
4. Guarded reset/table policy implementation.
5. Fixture projection/equivalence RED tests.
6. Fixture-only projection replay (live event handlers unchanged).
7. API verifier/story operations RED tests.
8. Verifier, story lifecycle, health, rotation, config publication.
9. Full protected-core simulator exclusion + legacy reset replacement.
10. Migrated-DB double-reset integration proof + blocking CI promotion.
11. Operator/ADR/context/landing docs + v11.26.0.
12. Testing/simplify/code-review/security-review gates.
13. Final type/test/feedback/pre-push verification.
14. PR, Admin-authorized deploy, controlled reset, and API/DB/UI validation.

## Critical Implementation Notes

1. **PostgreSQL, not the legacy truncate list, defines the reset surface.** Classify every table in
   managed application schemas and fail closed on additions; preserve migrations/schema/catalogs only.
2. **Dry-run is the default; destructive work requires `--apply`, a demo fingerprint, an advisory
   lock, paused mutation jobs, and a completed restorable backup.** Planned downtime does not relax
   these controls.
3. **One reset anchor drives every relative age.** Never use fixed calendar dates or freeze the clock.
4. **Maria is the dedicated public persona and is non-admin by construction.** Validate live
   memberships; do not trust stale JWT role claims or manifest intent alone.
5. **Protected-core people never enter the simulator actor pool.** Exclusion must cover Maria, helper,
   provider, shared neighbors, and every story dependency—not only `DEMO_PERSONA_EMAIL`.
6. **Historical source state may be loaded directly where APIs cannot express time, but outward APIs
   are the completion authority.** Direct row checks are sanity checks, never product validation.
7. **Do not hand-author derived scores as the story.** Seed canonical exchanges/feedback inputs,
   rebuild projections through application-owned domain functions using source event time, and assert
   qualitative outward behavior; exact private metrics stay out of ordinary validation.
8. **Respect platform time semantics.** Build fresh, pulse, decay, retention, and forgotten lanes from
   the implemented 7/14/30/60/180-day and six-month rules; overdue rows must already reflect cleanup.
9. **Durable Maria topology comes from truthful repeated completed exchanges and stability.** No direct
   trust-edge invention, immortality, or demo-only decay threshold.
10. **Trust topology is platform-wide; strength and membership remain scoped.** Request visibility is
    independent and must cover community, trust-network, sister, platform, and denial cases.
11. **The Maria ordinary story must retain the Sprint 116 rich floor:** ≤2-degree path, ≥3 shared
    people, and ≥4 visible one-hop people per side. Provider contrast must remain truthful.
12. **Live story IDs are server-generated and configuration is published only after authoritative
    re-read.** Never trust mutation response shape, partial output, or terminal story rows.
13. **Reciprocal and privacy validation are mandatory.** Reverse participant orientation, test an
    unrelated member denial, scan protected responses for forbidden metrics, and prove demo writes 403.
14. **Health is read-only and rotation is explicit.** Neither may silently repair topology, touch the
    baseline, or trigger a full reset.
15. **Fixture tuning is expected but governed.** Put density/age/texture knobs in the typed manifest;
    hard privacy, lifecycle, cohort, simulator, and relationship floors are not tunable away.
16. **Resume in dependency order:** validated baseline → live stories → demo configuration → public
    demo → cleanup → ambient simulation. Any failure leaves the demo disabled with a bounded recovery.
17. **Update existing reset/rehearsal/docs paths instead of creating parallel v2 scripts.** Fix forward
    so there is one supported operator workflow.

## Carry-Forward / Known State

- The old Sprint 116 story IDs are terminal and must never be configured:
  - ordinary request `f412e2cf-177d-4192-978f-8e7d0ab01ec1`
  - ordinary match `89b3eba1-1c8f-4e77-9333-910bad0a647a`
  - provider request `3e4fe821-9d5d-4da5-aa25-33a6649d92d4`
  - provider offer `e5bee77e-f361-4d2f-bc7f-0a48faa884a0`
- The current `scripts/truncate-database.sql` is stale and misses modern schemas/tables. Do not run it.
- Docker is unavailable locally. Pure/unit/regression work is local; DB apply and full outward API/UI
  validation remain TDD until the Admin-authorized deployed rehearsal.
- Root Turbo on Windows can fail with Jest temp-cache `EPERM`. Isolated planning evidence was green:
  shared focused 5/5, simulation 54/54, root unit 95/95, root regression 176/176. Use unique caches
  under `C:\tmp` for affected isolated reruns; assertion failures are not cache races.
- Planning `feedback:check` and `git diff --check` were clean.
- The plan was authored by Codex. Per cross-agent protocol, Claude should review rather than co-edit it
  when the next role handoff permits.

## Working Tree Expectation

Clean after the plan + handoff planning commit. Claude and Codex share one physical checkout. Only one
agent edits at a time; commit or stash before switching windows.

## Persistent Context

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation and is the only agent that marks a sprint complete.
- Contributor agents never self-merge; one branch/PR per task and no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not independently resolve cross-agent conflicts; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Authorization uses live membership lookup; JWT membership is only a hint.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Trust-path topology is platform-wide; strength is community-scoped (ADR-077).
- Reputation/relationship outward contracts remain governed by ADR-082/084.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Run focused workspace suites directly; Turbo can hide or invent cache-related failures.
- Every implementation task runs `/simplify`; every sprint runs `/code-review` and `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

Confirm GitHub Actions deploy succeeded and live content matches `master` before judging the result.
The existing Maria credential is synthetic test data, but the Sprint 117 manifest must not commit its
password; credentials come from server environment configuration.
