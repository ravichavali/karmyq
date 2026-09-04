# Sprint 127: Ecosystem Knowledge Registry — Design Spec

**Status:** Draft for review
**Author:** Claude (Opus 5)
**Reviewer:** Codex (cross-agent review — the agent that did not author it)
**Date:** 2026-09-04
**Proposed ADR:** ADR-097 (next available; highest in `docs/adr/` is ADR-096)

---

## Overview

### The problem

Karmyq's process knowledge does not propagate. It accumulates in one maintainer's private agent
memory — 81 files under `~/.claude/projects/<slug>/memory/`, outside the repo, machine-local by
construction — and reaches nobody else. A second checkout on a second machine gets none of it. An
external contributor who forks a public AGPL repo can never get any of it.

This is not a syncing problem. It is a **missing mechanism**: code evolves through commits, review,
and tests that fail when it rots. Habits, gotchas, and hard-won operational knowledge have no
equivalent, so they are learned repeatedly, by each person, at full cost each time.

### The evidence

One working session (2026-09-03/04) produced seven durable learnings. Two were captured; five would
have evaporated:

| Learning | Captured? |
|---|---|
| ADR-059 gate fails open on an empty exemption registry; its own remediation advice erodes it | Yes — BUG-038 |
| npm's status page is not a valid signal for advisory-endpoint health | Yes — BUG-038 |
| ADR-060 already implements fail-closed-on-API-error — a pattern ADR-059 should copy | No |
| Git hooks install to `.git/hooks` on a fresh clone; `.husky` only where husky previously ran | No |
| `diskutil info /` exposes no `Case-Sensitive` field on current macOS | No |
| `README.md` and `CONTRIBUTING.md` both say `npm install` where `npm ci` is required | No |
| Dependabot regenerates the Expo-SDK-breaking group PR weekly until explicitly ignored | No |

The repo has exactly three intake shapes for knowledge — an **ADR** (decision), a **bug** (defect),
an **idea** (future work). Five of the seven above are none of those. They are *gotchas*, and there
is nowhere to put a gotcha but private memory.

### The thesis

Give gotchas a home, a review path, and a test that fails when they go stale. Knowledge then evolves
the way code does, and `git clone` becomes the only distribution mechanism required.

---

## Verified Starting State

Every claim below was read out of the repository on 2026-09-04.

**The desired lifecycle already occurred twice, unplanned.**
`tests/regression/doc-context-drift-gate.test.ts` contains assertions that began as private
memories:

- line 89 — `frontend jest.setup mocks next/router (prevents the 8-suite useRouter regression)`
  corresponds to memory `feedback_userouter_global_test_mock`
- line 64 — `every landing concepts/guides doc has a nav.json entry (the "nav.json silently reverts"
  gotcha)` corresponds to memory `feedback_nav_json_revert`

Both travelled personal gotcha → repo-enforced invariant. No route was designed; it happened because
it was obviously right. **This spec turns that accident into a route.**

**The gate's own header already states the thesis** (`doc-context-drift-gate.test.ts:5-11`):

> the agent-facing docs drift silently between sprints ... Each was hand-fixed; nothing *detected*
> the drift, so it recurred. This gate turns the manual drift-hunt into a blocking CI check.

**Expiry-and-renewal discipline is already proven** in `security/audit-exemptions.json`, whose
entries carry `package, advisory, severity, rationale, decision, owner, created, expires`, and whose
gate asserts each exemption still matches a live advisory. The maintainer has renewed these at least
once (ADR-059 "Renewal cadence (Sprint 125)"), so the ritual is demonstrably performed.

**Flat append-only knowledge files do not scale here.** `docs/BUGS.md` is 724 lines and
`docs/IDEAS.md` is 490. `docs/` additionally holds one-off dumps nobody maintains
(`ARCHITECTURE_RESET_ANALYSIS.md`, `ARCHITECTURE_REVIEW.md`, `process-review-2026-06-22.md`). By
contrast `docs/adr/` holds 96 entries as one-file-per-entry without strain.

**The repo is public**, licensed AGPL-3.0, with two collaborators (`ravichavali`,
`kompellachavali`). `master` branch protection requires 6 status checks and 1 approving review, and
blocks force-pushes and deletions — but `enforce_admins` is **false**, so admins bypass it.

**Onboarding docs already disagree**, which is the inconsistency that prompted this work:

- `README.md:24` — `npm install`, and no `hooks:install` step at all
- `CONTRIBUTING.md:16-17` — `npm install`, followed by `npm run hooks:install`
- `CLAUDE.md` Discipline 3 — `npm ci` semantics; `hooks:install` mandatory because `.npmrc` sets
  `ignore-scripts=true`

A contributor following `README.md` therefore ends up with **silently inert git hooks**.

**Tooling — NOT available as assumed.** An earlier draft of this spec claimed `js-yaml` "resolves
at `node_modules/js-yaml` and is usable from the tests workspace", citing `require.resolve`. That
proves hoisting, not declaration, and is exactly the trap the workspace rule exists to prevent.
Verified 2026-09-04:

- `tests/package.json` does **not** declare `js-yaml` (it does declare `semver`, `ts-jest`,
  `typescript` and others — so the workspace does otherwise follow the rule).
- The **root** `package.json` does not declare it either, in `dependencies` or `devDependencies`.
  It appears only in `overrides` as `"js-yaml": "4.3.1"` — a **security pin**.
- It reaches the tree purely transitively, via `ts-jest → @jest/transform → babel-plugin-istanbul
  → @istanbuljs/load-nyc-config → js-yaml` and via `expo → @expo/cli → @expo/xcpretty → js-yaml`.

Depending on it as-is would mean depending on a package present only because two unrelated
toolchains happen to pull it, at a version chosen to satisfy an advisory. A ts-jest transform-chain
change would remove it silently.

**This has a scheduling consequence.** Resolving it edits `package.json` and `package-lock.json`,
which is a **serialized cross-lane surface**. The knowledge-registry lane is therefore *not*
dependency-independent, and cannot run concurrently with another lane holding the dependency slot
(including an open Dependabot PR). Lane allocation must account for this.

**Open decision — see Open Questions #5.** Either declare `js-yaml` directly in the owning
workspace (surgical edit plus in-place lockfile splice, proven with strict `npm ci`), or avoid the
dependency entirely by using a JSON sidecar rather than YAML frontmatter. Given this repo's
dependency posture, the zero-dependency option deserves serious weight.

**Fail-closed-on-error precedent:**
`tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts:361-374` —
`ADR-060 gate — refuses to fail open on API errors`, asserting exit 1 when an upstream query errors
"rather than treating it as 'no analysis'".

---

## New Concepts

**Gotcha** — a durable, repo-scoped operational fact that is neither a decision (ADR), a defect
(bug), nor a proposal (idea). "Hooks land in `.git/hooks` on a fresh clone." "npm's status page does
not reflect advisory-endpoint health."

**Executable entry** — a gotcha carrying a declarative machine check that the validator re-runs on
every push. When the claim stops being true, CI fails.

**Expiring entry** — a gotcha whose claim cannot be machine-checked, carrying a review date instead.
Unrenewed entries fail the gate and are deleted.

**Promotion** — moving knowledge up a tier: private memory → registry entry → mechanically enforced
invariant.

---

## Architecture

### Storage

One file per entry, slug-named, no sequence numbers:

```
docs/gotchas/npm-status-page-is-not-a-signal.md
docs/gotchas/hooks-path-differs-by-machine.md
```

*One file per entry* because `BUGS.md` demonstrates the failure mode of append-only files and
`docs/adr/` demonstrates the success of per-entry files at scale.

*Slug-named rather than numbered* deliberately. ADR numbers are a serialized cross-lane surface
requiring up-front reservation between parallel checkouts. Gotchas will be far more numerous;
reproducing that coordination ritual at higher volume would guarantee collisions. Slugs require no
coordination, and a duplicate slug is impossible because it is a filename.

### Entry format

Markdown with YAML frontmatter — a structured header the validator parses, a prose body humans read.

````markdown
---
title: npm's status page is not a signal for advisory-endpoint health
owner: ravichavali
created: 2026-09-04
expires: 2027-03-04
see_also: [adr-059-must-fail-closed-on-no-answer]
---

During a 2026-09-03 outage, POST to both `/-/npm/v1/security/audits/quick` and
`/-/npm/v1/security/advisories/bulk` hung or returned 503, in two independent networks
(a dev machine and GitHub-hosted runners), while `GET /-/ping` returned 200 and
<https://status.npmjs.org/> reported "All Systems Operational" with 100% Security Audit
uptime over 90 days.

Diagnose advisory-endpoint health with a direct probe. Never from the status page.
````

### Frontmatter schema

| Field | Required | Notes |
|---|---|---|
| `title` | yes | One line, states the fact |
| `owner` | yes | GitHub handle |
| `created` | yes | ISO date |
| `verify` | **exactly one of** | Declarative check block (below) |
| `expires` | **`verify` or `expires`** | ISO date, bounded span |
| `renewed` | no | List of `{date, evidence}` pairs; drives the promotion rule |
| `scope` | yes | Repo paths this entry applies to — drives discovery (below) |
| `see_also` | no | Slugs of related entries; **the validator asserts each target exists** |

**Exactly one of `verify` or `expires` is mandatory.** This single rule is what makes the collection
self-pruning rather than accumulating.

### Verification is declarative, never shell

The validator implements a closed set of typed checks. It does **not** execute strings from entry
files.

```yaml
verify:
  file_matches:
    path: scripts/install-hooks.sh
    pattern: 'hooks_dir="\.git/hooks"'
```

Supported types: `path_exists`, `file_matches`, `file_not_matches`, `json_equals`.

Two reasons this is non-negotiable:

1. **Supply chain.** This is a public repo that accepts fork PRs. A free-form command string executed
   by CI is arbitrary code execution from an untrusted contributor — precisely the class of hole
   ADR-061 closed with `ignore-scripts=true`.
2. **Cross-platform.** Development now runs on Windows (Git Bash) and macOS. A shell snippet that
   works on one silently fails on the other.

### Discovery — how anyone finds the relevant entries before working

A Documentation Map link is not discovery; nobody reads a directory of 40 files on the off-chance.
Every entry declares the paths it applies to:

```yaml
scope:
  - scripts/install-hooks.sh
  - .husky/
```

Discovery then reuses the mechanism that already exists. `CLAUDE.md`'s *Context Follows Directory
Scope* tells you to read local context for the area you are about to touch; this adds one line to
that rule — **also read every gotcha whose `scope` matches the paths you are about to change.**
Same trigger, same moment, no new habit to form.

`scope` is mandatory and machine-checked: the validator asserts every declared path exists. An
entry scoped to a deleted path is itself evidence the entry is stale, so discovery metadata
doubles as a rot signal.

### The validator is hermetic

**No network access, ever.** On 2026-09-03 an upstream npm outage failed the `Security Audit` job and
one regression suite, blocking every PR in the repo for hours. A gate over *knowledge* must never be
able to do that. All checks are filesystem reads and regex matches.

---

## Lifecycle

### Intake — three triggers

1. **Mid-session capture** — a `/learned` skill alongside the existing `/bug` and `/capture`, same
   shape: append and return to work without derailing. Those two skills exist because capture was
   made cheap; 1,214 lines across `BUGS.md` and `IDEAS.md` are the evidence it works.
2. **Sprint-ship checkpoint** — the `/ship` cycle asks what the sprint taught that is not yet
   captured. This catches what mid-session missed; it would have caught all five orphans above.
3. **Recurrence** — the strongest signal. When a gate catches the same class of thing twice, it
   belongs in the registry.

Agents **propose** entries at these triggers; humans approve. An agent authorised to write entries
unprompted will flood the directory.

### The promotion ladder

| Tier | Location | Reviewed | Reaches | Mechanically enforced? |
|---|---|---|---|---|
| 0 | Private agent memory | No | One person, one machine | No |
| 1 | `docs/gotchas/` | PR review | Everyone who clones | Only if the entry has a `verify` block |
| 2 | **Executable invariant** — drift-gate assertion, dependabot ignore rule, a test | PR review | Everyone, whether they read it or not | **Yes** |
| — | Prose relocation — `CONTEXT.md`, an ADR | PR review | Everyone who reads that file | **No** |

An earlier draft listed `CONTEXT.md` and ADRs as Tier 2. That was wrong: moving prose to a more
central file changes *who is likely to read it*, not whether anything enforces it. Only the third
row is mechanical. The distinction matters because the promotion rule below must not pretend a
relocation is an enforcement.

Tier 2 is where the two accidental promotions already landed — both became test assertions.

### The evolution rule

Not all knowledge can become executable, and pretending otherwise destroys true facts. "npm's
status page does not reflect advisory-endpoint health" is permanently useful and permanently
untestable from inside this repo. A rule that eventually deletes it is a bad rule.

So the pressure to promote applies **only where a machine check is possible**:

- **An entry that could carry a `verify` block but doesn't** is a promotion candidate. After two
  renewals the validator fails, asking for the check to be written or the entry deleted.
- **An entry that is inherently unverifiable** renews indefinitely, but **each renewal must carry
  evidence** — `renewed` entries are `{date, evidence}` pairs, where evidence states how the fact
  was re-confirmed ("re-probed 2027-03-01: status page green, endpoint 503"). A renewal without
  evidence fails. This keeps unverifiable knowledge honest without forcing its deletion.

**Expiry is relative to the most recent review, not to creation.** `created` is preserved as
provenance; the deadline is computed from the latest `renewed.date` (or `created` if never
renewed).

**Knowledge-review cadence is separate from the security-exemption cap.** ADR-059's cap exists
because an unreviewed security exemption is an active risk. A stale gotcha is merely unhelpful.
Reusing that cap would impose security-grade churn on low-risk content, so the registry gets its
own, longer interval.

Failures here are **hard, not warnings.** Advisory checks are ignored here by demonstrated
precedent: `npm run feedback:check` is warn-only and is a documented false-green (it reads
`git diff --cached` and is therefore clean on any committed branch).

### Retirement is deletion

No `retired/` directory and no `status` field. When knowledge stops being true, delete the file; the
PR message records why. Git history is the archive. This keeps the active set honest and is
philosophically consistent with treating knowledge like code.

---

## The Personal / Shared Boundary

| Category | Example from the existing 81 memories | Destination |
|---|---|---|
| Shareable repo knowledge | CodeQL false positives on `apps/frontend/src/lib/api.ts`; the lockfile regeneration prohibition; the jest positional-pattern trap | `docs/gotchas/` |
| Personal working preference | Review-loop cost concerns; `/simplify` effort calibration | Private memory |
| **Never shareable** | Demo access — SSH, psql, simulation password | Neither |

The third row is not hypothetical: the memory index advertises an entry as *"Demo UX-audit access —
SSH, psql, sim password."* A naive bulk promotion would place credentials in a public repo, where
deletion does not remove them from git history.

**Two routes out of "personal":**

- **Agent self-corrections depersonalise into repo hazards.** A memory reading *"my recurring defect:
  gates assert weaker than they claim — count vs identity, floor vs exact, presence vs blocking"* is
  phrased as a personal failing but describes a **repo-wide hazard** that will bite every contributor
  and every agent. Rewritten impersonally it is among the most valuable entries in the registry.
- **Team norms graduate to rules.** A preference that proves to be a team norm becomes a rule in
  `CLAUDE.md`/`CONTRIBUTING.md`, not a gotcha — rules are prescriptive, gotchas descriptive.

**Test for shareability:** would this still be true and useful if a stranger cloned the repo
tomorrow? If it is about the person, it stays personal. If it is about the repo, it ships.

---

## Failure Handling

| Condition | Behaviour |
|---|---|
| Entry fails schema | Fail, naming the file and the missing/duplicate field |
| Both `verify` and `expires` present, or neither | Fail — the rule is exactly one |
| `expires` in the past | Fail — renew (append to `renewed`) or delete |
| `expires` span exceeds the cap | Fail — reuse the existing exemption-registry constant |
| `verify` claim no longer holds | Fail, showing expected vs found |
| `verify` target unreadable or absent | **Fail, never skip** — mirrors ADR-060's refusal to fail open |
| Credential-shaped content detected | Fail — but see *Screening happens before publication* |
| `scope` names a path that does not exist | Fail — the entry is stale or misfiled |
| `see_also` names a slug with no matching file | Fail — dangling reference |
| Two renewals on an entry that could be `verify`-checked | Fail — write the check or delete |
| A `renewed` item missing its `evidence` | Fail — unverifiable knowledge stays honest by evidence |

### Screening happens before publication, not after

Credential screening **must run in the pre-commit hook** (`scripts/git-hooks/pre-commit`), not only
in the regression gate. A CI rejection arrives after the content is already on a public remote,
where deletion does not remove it from history. The regression gate keeps the check as
defence-in-depth — necessary because git hooks in this repo have a documented history of being
silently inert — but the pre-commit screen is the one that actually prevents publication.

This makes the screen the one part of the design that is deliberately **not** hermetic-only in
placement: it runs at the earliest point where the content still exists solely on the author's
machine.

Failure output names both remedies, because whoever hits it is usually not the author:

```
✗ docs/gotchas/hooks-path-differs-by-machine.md
  file_matches: scripts/install-hooks.sh no longer contains 'hooks_dir=".git/hooks"'
  → The claim is stale. Update the entry, or delete it if it no longer applies.
```

---

## Testing Strategy

New suite: `tests/regression/sprint-127-gotcha-registry-gate.test.ts` (regression tier — blocks both
the pre-push hook and the required `Test Backend Services` check).

**Positive:** every shipped entry parses, satisfies the schema, and its `verify` or `expires`
currently holds.

**Negative — one fixture per assertion, not one representative case.** A recurring defect in this
repo is gates that assert weaker than they claim; a single injection is not proof. Required failing
fixtures:

1. Missing required field
2. Both `verify` and `expires`
3. Neither `verify` nor `expires`
4. `expires` in the past
5. `expires` span one day beyond the cap
6. `verify.file_matches` whose pattern no longer matches
7. `verify.path_exists` pointing at a deleted path
8. `verify` target unreadable — asserts **failure**, not skip
9. Credential-shaped body content
10. Two renewals on an entry that **could** carry a `verify` block — asserts the promote-or-delete
    failure fires
11. Two renewals on an inherently unverifiable entry, each carrying evidence — asserts it **passes**,
    proving the rule does not delete true-but-untestable knowledge
12. A renewal with **no evidence** — asserts failure
13. `scope` naming a deleted path
14. `see_also` naming a non-existent slug
15. All three onboarding docs agreeing on `npm install` — asserts the policy check fires despite
    perfect consistency

**Hermeticity:** an explicit assertion that the validator performs no network I/O.

---

## Rollout

**Phase 1 — mechanism and proof.** Schema, validator with all assertions and the fifteen negative
fixtures, the `/learned` skill, and seeding with the five orphaned learnings from 2026-09-03/04.
Those five are ideal seeds: fresh, independently verified, and collectively exercising every check
type.

**Phase 2 — opportunistic promotion.** No migration project. A memory earns an entry when it is used
and proves durable, via the three intake triggers. The collection grows from evidence.

**Phase 3 — audit of the 81 existing memories**, later, informed by which entries proved useful in
practice. A much better third step than a first one.

**One Tier-2 fix belongs in Phase 1:** a drift-gate assertion covering the onboarding docs. It must
assert **the policy and the consistency, not consistency alone** — three documents that all
regressed to `npm install` would be perfectly consistent and uniformly wrong. Concretely, for each
of `README.md`, `CONTRIBUTING.md` and `CLAUDE.md`:

1. the install command is `npm ci`, and `npm install` does **not** appear as an install
   instruction;
2. `npm run hooks:install` is present;
3. and the three agree with each other.

Assertions 1 and 2 are the policy; 3 catches divergence the policy check would miss (e.g. differing
flags). This fixes the inconsistency that prompted the work — a contributor following `README.md`
today ends up with silently inert hooks.

**Required negative fixture: all three documents agreeing on `npm install`.** The gate must fail
that case. Without it the check asserts weaker than it claims, which is a documented recurring
defect in this repo.

---

## Doc Updates

- **ADR-097** — new knowledge surface plus a new blocking gate is architectural; index it in
  `docs/adr/README.md`
- **`CLAUDE.md`** — add `docs/gotchas/` to the Documentation Map and the docs feedback loop
- **`CONTRIBUTING.md`** — describe the registry for external contributors; fix `npm install` →
  `npm ci`
- **`README.md`** — fix `npm install` → `npm ci`; add the missing `hooks:install` step
- **`apps/landing/`** — a concept doc for ADR-097, per the landing docs authoring rules

---

## Critical Implementation Notes

1. **Never execute strings from entry files.** Declarative check types only. This is the single most
   important security property of the design.
2. **The validator must not touch the network**, including transitively.
3. **`docs/gotchas/` is not generated** — it is hand-authored and PR-reviewed. Do not add it to any
   generation pipeline.
4. **The onboarding-doc assertion states the policy explicitly AND compares the files.** An earlier
   draft forbade the explicit string, reasoning it was a drifting shadow copy. That conflated two
   different things: a *shadow map* duplicates an external arbiter (a registry, an SDK's pins) and
   drifts because the arbiter moves independently. `npm ci` is not an external arbiter's value — it
   **is the policy**, decided here, changed only by deliberately editing this rule. Asserting it is
   correct; asserting only mutual agreement is not, because uniform regression passes.
5. Landing docs regenerate during `npm test`; revert `build.json`/`architecture.json` timestamp and
   HEAD-sha churn before committing.
6. New tests begin in the changed workspace's `tests/tdd/` and are promoted to `regression/` when
   green.

---

## Open Questions

**Resolved in review (Codex, 2026-09-04):**

- ~~Expiry cap value~~ — **Resolved.** The registry gets its own, longer interval. ADR-059's cap is
  calibrated to security risk; a stale gotcha is unhelpful, not dangerous.
- ~~Two-renewal promotion rule~~ — **Resolved.** It applies only where a `verify` block is
  *possible*. Inherently unverifiable entries renew indefinitely with per-renewal evidence.
- ~~Landing docs site~~ — **Resolved: contributor-facing only**, at least initially. The registry is
  working material for people changing the code, not published documentation.

**Still open:**

1. **Credential detection implementation.** A local regex is hermetic but weak; real secret scanning
   generally wants the network, which the validator forbids. The pre-commit placement narrows the
   question — it must be fast and offline there — but the strength/hermeticity trade-off is
   unresolved. Leaning toward a local high-recall pattern set at pre-commit, accepting false
   positives as the safer failure direction.
2. **YAML or JSON?** Resolving `js-yaml` means either declaring it in the owning workspace
   (surgical `package.json` + in-place lockfile splice, proven with strict `npm ci`, and taking the
   dependency lane for that sprint) or dropping YAML for a JSON sidecar and adding no dependency at
   all. This is now the largest unresolved decision in the spec, because it determines whether the
   lane is dependency-independent.
3. **Is "gotcha" a stable category?** The boundary between a gotcha and a `CONTEXT.md` line is
   fuzzier than this spec admits, and may not survive contact with real entries.
