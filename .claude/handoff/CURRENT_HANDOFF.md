# Sprint 140 — Revised after CI review; PR A ready, PR B decision-gated

**Date**: 2026-11-10
**State**: **Maintainer approved a two-PR split and zero simulation nomination/ratification weights for now.**
Claude's recorded node-forge dependency-lane authorization is accurate. PR A contains the security fix, three bugs and eleven
clear unit/UI WIP repairs. PR B later handles twenty infrastructure/legacy suites only after CI and rewrite/retire decisions.
No implementation has started.

**Design**: [`docs/superpowers/specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md`](../../docs/superpowers/specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md)

**PR A execution plan**: [`docs/superpowers/plans/2026-11-10-sprint-140-security-and-wip-cleanup.md`](../../docs/superpowers/plans/2026-11-10-sprint-140-security-and-wip-cleanup.md)

> Git and PR state outrank this handoff. No parallel lanes were active when checked. Sprint 139's verified post-merge record:
> [`archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md`](archive/2026-11-09-sprint-139-correctness-bundle-COMPLETE-v11.112.0.md).

---

## Quick Start

1. Read `CLAUDE.md`, this handoff and both linked documents. Use `superpowers:executing-plans` for PR A.
2. Confirm the revised planning commit exists and the tree is clean. Then `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`, open Dependabot alerts and #329. Live state outranks the dated baseline below.
3. Execute **PR A Tasks 1–12**, starting with preflight and the security-first node-forge commit. Stop after one filled PR A.
   Task 13 is later PR B planning; Task 14 merge/deploy is not authorized.
4. Read every affected workspace's local docs before editing. Social-graph and all twenty PR-B suites are read-only in PR A.

**Next unchecked task**: PR A Task 1. Do not infer merge/deploy/demo/dismissal/ADR authorization from scope approval.

## Approved PR A scope and exact designs

1. **node-forge #181–#184** (3 medium, 1 low; patched 1.4.3; SLA **2026-11-24**). Raise override/security-floor regression
   and splice the single lock entry. Prove strict `npx -y npm@11.19.0 ci`, full `npm ls --all` baseline comparison and normal
   + low-severity audits. **Do not merge #333**; fresh diff parsing confirmed **26** unrelated removed `libc` entries.
2. **BUG-100:** `GET /communities/my/communities` uses only authenticated `req.user.userId`; ignore omitted/own/foreign
   `user_id`, preserve callers/envelope, deny missing identity before DB. Real two-user tests join existing root integration.
3. **Simulation containment:** the route fix otherwise activates currently dead nominate/ratify workflows, and deploy restarts
   pm2 simulation. Maintainer chose **zero weights for both actions in every profile** pending the quorum decision. Keep
   workflows and production governance routes unchanged; test selector exclusion.
4. **BUG-099:** UI All sends `status=all`; omitted remains active. SQL uses `($1::text IS NULL OR o.status=$1)` with null for
   all, preserving viewer `$2` and optional numbering. Audience, Sprint 139 expiry/ownership, filters/pagination stay.
5. **BUG-098:** fix confirmed admin trust-questions, preferences, MessagingContext, InlineChat and FloatingChat double unwraps;
   leave interceptor unchanged. `useTrustQuestions` needs only its mock fixed. Preserve **three** valid lookalikes: raw-Axios
   invite, raw-Axios refresh fallback, and raw-fetch `useMessaging.ts:163-178`.
6. **Eleven PR-A WIP repairs:** eight frontend suites named in the spec; request `sprint-125-provider-reach-gate` (only two
   `[COMMUNITY, VIEWER]` bind-order expectations); root `sprint-36-commitment-depth` and `preferredProviderNotification`.
   Run green and promote each exact file with **`git mv` only**. Never run the broad promoter directly.

## PR B boundary — twenty suites remain visible

PR B contains the other eight request suites **including `admin-schemas-api`**, two community, four social-graph and six root
suites, all listed in the spec. `admin-schemas-api` is an uninitialized 605-line API/DB scaffold, not a ready unit repair.

Before PR B implementation, obtain maintainer approval for:

- a required-CI execution design for any service integration tier (today required CI/pre-push run only root integration;
  `test.yml` covers only auth and is nonblocking); and
- a per-suite repair/rewrite/retire ledger. Retirement needs separate written approval and replacement coverage.

Do not move simulation-seeded legacy suites unchanged into root integration; CI lacks those users and `/community/my` does not
exist. **Sprint 117 stays at `tests/tdd/sprint-117-demo-reset.integration.test.ts`**, invoked last by exact CI path because it
wipes/rebuilds the DB. PR A does not require local Windows TDD exit 0: the twenty PR-B failures remain truthful warnings, but
no PR-A/new failure may remain.

## Execution order

Tasks 1–2 preflight/security; Task 3 BUG-100 + simulation zero weights; Tasks 4–5 BUG-099/098; Tasks 6–8 eleven focused unit/UI
repairs; Task 9 only the two new root integration suites; Task 10 maintainer-numbered ADR/docs/exact `git mv` promotions/version;
Task 11 pre-push SDLC gates with integration CI evidence pending; Task 12 final local verification, handoff, push and PR A, then stop.
The next chat verifies CI execution/readiness. Task 13 is PR B's later decision gate. Task 14 is a separately authorized merge/deploy chat.

## Ownership and base

| Field | Value |
|---|---|
| **PR A branch** | `agent/claude/sprint-140-planning` |
| **Planning base** | `origin/master` `8aabc50c` (#332, v11.112.0); branch HEAD at first inspection `a212cfd8` |
| **Version** | Provisional PR A v11.113.0, re-derived from origin/master at merge; PR B re-derived later |
| **Live state at planning** | Only PR #333 open; master `8aabc50c`, `74c5a8e5`, `17e453f8`; exactly four open Dependabot alerts |
| **Dependency lane** | **Claude**, explicitly authorized for node-forge 1.4.3 only; no other dependency work |
| **ADR** | Required for PR A's community/request/simulation changes under `CLAUDE.md`; no number allocated. Obtain separate maintainer allocation before Task 10 creates the ADR; never self-assign |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-139-planning` (`71f957b1`; same tree as `8aabc50c`), `agent/claude/sprint-138-planning` (`96ce19d2`), `agent/claude/sprint-137-planning` (`49ebd68a`), `agent/claude/sprint-136-planning` (`170d39fe`), `agent/claude/sprint-135-pr-request-status-guards` (`7bfc65ac`), `agent/claude/sprint-135-planning` (`5a3589ef`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`); older `agent/claude/sprint-134-*` heads remain on origin |

## Authorization boundaries

- **Not authorized:** merge, deploy, demo-host reads/writes, alert dismissals, ADR numbers, closing/merging/pushing #333,
  other dependency changes, PR-B implementation or obsolete-test retirement. Each requires its own explicit approval.
- Follow pre-commit-check before every commit and normal maintainer commit/push authorization. Never direct-push master,
  rebase, force-push or bypass hooks.
- Branch audits do not close GitHub alerts. Verify actual alert state only after patched master; never substitute dismissal.
- Stop after PR A creation. Merge readiness requires green required gates and actual CI/integration evidence/job counts.

## Dated obligations

- **node-forge #181–#184:** patch by **2026-11-24**; the split protects this deadline from PR-B infrastructure design.
- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at next Expo SDK move or by **2026-12-01**.
- **#329 Expo SDK drift:** remains open and out of scope.

## Unscheduled product candidates

Unchanged: the mobile sprint (`docs/IDEAS.md` 2026-10-29; do not ship the app before it), backing out of an in-progress
exchange from the UI, and the 2026-11-08 communication-channel framing idea (adversarial discussion first). Simulation
nomination/ratification reactivation and ratification quorum now also require a separate product decision.

## Carry-forward work

See Sprint 139 archive's *Carry-forward work* and *Decisions*: Sprint 138 F2/F3/F4/F8/F9; spec-forbidden follow-ups (pg NUMERIC
parser, versioned effective-params cache key, shared timed-query/logger repair, `match_cancelled` consumer, offer-past-expiry
SQL fragment, typed API wrappers or `.data.data` gate); retained pre-push TDD log pruning; Sprint 137 `/simplify` deferrals;
BUG-087 runtime proof; BUG-073 tabled; PR C exemption re-check; PR D's D8; per-community health-quality weight (needs ADR).

The first post-Sprint-139 nightly provider-refresh log remains unobserved. Demo reads require separate authorization; no backfill
was run.

## Standing rules

See `CLAUDE.md` and Sprint 138 archive's *Standing rules*. One editor on the shared Windows tree; clean handoffs; no docs-only
master push. Update CONTEXT/registry/guides/BUGS and regenerate landing docs for actual changes. Keep substantive generated
changes, remove metadata-only churn, and reconcile unintended automatic promotions from pre-run byte snapshots. Deliberate
promotions use exact `git mv`, never a direct broad promoter run.
