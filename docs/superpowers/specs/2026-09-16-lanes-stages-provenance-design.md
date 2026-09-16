# Lanes, Stages and Provenance — Design Spec

**Date**: 2026-09-16

**Status**: Approved by the maintainer, 2026-09-16 (ADR-098)

**Branch**: `lane/lanes-provenance`, cut from `origin/master` `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd` (v11.56.0)

**Sub-project**: 1 of 4 in the contributor-model track (see *Scope*)

**Design conversation**: maintainer with Claude, 2026-09-16 (brainstorming; every decision below
was confirmed section by section)

## Overview

Karmyq is built by contributors who each use whichever coding agent they have tokens for: today
Claude, Codex and Kimi. Work passes between them by **stage**. The goal is clone-and-go: a new
contributor clones the repo, follows the README, picks any supported agent and works under the same
quality bar, restrictions and rules as the maintainer. The project is also an exercise in how a
community develops software and learns from each other.

The current rules assume one maintainer serializing two checkouts on two machines. They break
down under this model:

- **The maintainer is the only serializer** (`claude.md:388-427`). Contributors must be able to pick
  up work without waiting for the maintainer.
- **Identity is in the branch name** (`agent/<name>/<slug>`, `AGENTS.md:78`). On 2026-09-16,
  `agent/codex/sprint-131-test-readiness` was planned by Codex, reviewed by Kimi and executed by
  Claude, so the name was wrong within a day.
- **Attribution is unreliable.** Commits the Sprint 131 handoff credits to Codex (`b47c0fe6`,
  `e2c03a56`; `.claude/handoff/CURRENT_HANDOFF.md:18,127` on master) carry `Co-Authored-By: Claude Opus 5`. History cannot say which agent did what.
- **State lives in branch-local handoff files** that other lanes cannot see until merge
  (`.claude/handoff/README.md:31-36`). Nobody can reliably answer "where is every lane, and where
  did it come from".

### Core principle

**Git and GitHub hold the truth; files and memory only narrate it.** A lane's stage, holder and
next step are read from GitHub and from boundary commits. Nothing authoritative lives in a
branch-local file or an agent's private memory.

## Decisions (maintainer-confirmed, 2026-09-16)

| # | Decision |
|---|---|
| D1 | Agents are interchangeable. Work moves between contributor/agent pairs by stage. |
| D2 | A stage is pinned to one branch, one machine and one agent while it lasts. Reviews run read-only from anywhere. The machine is recorded in each boundary commit's `Machine:` trailer. |
| D3 | The branch continues across stages. Each handover is a pushed **boundary commit** with trailers (not a new branch per stage, not handoff-only marking). |
| D4 | Stages are `spec → plan → execute → verify`. For now all four may run on one machine. |
| D5 | Enforcement lives in CI on the PR, not in local hooks or agent-specific skills. Every commit declares its agent explicitly. |
| D6 | The design is split into four sub-projects; this is sub-project 1 and goes first. |
| D7 | Available work is visible per stage, and contributors pick it up themselves. |
| D8 | **First claim wins.** No role gate (roles aren't firm) and no maintainer approval to start a stage. |
| D9 | A contributor who runs out of tokens **releases with progress**: a partial boundary commit with a `Next:` pointer returns the same stage to available. Unrenewed claims **expire**. |
| D10 | Approach **A**: GitHub Issues + labels + a Node CLI. (Rejected: Projects v2, with GraphQL-only config nobody reviews in a PR; a git ledger branch, invisible in the issue UI and adding a second branch model.) |
| D11 | Future contributors get **write access** and may merge. |
| D12 | **The merger must not be the executor**, judged per human. `allowSelfMerge` keeps self-merge available while there is a single contributor. |
| D13 | ADR numbers are derived by the `work` tool when needed (from `origin/master` plus open lane PRs) instead of allocated by the maintainer. The number for *this* ADR is the last one the maintainer allocates. |

## Model and vocabulary

**Lane:** one unit of work, such as a sprint PR, a fix or a dependency upgrade. It has one GitHub
issue, one branch `lane/<slug>` and at most one PR.

**Stages**, in order: `spec → plan → execute → verify`. A lane may start at a later stage (a small
fix can start at `execute`). At any moment a lane is in exactly one stage, which is either
**available** or **claimed** by exactly one contributor.

| Stage | Produces | Notes |
|---|---|---|
| `spec` | design spec in `docs/superpowers/specs/` | |
| `plan` | focused plan and lane handoff | |
| `execute` | code, tests, docs, version bump; opens the PR | takes the dependency lane when the lane is labelled `touches:dependencies` |
| `verify` | deploy watch, live check, handoff reconcile | recorded as issue comments (the branch is merged); its handoff evidence lands on the next lane branch touched, never as a docs-only master push |

**Checkpoints** are not claimable and never own the branch:

- **plan review** and **PR review:** read-only, anyone, any machine, any agent;
- **merge:** anyone with write access who is not the executor (see `allowSelfMerge`), and only when the merge slot is free.

**Identity** is always `human/agent`, e.g. `ravichavali/codex`. The human is the GitHub login. The
agent is declared explicitly and never inferred from `Co-Authored-By`.

**Contended resources** (one holder each, visible on GitHub):

- **dependency lane:** taken by claiming `execute` on a `touches:dependencies` lane, released when that stage ends;
- **merge slot:** busy from a master merge until its deploy's health verification finishes;
- **ADR numbers:** next free number derived when needed; collisions are caught by the existing drift gate.

**Config:** `lanes.config.json` at the repository root, changed only by PR:

```json
{
  "agents": ["claude", "codex", "kimi"],
  "expiryDays": { "spec": 7, "plan": 7, "execute": 3, "verify": 7 },
  "allowSelfMerge": true,
  "exemptBranches": ["dependabot/**", "agent/codex/sprint-131-test-readiness"]
}
```

## GitHub representation

Per lane, one **issue**:

- labels: `lane`; exactly one `stage:<spec|plan|execute|verify>`; exactly one
  `status:<available|claimed>`; optionally `touches:dependencies` and `holds:dependency-lane`. Audit findings are separate issues labelled `lane-audit`;
- **assignee** = the claim (none means available);
- body links the branch, spec, plan and PR;
- every command posts a uniform comment, so the issue timeline is a history readable from any machine.

The labels do not exist yet (`gh label list`, 2026-09-16). The CLI creates any missing ones on first use.

## Commands

Implemented as `scripts/work.js` and run as `npm run work -- <command>`. Plain Node 24; auth via
`GH_TOKEN`/`GITHUB_TOKEN`, following `scripts/check-image-size-upstream.js:158`.

| Command | Effect |
|---|---|
| `work` | Lists open lanes: stage, available/claimed, holder, days since the branch's last push. Shows who holds the dependency lane and whether the merge slot is busy, and the next free ADR number. Available items are listed first. |
| `work new <slug> --stage <s> [--touches-dependencies]` | Creates the issue and pushes `lane/<slug>` from `origin/master`. |
| `work claim <slug> --agent <a>` | Assigns the caller, sets `status:claimed` and takes the dependency lane if applicable, then verifies (see *Concurrency*). Checks out the branch and records the agent in local git config (`karmyq.agent`) for commit trailers. Refuses to run until `karmyq.machine` is set. |
| `work release <slug> --next "<pointer>"` | Writes and pushes a partial boundary commit (an issue comment in `verify`), unassigns, and returns the same stage to `status:available`. Releases a held dependency lane. |
| `work advance <slug>` | Relabels to the next stage, unassigns and releases the dependency lane. While the PR is unmerged (leaving `spec` or `plan`) it first writes and pushes a boundary commit. Leaving `execute` requires the PR **merged** and the merge slot **free**, and is recorded as an issue comment because the branch is already merged. The same applies in `verify`, and leaving `verify` closes the issue. |

State transitions:

```
            claim              advance
available ────────► claimed ────────────► (next stage) available
    ▲                  │
    ├──── release ─────┘   same stage, with Next: pointer
    └──── expiry ──────┘   same stage, scheduled workflow
```

Between `execute` and `verify`: PR review → merge (non-executor unless `allowSelfMerge`) → merge
slot clears on deploy health → `work advance` out of `execute` → `verify` becomes available.
`work advance` refuses to leave `execute` until the PR is **merged** and the merge slot is
**free**, so `verify` can never be claimed before the deploy it verifies has finished.

**Where each stage's record lives.** While the PR is unmerged, the lane branch is live, so
handovers (`spec -> plan`, `plan -> execute`) and partial releases during `spec`, `plan` and
`execute` are boundary commits on it. Once the PR is squash-merged the branch is done: the
`execute -> verify` advance and every `verify` claim, release (`Next:` pointer) and advance are
recorded only as **issue comments**, in the same trailer format. No commit is ever pushed to a
merged lane branch. Its
evidence (the lane handoff update) lands as an ordinary commit on whichever lane branch is next
touched, not as a boundary commit. Leaving `verify` closes the issue.

## Boundary commits and trailers

**Every commit** on a `lane/*` branch carries `Agent: <name>`, where the name is listed in
`lanes.config.json`. A `prepare-commit-msg` hook, added to `scripts/git-hooks/` beside `pre-commit` and `pre-push`, fills it from `git config karmyq.agent` where hooks
are installed; CI enforces it regardless.

**Boundary commit** (may be empty), written only by `work advance` and `work release` while the
PR is unmerged. `execute -> verify` and all of `verify` use issue comments; see *Commands*:

```
lane(<slug>): <from> -> <to>

Lane: <slug>
Stage: <from> -> <to>             (partial release: Stage: <stage> (partial))
Handed-off-by: <human>/<agent>
Machine: <free text, e.g. windows | mac>
Next: <pointer>                   (required on partial; optional otherwise)
Dependency-lane: taken | released | none
Agent: <agent>
```

`Machine:` records where the stage ran, which is what "where did this come from" means across
machines. It is required but free text: the gate checks it is present, not its value. `work` fills
it from `git config karmyq.machine`, set once per checkout.

## Provenance gate

`scripts/lane-provenance.js`, run by `.github/workflows/lanes-pr.yml` on every PR. It reads the
commits the PR adds over `origin/master` through the GitHub compare API, excluding commits already
on master. It uses the API's author **login** as the human. It fails when:

1. the PR's branch is neither `lane/<slug>` nor matched by `exemptBranches` in config;
2. a commit lacks `Agent:`, or names an agent not in config;
3. a commit's author has **no linked GitHub login** (the API returns `null`); contributors have write access, so the fix is to link the commit email, and the gate fails closed rather than guessing;
4. two consecutive commits differ in `human/agent` with no boundary commit between them, or a boundary's `Handed-off-by` does not match that boundary commit's own `human/agent` (the outgoing contributor writes the boundary, so an identity change is only legal straight after one);
5. a boundary lacks `Machine:`, its `Lane:` does not match the branch slug, or its `Stage:` skips or reverses order (a partial release repeats the current stage);
6. `Dependency-lane: taken` appears twice without a `released` between them.

**Exemptions are an explicit list, never "anything not named `lane/*`"** (otherwise renaming a
branch would skip the gate). `lanes.config.json` gains `exemptBranches`, glob patterns changed only
by PR. It starts as `["dependabot/**"]` plus the grandfathered branches named in *Rollout*.
Emergency fixes use a `lane/` branch that starts at `execute`. An exempt PR passes with an explicit
**exempt: <pattern>** line in the check output, never silently.

## Merge rule

GitHub cannot restrict who clicks merge to "not the executor", so enforcement has two parts:

- **Preventive:** check `merge-eligibility` (in `lanes-pr.yml`, triggered by `pull_request` and `pull_request_review`) passes only once a PR has an approving review
  from a human who is not an **executor**. It re-runs on review events. It passes trivially when `allowSelfMerge` is `true`.
- **Detective:** `.github/workflows/lanes-audit.yml`, on every master push, compares the merger with the executor. If the rule
  was broken while `allowSelfMerge` is `false`, it opens an issue labelled `lane-audit`.

**Executors** are the GitHub logins that authored the PR's non-merge commits after its last boundary
into `execute` (`plan -> execute`, or a later `execute (partial)`), or all of the PR's non-merge
commits if the lane started at `execute`. With partial releases several people can have executed,
and none of them may be the approver or merger.

Branch protection today already requires one approving review plus six checks (`pr-contract`,
`Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning
Gate (ADR-060)`, `Security Audit`; read 2026-09-16). With a single contributor, self-merge therefore
still needs `--admin`. This design changes **no repository settings**. Relaxing or extending
protection is an explicit maintainer action.

## Concurrency

**Claims:** `work claim` assigns, then re-reads the issue. If it has more than one assignee, the
earliest assignment event in the issue timeline keeps the claim. Later claimers unassign
themselves and exit non-zero with `claimed by <human>/<agent> first`. This is not atomic, but races
resolve the same way every time and remain visible.

**Dependency lane:** the `holds:dependency-lane` label on at most one open lane issue, taken with
the same assign-then-verify pattern (add the label, list holders, and back off if another lane
holds it earlier). `lanes-audit.yml` also runs daily and opens a `lane-audit` issue if two open lanes hold it.

**Merge slot:** derived, not stored. It is busy while the latest `ci.yml` run on master is queued
or in progress. `work` reports it. It is a rule, not a check, because a check would be stale by
merge time. Rationale: deploys already share `concurrency: group: deploy-demo` with
`cancel-in-progress: false` (`.github/workflows/ci.yml:408-411`), but GitHub keeps only one
*pending* run per group. A third merge during a running deploy cancels the waiting run, so that
merge never gets its own health verification.

**ADR numbers:** `work` derives the next free number from `origin/master` plus the ADR files added
by every open lane PR. Collisions remain caught by the drift gate's uniqueness assertion
(`tests/regression/doc-context-drift-gate.test.ts:88`). The PR that merges second renumbers.

**Expiry:** `.github/workflows/lanes-expiry.yml`, daily, with `issues: write` permission. For each
claimed lane, if its last activity is older than `expiryDays[stage]`, it
unassigns, sets `status:available`, releases a held dependency lane, and comments
`expired; last activity <date>; resume from the last Next:`. It never writes commits.

**Last activity** is the newest commit on `lane/<slug>` for `spec`, `plan` and `execute`. For
`verify`, whose branch is merged, it is the newest `work` comment on the issue (claim, release or
progress).

## Handoff files

- One narrative file per lane: `.claude/handoff/lane-<slug>.md`, from `TEMPLATE.md`. It holds
  evidence, decisions and gotchas only.
- The stage, holder, next pointer and dependency-lane state are **not** authoritative in it. The
  Ownership table points at `npm run work` and the branch's last boundary commit.
- The router table in `CURRENT_HANDOFF.md` is retired; `npm run work` replaces it.
- On `verify` completion the lane file is archived, as today.

## Rule and documentation changes

Made in lane `lanes-rules` (PR 3), with `claude.md` and `AGENTS.md` changed identically in substance.
The exception is `scripts/claude.md`: each lane documents the scripts it ships in its own PR (docs
feedback loop).

- **`claude.md` → Parallel Development** (`:352-446`): rewrite around "GitHub is the serializer":
  lanes, stages, claims, the dependency lane, the merge slot, ADR derivation. Remove "a human is the
  only thing that can serialize", "ownership… is never inferred" and maintainer ADR allocation.
  Keep one merge at a time, waiting for deploy health, and the no-docs-only-master-push rule.
- **`AGENTS.md` → Lanes & Merge Authority and Topology** (`:68-123`): the same model; the branch
  convention becomes `lane/<slug>`; "never self-merge" becomes the non-executor rule with `allowSelfMerge`.
- **`.claude/handoff/README.md`, `TEMPLATE.md`:** as in *Handoff files*.
- **New ADR-098, "Lanes, stages and provenance":** number allocated by the maintainer, 2026-09-16 (D13; verified unused on every remote branch and open PR that day).
  Supersedes the parallel-development serialization rules. Indexed in `docs/adr/README.md`.
- **`scripts/claude.md`:** `lane-provenance.js` and `lanes-pr.yml` (lane `lanes-provenance`); `work.js`, `lanes-audit.yml` and `lanes-expiry.yml` (lane `lanes-work-queue`).
- **`package.json`:** `work` script. No new dependencies.

## Testing

- **Rule logic is pure.** Provenance rules, transitions, claim resolution, expiry selection and ADR
  derivation take plain data (commit lists, issue/timeline JSON) and return verdicts. Unit tests
  cover every rule's pass and fail.
- **Real git fixtures:** tests build temporary repositories and branches, covering a clean
  handover, partial release, merge from master, missing trailer, undeclared agent change, skipped
  stage, wrong lane slug, missing `Machine:`, double dependency-lane take, unlinked author login, a non-exempt non-`lane/` branch, and an exempt branch. Each failure rule has
  at least one negative fixture proving it can go red.
- **GitHub adapter:** a thin module is the only code that performs HTTP. Tests run it against a
  local HTTP server that replays recorded GitHub API response shapes, including paging and 403/404.
- **Workflow wiring:** YAML-parse tests (using the declared `yaml` package, as
  `tests/regression/sprint-129-demo-health-workflow.test.ts:22-27` does) assert the triggers,
  permissions and invoked scripts of `lanes-pr.yml`, `lanes-audit.yml` and `lanes-expiry.yml`.
- **Honest limit:** tests cannot prove GitHub delivers events or honors permissions. The first real
  lanes after merge are that evidence (see *Rollout*).

## Rollout

1. **Three lanes, one PR each** (maintainer decision, 2026-09-16, amending the original single PR).
   They share this spec; each has its own focused plan and they merge one at a time. `lanes-provenance`
   (this branch) runs `spec` through `execute`; `lanes-work-queue` and `lanes-rules` start at `plan`
   on fresh branches from `origin/master` after the previous lane merges. New checks run on PRs but are **not required**
   in branch protection, so they report only.

   | Lane / PR | Contents |
   |---|---|
   | **`lanes-provenance`** | `lanes.config.json`, trailer parser, pure provenance rules, minimal GitHub compare adapter, `lane-provenance.js`, `lanes-pr.yml` (report-only), `prepare-commit-msg` hook, ADR-098 as **Proposed** |
   | **`lanes-work-queue`** | full GitHub adapter, `work` CLI (list/new/claim/release/advance), claim and dependency-lane verification, ADR-number derivation, `merge-eligibility`, `lanes-audit.yml`, `lanes-expiry.yml` |
   | **`lanes-rules`** | `claude.md`, `AGENTS.md`, handoff README/TEMPLATE; ADR-098 → **Accepted**; post-merge creation of the remaining Sprint 131 lanes |

   The rules change only in PR 3, once the tools they describe exist.
2. **Grandfathering:** work in flight when this merges continues under the old rules on its
   existing branch, listed by name in `exemptBranches`. Sprint 131 PR B on
   `agent/codex/sprint-131-test-readiness` is the known case. The gate reports such branches as exempt.
   Remove each entry once its PR merges.
3. **First real use:** after merge, `work new` creates lanes for the remaining Sprint 131 work (D1–D7
   at `plan`; C at `plan`, with its rollout approval still required by its own spec).
4. **Promotion to required:** after two lanes complete cleanly, the maintainer adds
   `lane-provenance` and `merge-eligibility` to branch protection. This is an explicit settings
   change, recorded in the lane handoff.
5. **Dogfooding:** this lane is not exempt. Every commit on `lane/lanes-provenance` carries
   `Agent:` from its first commit. Its stage handovers before `work` exists are hand-written boundary
   commits in the format above, so the PR that introduces the gate passes it.
6. **Merge order:** this PR merges only after Sprint 131 PR B has deployed and passed its health
   verification (one merge at a time).

## Scope

**In:** everything above.

**Out, handled by later sub-projects:**

| # | Sub-project |
|---|---|
| 2 | Agent-neutral rules: authority moves to AGENTS.md with CLAUDE.md and other agents' files as shims; Claude-only skills that define quality get `npm run` equivalents |
| 3 | Contributor onboarding: a README path from clone to first PR with any agent, proven by a fresh-clone dry run |
| 4 | Memory: promote (repo facts to `docs/gotchas/`, rules to AGENTS/CLAUDE, decisions to ADRs), prune (verification against the repo, expiry of unpromoted candidates) and merge (reconcile in the repo through PR review; corrections supersede, with a `supersedes` field) |

Also out: changing repository settings or branch protection; migrating closed history; fork-based
contributors (D11 assumes write access).

## Maintainer answers (2026-09-16)

1. **ADR number:** ADR-098.
2. **Label colours/descriptions:** GitHub's default palette.

## Critical Implementation Notes

1. GitHub is the serializer for claims, the dependency lane and expiry. Branch-local files never hold authoritative stage, holder or resource state.
2. Every commit on a `lane/*` branch declares `Agent:`. Never infer agent identity from `Co-Authored-By` or the git author name.
3. Identity for the merge rule is the **human** (GitHub login). Switching agents never satisfies "not the executor".
4. Boundary commits are written only by `work advance` / `work release` (by hand, in the same format, only on this lane before `work` exists) and pushed immediately. An unpushed handover does not exist.
5. `allowSelfMerge: true` is the single-contributor setting. Flipping it is a reviewed one-line PR.
6. Claims are assign-then-verify; the earliest timeline assignment wins. Report races; never hide them.
7. The merge slot is a rule reported by `work`, not a required check (the check would be stale). GitHub's deploy concurrency group cancels a middle pending run, so one merge at a time stays mandatory.
8. Expiry never writes commits and never deletes branches.
9. Every gate rule ships with a negative fixture proving it can fail. HTTP is isolated in one adapter tested against recorded response shapes.
10. No repository-settings changes. Required-check promotion is a later explicit maintainer action.
11. `claude.md` and `AGENTS.md` change together and agree in substance. Sub-project 2 later changes which one is the authority.
12. Grandfather in-flight branches; never retro-validate history made before this ships.
13. No commit is pushed to a merged lane branch. `execute -> verify` and all of `verify` are issue comments in trailer format, and expiry reads issue activity for `verify`.
14. Exemptions are an explicit `exemptBranches` list. A branch outside `lane/*` that is not listed fails the gate.
15. A commit author with no linked GitHub login fails the gate closed.
16. No new npm dependencies. Plain Node 24 and existing workspace-declared packages only.
17. One lane is one branch and at most one PR. Work that needs several PRs is several lanes sharing a spec; later lanes start at `plan`.
