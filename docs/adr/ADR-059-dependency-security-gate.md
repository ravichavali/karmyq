# ADR-059: Dependency Vulnerability Remediation + Blocking CI Security Gate

**Status**: Implemented
**Date**: 2026-05-30
**Sprint**: 75

---

## Context

A routine audit surfaced **31 `npm audit` vulnerabilities** (6 high, 25 moderate) across the single root `package-lock.json` (npm workspaces; no separate mobile lockfile), corresponding to ~13–25 open Dependabot alerts depending on how they dedupe. The vulnerable packages fell into three groups:

1. **Root-tree transitive deps** reachable from direct root dependencies — `qs` (express), `ip-address` (express-rate-limit), `uuid` (bull, node-cron), `fast-uri`.
2. **One direct dependency** — `axios@1.15.2` (high).
3. **Workspace-nested transitive deps** buried in the `apps/*` trees — `tar`, `@xmldom/xmldom`, `node-forge`, `picomatch` (all via **expo** in `apps/mobile`); `postcss`/`next` (build-time CSS in `apps/frontend` + `apps/landing`); `ws`/`engine.io` (via **jsdom**, test-only in `apps/frontend`).

The CI `security:` job had been **capped at `--audit-level=critical`** with an explicit comment that "high vulns in expo@54 are unfixable until SDK upgrade." That cap let dependency debt silently reaccumulate. This sprint's mandate: drive the count to **zero** and convert the cap into a **blocking `--audit-level=high` gate** with an SLA, so debt can never silently return.

### Options Considered

1. **Expo SDK upgrade** to clear the expo-chain highs at the source — large, risky, out of scope; deferred.
2. **`npm audit fix --force`** — rejected: it installs `next@9.3.3` (a catastrophic framework downgrade) and other breaking majors.
3. **Patch-at-the-leaf via root `overrides` + direct bump for `axios`** — chosen. Force-resolve patched leaf versions so the `expo-* depends on a vulnerable …` parent alerts auto-clear without touching the expo SDK major.

---

## Decision

### 1. Remediation: overrides-at-the-leaf + one direct bump

- **`axios`** (direct) bumped `1.15.2` → `^1.16.0`.
- **Root `overrides`** extended (keeping the pre-existing `tar`/`minimatch`/`react`/`react-dom` entries) with patched leaf versions: `@xmldom/xmldom ^0.8.13`, `node-forge >=1.4.0`, `fast-uri >=3.1.2`, `qs >=6.15.2`, `ip-address >=10.1.1`, `postcss ^8.5.10`, plus **surgical version-range overrides** for packages where the patched version is a major bump beyond the narrow vulnerable range (avoids dragging unrelated lower-major copies up): `picomatch@3.0.0 - 3.0.1`, `ws@8.0.0 - 8.20.0`, `brace-expansion@5.0.2 - 5.0.5`, and a parent-scoped `jsdom → ws` override.

### 2. The blocking gate

The CI `security:` job now runs:

```yaml
- name: Run npm audit (blocking — no high/critical vulns; see ADR-059)
  run: npm audit --package-lock-only --audit-level=high
```

No build passes with an unaddressed **high or critical** dependency vulnerability. `--package-lock-only` keeps it fast and deterministic.

### 3. The SLA (standing policy)

- No **high or critical** vulnerability (dependency or code-scanning) open longer than **1 week**.
- No vulnerability of **any** severity open longer than **2 weeks**.
- The gate blocks at `high`; moderates/lows are tracked to zero under the 2-week clause but do not block a hotfix.

### Version

`10.3.0` → `10.4.0` (minor — ships a behavioral CI gate).

---

## Implementation Notes (hard-won)

These are recorded because they cost real debugging time and will recur:

1. **npm overrides do not reach `apps/*` workspace subtrees on an incremental install.** `npm install` against the existing lockfile applies overrides to the **root** workspace tree (uuid/qs/ip-address/fast-uri cleared) but leaves the expo/next/jsdom subtree leaves untouched (14 residual vulns). Only a **from-scratch lockfile regen** (`rm package-lock.json && rm -rf **/node_modules && npm install`) applies every override and reaches zero. The trade-off: a from-scratch regen **re-floats every `^`/`~` dependency** to its newest satisfying version (~302 packages changed). This was a deliberate, owner-approved decision for this sprint, not an accident.
2. **`uuid` must be capped at `^11.1.1`, not `>=11.1.1`.** The vulnerability is fixed at exactly `11.1.1`, but `>=` resolves to `uuid@14`, which is **ESM-only for Node** (no `require` export condition) and breaks `bull`'s `require('uuid')` under Jest (`SyntaxError: Unexpected token 'export'`). `uuid@11.1.1` ships a proper CJS build. Verified: node-cron schedules fire and the full suite passes under 11.1.1.
3. **`tar` needs an exact-version override (`"tar": "7.5.15"`), not a range.** A range override left `apps/mobile`'s `@expo/cli` copy at the vulnerable `7.5.7`; a parent-scoped nested override caused npm to *drop* tar entirely. Exact-version forces the hoisted, patched copy everywhere.
4. **`@swc/helpers` must be pinned (`"@swc/helpers": "0.5.15"`).** A from-scratch regen under Node 24 silently drops it, breaking `next build` with `Cannot find module '@swc/helpers/_/_interop_require_default'`. The pin forces npm to materialize the node.
5. **`ts-jest` is pinned to `29.4.6`.** The re-float bumped it to `29.4.11`, which changed how its inline-`tsconfig` object merges with the project tsconfig — dropping `moduleResolution: node16` and breaking `@karmyq/shared/schemas/ui` subpath resolution in `request-service` tests (TS2307).
6. **`apps/mobile` type-check was already red on master** (pre-existing `FlatList`/`refreshControl` overload errors) and is **not** in the CI gate. The expo-internal version churn from the re-float lands in that already-broken, non-web-deployed workspace and does not regress any gated check.

### 2026-07-21 advisory refresh (v11.30.1)

New registry disclosures blocked the standing gate with seven high and one critical finding. The
follow-up hotfix retained the leaf-override strategy and again rejected `npm audit fix --force`:

- direct Axios consumers now require `^1.18.1`;
- exact/surgical overrides move `tar` to `7.5.21`, `brace-expansion` to `5.0.7`, `body-parser` to
  `1.20.6`, `shell-quote` to `1.10.0`, `js-yaml` to `4.3.0`, and `fast-uri` to `4.1.1`;
- Next.js remains on 15.5, while its optional image-processing leaf is overridden to
  `sharp@0.35.3`; because that release requires Node 20.9+, only the frontend build/runtime images
  move from Node 18 Alpine to Node 20 Alpine and declare the matching engine floor.

`npm audit --audit-level=high` returns zero vulnerabilities after the lockfile refresh. The Sharp
override is intentionally compatibility-tested through the frontend production build and Docker
build gate rather than accepting npm's suggested breaking Next.js downgrade.

---

## Consequences

**Positive**

- Zero high/critical/moderate/low `npm audit` vulnerabilities at v10.4.0.
- Dependency debt can no longer silently reaccumulate — the gate fails the build.
- No expo SDK upgrade required; the web demo's shipped backend + frontend + landing runtimes are unaffected by the leaf overrides.

**Negative / costs**

- **Override maintenance burden.** Each override is a manual pin that must be revisited as the ecosystem moves; a too-low cap (e.g. `uuid ^11`) blocks legitimate future majors until reviewed.
- **Large lockfile churn.** Reaching zero required a from-scratch regen that re-floated ~302 transitive packages. Future remediations should prefer the smallest diff that clears the gate (`high`) and only re-float when zeroing moderates is explicitly in scope.
- **Emergency escape.** If the gate blocks a genuine hotfix, `git push --no-verify` (local) bypasses it; CI remains the backstop. Use only to unblock, then remediate within the SLA.

**Relationship to other gates**

This is the **dependency** half of the standing security posture. Code scanning (CodeQL) is a distinct alert class with its own gate under **ADR-060** (Sprint 76). `/security-review` remains the human-level complement to both automated gates, not a replacement.

---

## Alternatives Rejected

- **Expo SDK 54 → 55/56 upgrade** — clears the expo-chain highs at the source but is a large, breaking change; deferred to a dedicated sprint.
- **`npm audit fix --force`** — installs `next@9.3.3` and other breaking downgrades.
- **Leaving the gate at `critical`** — the status quo that allowed the debt; rejected.
