# Usage diet — #335 follow-ups, scoped CLAUDE.md, agent model routing (ADR-104) — Handoff

**Date**: 2026-11-11
**Outcome**: in progress. The PR is open. The review-fix commit for Codex's review is pushed and awaits Codex re-review, then the maintainer's merge authorization

> State between sessions only. The rationale lives in [ADR-104](../../docs/adr/ADR-104-agent-process-economy.md); the
> evidence lives in the PR's `## Validation` ledger. There is no separate plan: this is a small, well-understood change,
> planned and executed in one chat as CLAUDE.md allows.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/usage-diet` |
| **Base** | `origin/master` at `edc867e9` (PR #335 merge; fetched 2026-11-11) |
| **Active editor** | Claude. Any review-fix commits land on this branch |
| **Reviewer role** | Codex, as the non-author. Reviewers read the diff and do not co-edit |
| **Owned paths** | `claude.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.claude/agents/{Explore,migration-validator}.md`, `.claude/handoff/**`, `.claude/skills/{pre-commit-check,update-handoff}/SKILL.md`, `apps/claude.md`, `packages/claude.md`, `scripts/claude.md`, `docs/SERVICE_GOVERNANCE.md`, `scripts/{pre-commit-check.sh,service-context-hook.js}`, `tests/regression/{pre-commit-check,service-context-hook}.test.ts`, `docs/adr/{ADR-104-agent-process-economy.md,README.md}`, `scripts/generate-docs.ts` (`ADR_GROUPS` entry only), and the generated ADR-104 landing pages (`nav.json`, `concepts.json`, `concepts/adr-104-*.json`) |
| **Shared resources needed** | **ADR-104**, allocated by the maintainer on 2026-11-11. **No version bump**: process docs and scripts only, as with #335, so `package.json` stays 11.113.0. The dependency lane is not used. No demo data operation. **Merge slot: needs the maintainer's explicit authorization** |

## Links

- **ADR**: [ADR-104](../../docs/adr/ADR-104-agent-process-economy.md), Proposed
- **PR**: opened from this branch. Find it with `gh pr list --head agent/claude/usage-diet`
- **Previous handoff (PR #335)**: [archive](archive/2026-11-11-pr-335-process-overhead-COMPLETE.md)

## Quick Start

1. Read `CLAUDE.md` and this handoff, then reconcile live state: `git fetch origin`,
   `gh pr list --head agent/claude/usage-diet --state all`, `git log --oneline origin/master -3`.
2. Stay on `agent/claude/usage-diet`. Never push to master directly and never force-push this branch.
3. Read the PR's `## Validation` ledger and *Quality gates* section before trusting any pass count.

**Next unchecked task**: Codex's third non-author review, of the second review-fix commit, as code-review and
security-review equivalents, labelled as such.
- Focus on `scripts/pre-commit-check.sh` lines 80–128, especially the recovery command printed at `:125-126`. It
  restores from the pre-npm `git write-tree` snapshot, never HEAD.
- Then the two reworded ADR-104 statements.
- The PR's *Review response* section maps each finding to its fix.

Gates done so far:
- [Codex review, 2026-11-11](https://github.com/ravichavali/karmyq/pull/336#issuecomment-6814815323): three P2
  findings, all CONFIRMED and fixed or corrected.
- [Codex re-review, 2026-11-12](https://github.com/ravichavali/karmyq/pull/336#issuecomment-6825575270): confirmed
  the staged-change fix.
  - New P2: the printed recovery command restored from HEAD and discarded work staged before the run.
  - Two P3 wordings: the drift-gate sentence, and "every custom subagent loads it".
  - All CONFIRMED and fixed.
- The author's `/simplify` pass ran once, on the code diff only, done in-conversation rather than with the recipe's
  four subagents. It merged the two post-run checks into one report.

After re-review comes the merge, which needs the maintainer's explicit authorization. Once merged and deployed, ADR-104
moves to Implemented on the next product branch (never in a docs-only master push), and this handoff is archived.

## What this branch does

- **#335 follow-ups.**
  - `scripts/pre-commit-check.sh` refuses untracked files before npm runs. It fails any passing run that changed the
    tree or the index, listing the paths. The index check compares a `git write-tree` snapshot taken before npm with
    one taken after; the Codex review added it.
  - `scripts/service-context-hook.js` exits 0 silently on empty or malformed stdin. That covers the malformed-input
    half of #335 review item 6.
  - 7 new regression cases cover these changes. The ledger records them RED on `edc867e9`'s scripts and GREEN on this
    branch.
- **Scoped context.** The root `claude.md` goes from 29,978 B / 498 lines to 18,109 B / 317 lines. Four
  area-specific sections moved to their local files, adapted to their new location with every requirement kept
  (ADR-104 §3 lists each edit). Pointers were repointed in TEMPLATE.md, CONTRIBUTING.md, AGENTS.md and the
  update-handoff skill. No test validates the relocation pointers or the preserved section content.
- **Model routing.**
  - `.claude/agents/Explore.md` overrides the built-in agent with `model: haiku`, read-only tools and
    `omitClaudeMd: true`.
  - `migration-validator` moves to `model: sonnet`.
  - `process-reviewer` is unchanged.

## Blockers and decisions

- **Blocker**: merging needs the maintainer's explicit authorization. Nothing in this file grants it.
- **Decision (maintainer)**: model routing lives in repo `.claude/agents/` frontmatter rather than user scope, so both
  machines and every clone get it. The accepted trade-off is that Codex and Kimi ignore `.claude/agents` and `model:`.
- **Decision (maintainer, 2026-11-11)**: an ADR is wanted after all. #335 shipped without one, so ADR-104 records both
  PRs.
- **Decision**: `process-reviewer` keeps the session model, because its remaining work is judgment.
- **Decision (maintainer, 2026-11-11, after the Codex review)**: moved text stays adapted to its new location rather
  than restored word-for-word. Restoring would bring back a wrong file reference. Nothing is deleted.
- **Decision (maintainer, 2026-11-11)**: the drift-gate claim is narrowed to what the gate actually checks, rather than
  adding a relocation gate in this PR (see follow-ups).
- **Decision**: `Explore` keeps `Bash` for `git log` and `git show`. Its read-only rule rests on its prompt and the
  session's inherited permissions, and ADR-104 §4 now says so.

## Carried follow-ups (out of scope here)

- **New, found 2026-11-11: the landing docs test always dirties the tree on a Turbo cache miss.**
  - `apps/landing/tests/regression/docs-generation.test.ts:21-22` runs `npm run generate-docs` into the real, tracked
    `apps/landing/src/data/docs/`.
  - Every run where it misses the cache rewrites `architecture.json` and `build.json` (timestamps, commit sha), and on
    Windows `concepts/adr-010-*.json` (escaped `\r\n`).
  - Since this branch, `pre-commit-check.sh` fails on that churn, as designed. Observed on `ae02a434`: the first run
    exited 1 listing exactly those three files. After `git restore`, the re-run exited 0 because the landing test hit
    the cache.
  - Fix forward: have the test generate into a temp directory, which needs an output-dir option in
    `scripts/generate-docs.ts`. Don't weaken the dirty-tree check.

- **Relocation pointer gate.** No test checks that each root `claude.md` pointer of the form `[file](file) → *Heading*`
  names a heading that exists. All four were checked by hand on 2026-11-11.
- `apps/claude.md:53`, the `generate-docs.ts` line in `scripts/claude.md`, and the
  `landing-docs-are-generated-never-authored` gotcha all say the landing **prebuild** regenerates the docs.
  - Memory records that it never runs under `ignore-scripts` (shown with a scratch package on 2026-11-09).
  - **UNVERIFIED** in this branch; out of scope here.
- **migration-validator schema list is stale** (verified 2026-11-11 against `infrastructure/claude.md`).
  - `.claude/agents/migration-validator.md:12-20` names `community` (the schema is `communities`).
  - It says `feed` is "owned by feed-service", which doesn't exist (ADR-071).
  - It omits `governance`, `feedback`, `provider`, `events`, `inventory` and the reserved `federation`.
  - The example at `:22` repeats `community.communities`.
- **BUG-101** (dead Edit/Write hook handlers) is open at `docs/BUGS.md:2743`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- **Sprint 140 PR B** is unplanned and decision-gated. It needs a design for required-CI integration execution and a
  per-suite ledger of what to repair, rewrite or retire. Retiring a suite needs separate approval and replacement
  coverage.
- deepmerge alert #178: re-check at the next Expo SDK move or by **2026-12-01**. #329 (Expo SDK drift) is still open.

## Verification references

- PR #335 merge `edc867e9`: master CI/CD run [43123187527](https://github.com/ravichavali/karmyq/actions/runs/43123187527)
  concluded success, 14/14 jobs including Deploy to Demo. Observed with `gh run view` on 2026-11-11, when
  `https://karmyq.com/` also returned 200.
- Security state observed 2026-11-11: 0 open Dependabot alerts and 0 open code-scanning alerts on master.
- This branch's tests: see the PR's `## Validation` ledger. It names the commit each command ran on.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
