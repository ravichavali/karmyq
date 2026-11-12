# Sprint 141 — Platform admin role (BUG-073) — Handoff

**Date**: 2026-11-12
**Outcome**: implementation complete; **PR #337** is open, its non-author review is done (no actionable defects), and
CI is green except the ADR-060 code-scanning gate. That gate is blocked by **CodeQL #631**, the documented `api.ts`
false positive, which waits for the **maintainer's UI dismissal**. Not merged, not deployed. BUG-073 is *fixed on
branch* only; ADR-105 stays **Proposed** until a verified deploy.

> State between sessions only. The design lives in the spec, the steps in the plan, and the evidence in the PR's
> `## Validation` ledger. This file names the next action and the boundaries.

---

## Sprint goal

Close BUG-073: an explicit, live-read **platform admin** role (`auth.platform_admins`) gates the three platform-wide
surfaces (the `/admin/schemas` request-type catalog, the six trust-question writes, the provider-trust backfill),
without changing what community admins can do in their own communities.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-141-planning` (planning and execution share it) |
| **Base** | `origin/master` at `06685ea4` (unmoved as of 2026-11-12, re-checked before the PR) |
| **Active editor** | Claude (author). Review-fix commits land on this branch |
| **Reviewer role** | A non-author (Codex, by recent practice). Reviewers read the diff and do not co-edit |
| **Shared resources** | **ADR-105** and a **minor bump** (11.113.0 → 11.114.0 in the root version fields, re-derived at merge) were allocated by the maintainer on 2026-11-12. **Not allocated**: merge slot, deploy, any demo data operation (including the platform-admin grant), any dependency change |

## Links

- **Spec**: [docs/superpowers/specs/2026-11-12-sprint-141-platform-admin-role-design.md](../../docs/superpowers/specs/2026-11-12-sprint-141-platform-admin-role-design.md)
- **Plan**: [docs/superpowers/plans/2026-11-12-sprint-141-platform-admin-role.md](../../docs/superpowers/plans/2026-11-12-sprint-141-platform-admin-role.md) — Tasks 1–12 done; Task 13 not authorized
- **ADR**: [ADR-105](../../docs/adr/ADR-105-platform-admin-role.md) (Proposed)
- **PR**: [#337](https://github.com/ravichavali/karmyq/pull/337). Its `## Validation` ledger carries every command,
  SHA, ruling and deferred minor
- **Non-author review**: [Codex review of `29a4a2d1`](https://github.com/ravichavali/karmyq/pull/337#pullrequestreview-5882655620),
  2026-11-12. No actionable code defects; it confirmed both CI proofs and analysed #631 as a false positive in the
  alert's PR thread (it dismissed nothing)
- **Previous handoff (PR #336)**: [archive](archive/2026-11-12-pr-336-usage-diet-COMPLETE.md)

## Quick Start (next chat: merge-readiness, after the maintainer's dismissal)

1. `git fetch origin`, `gh pr view 337`, `git log --oneline origin/master -3`. If master moved past `06685ea4`, merge
   `origin/master` in with a merge commit (never rebase) and re-derive the version.
2. **Security gate.** The ship skill (Phase 2) says agents cannot dismiss CodeQL alerts; the maintainer dismisses
   [#631](https://github.com/ravichavali/karmyq/security/code-scanning/631) in the UI, as a false positive.
   - Confirm it is gone: `gh api "repos/ravichavali/karmyq/code-scanning/alerts?state=open&ref=refs/pull/337/head"`.
   - Re-run the latest CI/CD run's failed jobs (`gh run rerun <id> --failed`). Then check `gh pr checks 337` **and**
     each run's conclusion and job count; the checks list can hide jobs that were never created.
3. When everything is green, ask the maintainer: "admin merge, yes/no?" (plan Task 13). Merge, deploy and the demo
   grant are not authorized until that answer.
4. After any merge: the master CI/CD gate evaluates **all** open alerts, and an `api.ts` line shift can re-raise this
   false positive on master. Read the open master alerts and the merge-SHA analysis.

## What the branch holds

- **444de72d**: PR #336's post-merge records (ADR-104 Implemented, handoff archive). Must not reach master alone.
- **905cc5af**: Sprint 141 spec + plan.
- **Execution** (Tasks 1–12):
  - `auth.platform_admins` migration (`20261112-auth-platform-admins.sql`), and `init.sql` byte-copied from workflow
    run 43287911994 (hash-identical; precondition: branch `init.sql` == master's).
  - `TABLE_POLICY`: `reset`. A new test derives the reset catalog from `init.sql`.
  - `isLivePlatformAdmin` in the request, community and reputation live-role modules.
  - request-service: `/admin/schemas` uses `platformAdminAuth`; the admin-actions prefilter is renamed
    `requireAnyCommunityAdmin` (unchanged behavior).
  - community-service: one router-wide write gate on the trust questions. reputation-service: the backfill gate.
  - One 403 body everywhere: `PLATFORM_ADMIN_REQUIRED`.
  - auth-service: `GET /users/me/platform-role`.
  - Frontend: `usePlatformAdmin` + `usePlatformAdminGate` gate the five admin pages and the two Schema Manager links.
  - Docs: ADR-105; the guides, concepts, CONTEXT ×5 and registry; `infrastructure/claude.md` counts re-counted from
    `init.sql`; one global rule in root `claude.md`; landing regenerated.
  - Version 11.114.0.
- Six new suites, promoted by exact `git mv` to their workspace's `regression/`.
- Four gates ran: tests, `/simplify`, `/code-review` (high) and `/security-review` (no findings), plus
  `process-reviewer` (its blocking findings were fixed).

## CI evidence (PR #337 at `29a4a2d1`, observed 2026-11-12)

- **CI/CD Pipeline** run [43303866446](https://github.com/ravichavali/karmyq/actions/runs/43303866446): conclusion
  **failure**, 8 jobs.
  - Six succeeded: unit + regression, Security Audit, Lint & Type Check, Integration Tests, Build Landing Page, and
    one more.
  - Build Docker Images and Deploy to Demo were skipped (a PR run).
  - **Code Scanning Gate (ADR-060) failed** with `1 open critical/high code-scanning alert(s) — blocking: #631
    js/request-forgery apps/frontend/src/lib/api.ts:857`.
- **Integration job** 131484331377 log: `PASS Integration Tests
  integration/sprint-134-pr-k-live-admin-role.integration.test.ts`. The job ran 514/514 tests with no failures, so
  acceptance criteria 3 and 8 are proven.
- **Regenerate init.sql** run 43303866203: success. The byte-for-byte comparison against the PR base passed.
- **Other runs:** Tests run 43303866368 succeeded (3 jobs: auth, frontend, Docker build). PR Contract run 43303866219
  succeeded. The CodeQL analyses (run 43303859436, 2 jobs) succeeded; the separate `CodeQL` check is red only for #631.
- **#631 disposition.** It is the documented false positive on the browser axios client
  (`apps/frontend/claude.md`; it recurs on any `api.ts` edit):
  - `platformRoleService.get` takes no arguments and calls a literal path;
  - the "host" is the build-time `NEXT_PUBLIC_API_URL` (`api.ts:15`). The seven flagged sources are the seven
    `NEXT_PUBLIC_*_API_URL` reads that reach `createApiClient`;
  - the request is made in the browser, so there is no server-side request to forge;
  - the code is unchanged; the alert waits for the maintainer's dismissal.

## Not authorized (plan Task 13 — a separate, future chat)

- Merge (one merge slot; re-derive the version from `origin/master` at merge time).
- Deploy, and the verification afterwards (master CI/CD conclusion + job count, karmyq.com probe, code-scanning
  alerts on master and the merge-SHA analysis).
- **The demo platform-admin grant.** It is a separate demo data operation:
  - it needs the maintainer's explicit authorization;
  - it runs as DB user `karmyq_prod`, after the deploy is verified;
  - it uses an account the maintainer chooses, never a simulation persona with shared credentials;
  - it needs repeating after every curated demo reset.

  **Rollout is fail-closed.** Until the grant, nobody can edit schemas or trust questions, or run the backfill.
- Smoke test after deploy:
  - a community-admin token gets 403 `PLATFORM_ADMIN_REQUIRED` on `GET /api/admin/schemas`;
  - the granted account gets 200;
  - `GET /api/users/me/platform-role` agrees for both.
- Then, on the next product branch: ADR-105 → Implemented, BUG-073 → fixed (deployed), archive this handoff.

## Deferred minors (from the gates; detail in the PR body)

- A second `GET /users/me/platform-role` from `CommunityConfigEditor` on the Profile tab, including in read-only
  mode.
- The 401 bodies in `requirePlatformAdmin` and the trust-question gate lack an ADR-074 `error` code. That is the
  pre-existing shape, moved here.
- If the platform-admin lookup throws, the trust-question router gate's error now reaches the app-level handler. It
  is still a logged 500, but without the route-tagged message.
- `requirePlatformAdmin` / `requireAnyCommunityAdmin` could share a factory.
- No test pins `platformRoleService.get` to `/users/me/platform-role`. A wrong path would fail closed.
- ADR-102:47 and ADR-032:415 still use the pre-Sprint-141 names. They are dated records.

## Carried follow-ups (out of scope unless a plan names them)

- **New from Sprint 141:**
  - `tests/e2e/admin/schema-management.spec.ts` (not in CI) needs a platform-admin fixture.
  - `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx` still asserts that a creator sees the link. It tests an
    inline stub and is a spec-deferred suite; retiring it needs maintainer approval (Sprint 140 PR B material).
  - Two IDEAS entries (2026-11-12): community-owned custom request types; folding the founding-circle reviewer
    allowlist into `auth.platform_admins`.
- **ADR-103 is still Proposed.** It needs the maintainer-run deploy-time demo check
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`), then a flip on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.** It needs an output-dir option in
  `scripts/generate-docs.ts`.
  - On this box `architecture.json`'s `dependencyGraph` field also churns. It mirrors the untracked, locally
    generated `services/dependency-graph.md`; restore that field, as Sprint 141 did.
- No relocation pointer gate for the root `claude.md` `→ *Heading*` pointers.
- The landing **prebuild** claim is UNVERIFIED (`apps/claude.md:46,49,53`, `scripts/claude.md:54`, the
  landing-docs gotcha). It never runs under `ignore-scripts`.
- The migration-validator schema list is stale (`.claude/agents/migration-validator.md:12-24`). Sprint 141 told the
  agent to judge against `infrastructure/claude.md` instead, and it reported no findings.
- BUG-101 (dead Edit/Write hook handlers), `docs/BUGS.md`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- Sprint 140 PR B: unplanned and decision-gated (required-CI integration execution, the per-suite WIP ledger,
  including `admin-schemas-api`).
- Expo SDK drift: #329 open; re-check deepmerge alert #178 at the next Expo SDK move or by **2026-12-01**.
- Later product candidates: the governance ratification quorum, the exchange back-out control (IDEAS 2026-10-29), and
  the mobile revival.
- **Git Bash trap seen in Sprint 141:** a `node` argument starting with `//` was rewritten by MSYS path conversion.
  Export `MSYS_NO_PATHCONV=1`, or put replacements in a script file.

## Verification references

- Baseline at `905cc5af`: `npm test` exit 0. `npm run test:tdd` exit 1 with 20 known WIP failures (listed in the PR
  body); no new failing suite is expected.
- Security state observed 2026-11-12: 0 open code-scanning alerts on master, 0 open Dependabot alerts.
- Full-suite evidence for the PR head is the pre-push hook and `/pre-commit-check` run recorded in the PR's
  `## Validation` ledger, plus the PR's CI run. Re-derive it there rather than trusting a count copied here.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
