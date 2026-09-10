# Sprint 128 PR A — Framework refinement — Handoff

**Date**: 2026-09-10
**Outcome**: implementation complete; PR #232 OPEN with CI green and **v11.49.0** prepared, awaiting the required approving review and maintainer merge authorization

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/codex/sprint-128-framework` |
| **Base** | `origin/master` at `095fc856` (fetched 2026-09-09) |
| **Active editor** | Codex — handoff reconciliation only; implementation handed off by Claude |
| **Reviewer role** | Review rounds recorded below; GitHub required approving review still owed |
| **Owned paths** | `.claude/skills/*`, `.claude/agents/process-reviewer.md`, `.claude/handoff/*`, `CONTRIBUTING.md`, `docs/concepts/how-karmyq-learns.md`, `tests/regression/doc-context-drift-gate.test.ts`, plus `docs/BUGS.md` (maintainer-approved deviation) |
| **Shared resources needed** | none — no ADR minted, no dependency change. Version bumped to **v11.49.0** at merge time, re-derived from `origin/master` (11.48.0) |

## Links

- **Spec**: `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`
- **Plan**: `docs/superpowers/plans/2026-09-07-sprint-128-a-framework.md`
- **PR**: [#232](https://github.com/ravichavali/karmyq/pull/232) — OPEN

## PR B is DONE — the previous handoff was wrong about this

The prior handoff stated PR #221 was OPEN and "no merge or deployment has occurred". Live state on
2026-09-09 contradicted it, and live evidence wins:

- **PR #221 MERGED** 2026-09-09T17:33:39Z, squash `095fc856` (`gh pr view 221`).
- **CI/CD Pipeline [run 34383657151](https://github.com/ravichavali/karmyq/actions/runs/34383657151) succeeded**, including the
  `Deploy to Demo` job. Observed 2026-09-09.
- `origin/master` is now `095fc856`. Version v11.48.0 shipped with it.

PR A's entry gate (B merged **and** deploy verified) is therefore satisfied. This correction is the
exact failure the corrected `update-handoff` skill now tells the next session to check for first.

## Quick Start

1. Read this handoff, then confirm live state before trusting it:
   `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. **Reuse the existing branch `agent/codex/sprint-128-framework`** — do not recreate it, and do
   not branch again from master. It is published as #232; compare local HEAD with the live PR head
   before treating CI evidence as covering local changes.
3. Open the plan: `docs/superpowers/plans/2026-09-07-sprint-128-a-framework.md`.
4. Remaining work is plan Task 8 — see *Still owed before merge* at the bottom.

**Next unchecked task**: Task 8 — PR [#232](https://github.com/ravichavali/karmyq/pull/232) is open with all checks green. It needs the required
approving review (not self-providable) and explicit maintainer merge authorization.

## What changed on this branch

- **New drift-gate assertion** (`tests/regression/doc-context-drift-gate.test.ts`, 13 → 41 tests):
  a pure `workflowRecipeIssues()` predicate over the **live agent-facing playbook set** — enumerated
  from git via the shared `tracked()` helper, never a directory glob — rejecting direct-to-master
  push recipes including `HEAD:master`, force, quoted and `refs/heads/` variants, with a negative
  fixture per case and a false-positive guard.
- **`docs/GITHUB_ACTIONS_SETUP.md`**: two direct-master recipes replaced with the PR-merge flow.
  One sat under *"Workflow Doesn't Trigger → Fix"*, i.e. it recommended the prohibited action.
- **`deploy` skill rewritten** to the PR flow: branch checks → gates green → PR template →
  independent review → readiness recommendation → **maintainer-authorized merge** → CI/deploy/health.
- **`ship`** delegates to `deploy`; `ship` Phase 1 owns the four gates and `deploy` Step 2 only
  confirms them, so the two no longer name each other as owner.
- **`update-handoff`** is canonical, with the routing decision procedure and a
  reconcile-against-live-state step; **`handoff`** is a thin alias, ending their divergence.
- **`process-reviewer`** no longer pipes `npm test` through `tail`, which discarded the exit status.
- **`TEMPLATE.md`** replaced (it was a *plan* template); **`handoff/README.md`** no longer documents
  that deleted template, and its activation checklist is now pointers into `CLAUDE.md` rather than a
  second ungated copy of those rules.
- **`sprint-planning`**: canonical stack reference, calibrated simplify cadence, test placement
  deferred to `tests/claude.md`, branch from fetched `origin/master`.
- **`CONTRIBUTING.md` / `how-karmyq-learns.md`**: one-editor workflow; the
  gotcha / handoff / agent-memory distinction lives in the concept page, with CONTRIBUTING linking.
- **BUG-039** logged (unrelated to this work).

## Review round — `/simplify` (4 parallel agents), all findings resolved

Four independent agents reviewed the diff for reuse, simplification, efficiency and altitude.
**Three defects this PR itself introduced** were found and fixed:

1. **The gate was a false-green** (altitude). It scanned only `.claude/skills/**`, while
   `docs/GITHUB_ACTIONS_SETUP.md:91,257` carried the identical recipe — and `claude.md:307` routes
   agents to that file. Scope widened to the live playbook set; **proven by injection** that it now
   fails there, then reverted.
2. **`handoff/README.md` still documented the deleted plan-style template**, actively instructing
   the next agent to rebuild the very defect this PR removes. Rewritten.
3. **Circular ownership**: `deploy` deferred the four gates to `ship`, `ship` deferred them back.
   One-way now. A stale `deploy Phase 7` pointer (renumbering left it aimed at the SSH step) fixed
   to Step 9.

Also applied: `findSkillDocs` replaced with the repo's shared `tracked()` helper (a hand-rolled
walker was the fourth in that directory and ignored the "live arbiter, never a directory glob"
contract, and lacked its `node_modules` guard); `find` → `some` with a hoisted `pushesToMaster`
predicate; duplicated policy removed from the activation checklist, CONTRIBUTING and sprint-planning.
Efficiency found nothing (new code is ~0.17% of suite runtime, measured).

**Deliberately not done, and why:**
- **Not acted on — needs your decision.** `master` branch protection has `enforce_admins: false`,
  and the admin identity used here can therefore bypass all six required checks and the review
  requirement with a direct push. The doc-level gate governs what playbooks *tell* an agent to do;
  it does not close that door. Setting `enforce_admins: true` is one API call and would make direct
  pushes actually impossible. **This is a repo-settings change and yours to make, not mine.**
- Fixture tests kept one-per-case rather than table-driven: the file's existing rationale (each
  failure mode gets its own fixture) is worth more than ~20 saved lines.

## Review round — `/code-review` (high), all 9 findings resolved

Every finding was reproduced against the repo before being fixed.

1. **The gate's pathspec was wrong in a way that inverted its scope.** `.claude/handoff/**/*.md`
   matches only files *below* a subdirectory, so it scanned the 10 **archived** handoffs and missed
   the 3 live ones — the opposite of what its own comment claimed. Corrected to `dir/*.md` plus an
   explicit `:(exclude)` for `archive/`, and **proven by injection in both directions**.
   The old discovery assertion would not have caught this, so it now asserts live-file identity
   *and* that no archived file is in scope.
2. **`gh pr create --fill`** (added by me in `GITHUB_ACTIONS_SETUP.md`) omits the four sections
   `.github/workflows/pr-contract.yml:31` requires, so the documented deploy path could not merge.
   Now `--body-file .github/pull_request_template.md`.
3. **Gate scope still missed `docs/gotchas/*.md`** — mandatory agent reading. Added.
4. **`TEMPLATE.md` dropped Quick Start**, which `claude.md:15`, `AGENTS.md:13` and
   `sprint-planning/SKILL.md:221` all require. Restored, and instantiated in this handoff.
5. **`deploy` Step 9 hardcoded `CURRENT_HANDOFF.md`**, contradicting the routing rule this PR adds;
   in router mode that corrupts the shared router. It now invokes `update-handoff`.
6. **`ship` Phase 3 lead-in** still promised "mechanical merge → push", contradicting the new text
   six lines below it.
7. **`CONTRIBUTING.md` said "one checkout"** while `claude.md:252` says two. Reworded to one active
   editor per branch, deferring to CLAUDE.md for the two-machine rules.
8. **`handoff/README.md`'s "Until a second machine is activated"** contradicted its own section
   heading. Reworded to "when only one sprint is in flight".
9. **`how-karmyq-learns.md`: "Only the first is distribution"** resolved to *memory* — the first
   item in its own sentence — inverting the thesis. Now names the gotcha explicitly.

## Review round — `/security-review`, no findings

Diff is 13 markdown files (excluded from findings by policy) plus one test file. The substantive
check, given Sprint 127's finding that a gate echoing what it read is an exfiltration channel into
a public CI log: **`workflowRecipeIssues` cannot echo arbitrary content.** It emits a match only
when a whitespace token on the line resolves to `master` or `…:master`, and echoes only that
`git push …` fragment — never the file body, a hash, or non-matching content. The other assertions
echo path keys only.

Also ruled out: argument injection via `tracked(...PLAYBOOK_PATHSPECS)` (`execFileSync` with argv,
no shell; all 11 pathspecs hardcoded, none option-shaped — `:(exclude)…` is pathspec magic, not an
option prefix); path traversal through `read()` (git refuses to index a `..` component); and
symlink escape (no tracked symlinks exist, and `ci.yml` triggers on `pull_request`, so fork PRs get
a read-only token and no secrets).

Note: `tests/regression/helpers/workspaces.ts` is **not** modified by this PR — it is pre-existing
from Sprint 122. This branch is only its first caller in this file.

## Independent non-author review — 2 findings, both real, both fixed

A non-author reviewer was asked to **defeat** the gate rather than confirm it. It found the most
important defect of the whole sprint:

1. **A push that names master nowhere was not caught.** The predicate only flagged a push whose
   *arguments* named master. But the original defect's own shape checked master out in one step and
   pushed several steps later — so rewriting that final line as an argument-less push, the most
   natural form, named master nowhere and slipped through. A remote-only push (no refspec) missed
   for the same reason, as did a push separated from `git` by a global option such as `-C`.
   Reproduced outside Jest before fixing.
   **Fix:** the scan now tracks the checked-out branch **across the whole document** (not per
   fenced block — the real defect spanned Step 1 and Step 3) and flags a refspec-less push while
   master is checked out. Two false-positive guards pin the other direction: an argument-less push
   after creating a feature branch is the *correct* workflow and stays clean, and such a push with
   no checkout anywhere is unattributable and is not guessed at.
2. **`.claude/PROMPTS.md` was out of scope** — a tracked, agent-facing file with a copy-paste
   *Deploy* prompt. Added to `PLAYBOOK_PATHSPECS`.

The reviewer also independently confirmed, against GitHub and `git-scm.com`, that PR #221 merged at
`095fc856` with a successful Deploy-to-Demo job, that the pathspec-crossing-slash fix is correct,
and that every `file:line` citation in this handoff resolves. It could not verify
`enforce_admins: false` (no authenticated access) — that remains the maintainer's call.

At that point the gate stood at 30 tests and root regression at 728; both were superseded by the
two review rounds below.

## Maintainer review of `233296a2` — 5 findings, all fixed

**P1 — the committed handoff broke the gate, and the reported result was wrong.** This file's
review notes quoted four forbidden command examples verbatim. Because `.claude/handoff/*.md` is now
in scope, the gate failed on them: **29 passed, 1 failed, exit 1** at that commit. The "30/30 /
728" figures in that commit message describe the tree *before* the final handoff edit.

**Root cause, and the rule that follows:** the suite was run, then a scanned file was edited, then
the commit was made without re-running. Now that `CURRENT_HANDOFF.md` is itself a gated document,
**every handoff edit invalidates a prior test result.** The handoff must be finished *before* the
verification run, not after it. The examples are now prose.

**P2 — three ways the bare-push rule could be evaded or misfire:**
- *Trailing comments counted as arguments*, so a remote-only push followed by `# deploy…` looked
  like it carried an explicit refspec. A comment does not change git's destination; comments are
  now stripped before arguments are counted.
- *Checkouts and pushes were scanned in two separate passes*, so every checkout on a line was
  processed before any push on it. A chain that pushed while on master and only afterwards
  switched away passed, and the reverse — a correct feature push followed by a checkout of master
  — was falsely flagged. One combined pattern now yields both subcommands in **textual order**.
- *Quoted checkout operands lost attribution*: a quoted master checkout followed by a bare push
  went unflagged while the unquoted form was caught. Operands are normalized.

**P2 — `handoff/README.md` still told agents to overwrite the router.** Its step 1 selects the file
to own, and its step 6 said to write `CURRENT_HANDOFF.md` regardless — the exact contradiction this
PR set out to remove. It now writes the file chosen in step 1, never the router, and defers to the
`update-handoff` skill rather than reproducing its steps.

The maintainer also confirmed with authenticated access that `enforce_admins: false`, six required
checks, and one required approving review. That closes the item the earlier reviewer left
UNVERIFIED — the bypass is real, and remains the maintainer's call.

Gate was 34 tests at that point (see the round below for the correction to the probe claim);
all of those cases are now fixtures.

## Second maintainer review — 3 more findings, all fixed

All three were consequences of the comment-stripping fix from the previous round — a fix that
introduced two new evasions and one false negative.

- **Commented-out commands still counted.** Comments were stripped from a matched command's
  *arguments*, but discovery ran first, so a commented-out branch switch was read as a real one
  and cleared master attribution. Comments are now removed **before** discovery.
- **File restoration was read as a branch switch.** `git checkout -- <path>` restores files without
  switching; the tracker recorded the pathname as the current branch. A `--` operand (and a bare
  `.`) now leaves branch state untouched.
- **Truncating at every `#` hid a real refspec.** A branch name may legitimately contain one, so
  truncation dropped the `master` that followed it. `#` now opens a comment only at a token
  boundary and outside quotes.

Getting the comment rule right needed one more distinction the first attempt missed: **a
line-leading `#` outside a fenced block is a markdown heading, not a comment.** Stripping there
would discard a heading whose text carries a recipe — so that case has its own fixture too.

**Correcting an overclaim.** The previous round described an out-of-Jest probe as independent
verification. That was wrong: running the same predicate through a different runner proves nothing
the suite doesn't. The independence came from **separately chosen cases and expected behavior**,
and cases only protect the repo if they live in the gate — all 11 are now fixtures. The probe was
scaffolding, not evidence.

Gate stood at 39 tests after that round.

## Third maintainer review — 1 finding, fixed

The path-restoration guard added in the previous round was applied to **both** `checkout` and
`switch`. But `git switch` has no path-restoration form — that is `git restore` — so in
`git switch -- master` the `--` merely ends option parsing and the operand is still a branch.

The guard therefore broke detection in both directions: a switch **to** master was ignored, so a
following push went unflagged; and a switch **away** from master was ignored, so a correct feature
push was falsely flagged. The maintainer verified both transitions against real git in a
disposable repository. The guard now applies only when the subcommand is `checkout`, with a
fixture for each direction and the distinction recorded in the function's docstring.

Gate is now **41 tests**.

**Pattern worth carrying forward.** Every defect in this predicate after the first has been a
*semantic* one — what a git command actually does — not a scoping or plumbing error: a push that
names no branch, a comment that is not a comment, a checkout that does not check out, a `--` that
means opposite things either side of one subcommand. Reading the diff harder does not surface
these; checking each command's real behaviour against git's documentation or a disposable repo
does. Anything added to this gate later should be verified that way before it is trusted.

## Blockers and decisions

- **Decision (maintainer, this session)**: commit BUG-039 inside PR A even though `docs/BUGS.md` is
  outside the plan's file map — it is append-only and would otherwise be lost.
- **Deviation, flagged**: `docs/GITHUB_ACTIONS_SETUP.md` is also outside the plan's file map. It was
  changed because leaving it would have shipped a gate that green-lights the exact defect it exists
  to catch.
- **Blocker**: none. Merge authorization is a gate, not a blocker.
- **Open, not fixed here — BUG-039**: `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE`
  on deployed karmyq.com, so the guided Maria demo cannot start. Needs server logs; ADR-084 makes
  every failure one opaque 503 by design. Not caused by Sprint 128.
- **Observed, left alone**: `apps/landing/src/data/docs/concepts/how-karmyq-learns.json` is
  gitignored and untracked while sibling concept pages are tracked. The prebuild regenerates it, so
  the site is correct; the inconsistency is pre-existing.

## Verification references

- `npm test -- --concurrency=2` → **exit 0**; 26/26 Turbo tasks, root unit **101/101**, root
  regression **739/739** across 29 suites (2026-09-09, after all review fixes).
- Drift gate direct: `cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand`
  → **41/41, exit 0**.
- **Falsifiability proven twice**: the assertion failed on the two original defects
  (`deploy/SKILL.md:30`, `ship/SKILL.md:66`) before the fix; and after widening, a temporary
  injection into `docs/GITHUB_ACTIONS_SETUP.md` failed the gate at the expected file and line.
- `node scripts/gotcha-check.js` → clean, 6 entries. `git diff --check` → clean. Local markdown
  links resolve in all changed docs; code-fence counts balanced.
- Generated `apps/landing/src/data/docs/` churn reverted; `architecture.json` drift is pre-existing.

⚠️ GitHub status above is a dated observation. Re-derive with `gh pr view` and
`git log origin/master` before trusting it.

## PR A is open — [#232](https://github.com/ravichavali/karmyq/pull/232)

Pushed 2026-09-10 at `bee2fbe3`. **All 20 checks SUCCESS**, plus `Deploy to Demo` SKIPPED, which is
expected — it runs only on a `master` push. `mergeStateStatus` is **BLOCKED** on the required
approving review, which cannot be self-provided on a PR authored by the same account.

`pr-contract` passed, confirming the `--body-file` fix: `gh pr create --fill` would have failed it.

**One unexplained transient.** The first push attempt failed the pre-push hook — `@karmyq/tests#test`
failed in the regression tier — but the hook's captured output was truncated to npm wrapper noise,
so **the failing test could not be identified**. Three direct reruns passed 739/739 and the retry
pushed cleanly. Recorded as unidentified rather than attributed to one of the known flakes without
evidence. If it recurs, capture the hook's full output before concluding anything.

## Still owed before merge

### Head-specific verification (2026-09-10)

Codex independently queried each run with `gh run view --json headSha,status,conclusion`:
[CI/CD Pipeline](https://github.com/ravichavali/karmyq/actions/runs/34482723027),
[Tests](https://github.com/ravichavali/karmyq/actions/runs/34482723029),
[PR Contract](https://github.com/ravichavali/karmyq/actions/runs/34482723024), and
[CodeQL](https://github.com/ravichavali/karmyq/actions/runs/34482719806) all reported completed/success
for the published PR head `107e6ef0b99922de7d56ed88205f39ef34b02284`. This evidence covers that
published revision, not subsequent local handoff edits. Live PR state was OPEN / BLOCKED /
REVIEW_REQUIRED with no submitted reviews. The authenticated account and PR author were both
`ravichavali`; branch protection required one approval and six checks, with `enforce_admins: false`.
Fetched `origin/master` remained `095fc856`; no merge or settings change was performed.

**Watcher failure reported by the previous session:** its 90-second wait ended while the rollup
still displayed the preceding head's completed checks and new runs had not registered. Zero
in-progress checks is not evidence of success. Before accepting green, require the expected
workflows to exist, verify each run's `headSha` against the current PR head, require successful
completion, and re-read the PR head to detect another push. Missing runs mean pending/unknown.
The earlier `gh run list --commit` lookup returned nothing; do not interpret an empty lookup as
passing. Use the run IDs and inspect their head SHAs directly.

### Remaining actions

- **Required approving review on #232** — cannot be self-provided; a human or a second account.
- **Explicit maintainer merge authorization**, then merge → CI/CD → deploy → health verify.
  Only after that does PR C start, from a refreshed `origin/master`.
- **Your decision, not mine**: `master` has `enforce_admins: false` (maintainer-confirmed with
  authenticated access), so the admin identity bypasses all six required checks and the required
  approval with a direct push. This PR fixes what the playbooks *say*; it cannot close that.
- **Unrelated to this PR**: GitHub reported 4 vulnerabilities on the default branch during the push
  (1 high, 3 moderate). The high is inside the repo's own ≤ 1 week SLA — worth checking
  independently of #232.
