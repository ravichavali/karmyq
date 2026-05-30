# Sprint 75: Dependency Vulnerability Remediation — COMPLETE ✅

## Handoff Document

**Date**: 2026-05-30
**Current Version**: v10.4.0 (shipped)
**Status**: ✅ Sprint 75 complete. All 31 npm-audit vulns → 0; blocking CI gate live (ADR-059). Tests 27/27, 4 SDLC gates passed. Deploying via CI/CD. **Next: Sprint 76 (code scanning remediation, ADR-060).**

---

## Sprint 75 Completion Notes

**Shipped (v10.4.0):**
- **0 npm-audit vulnerabilities** (was 31: 6 high, 25 moderate). `axios`→`^1.16.0` (direct); the rest patched at the leaf via root `overrides`.
- **Blocking CI gate**: `security:` job now `npm audit --package-lock-only --audit-level=high` (was `critical`). Codified as **ADR-059** + landing concept page + `GITHUB_ACTIONS_SETUP.md` security section.
- Regression invariant test `tests/regression/sprint-75-security-gate.test.ts` (asserts gate config + axios patched + high/critical=0 — deliberately NOT moderate/low, to match the gate + 2-week SLA).

**Key execution decision (owner-approved):** Reaching 0 required a **from-scratch lockfile regen** (npm overrides don't reach `apps/*` workspace subtrees incrementally), which re-floated ~302 transitive deps. Chose this over the surgical ~15-pkg diff (which left 14 build/test-tooling vulns) per explicit owner choice.

**Re-float fallout fixed (all in `overrides`):** `uuid ^11.1.1` (14 is ESM-only → breaks bull/Jest), `tar 7.5.15` exact (range/nested both failed), `@swc/helpers 0.5.15` (regen drops it → next build fails), `ts-jest 29.4.6` (29.4.11 breaks node16 subpath resolution → TS2307). Full gotcha list: ADR-059 + memory `feedback_npm_workspace_overrides`.

**Not a regression:** `apps/mobile` type-check was already red on master (FlatList overloads) and is not gated; mobile uses Expo Router not @react-navigation.

---

## Quick Start (Sprint 76)

1. Read this handoff + the Sprint 76 preview section below
2. `git checkout master && git pull`
3. `git checkout -b feature/sprint-76-code-scanning`
4. Triage the 15 CodeQL alerts (most SSRF ones are likely false positives — path-only into fixed host)

---

## Sprint Goal

Clear all **25 open Dependabot alerts** (16 high, 8 moderate, 1 low) to zero, then wire a **blocking `npm audit --audit-level=high`** gate into CI — codified as **ADR-059** with an SLA — so dependency debt can never silently reaccumulate.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **73** | Request Service Simplification | ✅ Complete + deployed |
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **75** | Dependency Vulnerability Remediation + CI security gate (ADR-059) | ✅ Complete + deployed (v10.4.0) |
| **76** | Code Scanning Remediation (CodeQL) + code-scanning gate (ADR-060) | Upcoming (scope below) |
| **77** | Trust Graph Viz Polish + Depth | Upcoming (scope preserved below) |
| **TBD** | Supply-Chain Hardening (Shai-Hulud defenses) | Backlog (scope below) |

---

## Spec + Plan

- **Design spec**: `docs/superpowers/specs/2026-05-30-sprint-75-dependency-remediation-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-05-30-sprint-75-dependency-remediation.md`

---

## Decisions made this planning session

1. **Scope**: zero out **all 25** alerts (highs + moderates + low), not just highs.
2. **CI gate + ADR-059 ship THIS sprint** (not deferred).
3. **Version**: 10.3.0 → **10.4.0** (minor — ships a behavioral CI gate).

---

## Remediation strategy (the core of the sprint)

All 25 alerts surface through the **single root `package-lock.json`** (npm workspaces; no separate mobile lockfile).

- **axios** (high/mod/low ×4) → **direct bump** `1.15.2` → `^1.16.0` in root `package.json`.
- **Everything else** → extend the existing root `overrides` block (force-resolve patched leaf versions): `@xmldom/xmldom`, `node-forge`, `fast-uri`, `picomatch`, `qs`, `ws`, `ip-address`, `brace-expansion`, `postcss`, `uuid` (+ existing `tar` override just needs lockfile regen).
- Overriding the **leaf** packages auto-clears every `expo-* depends on vulnerable versions of …` parent alert — **no expo SDK upgrade**.

---

## ⚠️ Critical Implementation Notes (copied from spec)

1. **`uuid@11` is the riskiest override.** `bull@4.11.5` + `node-cron@3.0.3` resolve `uuid@8`. Forcing `uuid@>=11.1.1` globally MUST be verified at runtime (enqueue a Bull job in cleanup-service; confirm a node-cron schedule fires). uuid v11 keeps CJS named exports so it *should* work — prove it. Fallback: bump `node-cron`→`^4.2.1` + scoped bull override, documented.
2. **`postcss` MUST use `overrides`, never `npm audit fix --force`** — `--force` installs `next@9.3.3` (catastrophic downgrade). `overrides: { "postcss": "^8.5.10" }` patches inside next + @expo/metro-config without touching next's major. Confirm `next build` passes for `apps/frontend` AND `apps/landing`.
3. **Overriding leaves auto-clears expo parents** — do NOT bump `expo` itself (SDK upgrade out of scope).
4. **Change the EXISTING CI audit step, don't add a duplicate.** `.github/workflows/ci.yml` `security:` job already runs `npm audit --package-lock-only --audit-level=critical` (capped *because* of expo highs we're now eliminating). Update that step's level + comment.
5. **Extend the existing `overrides` block** (`tar`, `minimatch`, `react`, `react-dom`) — don't replace it. The `tar` override already exists; regenerating the lockfile clears the 3 tar alerts.
6. **Single root lockfile, npm workspaces** — all overrides in root `package.json`; one `npm install` regenerates everything. Commit `package-lock.json`.
7. **Verify at `moderate` too** — target is zero across all 25. `npm audit --package-lock-only --audit-level=moderate` must be clean. Gate itself stays `high` (per SLA).
8. **`git push --no-verify`** is the emergency escape if the gate blocks a hotfix — document in ADR-059.
9. **`npm test` (unit + regression) MUST pass post-override** — it's the safety net for transitive incompatibilities. New failure = override incompatibility, not flaky.

---

## Security Gate / SLA (the standing policy this sprint establishes)

- **Gate**: `npm audit --package-lock-only --audit-level=high` as a **blocking** CI job. No build passes with an unaddressed high or critical.
- **SLA**: no high (or critical) open > **1 week**; no vulnerability of any severity open > **2 weeks**.
- **Documented as ADR-059** (next ADR number) + CI/CD docs + landing concept page.

---

## Sprint 76 preview — Code Scanning Remediation (CodeQL)

Separate from Sprint 75. Decided this planning session: code scanning is a **distinct alert class** with a **separate gate** (branch-protection required status check on the CodeQL workflow, set to fail on critical/high — NOT `npm audit`). Documented under its **own ADR-060** (Sprint 75's ADR-059 stays dependency-only).

**15 open CodeQL alerts as of 2026-05-30:**

| Sev | Rule | Location | Count | Likely disposition |
|-----|------|----------|-------|--------------------|
| critical | `js/request-forgery` (SSRF) | `apps/frontend/src/lib/api.ts` (lines ~341–360, ~803–828) | 10 | **Likely false positives** — path interpolated into a fixed-host baseURL (`process.env.NEXT_PUBLIC_*`); no attacker-controlled host. Triage → dismiss-with-justification and/or `encodeURIComponent` path params |
| high | `js/xss-through-dom` | frontend `communities/index.tsx`, landing `Movement.tsx` | 3 | **Likely real** — fix the DOM sink |
| high | `js/insecure-randomness` | `simulation-service` (`api-client.ts`, `dibs-workflow.ts`) | 2 | Dismissible — `Math.random()` in a sim engine, not security-sensitive |

**Approach**: triage-first (this is mostly a judgment exercise, not a rewrite). Per-alert: fix real ones, dismiss false positives with a written reason. Then activate the **blocking** CodeQL gate (can't flip to blocking until all 15 are resolved/dismissed — same discipline as the dependency gate). ADR-060 + CI/CD doc + landing concept page.

---

## Backlog — Supply-Chain Hardening (Shai-Hulud defenses)

Distinct from ADR-059 (which gates **known-CVE** deps). Shai-Hulud-style worms ship via **malicious install scripts** in compromised package versions → steal tokens → self-propagate. Current posture: committed lockfile + integrity hashes + `npm ci` in `ci.yml`/`test.yml` are the main defenses. Gaps to close (highest leverage first):

1. **`ignore-scripts=true` in `.npmrc`** — lifecycle scripts currently run unguarded (root `postinstall` → `install-hooks.sh`); this is the worm's execution vector. Set globally, run trusted scripts explicitly (or at minimum `--ignore-scripts` on CI installs + allowlist packages that legitimately need build scripts).
2. **`e2e-tests.yml` uses `npm install`, not `npm ci`** (lines ~26/50) — can drift to a newer (poisoned) version. Switch to `npm ci`.
3. **Add `npm audit signatures` to CI** — verifies registry/provenance signatures on the installed tree.
4. **No `.github/dependabot.yml`** — keep Dependabot PRs review-gated (never auto-merge, which would be an ingestion path).
5. **Token hygiene** — short-lived, narrowly-scoped CI tokens; no long-lived `NPM_TOKEN` in env unless publishing (limits the exfiltration/propagation payoff).

Items 1–3 are the quick wins. Could fold into Sprint 76 (security-themed) or stand alone.

---

## Deferred — Trust Graph Viz Polish + Depth (now Sprint 77)

User feedback after seeing Sprint 74 deployed (preserve verbatim for next sprint):
- **Community + Split (HEB) views land well** — keep the graphical, structure-first approach.
- **Both ego/relationship views need rework** — the My Network radial (concentric) AND the dashboard "Your Network" (force-directed aggregate). Unify them onto the same graphical, clustered, structure-revealing style as Community/Split. The radial view fails to "tell the story of connectivity" because it double-encodes trust score (ring distance + dot size) while hiding who-connects-to-whom.
- **Dot size**: default to **uniform** — size shouldn't carry meaning by default. Emphasize only the current user. Use color for categorical signal (cluster/community), amber for your edges. Encode "importance" via position/centrality, not size.
- **Fix sizing/scoring inconsistency**: Community view trust_score = `SUM(current_weight)` (decayed) in `getFullCommunityGraph`, but ego `getTrustGraph` uses `SUM(raw_weight)` (undecayed). Make the metric consistent across views.
- Then original Depth scope: inter-community zoom view (communities as nodes, zoom in) + fission edge differentiation.
- Follow UI-research-first: layout audit + reference products before implementation.

---

## Pre-Existing TDD Failures (do NOT fix)

Untouched from before this sprint:
- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `admin-schemas-api.test.ts` (request-service)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
- `social-graph-service/tests/tdd/sprint-66-trust-graph-visualization.test.ts`
- `social-graph-service/tests/tdd/sprint-67-ego-network.test.ts`
- `social-graph-service/tests/tdd/sprint-68-halflife.test.ts`

If `npm test` surfaces a NEW failure post-override, it's an override incompatibility (Critical Note #9), not pre-existing — resolve it.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: **059** = dependency security gate (Sprint 75, this sprint). **060** reserved = code-scanning gate (Sprint 76).
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — add new slugs to `GUIDE_ORDER` + `GUIDE_LABELS` + `GUIDE_SLUGS` in `scripts/generate-docs.ts`; run generate-docs from `apps/landing/` (`npm run generate-docs`), not root; grep-verify after
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **Root package.json version**: 10.3.0 (→ 10.4.0 this sprint)
- **Existing root `overrides`**: `tar`, `minimatch`, `react`, `react-dom` — extend, don't replace
