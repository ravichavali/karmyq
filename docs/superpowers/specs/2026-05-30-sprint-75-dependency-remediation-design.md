# Sprint 75: Dependency Vulnerability Remediation — Design Spec

**Date**: 2026-05-30
**Status**: Approved
**Version**: v10.3.0 → v10.4.0
**Sprint Branch**: `feature/sprint-75-dependency-remediation`

---

## Overview

The demo repo has accumulated **25 open Dependabot alerts** on `master` (16 high, 8 moderate, 1 low), all surfacing through the single root `package-lock.json`. They are exactly the kind of transitive tech debt that silently grows until a reviewer can no longer tell signal from noise. This sprint clears all 25 to zero and — critically — wires a **blocking security gate into CI** so the count can never silently climb again.

The remediation is not "run `npm audit fix` and hope." Two packages — `postcss` (moderate) and `uuid` (moderate) — are entangled with the `expo@54`, `next`, and `bull`/`node-cron` dependency trees, where a naive `npm audit fix --force` would downgrade `next` to v9 and `node-cron` to v4 (both breaking). The correct instrument is npm **`overrides`**: forcing the *leaf* vulnerable packages to patched versions resolves them in place, which in turn clears every `expo-* depends on vulnerable versions of …` parent alert automatically — no expo SDK upgrade required.

The sprint ends by raising the existing CI audit step from `--audit-level=critical` to `--audit-level=high` (currently capped at critical *because* of the expo highs we are now eliminating), codifying the gate and its SLA as **ADR-059**, and updating the CI/CD and landing service docs.

### Core Principle: Fix the leaves, gate the tree

Patch transitive vulnerabilities at the leaf via `overrides` rather than downgrading top-level frameworks — then make CI enforce a zero-high baseline so the debt cannot reaccumulate.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **73** | Request Service Simplification | ✅ Complete + deployed |
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **75** | Dependency Vulnerability Remediation + CI security gate | ⬅ This sprint |
| **76** | Trust Graph Viz Polish + Depth (deferred from pre-75 plan) | Upcoming |

> Note: the previously-planned "Sprint 75 — Trust Graph Depth" was deliberately bumped behind this remediation sprint and is now Sprint 76. The viz-polish scope is preserved verbatim in the handoff's "Deferred" section.

---

## New Concepts

### Security Gate (ADR-059)
A blocking CI step that fails the build when any **high or critical** vulnerability is present in the resolved dependency tree, plus a written SLA governing how long any open vulnerability may live.

- **Gate**: `npm audit --package-lock-only --audit-level=high` as a **blocking** job in `.github/workflows/ci.yml` (replaces the current critical-only step).
- **SLA**:
  - No **high** (or critical) vulnerability may remain open longer than **1 week**.
  - No vulnerability of **any** severity may remain open longer than **2 weeks**.
- **Rationale for `--package-lock-only`**: audits the committed lockfile deterministically without a full install, matching the existing step's behavior.

---

## Remediation Map (authoritative — from `npm audit --package-lock-only`)

| Package | Sev | Count | Fix mechanism | Notes |
|---------|-----|-------|---------------|-------|
| `axios` | high/mod/low | 4 | **Direct bump** in root `package.json` `1.15.2` → `^1.16.0` | Direct dep; clears all 4 axios alerts in one move |
| `@xmldom/xmldom` | high | 4 | `overrides` → `>=0.8.13` | Clean `npm audit fix` |
| `node-forge` | high | 4 | `overrides` → `>=1.4.0` | Clean |
| `tar` | high | 3 | Override already `>=7.5.11`; regenerate lockfile | Lockfile predates existing override |
| `fast-uri` | high | 2 | `overrides` → `>=3.1.2` | Clean |
| `picomatch` | high | 2 | `overrides` → `>=3.0.2` | Clean |
| `qs` | mod | 1 | `overrides` → `>=6.15.2` (or via express/body-parser bump) | Under express/body-parser |
| `ws` | mod | 1 | `overrides` → `>=8.20.1` | Multiple subtrees (frontend, expo, engine.io) |
| `ip-address` | mod | 1 | `overrides` → `>=10.1.1` | Under express-rate-limit@8 |
| `brace-expansion` | mod | 1 | `overrides` → `>=5.0.6` | Under expo glob + root |
| `postcss` | mod | 1 | **`overrides` → `^8.5.10`** | ⚠️ Entangled with next + expo metro-config; override avoids next@9 downgrade |
| `uuid` | mod | 1 | **`overrides` → `>=11.1.1`** | ⚠️ Under bull@4 + node-cron@3 + xcode(expo); needs runtime smoke test |

**Total: 25 alerts → 0.**

> Override version targets are minimums; pin to the latest patched release at implementation time and confirm via `npm audit`.

---

## Data Model

None. No schema changes this sprint.

---

## API Endpoints

None. No new or modified endpoints.

---

## Frontend Changes

None functionally. The only frontend-adjacent change is the resolved `postcss`/`axios`/`ws` versions in the lockfile; `apps/frontend` and `apps/landing` must still **build cleanly** (`next build`) after the overrides — this is a verification gate, not a code change.

---

## User Guide & Doc Updates

Even though this is a maintenance sprint, docs ship (mandatory every sprint):

1. **ADR-059** — new ADR documenting the security gate + SLA.
   - `docs/adr/ADR-059-dependency-security-gate.md`
   - Add to `docs/adr/README.md` index.
   - Landing: `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json` + nav.json "Architecture Decisions".
2. **CI/CD reference doc** — update with the new blocking audit step.
   - `docs/GITHUB_ACTIONS_SETUP.md` (or the CI section) — document the gate, the SLA, and the `git push --no-verify` / emergency escape.
3. **Landing service docs** — if a CI/security page exists under `apps/landing/src/data/docs/`, update it; otherwise the ADR concept page is sufficient.
4. **Memory reference** — `reference_cicd_pipeline.md` notes which steps are blocking; update so the audit step is now listed as blocking.

---

## Critical Implementation Notes

1. **`uuid@11` is the riskiest override.** `bull@4.11.5` and `node-cron@3.0.3` historically resolve `uuid@8`. Forcing `uuid@>=11.1.1` globally **must** be verified at runtime, not just at build: enqueue a Bull job (cleanup-service) and confirm a `node-cron` schedule fires. uuid v11 keeps CJS named exports (`require('uuid').v4()`), so bull/node-cron *should* work — but prove it. If it breaks, fall back to bumping `node-cron`→`^4.2.1` (breaking, but isolated) and a scoped `bull` override, documented as the chosen path.

2. **`postcss` must use `overrides`, never `npm audit fix --force`.** `--force` installs `next@9.3.3` — a catastrophic downgrade. An `overrides: { "postcss": "^8.5.10" }` patches it inside both `next` and `@expo/metro-config` without touching `next`'s major version. Confirm `next build` still passes for both `apps/frontend` and `apps/landing`.

3. **Overriding leaves auto-clears expo parents.** Alerts like "expo / expo-asset / @expo/config depends on vulnerable versions of …" disappear once the leaf (`uuid`, `postcss`, `xcode`, `node-forge`, etc.) is patched. Do NOT attempt to bump `expo` itself — the SDK upgrade is explicitly out of scope.

4. **The existing CI audit step is the thing to change, not add.** `.github/workflows/ci.yml` already has a `security:` job running `npm audit --package-lock-only --audit-level=critical` with a comment blaming expo@54 highs. Update *that* step to `--audit-level=high` and fix the comment — do not add a duplicate job.

5. **There is already an `overrides` block** in root `package.json` (`tar`, `minimatch`, `react`, `react-dom`). Extend it — don't replace it. The `tar` override (`>=7.5.11`) already exists but the committed lockfile predates it; regenerating the lockfile is what actually clears the 3 tar alerts.

6. **Single root lockfile, npm workspaces.** There is no separate `apps/mobile/package-lock.json`. All overrides go in the root `package.json` and one `npm install` (or `npm install --package-lock-only`) regenerates the whole tree. Commit the updated `package-lock.json`.

7. **Verify at both `high` and `moderate`.** Target is zero across all 25 (incl. moderates/low). Run `npm audit --package-lock-only --audit-level=moderate` and confirm clean before raising the gate. The gate itself is set to `high` (per ADR SLA — highs block; moderates get a 2-week SLA), but this sprint leaves moderates at zero too.

8. **`git push --no-verify` is the emergency escape** if the gate ever blocks a critical hotfix — document this in the ADR so the gate is enforceable but not a footgun.

9. **Regression risk is broad but shallow.** Overrides touch transitive deps used across all services. The existing `npm test` (unit + regression) suite is the safety net — it MUST pass post-override. Treat any new test failure as an override incompatibility, not a flaky test.
