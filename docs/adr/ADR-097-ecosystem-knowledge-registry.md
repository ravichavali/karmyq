# ADR-097: Ecosystem Knowledge Registry

**Status:** Implemented
**Date:** 2026-09-04
**Deciders:** ravichavali
**Supersedes:** none
**Related:** [ADR-059](ADR-059-dependency-security-gate.md), [ADR-060](ADR-060-code-scanning-gate.md), [ADR-061](ADR-061-supply-chain-and-secrets-hardening.md), [ADR-090](ADR-090-container-runtime-floor.md), [ADR-094](ADR-094-generalized-exemption-registries.md)

## Context

Code in this repository has a mechanism for staying true: it evolves through commits, it is
reviewed, and tests fail when it rots. Operational knowledge has none. Facts like "git hooks
install to `.git/hooks` on a fresh clone" or "npm's status page does not reflect advisory-endpoint
health" were learned at real cost — some of them during outages — and then stored in one
maintainer's private agent memory at `~/.claude/projects/<project>/memory/`.

That location is outside the repository. It does not travel with a clone, it does not travel
between the project's own two development machines, and an external contributor who forks the
project can never receive it. The knowledge that makes the repository workable was, in effect,
undistributed — while the code itself is openly published under the terms recorded in
[ADR-092](ADR-092-agpl-licensing-and-manifesto-audit.md).

Simply committing the notes is not sufficient. Documentation nobody checks becomes confidently
wrong, which is worse than absent: missing knowledge sends a reader looking, while wrong knowledge
sends them somewhere specific and incorrect. The repository has already paid for this — a
superseded instruction ("grep-verify `nav.json` after every edit") was copied into a design spec
long after the underlying file had become generated output.

## Decision

Introduce `docs/gotchas/`, a git-tracked registry of durable, repo-scoped operational facts, with
a validator that fails the build when an entry stops being true.

### 1. Storage: JSON sidecars, one pair per entry

Each entry is `<slug>.json` (metadata) plus `<slug>.md` (prose and evidence). An orphan of either
kind is rejected.

**Why not YAML front-matter in a single file.** YAML would need a parser. `js-yaml` is undeclared
in every workspace here and present only as a transitive security override, so adopting it would
mean a dependency edit — and dependency edits are a serialized, contended surface in this
repository's parallel-development model. JSON parses with `JSON.parse`. **The format choice is
what keeps this work dependency-independent**, able to proceed concurrently with the ADR-059
exemption work rather than queueing behind it.

### 2. Every entry carries exactly one of a machine check or a review date

- `verify` — a declarative check the build evaluates.
- `expires` — an ISO review date, for facts a machine cannot check.

This is the invariant that makes the collection self-pruning. An entry that can be checked, is; an
entry that cannot be checked, expires. Renewal requires stating **evidence** of how the fact was
re-confirmed, not merely advancing the date, and the review span is capped at 400 days from the
most recent review.

The cap is deliberately longer than ADR-059's security-exemption cap. A stale gotcha is unhelpful;
a stale security exemption is an active risk. Reusing the security cadence would impose
security-grade churn on low-risk content.

**Promotion from `expires` to `verify` is a reviewer's decision, not a validator rule.** An earlier
draft tried to encode "an entry renewed N times should become a machine check". Whether a fact is
*mechanizable* is not information the schema can express, and a validator asserting it would either
block correct entries or be trivially satisfiable.

### 3. Verification is declarative only — four fixed check types

`path_exists`, `file_matches`, `file_not_matches`, `json_equals`. The validator **never executes a
string from an entry file.**

This is a public repository that accepts pull requests from forks. A free-form command field would
be arbitrary code execution running in CI with repository credentials — the precise class of risk
ADR-061 exists to close. The constraint costs expressiveness and is worth it.

**Declarative is not automatically safe, and the first implementation proved it.** A fork supplies
both the `path` a check reads and the `pattern` it applies, and code review found two ways that was
still dangerous:

- **Arbitrary read.** `"path": "../../.ssh/id_rsa"` resolved outside the repository, turning
  `file_matches` into an oracle: its pass/fail result reports whether a pattern occurs in any file
  the CI runner can read, and on a public repo those results are visible in the CI log. Every check
  now resolves its target inside the repository root or refuses.

  Security review then showed that root containment **alone is not a security boundary**, and both
  gaps are closed:

  - **`.git` is inside the root.** On a GitHub Actions runner `.git/config` carries the credential
    `actions/checkout` persists, so "inside the repository" is not the same as "safe to read".
    `.git` is refused by path segment regardless of how an entry spells it.
  - **Containment was purely lexical.** Git stores a symlink as a blob whose target may be
    absolute, so a committed link inside the repo reached anywhere on the runner while passing a
    `path.resolve` + `startsWith` test. Targets are now resolved with `realpathSync` and
    re-checked, verified against a directory junction resolving outside the root.

  `json_equals` additionally **echoed the value it read** into its failure message, which is not an
  oracle but a direct exfiltration channel — one entry pointing at any JSON file in the workspace
  printed its contents into a public log. It now reports only that the claim did not hold.
- **Denial of service.** `/(a+)+$/` against 31 characters measured **~108 seconds**. One entry could
  hang CI indefinitely. Node offers no regex timeout, and the validator may not spawn a process
  (§4), so the pattern itself is the only place to stop this: nested quantifiers and patterns over
  200 characters are refused at validation, before anything executes them.

The pattern rule is a conservative **heuristic**, not a proof of linear-time matching. It is stated
that way deliberately — a check that claimed more than it establishes is the failure mode this
repository keeps rediscovering. Fixtures assert both that it rejects the exponential shapes and that
it still accepts every pattern the seed entries use.

### 4. The validator is hermetic — no network I/O, directly or transitively

Asserted by the gate as an **allowlist over the actual require set**, not a blocklist of known-bad
module names. A blocklist must be extended for every spelling it does not yet know —
`require('node:http')` defeats one — so it would assert weaker than this section claims. The gate
checks that `gotcha-registry.js` requires nothing outside `{fs, path, ./lib/exemption-registry}`,
that the extractor actually finds the requires that are there (or "no disallowed requires" would be
vacuously true), that the one local module it depends on is itself require-free — which is what
makes "transitively" real — and that the source contains no `fetch(`, no `child_process`, and no
dynamic `import()` that would bypass the scan.

The motivating evidence is recent and local: during the 2026-09-03 npm outage the ADR-059 gate
could not distinguish "no advisories" from "no answer" and blocked every pull request (BUG-038). A
knowledge registry that reached the network would fail for the same reason, at the same times —
precisely when a contributor least wants an unrelated gate blocking them.

### 5. Fail closed

An unreadable or absent `verify` target is a failure, never a skip. This mirrors ADR-060's refusal
to treat an API error as "nothing found". A check that silently passes when it cannot evaluate is
worse than no check, because it reports safety it did not establish.

### 6. Scope names git-tracked paths

`scope` anchors an entry to the paths it applies to, and every anchor must appear in `git ls-files`.
An earlier draft scoped an entry to `.husky/`, which exists on a developer machine but is
gitignored — the entry would have failed on every fresh clone, breaking the exact audience the
registry exists to serve.

Scope validation and scope discovery take deliberately different inputs: validation checks against
tracked paths, while discovery matches paths *about to change*, including files that do not exist
yet. The moment before creating a file is exactly when its rule is most useful.

### 7. Credential screening happens at pre-commit, not only in CI

A CI rejection arrives after the content is already on a public remote, where deleting it does not
remove it from git history. The screen reads staged **blobs from the index** rather than the working
tree, because staging a credential and then editing it out without staging the removal would
otherwise bypass it while the commit still carried the secret. The regression gate keeps the same
check as defence in depth, since git hooks in this repository have a documented history of being
inert.

## Consequences

**Positive**

- A `git clone` becomes the only distribution mechanism this knowledge needs — including for forks.
- Stale entries fail the build and name themselves, rather than misleading a reader indefinitely.
- No new dependencies, so the work does not contend for the serialized dependency lane.
- The declarative-only and hermetic constraints keep a documentation feature from becoming a
  supply-chain or availability surface.

**Negative / accepted costs**

- Four check types cannot express every verifiable fact. Facts outside them take a review date and
  a human, which is a real recurring cost.
- The clean-room fixture clones the repository and is the slowest test in the suite.
- Entries can still be wrong in their *prose* while their machine check passes; the check anchors
  the fact, not the explanation.

**Explicitly deferred**

- Opportunistic promotion of existing expiring entries, and an audit of the ~81 private memories
  for shareable content, are ongoing practice rather than tasks of this ADR.

## Implementation

- `scripts/gotcha-registry.js` — dependency-free CommonJS validator; pure functions, no I/O beyond
  reading the files under test.
- `scripts/gotcha-check.js` — CLI: validate (`--staged` for the pre-commit screen) and discover
  (`--for <paths>`).
- `tests/regression/sprint-127-gotcha-registry-gate.test.ts` — the blocking gate: positive
  assertions over the real registry, a negative fixture per assertion, and a clean-room fixture that
  clones the candidate commit and runs the validator under bare `node` with no `node_modules`.
- `scripts/git-hooks/pre-commit` — the credential screen.
- `.claude/skills/learned/SKILL.md` — mid-session capture; `.claude/skills/ship/SKILL.md` — the
  sprint-ship capture checkpoint.
- Public rationale: [How Karmyq Learns](https://karmyq.org/docs/concepts/how-karmyq-learns/);
  authoring manual in `CONTRIBUTING.md`.
