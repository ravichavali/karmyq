# Sprint 142 — planning (topic not yet chosen) — Handoff

**Date**: 2026-11-12
**Outcome**: in progress. Sprint 141 (PR #337, BUG-073, ADR-105, v11.114.0) is **shipped and verified**; its record
is [archived](archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md). This branch holds only Sprint 141's
post-merge records. The Sprint 142 topic has not been chosen.

> State between sessions only. Branch-local, so it reserves nothing; see `.claude/handoff/README.md` →
> *Parallel development rules* for how contended resources are allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-142-planning` |
| **Base** | `origin/master` at `898f23ba` (fetched 2026-11-12) |
| **Active editor** | Claude |
| **Reviewer role** | A non-author (Codex, by recent practice). Reviewers read the diff and do not co-edit |
| **Owned paths** | So far: the post-merge records (`docs/BUGS.md` status lines, ADR-105 + `docs/adr/README.md`, its two landing JSON files, `.claude/handoff/`) |
| **Shared resources needed** | None allocated. Merge slot, version bump, ADR numbers, dependency lane and every demo data operation each need the maintainer's own authorization |

## Links

- **Sprint 141 archive** (post-merge verification + the final Sprint 141 handoff, verbatim):
  [archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md](archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md)
- **ADR-105** (Implemented): [docs/adr/ADR-105-platform-admin-role.md](../../docs/adr/ADR-105-platform-admin-role.md)
- **PR**: none yet for Sprint 142.

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. If master moved past `898f23ba`, merge
   `origin/master` into this branch with a merge commit (never rebase).
2. **This branch's first commit is Sprint 141's post-merge record.** It must never reach master on its own (no
   docs-only master push); it rides with the next product PR.
3. **Choose the Sprint 142 topic with the maintainer**, then run the `sprint-planning` skill on this branch. Candidates
   are listed under *Carried follow-ups*. Nothing is chosen or allocated yet.

**Next unchecked task**: the maintainer picks the Sprint 142 topic.

## Blockers and decisions

- **Pending authorization — the demo platform-admin grant (ADR-105 §6).** Rollout is fail-closed: until the grant,
  nobody on the demo can edit request-type schemas or trust questions, or run the provider-trust backfill.
  - The maintainer chooses the account, never a simulation persona with shared credentials.
  - It runs as DB user `karmyq_prod`, with explicit per-operation authorization, and is repeated after every curated
    demo reset.
  - Then finish the smoke test: the granted account gets 200 on `GET /api/admin/schemas`, and
    `GET /api/users/me/platform-role` returns `platformAdmin: true` for it. The refusal half already passed live
    (archive, *Smoke test*).
- **Decision (2026-11-12):** ADR-105 moved to Implemented at the verified deploy, as its own status line said. The
  owed grant is an operational step and does not hold the status back.
- **Decision (2026-11-12):** the BUG-076/080/081/082/092/097/098/099/100 status lines were corrected in this record,
  because both deploys were verified (#332 run 42914254213 and #334 run 43103530588, 14/14 jobs each). They had still
  said "on branch / not yet deployed".

## Deferred minors (from Sprint 141's gates; detail in the PR #337 body)

- A second `GET /users/me/platform-role` from `CommunityConfigEditor` on the Profile tab, including in read-only
  mode.
- The 401 bodies in `requirePlatformAdmin` and the trust-question gate lack an ADR-074 `error` code. That is the
  pre-existing shape (`verifyToken`, `483ae889`), moved there. Observed live on 2026-11-12.
- If the platform-admin lookup throws, the trust-question router gate's error now reaches the app-level handler. It
  is still a logged 500, but without the route-tagged message.
- `requirePlatformAdmin` / `requireAnyCommunityAdmin` could share a factory.
- No test pins `platformRoleService.get` to `/users/me/platform-role`. A wrong path would fail closed.
- ADR-102:47 and ADR-032:415 still use the pre-Sprint-141 names. They are dated records.

## Carried follow-ups (out of scope unless a plan names them)

- **From Sprint 141:**
  - `tests/e2e/admin/schema-management.spec.ts` (not in CI) needs a platform-admin fixture.
  - `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx` still asserts that a creator sees the link. It tests an
    inline stub and is a spec-deferred suite; retiring it needs maintainer approval (Sprint 140 PR B material).
  - Two IDEAS entries (2026-11-12): community-owned custom request types; folding the founding-circle reviewer
    allowlist into `auth.platform_admins`.
- **CodeQL on `api.ts`, new datapoint (2026-11-12):** the master merge-SHA analysis raised #632 on line 851, which
  #337 did not touch, while the PR-ref analysis showed only #631. Read open master alerts after every merge; don't
  predict them from the diff.
- **ADR-103 is still Proposed.** It needs the maintainer-run deploy-time demo check
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`), then a flip on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.** It needs an output-dir option in
  `scripts/generate-docs.ts`.
  - On this box `architecture.json`'s `dependencyGraph` field also churns. It mirrors the untracked, locally
    generated `services/dependency-graph.md`; restore that field.
  - Observed 2026-11-12: the committed `apps/landing/src/data/docs/build.json` is frozen at `a8e78603`
    (2026-10-15, `adrCount` 99; the generator now says 103), because every record restores it as churn. Whether the
    deployed landing site shows those values is UNVERIFIED.
- No relocation pointer gate for the root `claude.md` `→ *Heading*` pointers.
- The landing **prebuild** claim is UNVERIFIED (`apps/claude.md:46,49,53`, `scripts/claude.md:54`, the
  landing-docs gotcha). It never runs under `ignore-scripts`.
- The migration-validator schema list is stale (`.claude/agents/migration-validator.md:12-24`).
- BUG-101 (dead Edit/Write hook handlers), `docs/BUGS.md`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- Sprint 140 PR B: unplanned and decision-gated (required-CI integration execution, the per-suite WIP ledger,
  including `admin-schemas-api`).
- Expo SDK drift: #329 open; re-check deepmerge alert #178 at the next Expo SDK move or by **2026-12-01**.
- Later product candidates: the governance ratification quorum, the exchange back-out control (IDEAS 2026-10-29), and
  the mobile revival.
- **Git Bash trap:** a `node` argument starting with `//` is rewritten by MSYS path conversion, and so is
  `git show <rev>:<path>`. Export `MSYS_NO_PATHCONV=1`, or put replacements in a script file.

## Verification references

- Sprint 141 deploy: master CI/CD run [43318586338](https://github.com/ravichavali/karmyq/actions/runs/43318586338)
  attempt 2, `success`, 14/14 jobs including Deploy to Demo (observed 2026-11-12). Smoke-test detail is in the
  archive.
- Security state observed 2026-11-12, after the #631/#632 dismissals: 0 open code-scanning alerts on master.
- This branch's records are docs only (BUGS.md status lines, ADR-105 status, index, two generated landing JSON files,
  handoff). Before committing them, `npm test --workspace=tests` (the root gates, including the doc/context drift
  gate) ran on the working tree on 2026-11-12; see the commit message for its result.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
