# Sprint 143 planning — Handoff

**Date**: 2026-11-15
**Outcome**: in progress. Sprint 142 (PR #338, governance ratification quorum, ADR-055 amendment, v11.115.0) is
**shipped and verified**; its record is
[archived](archive/2026-11-15-sprint-142-governance-quorum-COMPLETE-v11.115.0.md). The Sprint 143 topic is **not
chosen yet**. This branch carries the Sprint 142 post-merge records, which ride with the next product PR.

> State between sessions only. Branch-local, so it reserves nothing; see `.claude/handoff/README.md` →
> *Parallel development rules* for how contended resources are allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-143-planning` |
| **Base** | `origin/master` at `1692a560` (fetched 2026-11-15; no open PRs observed) |
| **Active editor** | Claude (post-merge records, 2026-11-15) |
| **Reviewer role** | A non-author. Reviewers read the diff and do not co-edit |
| **Owned paths** | Post-merge records only: this handoff + archive, ADR-055 status line + index entry, community-service `CONTEXT.md` status lines, regenerated landing JSON. No product code |
| **Shared resources needed** | None allocated. Merge slot, version bump, ADR numbers, dependency lane and every demo data operation each need the maintainer's own authorization |

## Links

- **Sprint 142 archive** (post-merge verification + the final Sprint 142 handoff, verbatim):
  [archive/2026-11-15-sprint-142-governance-quorum-COMPLETE-v11.115.0.md](archive/2026-11-15-sprint-142-governance-quorum-COMPLETE-v11.115.0.md)
- **ADR-055** (Implemented; Sprint 142 amendment deployed): [docs/adr/ADR-055-trust-governance-architecture.md](../../docs/adr/ADR-055-trust-governance-architecture.md)
- **PR**: none yet for Sprint 143.

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. If master moved past `1692a560`, merge
   `origin/master` into this branch with a merge commit (never rebase).
2. **This branch's first commit is Sprint 142's post-merge record.** It must never reach master on its own (no
   docs-only master push); it rides with the next product PR. Reuse this task branch.
3. Ask the maintainer to choose the Sprint 143 topic, then run the `sprint-planning` skill (spec + plan + handoff in
   the planning chat; execution in the next chat).

**Next unchecked task**: topic selection with the maintainer. Candidates are listed under *Carried follow-ups*.

## Blockers and decisions

- **Pending authorization — the demo platform-admin grant (ADR-105 §6).** Rollout is fail-closed: until the grant,
  nobody on the demo can edit request-type schemas or trust questions, or run the provider-trust backfill.
  - The maintainer chooses the account, never a simulation persona with shared credentials.
  - It runs as DB user `karmyq_prod`, with explicit per-operation authorization, and is repeated after every curated
    demo reset.
  - Then finish the smoke test: the granted account gets 200 on `GET /api/admin/schemas`, and
    `GET /api/users/me/platform-role` returns `platformAdmin: true` for it.
- **Decision (2026-11-15):** ADR-055 stays **Implemented**; its Sprint 142 amendment line and index entry now say
  deployed (v11.115.0). The community-service `CONTEXT.md` status lines for Sprints 142/141/140 were corrected from
  "on branch / deployment pending": all three deploys were verified (runs 43734484275, 43318586338, 43103530588).

## Sprint 142 follow-ups (out of scope unless a plan names them)

- **Deferred Minor:** `not_in_electorate` UI copy ("You joined after this nomination opened.") is also shown to a
  member who was inactive when the nomination opened. Suggested copy: "You were not an active member when this
  nomination opened." (`apps/frontend/src/components/GovernanceTab.tsx`, `reasonCopy`).
- **BUG-102** (`docs/BUGS.md`): self-join of an inactive membership hits the `(community_id, user_id)` unique
  constraint and returns 500. Staff `PUT … status: 'active'` is the only reactivation path.
- **Governance policy gaps, accepted for now:** no withdrawal or expiry, so pending nominations can stall
  (including a `ready_to_finalize` nomination whose nominee became ineligible). Also no rotation, revocation or
  delegation. Persona-heavy demo communities may never reach quorum, because simulation governance stays disabled
  (ADR-103).
- **Unmeasured:** how many legacy pending nominations the Sprint 142 migration withdrew on the demo. Measuring it
  needs a demo DB read, which is not authorized.
- **RLS reality vs CLAUDE.md:** `docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`
  records that the CI role (and the default service role) bypasses RLS, and that `dbContextMiddleware` sets
  transaction-local context on a separate pooled query. CLAUDE.md → *Database* still says a query that skips
  `setDbContext` "sees nothing". Correcting the global rule is a maintainer decision; the live demo role's flags are
  UNVERIFIED.

## Deferred minors (from Sprint 141's gates; detail in the PR #337 body)

- A second `GET /users/me/platform-role` from `CommunityConfigEditor` on the Profile tab, including in read-only
  mode.
- The 401 bodies in `requirePlatformAdmin` and the trust-question gate lack an ADR-074 `error` code (the
  pre-existing `verifyToken` shape, `483ae889`).
- If the platform-admin lookup throws, the trust-question router gate's error reaches the app-level handler: still a
  logged 500, but without the route-tagged message.
- `requirePlatformAdmin` / `requireAnyCommunityAdmin` could share a factory.
- No test pins `platformRoleService.get` to `/users/me/platform-role`. A wrong path would fail closed.
- ADR-102:47 and ADR-032:415 still use the pre-Sprint-141 names. They are dated records.

## Carried follow-ups (out of scope unless a plan names them)

- **From Sprint 141:** `tests/e2e/admin/schema-management.spec.ts` (not in CI) needs a platform-admin fixture;
  `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx` asserts a creator sees the link (inline stub, spec-deferred;
  retiring it needs maintainer approval); two IDEAS entries (2026-11-12): community-owned custom request types and
  folding the founding-circle reviewer allowlist into `auth.platform_admins`.
- **CodeQL:** read open master alerts after every merge; don't predict them from the diff (Sprint 141 datapoint
  #632). Sprint 142's master analysis re-raised nothing (observed 2026-11-15).
- **ADR-103 is still Proposed.** It needs the maintainer-run deploy-time demo check
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`), then a flip on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.** It needs an output-dir option in
  `scripts/generate-docs.ts`. On this box `architecture.json`'s `dependencyGraph` field also churns (it mirrors the
  untracked, locally generated `services/dependency-graph.md`). The committed `build.json` stays frozen at
  `a8e78603` because every record restores it as churn; whether the deployed landing shows those values is
  UNVERIFIED.
- No relocation pointer gate for the root `claude.md` `→ *Heading*` pointers.
- The landing **prebuild** claim is UNVERIFIED (`apps/claude.md:46,49,53`, `scripts/claude.md:54`, the
  landing-docs gotcha). It never runs under `ignore-scripts`.
- The migration-validator schema list is stale (`.claude/agents/migration-validator.md:12-24`).
- BUG-101 (dead Edit/Write hook handlers), `docs/BUGS.md`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- Sprint 140 PR B: unplanned and decision-gated (required-CI integration execution, the per-suite WIP ledger,
  including `admin-schemas-api`).
- Expo SDK drift: #329 open; re-check deepmerge alert #178 at the next Expo SDK move or by **2026-12-01**.
- **Later product candidates:** the exchange back-out control (IDEAS 2026-10-29), the mobile revival, and the
  governance follow-ups above (withdrawal/expiry, BUG-102).
- **Git Bash trap:** a `node` argument starting with `//` is rewritten by MSYS path conversion, and so is
  `git show <rev>:<path>`. Export `MSYS_NO_PATHCONV=1`, or put replacements in a script file.

## Verification references

- **Sprint 142 deploy:** master CI/CD run [43734484275](https://github.com/ravichavali/karmyq/actions/runs/43734484275)
  attempt 1, `success`, 14/14 jobs including Deploy to Demo; 9/9 services healthy, no rollback (observed
  2026-11-15). Smoke-test detail is in the archive.
- Security state observed 2026-11-15 after the merge: 0 open code-scanning alerts on master.
- This branch's records are docs only. Before committing them, `npm test --workspace=tests` (the root gates,
  including the doc/context drift gate) ran on the working tree; see the commit message for its result.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
