# Sprint 76: Code Scanning Remediation + Supply-Chain Hardening — READY TO EXECUTE

## Handoff Document

**Date**: 2026-05-30
**Current Version**: v10.4.0 (shipped) → v10.5.0 (this sprint)
**Status**: 📋 Sprint 76 planned — spec + plan written, ready to execute. Upgrade CodeQL coverage (security-extended + remote_and_local), triage the re-scanned alert set → 0, activate blocking code-scanning gate (ADR-060), fold in supply-chain & secrets hardening — ignore-scripts, npm ci, audit signatures, OSV-Scanner, dependabot.yml, secret-scanning toggles (ADR-061).

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-76-code-scanning`
3. Open plan: `docs/superpowers/plans/2026-05-30-sprint-76-code-scanning.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Drive the **15 open CodeQL alerts to zero** (fix 2 real ones, dismiss 13 false-positive/won't-fix with written justifications), activate a **blocking code-scanning CI gate** (ADR-060), and fold in **3 supply-chain hardening quick wins** (ADR-061) — shipping **v10.5.0**.

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-30-sprint-76-code-scanning-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-30-sprint-76-code-scanning.md`

---

## Decisions made this planning session

1. **Scope**: CodeQL remediation + ADR-060 gate **PLUS** supply-chain & secrets hardening → ADR-061. (Security-themed sprint; cohesive fit.)
2. **SSRF (10 critical)**: harden the cheap unencoded cases (`encodeURIComponent`, esp. `api.ts:803` raw axios) **then dismiss all 10** as false-positive with justification (fixed host, path-only taint).
3. **Version**: 10.4.0 → **10.5.0** (minor — ships a new behavioral CI gate, mirroring Sprint 75's 10.3.0→10.4.0).
4. **Scanner hardening folded in** (answer to "does default give unrealistic assurance?" — yes): bump CodeQL to **`security-extended` + `remote_and_local`** (was the conservative `default`/`remote` → partial coverage); add **OSV-Scanner** CI step + **`.github/dependabot.yml`** (grouped, review-gated, no auto-merge); enable **secret-scanning validity checks + non-provider patterns** (were disabled). Recommend the **Socket GitHub App** for behavioral malicious-package detection.
5. **Gate workflow**: keep **direct-push-to-master** + best-effort poll-gate for now. The stronger PR-based native severity gate is recorded as a future option in ADR-060, NOT adopted this sprint.
6. **Secret scanning + push protection are ALREADY enabled** — don't "add" them; only the two sub-toggles are off.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **73** | Request Service Simplification | ✅ Complete + deployed |
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **75** | Dependency Vuln Remediation + CI security gate (ADR-059) | ✅ Complete + deployed (v10.4.0) |
| **76** | Code Scanning Remediation (ADR-060) + Supply-Chain Hardening (ADR-061) | 📋 Planned — execute now (v10.5.0) |
| **77** | Trust Graph Viz Polish + Depth | Upcoming (scope preserved below) |
| **TBD** | Supply-Chain Hardening remainder (items 4–5) | Backlog (below) |

---

## The 15 alerts — triage reference (BASELINE before the suite upgrade; expect more after Task 1b)

| # | Sev | Rule | Location | Disposition |
|---|-----|------|----------|-------------|
| 82,83,84,92,93,94,98 | crit | request-forgery | `api.ts:341–360` | dismiss:false-positive (fixed host, path-only taint) |
| 86,97,119 | crit | request-forgery | `api.ts:803,825,828` | **harden** (encode) + dismiss:false-positive |
| 88 | high | xss-through-dom | `Movement.tsx:11` | **fix** (`encodeURIComponent(email)` in mailto) |
| 89,90 | high | xss-through-dom | `communities/index.tsx:432-433` | dismiss:false-positive (relative href, React-escaped) |
| 117 | high | insecure-randomness | `dibs-workflow.ts:22-23` | dismiss:won't-fix (sim engine, non-security) |
| 118 | high | insecure-randomness | `api-client.ts:431` | dismiss:won't-fix (sim engine, non-security) |

**Net code change: ~2 small edits.** Everything else is a documented API dismissal.

---

## ⚠️ Critical Implementation Notes (copied from spec)

1. **CodeQL is GitHub default setup — there is NO committed `codeql.yml`.** Do NOT add an advanced-setup workflow (it conflicts with default setup). The gate is a **CI job that queries the code-scanning alerts API**, parallel to ADR-059's `security:` job.
2. **Gate timing / fail decision:** default-setup analysis is async. Poll for an analysis on the pushed SHA (bounded timeout). Analysis shows open critical/high → **fail**; no analysis within timeout → warn + **pass** (fail-open on *missing analysis* only, never on present findings). Document in ADR-060.
3. **Dismissals use the API, not code:** `gh api -X PATCH .../code-scanning/alerts/{n} -f state=dismissed -f dismissed_reason=... -f dismissed_comment='<justification>'`. Gate can't go green until 13 dismissals + 2 fixes done.
4. **`encodeURIComponent` may not auto-clear the SSRF alerts** — CodeQL doesn't always treat path-encoding as a sanitizer. Harden anyway (correct); expect to still dismiss with justification.
5. **`ignore-scripts=true` breaks auto hook-install.** Root `postinstall` runs `scripts/install-hooks.sh`; a clean `npm ci` will NOT install hooks after this change. Verify `npm run hooks:install` standalone + update CLAUDE.md + README + GITHUB_ACTIONS_SETUP.md.
6. **Upgrade CodeQL suite FIRST (Task 1b), then re-scan, then triage.** `security-extended` + `remote_and_local` will surface NEW alerts — triage the *extended* set, not the stale 15. Gate can't flip until the extended board is at zero.
7. **Can't flip the gate to blocking until the board is at zero** — upgrade suite → re-scan → triage/fix/dismiss the full set → confirm 0 open crit/high → enable gate → negative-test it.
8. **OSV-Scanner is advisory-based** (broadens CVE coverage past npm audit, won't catch a brand-new malicious package); **Socket App** is the behavioral complement (console install). **dependabot.yml: grouped, review-gated, NO auto-merge.**
9. **CodeQL config + secret-scanning toggles are `gh api -X PATCH` settings, not files** — ADR-060/061 are their durable record.
10. **ADR numbering:** 060 = code-scanning gate (+ CodeQL config upgrades), 061 = supply-chain & secrets hardening. 059 stays dependency-only.
8. **Landing docs dir is `.gitignore`d** — `git add -f`. **nav.json revert bug** — grep-verify after generate-docs; re-apply if reverted.
9. **Version bump 10.4.0 → 10.5.0** in root `package.json`.
10. **`e2e-tests.yml` is the only remaining `npm install`** (lines 26, 50) → `npm ci`.

---

## Supply-chain & secrets hardening (ADR-061)

**Install-script & lockfile:**
1. **`ignore-scripts=true` in `.npmrc`** — removes the worm execution vector (lifecycle scripts). Tradeoff: hooks now install via explicit `npm run hooks:install` (see note #5).
2. **`e2e-tests.yml`: `npm install` → `npm ci`** (lines 26, 50) — last non-deterministic install in CI.
3. **`npm audit signatures` step in CI** — verifies registry provenance on the installed tree.

**Detective + process:**
4. **OSV-Scanner CI step** — broader advisory DB than npm audit (committed step, no App, fits direct-push). Non-blocking first. Socket App recommended as behavioral complement.
5. **`.github/dependabot.yml`** — grouped, review-gated security+version PRs; **no auto-merge**.
6. **Secret-scanning toggles** — enable validity checks + non-provider patterns (currently disabled).

Backlog remainder (NOT this sprint): CI token hygiene (short-lived, narrow-scope); keep dependabot PRs human-reviewed (auto-merge = ingestion path).

---

## Deferred — Trust Graph Viz Polish + Depth (Sprint 77)

User feedback after Sprint 74 deployed (preserve verbatim):
- **Community + Split (HEB) views land well** — keep the graphical, structure-first approach.
- **Both ego/relationship views need rework** — My Network radial (concentric) AND dashboard "Your Network" (force-directed aggregate). Unify onto the same graphical, clustered, structure-revealing style as Community/Split. Radial fails to "tell the story of connectivity" — it double-encodes trust score (ring distance + dot size) while hiding who-connects-to-whom.
- **Dot size**: default **uniform** — size shouldn't carry meaning by default. Emphasize only the current user. Color for categorical signal (cluster/community), amber for your edges. Encode importance via position/centrality, not size.
- **Fix sizing/scoring inconsistency**: Community view trust_score = `SUM(current_weight)` (decayed) in `getFullCommunityGraph`, but ego `getTrustGraph` uses `SUM(raw_weight)` (undecayed). Make the metric consistent across views.
- Then original Depth scope: inter-community zoom view (communities as nodes) + fission edge differentiation.
- Follow UI-research-first: layout audit + reference products before implementation.

---

## Pre-Existing TDD Failures (do NOT fix)

Untouched, pre-date this sprint:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

A NEW failure during this sprint is a real regression — resolve it, don't wave it off as pre-existing.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: 059 = dependency gate. **060 = code-scanning gate + CodeQL config upgrades (this sprint). 061 = supply-chain & secrets hardening (this sprint).**
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — add slugs to `GUIDE_ORDER` + `GUIDE_LABELS` + `GUIDE_SLUGS` in `scripts/generate-docs.ts`; run from `apps/landing/` (`npm run generate-docs`), not root; grep-verify after
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it. Write `trust_edges`, read `trust_edges_live`
- **Root package.json version**: 10.4.0 (→ 10.5.0 this sprint)
- **Existing root `overrides`**: `tar`, `minimatch`, `react`, `react-dom`, `axios`, `uuid`, etc. — extend, don't replace
- **CI security job** (`.github/workflows/ci.yml` `security:`): `npm audit --package-lock-only --audit-level=high` (ADR-059, blocking). The new code-scanning gate is a SEPARATE job.
