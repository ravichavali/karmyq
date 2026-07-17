# Sprint 119 — Truthful Surfaces & the Fractal Story — COMPLETE (archived 2026-07-16)

> **FINAL STATE:** PR A (#149) merged 2026-07-15 (`b5b9a09`, v11.28.0). PR B (#150) merged by
> Admin 2026-07-16 14:47Z (squash `6cf8f2d`, v11.29.0), CI/CD deployed. ADR-086 status flip to
> Implemented rides Sprint 120 PR A. Remaining live-validation items folded into Sprint 120 PR C's
> audit pass. BUG-030 (found during PR A post-deploy validation) is Sprint 120 PR A scope.

> **STATUS (2026-07-10, execution session):** PR A Tasks 1–9 COMPLETE on
> `feature/sprint-119-truthful-surfaces` (staged, ready to commit+push). All four SDLC gates run:
> two /simplify passes (8 agents, applied), /code-review at HIGH effort (8 finder angles; all
> confirmed findings FIXED — see below), /security-review (NO findings), full blocking tier green.
> BUG-029 fixed both ends + hardened by review: endpoints-only `computeCommunityPath`;
> scope-preferred deterministic `community_name` enrichment (single+batch, one set-based query);
> **cached community_member rows now revalidated on read** (pre-fix 3-node/1° shapes and
> departed-membership pairs are deleted + recomputed — closes the admin-node leak, stale-claim,
> and mixed-ranking TTL windows); `setAuthSession` removes a leftover refreshToken (cross-account
> refresh bleed found by review, test-pinned); **TrustCard** (missed consumer found by review) now
> names the community, never draws a person route (server passes community_name). Arrival:
> `beginArrival` is the ONE writer (open + invite paths), `hasOnboarded` adopted in
> welcome/WelcomeModal, both join surfaces share `isFirstEverJoin`. Header lever 2 shipped
> (overflow menu = one home for Communities/provider links; My Network keeps topnav). v11.28.0,
> BUGS.md BUG-029 → fixed, CONTEXT/registry/guides/landing updated (nav.json verified twice).
> Sprint-119 suites PROMOTED to regression (frontend 25 suites/223 tests; social-graph 22 suites).
> Known-accepted: batch community_name has no consumer yet (spec-mandated parity); PLAUSIBLE
> pre-existing edge (localStorage communities snapshot can route a stale-snapshot member to
> /welcome). Deferred follow-ups: computeInvitationPath disclosure-gate question, api.ts
> interceptor clearAuthSession adoption, cold-cache batch enrichment.
> **PR #149 MERGED by Admin 2026-07-15 (16:34Z)** — merge commit `b5b9a09`; CI/CD Pipeline,
> Tests, and CodeQL all green on master; deploy verified live (frontend/login/communities 200).
> **Post-deploy API validation of BUG-029 PASSED**: scanned all 149 fellow-member paths as
> maria.reyes — `community_member` paths are endpoints-only (pathLen 2), `community_name`
> populated, `degrees: 2` preserved; Nadia Ito no longer appears as an intermediate node; cache
> revalidation observed working (stale rows deleted + recomputed live). One finding:
> **BUG-030 logged** (docs/BUGS.md) — fractional exchange-path trust score (Ebbinghaus decay)
> fails the INTEGER `path_trust_score` cache column → 500 on /paths for affected pairs (1/149 on
> demo: maria.reyes → Fatima Alhassan); PRE-EXISTING since S90, surfaced by PR A's forced
> recomputes; batch route has no per-target catch so one bad pair can 500 a whole /paths/batch.
> Fix NOT in PR B scope (approved plan unchanged) — needs a planning decision (migrate column to
> DOUBLE PRECISION vs round at 3 write sites; consider per-target isolation in batch loop).
> Remaining Task 10 HUMAN validation (browser-only, not yet done): throwaway first-join from a
> community DETAIL page lands on /welcome; `/demo` tour survives refresh; topbar calm at
> md/lg/xl.
>
> **PR B STATUS (2026-07-15, Codex recovery session): Tasks 1–7 COMPLETE; Task 8 final gate in
> progress** on `feature/sprint-119-graph-presentation`. Claude's uncommitted Tasks 1–5 WIP was
> recovered without overwrite and verified: focused Sprint 119 suites 3/3 (39 tests), social-graph
> unit+regression 22/22 (158 pass, 3 todo), frontend unit+regression 31/31 (288 pass), and both
> touched workspace typechecks green. Server adds fail-closed `active_recently` from the shared
> 30-day window; ring anchors the viewer at 12 o'clock + truthful N-of-M summary; hub distinguishes
> recent woven/dormant/periphery bridges through the raw-payload normalization hop. ADR-086 is
> Accepted, guide/onboarding/CONTEXT/registry/landing docs updated, nav re-applied after generator
> reversion, version v11.29.0. Simplify/code/security review passes found no production-code issue;
> documentation findings fixed. Three Sprint 119 TDD suites promoted to regression. Full root
> `npm test` is green (26/26 Turbo tasks); staged feedback + process review pass; direct feature,
> doc, privacy, and dependency-security regressions pass (`npm audit`: zero high/critical).
> Commit `73d7f8c8` pushed; **PR #150 OPEN and READY FOR REVIEW**:
> https://github.com/ravichavali/karmyq/pull/150.
>
> **PR B REVIEW COMPLETE (2026-07-16, Claude review session): APPROVE — awaiting explicit Admin
> merge authorization** (`gh pr merge 150 --squash --admin`; never self-authorized). All PR #150
> checks verified green (Tests, Lint/TypeCheck, Security Audit, CodeQL + ADR-060 gate, Integration,
> Docker builds, Landing build, pr-contract); PR is mergeable and no longer a draft. Full /review
> verified implementation against source: fail-closed `isFormedRecently` (null/unparseable → false),
> `last_interaction_at` column exists NOT NULL, rotation-only splice handles anchor -1/0, privacy
> pin (no timestamp serialized), legend colors truthful (emerald-500/green-400 match encodings).
> **No blockers. Six minor non-blocking findings** — polish candidates for a future sprint, NOT
> pre-merge work: (1) ring N-of-M summary counts the truncated subset, not totalActiveMembers —
> decide phrasing under truncation; (2) quieted nearly_forgotten chords (0.055) visually equal
> UNRELATED_OPACITY (0.05); (3) hub legend now has redundant "— organic trust" slate entry beside
> Woven/Dormant; (4) `hubBridgeVisual` recomputed ~5×/edge per render (negligible); (5) aria-label
> on SVG `<line>` needs `role="img"` for real AT exposure; (6) `isFormedRecently` name reused for
> interaction recency — alias would read better. Do not fold BUG-030 into this PR.
>
> Sprint 118 record: `.claude/handoff/archive/2026-07-09-sprint-118-invited-arrival-living-graph-COMPLETE.md`.

## Sprint Goal

No surface claims structure the data doesn't contain (PR A: BUG-029 fix at both ends + arrival
gap + setAuthSession helper + header lever 2), then give the two remaining graph scales their
at-a-glance answers (PR B: community ring = "where do you fit?", across-communities hub = "which
of your communities are woven together?") — closing the presentation question opened by the S114
revert, recorded as ADR-086.

## Arc Context

- S115 (ADR-083) made position earned; S118 (ADR-085) made ego edge state lived ("your web is
  growing/fading"). S119 PR B completes the fractal: one question per zoom level. Community-scale
  answer chosen by the maintainer this session: **"where do you fit?"** (viewer-centric, NOT
  weaving/fraying — that option was explicitly not chosen). Across-communities answer: **"which
  are woven together?"** (bridge emphasis + aliveness).
- BUG-029 fold-in was decided by the maintainer at S118 close; fix shape recorded there and in
  `docs/BUGS.md` (server endpoints-only path, badge "Fellow member of {community}", keep
  `degrees: 2` for ranking).

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-07-09-sprint-119-truthful-surfaces-fractal-story-design.md`
- Plan PR A (10 tasks): `docs/superpowers/plans/2026-07-09-sprint-119-pr-a-truthful-surfaces.md`
- Plan PR B (9 tasks): `docs/superpowers/plans/2026-07-09-sprint-119-pr-b-graph-presentation.md`
- Branches: `feature/sprint-119-truthful-surfaces` (PR A) →
  `feature/sprint-119-graph-presentation` (PR B, after PR A merges)
- Version: v11.27.0 → v11.28.0 (PR A) → v11.29.0 (PR B) · ADR: **ADR-086** (rides PR B)
- Scope decisions (maintainer, planning session): theme = graph presentation phase 2 + all four
  ride-alongs (arrival gap, setAuthSession, header lever 2, invitation-wording review); two PRs,
  one sprint, per-PR plan files; each PR merges + deploys independently.

(Critical implementation notes and carry-forward state as recorded in the Sprint 119 planning
handoff; superseded by the Sprint 120 handoff of 2026-07-16.)
