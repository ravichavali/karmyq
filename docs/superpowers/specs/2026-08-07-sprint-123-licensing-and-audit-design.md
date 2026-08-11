# Sprint 123: Licensing Decision + Record the Audit — Design Spec

**Date**: 2026-08-07
**Status**: Approved (revised after review — see *Revision history*)
**Version**: v11.42.0 → v11.43.0
**Sprint Branch**: `feature/sprint-123-licensing-and-audit`
**Input**: [`2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) §4 S123

---

## Revision history

**Revised 2026-08-07 after external review — six findings, five confirmed and fixed, plus two
corrections found while verifying them.** The first version of this spec was wrong in ways that
would have shipped a red gate:

| Finding | Verdict | Fix |
|---|---|---|
| Manifest count wrong | **CONFIRMED.** `git ls-files '*package.json'` → **20**, not 18. My count came from a scratchpad script that double-counted `packages/shared` | Scope is 20; the gate discovers via `git ls-files`, the live arbiter |
| Seven service READMEs claim MIT | **CONFIRMED.** My original scan was truncated by `\| head -60` — the exact failure CLAUDE.md warns about | Claim inventory is now **13** live sites, re-derived by full untruncated scan |
| Extractors reject the target text | **PARTLY CONFIRMED.** `CONTRIBUTING` regex excludes `.` so `AGPL-3.0-or-later` → `null`; footer breaks once linked. The badge regex and the global-flip claim were **not** defects — verified by execution | Extractors are now written against committed fixtures, not speculation |
| Version bump absent, contradicts "lockfile untouched" | **CONFIRMED.** `e5dc24ce` shows a bump touches `package.json` ×1 and `package-lock.json` ×2 | New Task 10; the lockfile assertion is corrected to "only these lines change" |
| Quick Start loses the plan | **CONFIRMED**, and worse than reported: the planning commits are not on `origin/master` *or* on the pushed planning branch | Branch from the planning branch's local HEAD |
| Legal conclusions overreach | **CONFIRMED as wording.** Zero forks/stars/watchers cannot prove no clones | Softened to what was observed |
| `LICENSE` verbatim vs. appending a notice | **CONFIRMED** (raised as an addendum). GitHub's detection is similarity-based; a modified `LICENSE` can defeat it — and "GitHub detects the license" is our own Definition of Done | `LICENSE` stays byte-exact; the copyright notice goes in `README.md` |

**Superseded by maintainer attestation (2026-08-07):** the provenance/consent apparatus in the
first version is void. See *Provenance* below.

---

## Overview

Karmyq is a **public** repository (`gh repo view --json isPrivate` → `false`, verified 2026-08-07)
that makes contradictory license claims and has no license file. `README.md` claims MIT with a badge
linking to a file that does not exist. `CONTRIBUTING.md` tells contributors their work is MIT.
**Seven service READMEs say MIT.** The landing site — the published manifesto — claims AGPLv3 and
builds an argument on it. `apps/mobile/README.md` claims AGPL-3.0 and links to the same missing
file. All 20 tracked manifests are silent. GitHub reports `licenseInfo: null`.

This sprint publishes **AGPL-3.0-or-later**, reconciles all thirteen claim sites and twenty
manifests, and records the manifesto audit that found the problem so it is not re-derived in three
months.

The sprint's durable output is not the `LICENSE` file — that is fifteen minutes of work. It is the
**regression gate that fails when any two license sources disagree**. A gate asserting only
"LICENSE exists" would have passed happily through this entire contradiction.

### Core Principle: A gate that only checks presence would have passed through the bug it exists to prevent

Every source is read, normalized, and compared against every other. Absence of a claim is a failure
(a moved claim silently dropping out of the check is the failure mode), and disagreement between any
two is a failure. Per [ADR-091](../../adr/ADR-091-verification-before-assertion.md), each extractor
is proven able to go red **individually** — not once, for one source.

---

## Multi-Sprint Arc

Four sprints, one topic each (arc design D6). This is S123 of 4.

### Sprint 123 — Licensing decision + record the truth (this sprint)
Publish AGPL-3.0-or-later; reconcile 13 claim sites + 20 manifests; ADR-092 (audit + licensing),
ADR-093 (`federation` reserved); consistency gate.

### Sprint 124 — The provider question (next)
Enforce `provider_services_enabled` and `provider_min_personal_trust_score` at the community
surface. ADR for the two open semantic questions: does standing gate global registration, and what
happens to the unauthenticated global directory. **Not decided — that is S124's real product work.**

### Sprint 125 — Demo data backfill
Fix `TimeTravelFactory` first (it inserts into `reputation.karma_records` directly with
caller-supplied points — it violates the replay constraint it appears to satisfy), then backfill
aged history through production math.

### Sprint 126 — Live simulation across all users
Remove the protected-core exclusion from `buildActorPoolPredicate()`; verify `reset:demo`'s real
path.

---

## New Concepts

**License claim site.** Any tracked, non-generated file that states what license *this project* is
under. Thirteen exist. The gate enumerates them explicitly and fails if any one stops being
readable, so a rename or rewrite cannot silently remove a source from the comparison.

**Normalized license family.** Prose says `AGPLv3`; SPDX says `AGPL-3.0-or-later`; a badge says
`AGPL--3.0--or--later`. All mean the same thing and must compare equal, while `MIT` must not. The
gate normalizes to a family token (`AGPL-3.0` | `MIT` | `OTHER`) for cross-source comparison, and
additionally asserts **exact SPDX** in the 20 manifests, where the string is machine-read.

**Reserved schema.** A schema created by a migration and referenced by no service. `federation` is
the only one. Documented as reserved rather than deleted: `init.sql` is generated from migrations
and the demo database already carries it, so deletion is a migration with real risk and no user
benefit.

---

## Maintainer Decisions (2026-08-07)

| # | Decision |
|---|---|
| D7 | The project is **AGPL** |
| D8 | SPDX id is **`AGPL-3.0-or-later`** (FSF's recommended "or any later version" form) |
| D9 | Copyright line is **`Copyright (C) 2025-2026 Ravi Chavali`**, placed in `README.md` — **not** in `LICENSE` |
| D10 | **All 20 tracked manifests** declare the license, discovered via `git ls-files` |
| D11 | **Sole authorship.** Every commit is the maintainer's own work, across five git identities. No third-party contribution exists, so no consent is required and relicensing is unproblematic |
| D13 | The 7 UNVERIFIED §2.4 claims are **recorded as follow-up in ADR-092**, not checked this sprint |

*(D12 — the `Karmyq Developer` identity confirmation — is absorbed into D11.)*

---

## Provenance

**Superseding the first version of this spec entirely.** The maintainer attested on 2026-08-07 that
`Pallavi Ravi <kompella.chavali@gmail.com>` is another of their own addresses, and that all work to
date is their own. The consent question, the counsel recommendation, and the "third-party
contributor" framing are therefore void.

`git log --all` at `13249a78` (2026-08-07), 1,684 commits:

| Identity | Commits | Status |
|---|---|---|
| `Ravi Chavali <ravichavali@gmail.com>` | 1,470 | Maintainer |
| `Ravi Chavali <ravichavali@users.noreply.github.com>` | 107 | Maintainer (GitHub noreply) |
| `Pallavi Ravi <kompella.chavali@gmail.com>` | 24 | Maintainer — alternate address (attested) |
| `kompellachavali <kompella.chavali@gmail.com>` | 2 | Same address, different name string |
| `Karmyq Developer <karmyq@example.com>` | 12, incl. initial commit `1dea32d1` | Maintainer — pre-config identity (attested) |
| `dependabot[bot]` | 69 | Mechanical manifest/lockfile edits — not authorship |

**Sole human author: 1,615 commits across five identities.** A `.mailmap` collapses them.

⚠️ **ADR-092 records this as a maintainer attestation, because that is what it is.** The repository
cannot prove which addresses belong to one person; the maintainer can, and has. Stating it as an
attestation is both accurate and sufficient — it is not hedging, it is naming the source of the
fact.

### What is observable, stated at that strength

- `forkCount: 0`, `stargazerCount: 0`, `watchers: 0` (verified 2026-08-07).
- **These do not prove nobody obtained the code.** Clones and tarball downloads are not visible in
  these counters, and the repository is public. ADR-092 must say *"no GitHub-native forks, stars, or
  watchers were observed; clones and downloads are not observable"* — **not** "no third party has
  ever received the code."
- Repository is public, so the contradictory claims have been publicly readable. That is the reason
  to fix them, and it needs no stronger claim than that.

---

## Data Model

**No schema changes.** No migration. The only database-adjacent change is documentation: CLAUDE.md's
"13 schemas" becomes "12 live + 1 reserved".

---

## API Endpoints

**None.** No endpoint added, modified, or removed. `services/registry.json` unchanged.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/landing/src/components/Footer.tsx:26` | `Open source, AGPLv3` → link to the repository `LICENSE`. ⚠️ Adding the link puts JSX between the comma and the token — the extractor must be written against the **committed** markup, not the current markup |
| `apps/landing/src/lib/landingContent.ts:278` | Already claims AGPLv3 — becomes true. Reword only if the extractor needs the token unambiguous |

No component added. No route added. `apps/frontend` untouched.

---

## The License Claim Inventory

**Thirteen live sites**, re-derived 2026-08-07 by a full untruncated scan of `git ls-files`
(15 raw hits across 14 files; 2 allowlisted below).

| # | Site | Claims today | Becomes |
|---|---|---|---|
| 1 | `README.md:4` (shields.io badge → nonexistent `LICENSE`) | MIT | `AGPL-3.0-or-later`, link resolves |
| 2 | `README.md:164` (License section) | MIT | `AGPL-3.0-or-later` + the D9 copyright notice |
| 3 | `CONTRIBUTING.md:52` | MIT — *the live contributor agreement* | `AGPL-3.0-or-later` |
| 4 | `apps/mobile/README.md:363` | AGPL-3.0, links to nonexistent `LICENSE` | `AGPL-3.0-or-later`, link resolves |
| 5 | `apps/landing/src/components/Footer.tsx:26` | AGPLv3 | unchanged in meaning; link added |
| 6 | `apps/landing/src/lib/landingContent.ts:278` | AGPLv3 | unchanged in meaning |
| 7 | `services/auth-service/README.md:261` | **MIT** | `AGPL-3.0-or-later` |
| 8 | `services/cleanup-service/README.md:238` | **MIT** | `AGPL-3.0-or-later` |
| 9 | `services/community-service/README.md:74` | **MIT** | `AGPL-3.0-or-later` |
| 10 | `services/messaging-service/README.md:102` | **MIT** | `AGPL-3.0-or-later` |
| 11 | `services/notification-service/README.md:101` | **MIT** | `AGPL-3.0-or-later` |
| 12 | `services/reputation-service/README.md:99` | **MIT** | `AGPL-3.0-or-later` |
| 13 | `services/request-service/README.md:85` | **MIT** | `AGPL-3.0-or-later` |

⚠️ **Sites 7–13 were missed in the first version of this spec** because the scan was piped through
`| head -60`. They are the majority of the MIT claims in the repository.

**Three services have no License section at all** — `geocoding-service`, `simulation-service`,
`social-graph-service`. Each **gains** one, so the invariant is uniform ("every service README
states the license") rather than conditional ("those that have a section must agree"). A conditional
rule is the weaker-than-claimed shape this repo keeps getting caught by.

### Manifests — 20, not 18

`git ls-files '*package.json'` (the live arbiter, not a directory glob):

- Root: `package.json`
- Workspaces (15, confirmed by `npm query .workspace`): `apps/{frontend,landing,mobile}`,
  `packages/shared`, `tests`, `services/*` × 10
- **Standalone npm projects, outside the workspace graph:** `scripts/`, `tests/e2e/`, `tests/load/`,
  `tests/performance/`

⚠️ **The first version said 18** — a scratchpad script double-counted `packages/shared` and the
directory glob never reached `tests/e2e`, `tests/load`, `tests/performance`. **D10 covers all 20**:
they are all first-party Karmyq code in a public AGPL repository, and a scope defined by "npm
workspaces" would leave three of them silent for no reason a reader could infer.

**The gate discovers manifests via `git ls-files`**, so a new one cannot appear unlicensed and pass.
A hand-written list is the false-green pattern CLAUDE.md Discipline 5 forbids.

### Allowlisted — not claims about Karmyq's license

| Site | Says | Why untouched |
|---|---|---|
| `apps/frontend/IMPLEMENTATION_SUMMARY.md:333` | "MIT license compatible" | A statement about OSM/geocoding **dependencies**. Changing it would make it wrong |
| `docs/archive/operations/SELF_HOSTING_GUIDE.md:897` | AGPL-3.0 | Archived directory; already agrees |

Allowlisted **by path with the reason in a comment**, so a license claim appearing in a new file is
caught rather than absorbed.

---

## The Consistency Gate

`tests/regression/sprint-123-license-consistency-gate.test.ts`

⚠️ **`tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` is never promoted —
`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*` — so a gate left there runs
forever and blocks nothing. `tests/CLAUDE.md` names repo-wide invariants as the exact case for root
`tests/regression/`.

### What it asserts

1. **`LICENSE` is byte-exact canonical AGPL-3.0** — contains `GNU AFFERO GENERAL PUBLIC LICENSE`,
   `Version 3, 19 November 2007`, the closing `<https://www.gnu.org/licenses/>`, and **does not
   contain a project-specific copyright line** (that would risk GitHub's similarity-based
   detection, and "GitHub detects the license" is a Definition-of-Done item).
2. **`README.md` carries the D9 copyright notice** — the notice has to live somewhere, and GNU's
   `gpl-howto` says attach it to the program rather than modify the license text.
3. **All 13 prose sites extract non-null AND agree.** A null extraction is a **failure**, not a
   skip. If someone rewrites `CONTRIBUTING.md` and the regex stops matching, the gate goes red.
4. **All 20 manifests declare `license` exactly `AGPL-3.0-or-later`**, list discovered from
   `git ls-files`, with a floor assertion so discovery cannot silently shrink.
5. **README's badge and README's prose section agree with each other** — two independent sites in
   one file, and drifted apart is the exact shape of the original bug.
6. **No unallowlisted new claim site** — full scan of tracked, non-generated files; any hit outside
   the 13 enumerated sites and the 2 allowlisted paths fails with a message telling the author to
   fix the claim or allowlist the path deliberately.

### How it is proven able to fail

Per ADR-091 and memory `feedback_gates_assert_weaker_than_claimed` — *one injection is not proof*:

- **Extractors are written against committed fixtures, not guessed.** The first version's
  `CONTRIBUTING` regex used `[^\n.]+` and returned `null` for `AGPL-3.0-or-later` because the class
  excludes periods — it would have failed on the very text it was written to accept. Task 5 commits
  the final wording; Task 2's extractors are then written and run against that on-disk text.
- **Table-driven per-source flip** across all 13 sites plus a representative manifest, asserting
  each real extractor returns `MIT` on flipped content and `null` on emptied content.
- **One real on-disk flip** (Task 6): mutate `README.md:4`, run the suite directly, **watch it go
  red**, restore, watch it go green. ⚠️ Restore with a **targeted revert of that hunk** — `git
  checkout README.md` would discard Task 5's uncommitted reconciliation of the same file.
- Both outputs pasted into the PR. A green run alone proves nothing.

---

## Added scope: the inert git hooks

Found 2026-08-07 while pushing the planning branch — the push completed in seconds, silently.

`core.hooksPath` is set to `.husky` (husky owns it, for `pre-commit`), but
`scripts/install-hooks.sh:63` hardcodes `target=".git/hooks/$hook_name"`. Git reads **only** the
configured hooks path, so everything the installer writes is dead code.

| Hook | Source | Reality |
|---|---|---|
| `pre-push` — unit + regression, blocking | `scripts/git-hooks/pre-push` | **Never runs.** `.husky/` contains no `pre-push` at all |
| `pre-commit` — governance **+ doc feedback loop** | `scripts/git-hooks/pre-commit` | **Never runs.** The older, narrower `.husky/pre-commit` runs instead — no doc-feedback check, no generated-file exclusions |

**Two CLAUDE.md claims are false today:** Discipline 3 ("pre-push hook enforces") and *Creating New
Services* ("Pre-commit hook enforces the checklist").

It belongs in this sprint because it is the same failure class the sprint is already about — a
mechanism that claims to enforce something, was never observed failing, and is silent when it does
nothing. ADR-060 was this. The license gate would have become this if it only checked presence.

**Fix-forward in `install-hooks.sh`** (resolve `core.hooksPath`, fall back to `.git/hooks`), not a
hand-placed file in `.husky`. The regression test asserts the **installer** is correct rather than
this machine's state — CI skips hook installation on `$CI`, so a "hook exists here" assertion would
false-fail — and proves it functionally by running the installer in a throwaway repo with a custom
`core.hooksPath` and asserting the hook lands there.

**Also noted, not adopted:** `scripts/setup/git-hooks/{pre-commit,pre-push}` is a *third* set of
hook sources. Its status is recorded in the PR; consolidating it is out of scope.

---

## User Guide & Doc Updates

Mandatory every sprint.

| Artifact | Path | Change |
|---|---|---|
| **New concept page** | `docs/concepts/open-source-and-agpl.md` | What AGPL-3.0-or-later means for someone who forks or self-hosts Karmyq |
| Nav wiring | `scripts/generate-docs.ts` — `CONCEPT_ORDER` **and** the `whyKarmyq` array | ⚠️ **Both.** The drift gate fails on a concept page absent from nav |
| ADR landing pages | `scripts/generate-docs.ts` — `ADR_GROUPS` "— Infrastructure —" | ⚠️ Add `adr-092-…`, `adr-093-…`. All 89 existing ADRs are curated there; generated `nav.json` is not hand-editable |
| ADR index | `docs/adr/README.md` | Entries for ADR-092/093 — enforced by `doc-context-drift-gate.test.ts` |
| CLAUDE.md | `CLAUDE.md:175` | "13 schemas" → 12 live + 1 reserved, naming `federation`, linking ADR-093 |
| AGENTS.md | root | Sync if it repeats the schema count |
| README | `README.md` | Badge, license section, **and the D9 copyright notice** |
| CONTRIBUTING | `CONTRIBUTING.md` | Contributor agreement → AGPL-3.0-or-later |
| 10 service READMEs | `services/*/README.md` | 7 corrected from MIT; 3 gain a License section |

No `docs/guides/` change: this sprint ships no user-facing behavior. Licensing is a "Why Karmyq"
question, so the concept page is the right surface.

---

## ADRs

### ADR-092 — AGPL-3.0-or-later, and the manifesto audit that produced it

Next free number (highest is 091, verified). Status **Accepted** → **Implemented** on deploy.

- The decision, D7–D13, and **why not MIT**: network copyleft is what makes the manifesto's
  "if someone runs Karmyq, their changes stay open too" true. MIT does not do that.
- **Provenance as a maintainer attestation** — five identities, one author, per the table above.
  Observables stated at observed strength: no forks/stars/watchers seen; **clones and downloads are
  not observable**.
- The audit: 9 holding claims with `file:line`, F1/F2/F3, reverse findings (`federation`
  unimplemented; the public unauthenticated provider directory; collectives, dibs, scheduling and
  feedback shipped but never claimed).
- **The 7 UNVERIFIED §2.4 claims as an explicit follow-up list** (D13), each marked neither holding
  nor failing, with the search that would settle it.
- F2/F3 handed to S124 with their open semantic questions intact.

### ADR-093 — `federation` is reserved, unimplemented scaffolding

Status **Accepted**. Records that `001_federation_schema.sql` creates instance-identity tables with
keypairs and a `federation_enabled` flag, that no service references `federation.` (search scope
stated inline), and that the schema is **deliberately not deleted**.

---

## Critical Implementation Notes

These appear verbatim in the implementation plan.

1. **Branch from `docs/sprint-123-planning`, not `origin/master`.** The spec and plan are on the
   planning branch only — pushed as of 2026-08-07, but never on `origin/master`. Branching from
   `origin/master` produces a working tree with no plan in it.
2. **The AGPL text is copied verbatim and left byte-exact.** Fetch
   `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch` (`curl` is unreliable here —
   spurious status 000). **Do not append a copyright block to `LICENSE`** — GitHub's detection is
   similarity-based and `licenseInfo != null` is a Definition-of-Done item. The D9 notice goes in
   `README.md`, per GNU's `gpl-howto`. If the fetch fails, stop and ask — do not approximate.
3. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes, so a gate left there blocks nothing.
4. **Write extractors against committed fixtures, never speculation.** Task 5 lands the final
   wording *before* Task 2's extractors are finalized. The first version's `CONTRIBUTING` regex
   excluded periods and returned `null` for the very string it was meant to accept.
5. **A null extraction must fail the gate, not skip it.** Presence-instead-of-blocking is this
   repo's recurring gate defect.
6. **Prove each extractor can fail, not just one.** Table-driven MIT-flip across all 13 sites, plus
   one real on-disk flip. **Restore the flip with a targeted revert** — `git checkout README.md`
   discards Task 5's uncommitted work on the same file.
7. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs.
8. **`nav.json` is generated and hand-edits silently revert.** Source is `scripts/generate-docs.ts`:
   `ADR_GROUPS` (~line 520) for the ADRs, **both** `CONCEPT_ORDER` (~245) and `whyKarmyq` (578) for
   the concept page. `doc-context-drift-gate.test.ts` fails on any page missing from nav.
9. **`npm test` regenerates the landing docs** — commit the intended additions, revert incidental
   timestamp/HEAD-sha churn.
10. **The manifest list is discovered via `git ls-files`, never hand-written.** There are **20**.
    A directory glob missed `tests/e2e`, `tests/load`, `tests/performance` in the first version.
11. **The version bump touches the lockfile.** `e5dc24ce` proves the shape: `package.json` ×1 and
    `package-lock.json` ×2 (`.version`, `.packages[""].version`). "Lockfile untouched" is **wrong**
    — the correct assertion is *only those lines change*, verified by reading the diff.
12. **The shields.io badge escapes hyphens** — `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue`. The normalizer un-escapes `--` before comparing.
13. **`git add` CLAUDE.md carefully on Windows** — tracked lowercase as `claude.md`.
14. **No docs-only push to master** — a post-merge docs push triggers a second deploy and 502s the
    demo.

---

## Definition of Done

- [ ] `LICENSE` at repo root, **byte-exact canonical** AGPL-3.0, no appended notice
- [ ] `README.md` carries `Copyright (C) 2025-2026 Ravi Chavali`
- [ ] All **20** manifests declare `"license": "AGPL-3.0-or-later"`
- [ ] All **13** claim sites agree; the 3 service READMEs without a section have one; both
      previously-broken `LICENSE` links resolve
- [ ] Root version is **11.43.0** in `package.json` and both `package-lock.json` entries
- [ ] `gh repo view --json licenseInfo` no longer returns `null`
- [ ] Gate in `tests/regression/`, **observed red on a real flip and green after restore**, both
      outputs in the PR
- [ ] `scripts/install-hooks.sh` resolves `core.hooksPath`; hook-installer test **observed red**
      against the hardcoded path; `pre-push` verified firing on a real push (not silent and instant)
- [ ] ADR-092 + ADR-093 written, indexed, wired into `ADR_GROUPS`
- [ ] `docs/concepts/open-source-and-agpl.md` renders with a nav entry
- [ ] CLAUDE.md says 12 live + 1 reserved
- [ ] `npm test` green · `npm run feedback:check` clean · `/simplify`, `/code-review`,
      `/security-review` run on the diff
- [ ] Deployed, smoke-tested, handoff reconciled against real state
