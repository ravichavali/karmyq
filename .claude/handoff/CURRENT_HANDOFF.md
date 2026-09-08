# Current Handoff — as of 2026-09-08 (Sprint 128 PR B verified; publication approval needed)

**Version:** v11.47.0 (`package.json:3`). **Base:** `origin/master` at `a7dde43e`.
PR #220 merged 2026-09-06, verified with `gh pr view 220` on 2026-09-07.
Its CI/CD Pipeline [run 34058385551](https://github.com/ravichavali/karmyq/actions/runs/34058385551)
succeeded. No fresh demo smoke test was performed in this planning session.

---

## 🔀 Active lanes

Sprint 128 runs on the Windows checkout with one active editor. The maintainer confirmed that
the second laptop is not set up. Future concurrent lanes use router-to-lane handoffs; they are
not active in this sprint.

| Lane | Machine | Branch | Handoff file | Sprint |
|---|---|---|---|---|
| Security maintenance / PR B (first) | Windows (primary) | `agent/codex/sprint-128-planning` | this file | 128 |

The maintainer approved framework refinement, security/dependency maintenance and standing-preview
corrections, executed sequentially. This stream holds the scheduled dependency work during PR B;
reconcile ownership only if new competing work is introduced. E1 is resolved through remediation;
D1's isolated test operation remains approved under the spec's terms. Merge, ADR allocation and operations outside
those terms retain their separate authority requirements.

⚠️ **This table is a pointer, not a coordination store.** It is a branch-local file, so it can be
stale and it is **never** the authority on who owns a contended resource. Derive those from their
live arbiters — see `CLAUDE.md` → *Parallel Development* → **Why reservations do not work here**
(ADR numbers, version bump, dependency lane, merge slot, demo data ops).

---

## Quick Start — publish PR B after explicit authorization

1. `git fetch origin` and confirm real state before trusting anything written here:
   `gh pr list` and `git log --oneline origin/master -3`.
2. **PRs #219 and #220 are MERGED.** Do not reopen, push, or seek merge authorization for them.
3. Use existing branch `agent/codex/sprint-128-planning`; do not recreate it. Planning artifacts
   and PR B implementation ship together. **Implementation is committed and verified; publication is blocked by automatic approval review.**
4. Read the [spec](../../docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md),
   [sprint index](../../docs/superpowers/plans/2026-09-07-sprint-128-single-stream.md), and
   [PR B plan](../../docs/superpowers/plans/2026-09-07-sprint-128-b-security-maintenance.md).
   Execute sequentially with `superpowers:executing-plans`; one editor, no worktrees.
5. **Goal:** make delivery easy to resume and review, repair security evidence handling and dated
   dependency decisions, and make standing-backfill previews match the real score writer.
6. Execute **B → A → C**. PR B owns audit/SDK maintenance and this existing branch. PR A owns
   workflow skills/handoff templates/contributor docs plus the doc drift assertion;
   PR C owns reputation preview correction. Exact write paths, validation and review/deploy steps
   are in the per-PR plans. A/C start from refreshed `origin/master` after the preceding PR's
   authorized merge and deployment verification. Fresh chat per PR; independent non-author review.
7. E1's September 15 expiry is resolved through supported remediation in PR B: Metro 0.84.5
   drops image-size; orphaned lock entries and the two unmatched exemptions are removed. No renewal
   was applied. Verify the final install/audit before declaring PR B ready. D1 is approved for PR C's isolated synthetic test operation;
   use corrected `s128-preview-*` resource names and pre/post environment checks. Do not let process
   polish postpone urgent remediation. PR B follows canonical PR-only merge rules directly;
   it does not depend on the still-stale deploy skill being corrected by A.
8. Read-only GitHub snapshot on September 7: open PRs #211, #212, #214, #216, #217, #218 are
   dependency proposals. Scheduled Expo SDK drift [run 34127716361](https://github.com/ravichavali/karmyq/actions/runs/34127716361)
   failed with drift detected. [Issue #206](https://github.com/ravichavali/karmyq/issues/206) lists
   eight Expo-family patch drifts; remeasure live before selecting versions. The image-size watch
   run 34124767949 succeeded. Refresh live state before execution.
9. Preview parity must exercise the real score writer on a disposable DB. Historical report counts
   below are not fresh measurements; the full provider discrepancy remains UNVERIFIED until reproduced.
10. No release version or ADR number is allocated. No Sprint 128 PR is open. Implementation commit
    is `352ffde2`. Obtain explicit authorization to publish this branch to public GitHub repository
    `ravichavali/karmyq`, then use normal push hooks and open PR B with the full template.

Original planning artifacts were verified before this review revision. Spec/plan self-review and the required independent
process review found no planning blockers. `npm test` exited 0: 26/26 Turbo tasks (25 cached),
root unit 101/101 and regression 647/647. Gotcha validation, local Markdown links, matching critical
notes, staged feedback and diff whitespace checks passed. Initial test attempts exposed sandbox
access restrictions and a PowerShell PATH selecting WSL Bash/missing Unix utilities; the successful
run used network/subprocess access and prepended the installed `C:\Program Files\Git\usr\bin`
to that process's PATH. No machine-wide setting was changed. PR A Task 1 records the startup check.

Planning commits stay on this branch; no Sprint 128 PR has been opened or pushed in this session.
Use git history for the planning commit identity. Current implementation evidence supersedes the
historical planning-only verification below.

### PR B implementation — September 8

- Refreshed git/GitHub: same six dependency PRs; `origin/master` remains `a7dde43e`.
- Task 1: live image-size evidence at `2026-09-08T12:18:31.984Z` matched E1 before dependency
  edits; monitor exit 1 was the seven-day expiry warning. Live Expo gate reported 14 drifts.
- Audit contract: original code failed 43/44 new cases; initial fix passed 44/44, plus 38/38
  existing audit/exemption cases. Independent review reproduced stderr leakage and severity-graph
  weaknesses (six additional red cases). Corrections and ordering fixtures passed; all four
  directly changed audit/SDK suites passed 106/106 before the final remediation fixture additions.
- SDK declarations/required transitive lock nodes and SDK-managed Dependabot version-update
  ignores are edited. The new config assertion first failed on the missing ignore list (15 other
  tests passed). Tests now directly declare the already-installed `yaml` parser.
- Final strict `npm ci` passed after removing the two proven orphaned image-size/queue lock
  entries. Metro 0.84.5 uses its internal image parser and no longer declares image-size. The
  installed-tree monitor at `2026-09-08T12:39:01.720Z` reports `resolved: []`, `exemptions: []`,
  `ok: true`; the live audit passes with zero high/critical (five moderate remain). Expo drift
  gate passes with only the two existing registered Jest divergences.
- E1 is resolved via its approved remediation alternative: both unmatched exemptions removed,
  no renewal applied. Mobile type-check and tests (2/2) pass. Full tests initially exposed three
  old fixture assumptions about nonempty registries/old Router pins; repaired without weakening
  assertions, and those suites pass directly (87/87). Final full suite passed: 26/26 Turbo tasks
  (23 cached), 101/101 root unit and 711/711 regression tests across 29 regression suites.
- Tests-workspace `tsc --noEmit` reports 70 pre-existing diagnostics. Final in-memory comparison
  against committed test sources produced the same 70, zero new diagnostics and none in any
  changed test file. These broad e2e/TDD issues remain a disclosed limitation.
- Independent simplify/code/security review has no remaining material findings. Source docs,
  gotchas, mobile context and generated landing docs are updated; dependency analysis regenerated.
- Staged feedback passed; ADR index/status reminders were resolved by reviewing the status and
  updating the index. Pre-commit review found no remaining material issues. Implementation is
  committed as `352ffde2`; the working tree was clean before this publication-status update.
- **Publication blocker:** automatic approval review rejected `git push -u origin
  agent/codex/sprint-128-planning` because it requires explicit user authorization for source-code
  publication to GitHub. No push or PR occurred; do not retry by an indirect method. Destination
  verified read-only: public `https://github.com/ravichavali/karmyq`. Request authorization for
  that exact branch/repository and PR creation. Local PR description is prepared at
  `C:\Users\ravic\AppData\Local\Temp\s128-pr-body.md` (machine-local convenience, not shared state).
  Rebuild from `.github/pull_request_template.md` and this evidence if the temporary file is absent.
- No server operation occurred. D1 remains for PR C. After authorization, push normally, open
  PR B, monitor CI and reconcile this handoff. Claude readiness review and
  explicit maintainer merge authorization remain gates; A starts only after B deploy verification.

## Critical implementation notes

1. One active stream on Windows; the second laptop is not set up. One editor at a time and a clean tree at role handoff.
2. B → A → C are sequential PRs, each based on refreshed `origin/master`; no worktrees or direct master pushes.
3. `CURRENT_HANDOFF.md` holds this stream's state. A future router is a pointer, never a lock or proof of ownership.
4. PR B resolves E1 through SDK-aligned removal of image-size and its two unmatched exemptions; verify the live audit passes with the empty registry. No renewal was applied.
5. Invalid audit evidence must fail before exemption matching for both empty and populated registries.
6. Preserve the trust formula and provider floors. Preview equivalence must exercise the real score writer, not a mocked return value.
7. New reputation tests begin in its `tests/tdd/` and promote when green; root cross-repo gates belong in `tests/regression/` because root TDD does not auto-promote.
8. Declare every imported dependency, edit manifests/lockfile surgically, and prove dependency changes with strict `npm ci`.
9. Every PR runs tests, simplify, independent code review and security review; maintainer authorization precedes merge, and deploy plus health verification precede the next merge.
10. Write source docs, remove generated timestamp/HEAD churn, and reconcile the handoff against live git/PR state before stopping.

## Deferred / retrospective

### Implementation plan and authorized decisions

The external review required security first; the plan now keeps labels stable while sequencing
B → A → C. A adds a direct-master recipe assertion with negative fixtures to the existing doc
drift gate. C builds one index per projected dataset, makes isolated PG/Redis provisioning plus
baseline a Task 1 hard gate, and preserves existing provider filters and fixed what-if floors.
The counting unit is provider-profile/community; two profiles for one user in one community count twice.

**E1 resolved, 2026-09-08:** supported SDK/Metro remediation removes image-size and both
unmatched exemptions. The earlier conditional renewal was not applied. Its original approval
terms and the measured remediation are retained in spec **E1**; do not reintroduce the entries.

**D1 is APPROVED by the maintainer's latest confirmation, 2026-09-07.** This supersedes the
earlier pending decision. Implement the approved isolation scope using `s128-preview-pg`,
`s128-preview-redis` and `s128-preview-net`: the earlier names collided with `scripts/deploy.sh:227`
(container cleanup filter `karmyq-`) and `:228` (network cleanup filter `karmyq`). No Compose
project labels, demo volumes or existing app-network attachments. The spec and PR C Task 1 name
the images, limits, loopback ports, schema-only/synthetic input and credential/target checks.
Before and after every test run (even a failed one), compare container IDs/start times/restart
counts/task labels and require healthy DB/Redis. A lost/restarted dependency is an environment
failure, not parity evidence. Preserve Jest's own exit status. Clean up only recorded task
resources on completion or abandonment; record any cleanup failure.
Historical host feasibility checks passed; availability of the corrected names is UNVERIFIED
until Task 1 rechecks them. No D1 server resource was created. Provisioning and
baseline remain PR C's hard entry gate; authorization is no longer the blocker. Scope expansion
still needs its own decision. Full operation terms are in spec D1.

Historical planning verification is in the planning commits; current PR B evidence is above.

Actual second-machine activation and concurrent delivery are deferred. Also deferred: provider
floor selectivity, blocking-lint policy, network import/onboarding features and major toolchain
upgrades. The sprint records review rounds, late findings, handoff corrections and ownership or
decision waiting; no new telemetry infrastructure. Claude assesses sprint completion after delivery.

---

## What shipped

**Sprint 126 — Honest Standing Backfill.** PR **#210 merged** 2026-09-03, squash `9083a79a`,
version **v11.46.0**, deployed and smoke-tested. The demo backfill was **applied and converged**
as an explicitly authorized data operation: 20,341 karma rows, 6,800 activity rows, 5,683 trust
pairs, 8,403 of 8,403 completed matches projected, idempotency proven against live data. Backup at
`~/backups/pre-s126-backfill-20260903T203953Z.dump`.

Full record: [`archive/2026-09-03-sprint-126-standing-backfill-SHIPPED-v11.46.0.md`](archive/2026-09-03-sprint-126-standing-backfill-SHIPPED-v11.46.0.md)
(historical — do not follow its instructions).

---

## Previous sprint record — historical validation, not current instructions

### PR #219 — MERGED 2026-09-05, squash `ea7ee194`
Shipped the `Parallel Development` rules in `CLAUDE.md`, the `AGENTS.md` topology rewrite, the
handoff lane convention, BUG-038, and a **real ADR-number uniqueness assertion** in the drift gate
(5 → 7 tests) replacing a backstop the earlier text claimed but had never implemented.

Merged with `--admin` under explicit maintainer authorization: the required approving review could
not be self-provided (the PR was authored by the same account), and all 20 checks passed.

**Codex reviewed three rounds** (`9b726c16`, `ccbc1bbf`, `ad6b38f3`). Round 1: reservations not
reliably shared between branches; self-contradictory handoff. Round 2: ADR allocation still raced
and the claimed backstop did not exist; an open Dependabot PR permanently occupied the dependency
lane. Round 3: superseded rules left in the summary table. All fixed before merge.

The durable correction: **querying live state establishes what is visible; allocating ownership
still requires serialization.** ADR numbers, the dependency lane and demo operations are now
maintainer-allocated, and ADR uniqueness is enforced by a real gate
(`tests/regression/doc-context-drift-gate.test.ts`, 5 → 7 tests, with a negative fixture proving it
fails on two `ADR-097` files).

### Sprint 127 — PR #220 merged September 6 (implementation record follows)

Branch `feature/sprint-127-knowledge-registry`, cut from the spec branch (which already carried
`master` at `ea7ee194`), so the PR ships spec + plan + implementation together.

**All 13 plan tasks complete.** `npx turbo run test --concurrency=2` → **26/26 tasks, exit 0**;
**647 regression tests**, 106 of them in the new registry gate.

What shipped:

- `docs/gotchas/` with **six seed entries** — three carrying declarative machine checks
  (hooks path, landing generation, Node 24 floor), three carrying review dates (npm status page,
  ADR-059/BUG-038, Dependabot/Expo).
- `scripts/gotcha-registry.js` — dependency-free CommonJS validator; `scripts/gotcha-check.js` —
  CLI for validation (`--staged`) and discovery (`--for <paths>`).
- `tests/regression/sprint-127-gotcha-registry-gate.test.ts` — **106 tests**: positive assertions
  over the real registry, a negative fixture per assertion, a hostile-input block covering every
  code-review and security-review finding, and a clean-room fixture that clones the candidate
  commit and runs the validator under bare `node` with no `node_modules`.
- Credential screen in `scripts/git-hooks/pre-commit`, proven with four probes in a disposable
  clone (partial-staging bypass, quoted JSON key, orphaned `.md`, and deletion-must-pass).
- Onboarding-policy assertion in the drift gate; README/CONTRIBUTING/claude.md now state
  `npm ci` + `npm run hooks:install` identically.
- `.claude/skills/learned/SKILL.md` and a capture checkpoint in the `ship` skill.
- `docs/concepts/how-karmyq-learns.md` (public), CONTRIBUTING authoring manual, and
  **ADR-097**.

**Both new gates were proven falsifiable**: breaking `hooks_dir=".git/hooks"` fails the registry
gate with "no longer contains"; regressing README to `npm install` fails the onboarding assertion.

**Two real defects were caught by the suite after the docs commit** and fixed in `f2ea4958`: a
generated ADR page reaches `nav.json` only if its slug is in `ADR_GROUPS` (ADR-097 was missing),
and the ADR's passing mention of a licence token registered as an unenumerated claim site.

**All four SDLC gates are done.** `/simplify` (4 parallel agents), `/code-review` at high, and
`/security-review` all ran on the branch diff; every finding was reproduced before being fixed and
is now pinned by a fixture that fails without the fix.

- **/simplify** — reused `parseUtcDate`/`todayUtc` from the ADR-094 core and `ROOT`/`tracked()`
  from the test helpers; replaced two divergent check chains with one `CHECKS` dispatch table;
  made hermeticity an allowlist over the actual require set rather than a blocklist of module
  names. That reuse **found a real latent bug in shared security-gate code**: `parseUtcDate` threw
  a `RangeError` on `2026-13-45`, so a malformed date in `security/audit-exemptions.json` would
  have taken the ADR-059 gate down rather than failing it. Guarded, with the parity test extended.
- **/code-review (high)** — six findings, all confirmed: four unhandled-crash paths, a false
  negative in `--for` (an unparseable sidecar answered "No gotchas" with exit 0), a one-day
  gate/CLI date disagreement, and a false alarm blocking unrelated commits.
- **/security-review** — two Medium findings, both against path containment, plus a prototype-key
  crash. **The durable lesson: refusing paths outside the repository root is not a security
  boundary.** `.git` is *inside* the root and holds the runner's checkout credential; containment
  was purely lexical so a committed symlink defeated it; and `json_equals` echoed the value it
  read, which is a direct exfiltration channel into a public CI log. All closed and proven — the
  symlink case with a directory junction, since the reviewer could not demonstrate it on Windows.

**Version shipped: v11.47.0.** Historical validation: root `package.json` + the two root lockfile
fields were spliced in place; `npm ci --dry-run` exited 0 with no dependency churn.

**No remaining PR #220 push/open/merge action.** GitHub confirms the PR merged at `a7dde43e`.

Spec: `docs/superpowers/specs/2026-09-04-ecosystem-knowledge-registry-design.md`.
Plan: `docs/superpowers/plans/2026-09-04-sprint-127-knowledge-registry.md`.

### Design spec — how it got here

Proposes `docs/gotchas/` — a home for operational knowledge that today lives only in one
maintainer's private agent memory and reaches nobody else. Every entry carries exactly one of a
declarative machine check or an expiry date. **Review-approved: "no remaining plan blockers"
(Codex, round 4).** Two rounds on the spec and four on the plan are integrated; 25+ findings, zero
false positives. Spec round 1: renewal
rule too blunt, doc-agreement gate asserted weaker than it claimed, `js-yaml` undeclared, plus asks
on discovery, scope and credential screening. Round 2: the renewal rule needed information the
schema cannot express (promotion is now a reviewer decision, not a validator rule), and `scope`
must name git-tracked paths rather than machine-local ones.

**Format decided: JSON sidecars** (one `.json` + one `.md` per entry, orphans rejected), which
takes no new dependency — so **this lane is dependency-independent** and can run concurrently with
the ADR-059/exemptions work. Codex has **no further design objections to implementation planning**
once the remaining text reconciliation lands.

The spec was approved and **implementation is complete** — see the Sprint 127 record above. This
section is retained as the record of how the design was reached.

---

## Outstanding — rough priority

1. **PR B review/merge/deploy:** BUG-038 is fixed on this branch; deployment remains pending.
   The new contract/CLI regressions enforce unavailable-evidence rejection before registry matching.
2. **Master still has the September 15 exemption deadline.** This branch removes image-size and
   the two exemptions through supported remediation; deploy PR B before that date.
3. **PR #218 — Dependabot production-deps group.** Do **not** merge: it bumps 6 React Native
   packages past Expo SDK 57 pins (`react-native` 0.87.1 vs 0.86.2, plus maps, safe-area-context,
   reanimated, worklets, screens), caught by
   `tests/regression/sprint-122-expo-sdk-alignment.test.ts:175`, with 7 consequent TS errors in
   `apps/mobile` (historical review). PR B adds the SDK-derived ignore-list assertion and config;
   it does not merge or close these queued dependency proposals.
4. **Two operator-report preview inaccuracies** from the Sprint 126 backfill (`scoreBuckets`
   predicts 1,518 pairs at score 0 where the stored minimum is 1; `providerEligibility` predicts
   384 providers where 499 of 501 qualify). Stored data is correct; the operator preview is wrong,
   which matters because it is what an operator reads before authorizing a destructive operation.
5. **ADR-095 floor 20 is barely selective** — 499/501 providers clear it. Needs a deliberate
   decision; changing the floor requires its own authorization.
6. **Is a non-blocking linter still the policy?** `.github/workflows/ci.yml:78` runs
   `npm run lint --if-present || echo "...non-blocking"`, so lint failures never fail CI, while the
   `apps/mobile` type-check at `:75` does block. That is configured intent, not a defect — but it
   was written before the current posture that a gate which cannot fail is worse than no gate.
   Worth a deliberate yes or no rather than leaving it implicit. Surfaced 2026-09-05 when a green
   `Lint & Type Check` job carried an `npm run lint exited (1)` annotation.

---

## Second machine (Mac) — setup deferred; historical notes

Steps 1–7 of the setup are unaffected by anything above. Known corrections from the first attempt:

- `git config core.hooksPath` is **empty on a fresh clone** — that is correct. The installer reads
  it and falls back to `.git/hooks` (`scripts/install-hooks.sh:53-54`). Verify by listing
  `pre-push`/`pre-commit` at whichever path resolves; on macOS they are **symlinks** (`lrwxr-xr-x`)
  by design, copies only on Windows.
- `diskutil info /` has **no** `Case-Sensitive` field on current macOS. Test what matters instead:
  `ls CLAUDE.md` in the repo — it resolves only on a case-insensitive filesystem, and the root
  context file is git-tracked lowercase as `claude.md`.
- `gh` is not installed by default: `brew install gh`.
- Only the memory directory, the four real `.env` files, `.claude/settings.local.json`, and
  optionally `~/.claude/settings.json` need manual copying. Everything else arrives with the clone.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master; never force-push.
- Every merge needs explicit maintainer authorization; `--admin` override needs its own each time.
- No docs-only master pushes — every master push is a full deploy.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
- All four SDLC gates every sprint, calibrated to diff size.
- Landing docs regenerate on `npm test`; revert timestamp/HEAD-sha churn before committing.
- Cross-agent review: the agent that did not author an artifact reviews it.
- **Reconcile this file against `gh pr list` and `git log` before claiming any work complete.**
  A handoff that contradicts real PR state is a blocking defect. It happened **three times in one
  session** (2026-09-04/05): at `9b726c16` the body still described a merged PR as open; after the
  #219 merge the header still named the old branch of record; and its Quick Start still said
  "neither is merged" minutes after one was. Codex caught all three.

  This file is the most staleness-prone artifact in the repo precisely because it is the only one
  carrying cross-session state — every merge, every push, and every review round invalidates part
  of it. Treat "update the handoff" as a step of the action, not a task that follows it.
