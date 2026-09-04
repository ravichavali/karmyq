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

**RESOLVED — the format is JSON sidecars, so this dependency is not taken at all.** JSON parses
natively; no parser library is needed. That removes the `package.json`/`package-lock.json` edit
entirely, which means **the knowledge-registry lane does not contend for the dependency lane** and
can run concurrently with the security-exemption work. The finding is kept here because the
reasoning error it exposed — citing `require.resolve` as proof of availability, when it proves only
hoisting — is the durable lesson.

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

**A JSON sidecar plus a Markdown body** — two files per entry, sharing a slug:

```
docs/gotchas/npm-status-page-is-not-a-signal.json    ← metadata, machine-read
docs/gotchas/npm-status-page-is-not-a-signal.md      ← prose, human-read
```

Chosen over YAML frontmatter on review recommendation, and it resolves the dependency problem
rather than deferring it: JSON parses natively, so `js-yaml` is not required and **the
knowledge-registry lane becomes dependency-independent** — no `package.json` or
`package-lock.json` edit, so it does not contend for the dependency lane at all.

**Pairing is enforced.** Exactly one `.md` per `.json` and vice versa; an orphan of either kind
fails the gate. A sidecar with no prose is unreadable knowledge; prose with no sidecar is invisible
to both the validator and discovery.

`npm-status-page-is-not-a-signal.json`:

```json
{
  "title": "npm's status page is not a signal for advisory-endpoint health",
  "owner": "ravichavali",
  "created": "2026-09-04",
  "expires": "2027-03-04",
  "scope": ["scripts/audit-exemptions.js", "security/audit-exemptions.json"],
  "see_also": ["adr-059-must-fail-closed-on-no-answer"]
}
```

`npm-status-page-is-not-a-signal.md`:

```markdown
During a 2026-09-03 outage, POST to both `/-/npm/v1/security/audits/quick` and
`/-/npm/v1/security/advisories/bulk` hung or returned 503, in two independent networks
(a dev machine and GitHub-hosted runners), while `GET /-/ping` returned 200 and
<https://status.npmjs.org/> reported "All Systems Operational" with 100% Security Audit
uptime over 90 days.

Diagnose advisory-endpoint health with a direct probe. Never from the status page.
```

### Sidecar schema

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

```json
"scope": ["scripts/install-hooks.sh", "scripts/git-hooks/"]
```

**`scope` must name git-TRACKED paths.** An earlier draft used `.husky/` as an example — which is
gitignored and machine-local, so its mandatory existence check would fail on every fresh clone
while the gotcha itself remained perfectly true. A validator that fails on a correct entry trains
people to ignore it.

The check is therefore `git ls-files`, not `fs.existsSync`: a path counts only if git tracks it.
That is the same answer on every machine and in CI, which `existsSync` is not.

**Matching is by directory prefix.** A scope entry ending in `/` matches any path beneath it; an
entry without a trailing `/` matches that path exactly. So `scripts/git-hooks/` covers
`scripts/git-hooks/pre-push`.

**Validation and discovery take different inputs, deliberately:**

| | Input | Why |
|---|---|---|
| **Validating a scope anchor** | git-**tracked** paths (`git ls-files`) | The anchor must be real and identical on every machine and in CI |
| **Matching during discovery** | the paths you are **about to change**, including **new files not yet staged or tracked** | Otherwise directory-scoped knowledge misses exactly the case it is most needed for |

That second row matters more than it looks. If someone creates `scripts/git-hooks/pre-merge`, a
tracked-files-only match would surface **nothing** — the new file isn't tracked yet — even though a
gotcha scoped to `scripts/git-hooks/` is precisely what they should read before writing a new hook.
Directory-scoped knowledge exists for new-file creation; a matcher that only sees tracked files
fails at its primary job.

Discovery then reuses the mechanism that already exists. `CLAUDE.md`'s *Context Follows Directory
Scope* tells you to read local context for the area you are about to touch; this adds one line to
that rule — **also read every gotcha whose `scope` matches the paths you are about to change.**
Same trigger, same moment, no new habit to form.

`scope` is mandatory and machine-checked against the tracked file list. An entry scoped to a path
git no longer tracks is itself evidence the entry is stale, so discovery metadata doubles as a rot
signal.

**Discovery surfaces the entry itself — never a summary of it.** There is no index file
paraphrasing what each gotcha says, and this is a deliberate constraint rather than an omission.
A live example from this spec's own review: the private memory covering the landing-docs pipeline
is correct and detailed ("never hand-author these; add the slug to the generator's lists; then
regenerate"), but its one-line index entry compressed that to *"grep-verify after every edit"* —
which inverts the guidance into the workaround it exists to prevent. Acting on the index without
opening the entry produced a wrong instruction in an earlier draft of this document.

A summary layer over knowledge is a shadow copy, and it drifts exactly like any other shadow copy —
with the added hazard that it looks authoritative and is cheaper to read than the truth. So
`scope` matching returns file paths to open, not descriptions to trust.

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

**Promotion is a review decision, not a validator rule.** An earlier draft had the validator fail
after two renewals on "an entry that could carry a `verify` block but doesn't". That is not
mechanically decidable: an entry that could be checked and one that is inherently unverifiable have
**identical fields**, and no deterministic validator can infer the difference from prose. The rule
was unimplementable as written.

The split is therefore by what each mechanism can actually establish:

- **The validator enforces only what is decidable** — dates parse and are real, the entry is not
  past its review date, every renewal carries evidence, exactly one of `verify`/`expires` is
  present, the `.json`/`.md` pair is complete, `scope` paths are tracked, `see_also` targets exist.
- **The reviewer decides promotion.** Every renewal is a PR, and that PR is the checkpoint: the
  reviewer asks whether the fact has become machine-checkable since it was written, and either
  writes the `verify` block, deletes the entry, or renews it as prose. A human answers the question
  a validator cannot.

**Every renewal carries evidence.** `renewed` holds `{date, evidence}` pairs, where evidence states
how the fact was re-confirmed — "re-probed 2027-03-01: status page green, endpoint 503". A renewal
without evidence fails the gate. This is decidable, so the validator owns it, and it keeps
unverifiable knowledge honest without pretending the machine can judge verifiability.

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
| `expires` span exceeds the cap | Fail — using the **registry's own** cadence constant, deliberately longer than ADR-059's security-calibrated cap |
| `verify` claim no longer holds | Fail, showing expected vs found |
| `verify` target unreadable or absent | **Fail, never skip** — mirrors ADR-060's refusal to fail open |
| Credential-shaped content detected | Fail — but see *Screening happens before publication* |
| `scope` names a path git does not track | Fail — stale, misfiled, or pointing at a machine-local artifact |
| `see_also` names a slug with no matching file | Fail — dangling reference |
| A `.json` with no `.md`, or a `.md` with no `.json` | Fail — orphaned half of a pair |
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
10. Many evidenced renewals on an unverifiable entry — asserts it **passes**, proving the design
    does not delete true-but-untestable knowledge. (There is deliberately no fixture for
    "could have been verified": that is a reviewer's judgment, not a validator's.)
11. A renewal with **no evidence** — asserts failure
12. A renewal whose `date` is malformed — asserts failure
13. `scope` naming an untracked-but-present path (e.g. `.husky/`) — asserts **failure**, since a
    check that passes only on the author's machine is the defect this rule exists for
14. `see_also` naming a non-existent slug
15. All three onboarding docs agreeing on `npm install` — asserts the policy check fires despite
    perfect consistency
16. An orphaned `.json` with no `.md`, and an orphaned `.md` with no `.json`
17. **Clean-checkout validation AND discovery** — see below; whole-registry validation alone does
    not prove discovery works

**Hermeticity:** an explicit assertion that the validator performs no network I/O.

### Fixture 17 in detail

Whole-registry validation from a clean tree proves the *validator* survives a fresh clone. It does
**not** prove *discovery* returns the right entries, which is the part people actually depend on.
The fixture therefore does both:

1. **Clone the candidate commit into a temporary directory** and run the validator there with
   `node`, **installing nothing**. This is possible only because the JSON-sidecar format took no
   parser dependency — the validator is dependency-free by construction, so "no `npm install`" is a
   real constraint the design already satisfies rather than a wish.
2. **Assert the tested commit explicitly** — the fixture records which SHA it validated. A clean-room
   test that silently validated the wrong tree would be worse than none.
3. **Invoke discovery for representative changed paths and assert the exact expected entry set** —
   not merely "non-empty". An exact-set assertion is what makes this falsifiable.
4. **Include an adjacent-prefix non-match** — e.g. `scripts/git-hooks-old/` must NOT match a
   `scripts/git-hooks/` scope. Prefix matching that over-matches is a silent correctness bug that a
   positive-only test cannot see.

---

## Rollout

**Phase 1 — mechanism, proof, and the argument for it.** Schema, validator with all assertions and
the seventeen negative fixtures, the `/learned` skill, the public concept doc and README section
(see *Doc Updates* — a learning mechanism nobody knows about does not get used), and seeding with
the five orphaned learnings from 2026-09-03/04.
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

**The philosophy is public; the entries are working material.** These are two different artifacts
and they go to two different audiences. An earlier round resolved "contributor-facing only", which
was right about the *registry* and wrong about the *idea* — the maintainer has directed that the
philosophy itself belongs in the public documentation and onboarding, because how this project
learns is part of what the project **is**, alongside how it governs and licenses itself.

**Public — `apps/landing/` (karmyq.org):**

- **A concept doc under "Why Karmyq"**, beside `open-source-and-agpl`, which is the existing
  precedent for a governance/philosophy piece in that section. Subject: a project's habits and
  hard-won knowledge should evolve the way its code does — through review, and with something that
  fails when they go stale. It should state the problem honestly (knowledge accumulating in one
  person's head reaches nobody, and an external contributor can never receive it), and the answer
  (a home, a review path, a rot-check).

  **Author it at the source, not the output.** Two steps, both in the source pipeline:
  1. Write `docs/concepts/<slug>.md` — `generateConceptPages()` reads that directory
     (`scripts/generate-docs.ts:269`).
  2. Add the slug to the **`whyKarmyq` array** at `scripts/generate-docs.ts:585`, which is what
     builds the nav section (`:592`).

  **Do not edit `apps/landing/src/data/docs/nav.json`.** It is generated output; the next
  regeneration overwrites any hand edit. An earlier draft of this spec said to edit `nav.json` and
  grep-verify afterwards, which contradicts `CLAUDE.md`'s own rule that this directory is
  regenerated by the landing prebuild — and which is a workaround for the symptom rather than a fix
  at the source. Verify by **regenerating** and then checking the produced page and nav entry.
- **The ADR-097 concept doc**, auto-indexed under "Architecture Decisions".

**Contributor-facing:**

- **`README.md`** — **carries the philosophy itself, not merely a link to it.** This is the
  highest-traffic surface the project has: on a public repo it is what a stranger reads first, and
  most never click through to the docs site. The section states the idea in its own right — habits
  and hard-won knowledge should evolve the way code does, through review, with something that fails
  when they go stale — then links to the concept doc for the full argument and to `CONTRIBUTING.md`
  for how to add an entry. It also carries the corrections this work depends on: `npm install` →
  `npm ci`, and the missing `hooks:install` step.
- **`CONTRIBUTING.md`** — how to *author* an entry (the sidecar pair, `scope`, `verify` vs
  `expires`, evidence on renewal), and how discovery works. This is the operating manual; the
  landing doc is the argument.
- **`CLAUDE.md`** — `docs/gotchas/` in the Documentation Map and the docs feedback loop; one line in
  *Context Follows Directory Scope* directing readers to matching gotchas for paths they are about
  to change.
- **`CLAUDE.md` — fix the "Landing docs authoring" instruction (`claude.md:126`).** It currently
  names `apps/landing/src/data/docs/` as the authoring location, "each wired into `nav.json`" — but
  that directory is generated output, as `claude.md:264` states 138 lines later. The two rules
  contradict each other, and the first one is what produced the error corrected above: an
  instruction to hand-edit generated files. It should name the sources instead —
  `docs/concepts/<slug>.md`, `docs/guides/<slug>.md`, and the ordering arrays in
  `scripts/generate-docs.ts` — and say that the landing data directory is regenerated, never
  authored.

  This is a small fix with disproportionate value: it is the *source* of a class of mistake, and it
  is a working example of the promotion ladder — an observation that recurs becomes a corrected
  rule, not a repeated workaround.

  **Correction to an earlier claim in this spec:** a previous commit message blamed a private
  memory for being wrong about this. It was not — that entry is correct and detailed, naming the
  generator's lists and the regenerate-then-verify step. What misled was its **one-line index
  summary**, which reduced it to "grep-verify after every edit". The mistake was acting on a
  summary instead of opening the entry, which is why *Discovery* forbids a summary layer.
- **`docs/adr/ADR-097`** + its index entry.

**What is NOT published on the docs site:** the entries themselves. They remain **publicly
accessible in the repository** — this is a public repo, and `docs/gotchas/` is readable by anyone —
but they are not surfaced on karmyq.org. They are working material for people changing the code:
terse, path-scoped, and meaningless without the repo in front of you. Publishing 40 gotchas as
documentation would bury the argument in operational detail. The distinction is *placement*, not
secrecy.

**Rollout note:** the concept doc and README section ship in Phase 1, not later. Behaviour changes
update docs in the same PR, and for this feature the documentation *is* half the deliverable — a
learning mechanism nobody knows about does not get used.

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
- ~~Landing docs site~~ — **Resolved, then AMENDED by the maintainer (2026-09-04).** Round 1
  resolved "contributor-facing only". That holds for the **entries**, but not for the **idea**: the
  philosophy ships publicly on karmyq.org under "Why Karmyq" and in the README, because how the
  project learns is part of what it is. See *Doc Updates* for the split.
- ~~YAML or JSON~~ — **Resolved (round 2): JSON sidecars**, one `.json` + one `.md` per entry, with
  orphans rejected. Adds no dependency, so the lane is dependency-independent.
- ~~Two-renewal promotion as a validator rule~~ — **Resolved (round 2): withdrawn.** It was not
  mechanically decidable. Promotion is a reviewer's judgment at renewal; the validator enforces
  only dates, evidence, pairing, tracked scope, and reference integrity.

**Still open:**

1. **Credential detection implementation.** A local regex is hermetic but weak; real secret scanning
   generally wants the network, which the validator forbids. The pre-commit placement narrows the
   question — it must be fast and offline there — but the strength/hermeticity trade-off is
   unresolved. Leaning toward a local high-recall pattern set at pre-commit, accepting false
   positives as the safer failure direction.
2. **Is "gotcha" a stable category?** The boundary between a gotcha and a `CONTEXT.md` line is
   fuzzier than this spec admits, and may not survive contact with real entries. This is the one
   question that only real usage can answer, which is an argument for Phase 1 staying small.
