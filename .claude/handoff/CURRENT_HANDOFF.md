# Sprint 128 PR A — Framework refinement — Handoff

**Date**: 2026-09-09
**Outcome**: in progress — implementation complete, PR not yet opened

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/codex/sprint-128-framework` |
| **Base** | `origin/master` at `095fc856` (fetched 2026-09-09) |
| **Active editor** | Claude (this session) — one editor |
| **Reviewer role** | non-author review still owed (`/simplify`, `/code-review`, `/security-review`) |
| **Owned paths** | `.claude/skills/*`, `.claude/agents/process-reviewer.md`, `.claude/handoff/*`, `CONTRIBUTING.md`, `docs/concepts/how-karmyq-learns.md`, `tests/regression/doc-context-drift-gate.test.ts`, plus `docs/BUGS.md` (maintainer-approved deviation) |
| **Shared resources needed** | none — no ADR minted, no dependency change. Version bump is re-derived from `origin/master` **at merge time** |

## Links

- **Spec**: `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`
- **Plan**: `docs/superpowers/plans/2026-09-07-sprint-128-a-framework.md`
- **PR**: not yet opened

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
   not branch again from master. Seven commits are already on it.
3. Open the plan: `docs/superpowers/plans/2026-09-07-sprint-128-a-framework.md`.
4. Remaining work is plan Tasks 7–8 — see *Still owed before merge* at the bottom.

**Next unchecked task**: Task 7 — push the branch and open PR A with the full template. All four
SDLC gates are complete; an independent non-author review and merge authorization remain.

## What changed on this branch

- **New drift-gate assertion** (`tests/regression/doc-context-drift-gate.test.ts`, 13 → 34 tests):
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

Gate is now **30 tests**; root regression **728**.

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

Gate is now **34 tests**, plus an 11-case parser probe run outside Jest (7 must-flag, 4 must-stay-
clean) so the predicate is checked independently of the suite that ships with it.

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
  regression **732/732** across 29 suites (2026-09-09, after all review fixes).
- Drift gate direct: `cd tests && npx jest regression/doc-context-drift-gate.test.ts --runInBand`
  → **34/34, exit 0**.
- **Falsifiability proven twice**: the assertion failed on the two original defects
  (`deploy/SKILL.md:30`, `ship/SKILL.md:66`) before the fix; and after widening, a temporary
  injection into `docs/GITHUB_ACTIONS_SETUP.md` failed the gate at the expected file and line.
- `node scripts/gotcha-check.js` → clean, 6 entries. `git diff --check` → clean. Local markdown
  links resolve in all changed docs; code-fence counts balanced.
- Generated `apps/landing/src/data/docs/` churn reverted; `architecture.json` drift is pre-existing.

⚠️ GitHub status above is a dated observation. Re-derive with `gh pr view` and
`git log origin/master` before trusting it.

## Still owed before merge

- ~~`/security-review`~~ — **done, no findings.** All four SDLC gates complete.
- ~~Independent non-author review~~ — **done**; 2 findings, both fixed (above). A second pair of
  eyes via Codex is still available if you want it.
- **Push + open PR A**, then **explicit maintainer merge authorization** (plan Task 8).
- **Your decision, not mine**: `master` branch protection has `enforce_admins: false`, so the admin
  identity can bypass all six required checks with a direct push. This PR fixes what the playbooks
  *say*; it cannot close that. `enforce_admins: true` is one API call.
