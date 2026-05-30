# Sprint 75: Dependency Vulnerability Remediation — READY TO EXECUTE

## Handoff Document

**Date**: 2026-05-30
**Current Version**: v10.3.0 → v10.4.0 (this sprint)
**Status**: 📋 Spec + plan written, ready to execute. Sprint 74 (Trust Graph Foundation) complete + deployed.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-75-dependency-remediation`
3. Open plan: `docs/superpowers/plans/2026-05-30-sprint-75-dependency-remediation.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Clear all **25 open Dependabot alerts** (16 high, 8 moderate, 1 low) to zero, then wire a **blocking `npm audit --audit-level=high`** gate into CI — codified as **ADR-059** with an SLA — so dependency debt can never silently reaccumulate.

---

## Multi-Sprint Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **73** | Request Service Simplification | ✅ Complete + deployed |
| **74** | Trust Graph Foundation (HEB + radial) | ✅ Complete + deployed |
| **75** | Dependency Vulnerability Remediation + CI security gate | ⬅ This sprint |
| **76** | Trust Graph Viz Polish + Depth | Upcoming (scope preserved below) |

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

## Deferred — Trust Graph Viz Polish + Depth (now Sprint 76)

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
- **ADR numbering**: Next ADR is **059** (this sprint uses it)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — add new slugs to `GUIDE_ORDER` + `GUIDE_LABELS` + `GUIDE_SLUGS` in `scripts/generate-docs.ts`; run generate-docs from `apps/landing/` (`npm run generate-docs`), not root; grep-verify after
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **Root package.json version**: 10.3.0 (→ 10.4.0 this sprint)
- **Existing root `overrides`**: `tar`, `minimatch`, `react`, `react-dom` — extend, don't replace
