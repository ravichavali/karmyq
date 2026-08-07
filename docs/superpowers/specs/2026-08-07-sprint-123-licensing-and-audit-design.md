# Sprint 123: Licensing Decision + Record the Audit — Design Spec

**Date**: 2026-08-07
**Status**: Approved
**Version**: v11.42.0 → v11.43.0
**Sprint Branch**: `feature/sprint-123-licensing-and-audit`
**Input**: [`2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) §4 S123

---

## Overview

Karmyq is a public repository that makes **contradictory license claims and has no license at
all**. `README.md` claims MIT with a badge linking to a file that does not exist. `CONTRIBUTING.md`
tells every contributor their work is MIT-licensed. The landing site — the published manifesto —
claims AGPLv3 and builds an argument on it ("if someone runs Karmyq, their changes stay open too").
`apps/mobile/README.md` claims AGPL-3.0 and links to the same missing file. All 18 workspace
manifests are silent. GitHub reports `licenseInfo: null`. With no license file, **default copyright
applies and no grant has been made** — the "open source" claim on the landing page is currently
false as a matter of law, not of tone.

This sprint publishes **AGPL-3.0-or-later**, reconciles every claim site to agree with it, and
records the manifesto audit that found the problem so it is not re-derived in three months. The
audit produced nine claims that hold and three that fail; two of the failures (F2 provider standing,
F3 unenforced community config) are Sprint 124's work and are recorded here, not fixed here.

The sprint's durable output is not the `LICENSE` file — that is fifteen minutes of work. It is the
**regression gate that fails when any two license sources disagree**. A gate asserting only
"LICENSE exists" would have passed happily through the entire MIT-vs-AGPL contradiction this sprint
exists to end.

### Core Principle: A gate that only checks presence would have passed through the bug it exists to prevent

Every source that states a license is read, normalized, and compared against every other. Absence of
a claim is a failure (a moved claim silently dropping out of the check is the failure mode), and
disagreement between any two is a failure. Per [ADR-091](../../adr/ADR-091-verification-before-assertion.md),
each extractor is proven able to go red individually — not once, for one source.

---

## Multi-Sprint Arc

Four sprints, one topic each (arc design D6). This is S123 of 4.

### Sprint 123 — Licensing decision + record the truth (this sprint)
Publish AGPL-3.0-or-later; reconcile 6 claim sites + 18 manifests; ADR-092 (audit + licensing),
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

**License claim site.** Any tracked, non-generated file that states what license this project is
under. Six exist today; the gate enumerates them explicitly and fails if any one stops being
readable, so a rename or rewrite cannot silently remove a source from the comparison.

**Normalized license family.** Prose says `AGPLv3`; SPDX says `AGPL-3.0-or-later`; the mobile README
says `AGPL-3.0`. All three mean the same thing and must compare equal, while `MIT` must not. The
gate normalizes to a family token (`AGPL-3.0` | `MIT` | `OTHER`) for cross-source comparison, and
additionally asserts **exact SPDX** in the 18 manifests, where the string is machine-read by npm and
GitHub.

**Reserved schema.** A database schema that is created by a migration and referenced by no service.
`federation` is the only one. It is documented as reserved rather than deleted, because `init.sql`
is generated from migrations and the demo database already carries it — deletion is a migration with
real risk and no user benefit.

---

## Maintainer Decisions (2026-08-07)

| # | Decision | Consequence |
|---|---|---|
| D7 | The project is **AGPL** | Recorded in the arc design; the README's MIT claim is the wrong one |
| D8 | SPDX id is **`AGPL-3.0-or-later`** | FSF's recommended "or any later version" form; matches the landing's loose "AGPLv3" |
| D9 | Copyright line is **`Copyright (C) 2025-2026 Ravi Chavali`** | Single named legal person |
| D10 | **All 18 manifests** declare the license, not just root | Ten `services/*` manifests are publish-eligible and currently silent |
| D11 | Pallavi Ravi's consent is **verbal**, no written artifact, **no follow-up task** | ADR-092 records it as verbal and undocumented — stated plainly, not implied to be a paper trail |
| D12 | `Karmyq Developer <karmyq@example.com>` is **confirmed as the maintainer's own** pre-config identity | Recorded in ADR-092; `.mailmap` maps it to the canonical identity |
| D13 | The 7 UNVERIFIED §2.4 claims are **recorded as follow-up in ADR-092**, not checked this sprint | Keeps S123 one topic (D6); cross-community transfer is verified in S125 anyway as its stated prerequisite |

⚠️ **D11 is the sprint's one accepted risk, and it was taken knowingly.** The maintainer was offered
a written-confirmation-first option and an in-sprint email task, and declined both. The mitigating
facts are real and measured: `forkCount: 0`, `stargazerCount: 0`, `watchers: 0`, `gh api
repos/.../forks` → 0, so **no third party has ever received the code under the README's MIT claim**.
ADR-092 states the consent is verbal and that no artifact exists, so a future reader is not misled
about the strength of the record.

---

## Provenance — measured, not assumed

`git log --all` at `9a88cc96` (2026-08-07), 1,684 commits:

| Identity | Commits | Status |
|---|---|---|
| `Ravi Chavali <ravichavali@gmail.com>` | 1,470 | Maintainer |
| `Ravi Chavali <ravichavali@users.noreply.github.com>` | 107 | Maintainer (GitHub noreply) |
| `dependabot[bot]` | 69 | Mechanical manifest/lockfile edits — not authorship |
| `Pallavi Ravi <kompella.chavali@gmail.com>` | 24 | **Third party.** Verbal consent obtained (D11) |
| `kompellachavali <kompella.chavali@gmail.com>` | 2 | Same person, different name string |
| `Karmyq Developer <karmyq@example.com>` | 12, incl. initial commit `1dea32d1` | **Maintainer's own** (D12) |

No `.mailmap` exists. One is added this sprint so the three maintainer identities and the two
Pallavi identities collapse correctly in `git shortlog -sne`.

---

## Data Model

**No schema changes.** No migration. The only database-adjacent change is documentation: CLAUDE.md's
"13 schemas" becomes "12 live + 1 reserved", because `federation` is created by
`infrastructure/postgres/migrations/001_federation_schema.sql` and referenced by no service.

---

## API Endpoints

**None.** No endpoint is added, modified, or removed. `services/registry.json` is unchanged.

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/landing/src/components/Footer.tsx:26` | `Open source, AGPLv3` → link to the repository `LICENSE`, wording aligned to `AGPL-3.0-or-later` |
| `apps/landing/src/lib/landingContent.ts:278` | Body text already claims AGPLv3 — becomes true. Reword only if the gate's normalizer needs an unambiguous token |

No component is added. No route is added. `apps/frontend` is untouched.

---

## The License Claim Inventory

Six live claim sites. **The arc design listed four; two were found during planning and are the
legally consequential ones.**

| # | Site | Claims today | Becomes |
|---|---|---|---|
| 1 | `README.md:4` (shields.io badge → nonexistent `LICENSE`) | MIT | `AGPL-3.0-or-later`, link resolves |
| 2 | `README.md:164` (License section) | MIT | `AGPL-3.0-or-later` |
| 3 | **`CONTRIBUTING.md:52`** | **MIT** — *the actual contributor agreement.* ⚠️ Not in the arc design | `AGPL-3.0-or-later` |
| 4 | **`apps/mobile/README.md:363`** | **AGPL-3.0**, links to nonexistent `LICENSE`. ⚠️ Not in the arc design | `AGPL-3.0-or-later`, link resolves |
| 5 | `apps/landing/src/components/Footer.tsx:26` | AGPLv3 | unchanged in meaning; link added |
| 6 | `apps/landing/src/lib/landingContent.ts:278` | AGPLv3 | unchanged in meaning |

Plus **18 workspace manifests**, all currently with no `license` field:

`package.json` · `packages/shared/package.json` · `tests/package.json` · `scripts/package.json` ·
`apps/{frontend,landing,mobile}/package.json` · `services/{auth,cleanup,community,geocoding,messaging,notification,reputation,request,simulation,social-graph}-service/package.json`

⚠️ **The ten `services/*` manifests are not `private: true`**, so they are publish-eligible with no
declared license. They get the `license` field (D10). Marking them private was offered and **not**
chosen — recorded here so a later reader knows it was considered, not overlooked.

**Two sites deliberately left alone**, with reasons:

| Site | Says | Why untouched |
|---|---|---|
| `docs/archive/operations/SELF_HOSTING_GUIDE.md:897` | AGPL-3.0 | Archived directory; already agrees with the decision |
| `apps/frontend/IMPLEMENTATION_SUMMARY.md:333` | "MIT license compatible" | Reads as a statement about OSM/geocoding **dependencies**, not about Karmyq. Changing it would make it wrong |
| `docs/superpowers/plans/2026-06-01-multi-agent-pr-process.md:310` | MIT | Historical plan document; `CONTRIBUTING.md` is the live agreement it produced |

Both are added to the gate's allowlist **by path, with the reason in a comment**, so a future
license claim appearing in a new file is caught rather than absorbed.

---

## The Consistency Gate

`tests/regression/sprint-123-license-consistency-gate.test.ts`

⚠️ **`tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` is never promoted —
`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*` — so a gate left there runs
forever and blocks nothing. See `tests/CLAUDE.md`. This is a repo-wide invariant spanning README,
manifests, landing and mobile, which `tests/CLAUDE.md` names as the exact case for root
`tests/regression/`.

### What it asserts

1. **`LICENSE` exists and is genuinely AGPL-3.0** — contains `GNU AFFERO GENERAL PUBLIC LICENSE`
   and `Version 3, 19 November 2007`, and the copyright line names the holder from D9. Length
   sanity-checked so a truncated paste fails.
2. **Every one of the 6 prose sites extracts a non-null license.** A null extraction is a **failure**,
   not a skip — this is the trap that makes gates false-green (memory:
   `feedback_gates_assert_weaker_than_claimed`). If someone rewrites `CONTRIBUTING.md` and the
   regex stops matching, the gate must go red, not quietly stop checking that file.
3. **All 6 normalize to the same family**, and that family is `AGPL-3.0`.
4. **All 18 manifests declare `license` exactly `AGPL-3.0-or-later`** — exact SPDX, not normalized,
   because npm and GitHub machine-read this string. The manifest list is **discovered from the
   filesystem** (`services/*`, `apps/*`, `packages/*` + the four roots), not hand-listed, so a new
   workspace cannot be added without a license and silently pass.
5. **README's badge and README's prose section agree with each other** — they are two independent
   sites in one file and drifted apart is exactly the shape of the original bug.
6. **No unallowlisted new claim site.** Repo-wide search over tracked, non-generated files for
   license-family tokens; any hit outside the enumerated sites and the documented allowlist fails
   with a message telling the author to fix the claim or allowlist the path deliberately.

### How it is proven able to fail

Per ADR-091 and memory `feedback_gates_assert_weaker_than_claimed` — *one injection is not proof*:

- **Table-driven per-source flip.** For each of the 6 prose sites and a representative manifest, the
  test feeds that site's **real extractor** synthetic content with the license flipped to MIT and
  asserts the extractor returns `MIT` (≠ expected). This proves each extractor is individually live
  and discriminating — a regex that matches nothing would return `null` and fail this test.
- **A null-extraction case** per source, asserting the comparator rejects it rather than skipping.
- **One real on-disk flip, performed by hand during the sprint** (Task 6): edit `README.md:4` to
  MIT, run the suite directly (`cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`
  — never through Turbo, whose cache misses cross-workspace inputs), **watch it go red**, revert,
  watch it go green. Both outputs pasted into the PR description. A green run alone proves nothing.

---

## User Guide & Doc Updates

Mandatory every sprint.

| Artifact | Path | Change |
|---|---|---|
| **New concept page** | `docs/concepts/open-source-and-agpl.md` | What AGPL-3.0-or-later means for someone who forks or self-hosts Karmyq. Makes the manifesto's "Fork it, improve it, make it yours" claim actionable rather than decorative |
| Nav wiring | `scripts/generate-docs.ts` — `CONCEPT_ORDER` **and** the `whyKarmyq` slug array | ⚠️ **Both.** `CONCEPT_ORDER` sets reading order; the `whyKarmyq` array sets nav placement. The drift gate fails on a concept page absent from nav |
| ADR landing pages | `scripts/generate-docs.ts` — `ADR_GROUPS` "— Infrastructure —" | ⚠️ Add `adr-092-…` and `adr-093-…` slugs. **All 89 existing ADRs are curated here**; the generated `nav.json` is not hand-editable (memory: `feedback_nav_json_revert`) |
| ADR index | `docs/adr/README.md` | Entries for ADR-092 and ADR-093 — enforced by `doc-context-drift-gate.test.ts` |
| CLAUDE.md | `CLAUDE.md:175` | "13 schemas" → 12 live + 1 reserved, naming `federation` and linking ADR-093 |
| AGENTS.md | root | Sync if it repeats the schema count (CLAUDE.md is source of truth) |
| README | `README.md` | License badge + section; verify the badge URL renders (shields.io escapes `-` as `--`) |
| CONTRIBUTING | `CONTRIBUTING.md` | Contributor agreement now says AGPL-3.0-or-later |

No `docs/guides/` change: this sprint ships no user-facing behavior. The concept page is the
user-facing doc, and it is the right surface — licensing is a "Why Karmyq" question, not a
how-to.

---

## ADRs

### ADR-092 — AGPL-3.0-or-later, and the manifesto audit that produced it

Next free number (highest today is 091, verified by `ls docs/adr`). Status: **Accepted** → flipped
to **Implemented** when deployed.

Contents:
- The licensing decision, D7–D13, with the reasoning for AGPL over MIT (network copyleft is what
  makes the manifesto's commons argument true; MIT does not do that).
- **Provenance, measured** — the commit table above, the zero-distribution finding, Pallavi's
  **verbal, undocumented** consent (D11), and the `Karmyq Developer` identity confirmation (D12).
- The audit: the 9 claims that hold with `file:line` references, F1/F2/F3, and the reverse findings
  (`federation` unimplemented; the public unauthenticated provider directory; collectives, dibs,
  scheduling and feedback shipped but never claimed).
- **The 7 UNVERIFIED §2.4 claims recorded as follow-up** (D13), each with the search that would
  settle it, and explicitly marked as neither holding nor failing.
- F2 and F3 handed to S124 with their open semantic questions intact.

### ADR-093 — `federation` is reserved, unimplemented scaffolding

Status: **Accepted**. Records that `001_federation_schema.sql` creates instance-identity tables with
keypairs and a `federation_enabled` flag, that no service references `federation.` (only
`simulation-service`'s `tablePolicy.ts`, as policy metadata), and that **the schema is deliberately
not deleted**: `init.sql` is generated from migrations and the demo database carries it, so deletion
is a migration with real risk and no user benefit.

---

## Critical Implementation Notes

These appear verbatim in the implementation plan.

1. **The AGPL text is copied verbatim from a canonical source, never hand-typed or reconstructed
   from memory.** Fetch `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch`
   (`curl` is unreliable on this host — spurious status 000) and verify before committing: the file
   must contain `GNU AFFERO GENERAL PUBLIC LICENSE`, `Version 3, 19 November 2007`, the closing
   `<https://www.gnu.org/licenses/>`, and be ~660 lines. **A license file with typos is a real
   defect, not a cosmetic one.** If the fetch fails, stop and ask — do not approximate.
2. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`), so a gate
   left there blocks nothing. See `tests/CLAUDE.md`.
3. **A null extraction must fail the gate, not skip it.** The recurring defect in this repo is gates
   that assert weaker than they claim — presence instead of blocking, count instead of identity.
   If a site's extractor returns `null`, that is a red test.
4. **Prove each extractor can fail, not just one.** Table-driven MIT-flip per source, plus one real
   on-disk flip of `README.md:4` with both red and green outputs pasted into the PR.
5. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs — a `tests/regression/*` file reading `apps/landing` and
   `apps/mobile` will cache a stale pass while CI fails.
6. **`nav.json` is generated and hand-edits silently revert.** The source is `scripts/generate-docs.ts`.
   ADR-092/093 go in `ADR_GROUPS` ("— Infrastructure —"); the new concept page goes in **both**
   `CONCEPT_ORDER` and the `whyKarmyq` slug array. All 89 ADRs are currently curated there, and
   `doc-context-drift-gate.test.ts` fails on any concept page missing from nav — so skipping this
   step breaks an existing gate.
7. **`npm test` regenerates the landing docs.** The prebuild runs `generate-docs`, which rewrites
   `apps/landing/src/data/docs/`. Expect timestamp/HEAD-sha churn; commit the intended ADR/concept
   additions and revert the incidental churn (memory: `feedback_npm_test_regenerates_landing_docs`).
8. **The manifest list is discovered, not hand-written.** Globbing `services/*`, `apps/*`,
   `packages/*` plus the four root manifests means a new workspace cannot appear unlicensed and pass.
   A hand-written shadow list is exactly the false-green pattern CLAUDE.md Discipline 5 forbids.
9. **`CONTRIBUTING.md:52` and `apps/mobile/README.md:363` are not in the arc design.** They were
   found during planning. `CONTRIBUTING.md` is the live contributor agreement and is the most
   legally consequential MIT statement in the repository — it is not optional scope.
10. **The shields.io badge escapes hyphens.** `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue` in the badge URL. The gate must un-escape before comparing,
    and the rendered badge should be eyeballed once.
11. **`git add` CLAUDE.md carefully on Windows** — it is tracked lowercase as `claude.md`
    (memory: `feedback_git_add_windows`).
12. **No docs-only push to master.** Everything lands in the one PR; a post-merge docs push triggers
    a second deploy and 502s the demo.

---

## Definition of Done

- [ ] `LICENSE` at repo root, verbatim AGPL-3.0, copyright `Ravi Chavali`
- [ ] All 18 manifests declare `"license": "AGPL-3.0-or-later"`
- [ ] All 6 claim sites agree; both nonexistent-`LICENSE` links resolve
- [ ] `gh repo view --json licenseInfo` no longer returns `null`
- [ ] Gate in `tests/regression/`, **observed red on a real flip and green after revert**, both
      outputs in the PR
- [ ] ADR-092 + ADR-093 written, indexed, and wired into `ADR_GROUPS`
- [ ] `docs/concepts/open-source-and-agpl.md` renders on the landing site with a nav entry
- [ ] CLAUDE.md says 12 live + 1 reserved
- [ ] `npm test` green · `npm run feedback:check` clean · `/simplify`, `/code-review`,
      `/security-review` run on the diff
- [ ] Deployed to demo, smoke-tested, handoff reconciled against real state
