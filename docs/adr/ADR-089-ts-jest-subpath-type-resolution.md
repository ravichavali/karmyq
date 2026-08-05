# ADR-089: ts-jest Cannot Read `exports` Maps — `typesVersions` Is the Contract

**Status**: Implemented
**Date**: 2026-08-04
**Sprint**: 122
**Version**: 11.39.0
**Deciders**: Development Team
**Related**: ADR-029 (TDD Test Framework), ADR-088 (Test-Tier Truthfulness), Sprint 122 PR 4

## Context

`@karmyq/shared` publishes its public surface through an `exports` map with subpaths
(`@karmyq/shared/matching/types`, `@karmyq/shared/schemas/ui`, and 17 more). Node's runtime
resolver reads `exports`. TypeScript reads it **only** under `moduleResolution: node16`,
`nodenext` or `bundler` — never under `node10`.

**ts-jest forces `moduleResolution: node10` whenever it forces `module: commonjs`, in every 29.x
release.** In 29.4.6 this was a hardcoded assignment in
`fixupCompilerOptionsForModuleKind`. In 29.4.11+ (upstream issue #4198) it became
`resolveCompatibleModuleResolution(forcedModule, userResolution)`, which maps a user-supplied
`Node16`/`NodeNext` to `Bundler` *only if* the forced module kind is bundler-compatible — and
`CommonJS` never is. Both paths land on `node10`. Measured on this repo's
`services/request-service` (the one workspace whose tsconfig uses `module: node16`), both versions
produce `module: CommonJS, moduleResolution: Node10`.

Consequence: **no tsconfig setting can make ts-jest's CommonJS path read an `exports` map.**
Setting `node16` is substituted away; setting `bundler` is substituted away. This is not a bug to
wait out — it is ts-jest's deliberate contract.

### Why this was mis-diagnosed once already

Sprint 122 PR 3 recorded the cause as the root `jest.config.js` passing an **inline `tsconfig`
object**, said to stop ts-jest 29.4.11+ reading the workspace `tsconfig.json`, and concluded the
fix was to point ts-jest at each workspace's real config. PR 4 disproved **both halves** by
measurement:

- With the real `tsconfig.json` path in place, ts-jest 29.4.12 **still** failed with the identical
  `TS2307: Cannot find module '@karmyq/shared/matching/types'`. With `typesVersions` added and the
  inline object deliberately restored, the suite passed. The inline object was never the cause.
- The premise itself is false. Instantiating ts-jest 29.4.12's `ConfigSet` with an inline object
  reports `tsconfigFilePath: apps/landing/tsconfig.json` and inherits `strict: true`,
  `target: ES5`, `isolatedModules: true` — **identical** to supplying a path. ts-jest still locates
  the workspace config via `ts.findConfigFile(rootDir)` and merges the inline object on top of it.

Because the second point removes any behavioural difference, PR 4 **reverted** its own
inline-object-to-path change rather than ship a config churn justified by a defect that does not
exist. The transforms remain as they were on master.

The misleading signal was that request-service's suites *passed* on 29.4.6 under `node10`, which
`node10` structurally cannot do for an `exports`-only subpath. That pass came from a module
resolution cache built before the option fixup applied — an accident. **A green result the
mechanism cannot account for is evidence of a hidden variable, not evidence of health.**

## Decision

**`packages/shared` declares `typesVersions` mirroring its `exports` map, entry for entry, and the
two are held identical by a blocking test.**

`typesVersions` is the pre-`exports` type-resolution mechanism, and `node10` resolution honours it.
It affects **type** resolution only — Node still resolves the runtime entry points through
`exports` — which is precisely why `require.resolve()` succeeded throughout the period the type
checker was failing.

The map is **derived from `exports` and parity-enforced**: its committed form is literal JSON, and
`packages/shared/src/__tests__/exportsTypesVersionsParity.test.ts` asserts whole-map equality
against `exports` plus on-disk existence of every file both maps name. There is deliberately no
build-time generator — the test is the mechanism that keeps them identical, and it fails on a
missing subpath, an extra one, or a subpath pointed at the wrong file.

### `typesVersions` points at SOURCE, not `dist` — this matters

Each entry maps a subpath to the **`.ts` source** its declaration is built from
(`matching/types` → `src/matching/types.ts`), not to `dist/**/*.d.ts`.

The first version of this ADR pointed at `dist`, and CI rejected it: `Lint & Type Check` runs
`tsc --noEmit` on consumers **without building `packages/shared` first**, and
`services/auth-service` failed with 13 × `TS2307`. Consumers on `moduleResolution: node` had always
resolved these subpaths by plain directory traversal straight to shared's source; `typesVersions`
takes precedence over that traversal, so pointing it at an unbuilt `dist` broke resolution that had
previously worked with no build at all.

That is also the asymmetry that made the original ts-jest bug look selective: the flat-layout
subpaths (`utils/`, `middleware/`) have source at the path the specifier implies, so node10 found
them; the `src/`-nested ones (`matching/types`, `schemas/ui`) do not, so node10 failed only there.

Pointing at source removes the build dependency from **type** resolution entirely — a consumer
type-checks identically whether or not shared has been built. `exports` still points at `dist` for
**runtime**, which is correct and unchanged.

⚠️ **The parity gate could not have caught this.** It lives in `packages/shared`, whose
`test` task dependsOn its own `build`, so `dist/` always exists in that suite — the gate's own
build guarantee hid a property about what *other* workspaces see. It now asserts source existence
explicitly, and carries an injection for the dist-pointing regression itself.

### Rejected alternatives

| Alternative | Why not |
|---|---|
| Pin `ts-jest` at 29.4.6 (status quo) | An override is a decaying floor, not a fix. It also blocks every future ts-jest security patch, and the behaviour it depends on is an accident, not a guarantee. |
| `paths` in each consumer's tsconfig | Works, but needs an edit in every consuming workspace and must be re-synced by hand whenever a subpath is added. `typesVersions` is one edit that fixes all consumers at once. |
| `moduleResolution: bundler`/`node16` in a `tsconfig.jest.json` | Impossible — both are substituted to `node10` alongside the `module: commonjs` ts-jest forces. Verified, not assumed. |
| Drop the `exports` map, publish a flat `dist` | Throws away encapsulation of internals for a test-tooling limitation. |
| Silence the diagnostic (`diagnostics: false`, ignore TS2307) | Turns a real type error into a green run — the exact defect class ADR-088 exists to prevent. |

## Consequences

### Positive

- ts-jest is **unpinned**: the root `overrides` entry is deleted and every workspace declares
  `^29.4.12`. Security patches can land normally.
- Every consumer's tests type-check subpath imports correctly, under any ts-jest 29.x.
- Adding a subpath to `exports` without adding it to `typesVersions` now fails a blocking test
  immediately, rather than surfacing later as a confusing `TS2307` in an unrelated workspace.
- The parity gate caught three `./api/*` exports that had pointed at files excluded from the build
  since 2026-01-23 (`11ebb6a4`) — broken public surface with zero importers, removed here.

### Negative / limits

- `typesVersions` duplicates information already in `exports`. Mitigated by deriving it from
  `exports` and asserting equality, but it is still two places on disk.
- The mechanism is a TypeScript compatibility shim. If ts-jest ever adopts exports-aware
  resolution on the CommonJS path, `typesVersions` becomes redundant — harmless, but worth
  revisiting at the TypeScript 7 step (see `docs/IDEAS.md`, the "platform floor" arc).
- This says nothing about runtime resolution, which was never broken.

## Implementation

- `packages/shared/package.json` — `typesVersions` added (19 subpaths); dead `./api/client`,
  `./api/mobile-storage`, `./api/web-storage` exports removed.
- `packages/shared/src/__tests__/exportsTypesVersionsParity.test.ts` — parity + on-disk gate.
- Root `overrides."ts-jest": "29.4.6"` deleted. The nine workspaces that already declared ts-jest
  were normalised to `^29.4.12`, and `cleanup-service` and `simulation-service` gained the
  declaration they had been getting via root hoisting — **eleven** declaring workspaces in the
  final tree.
- `tests/regression/sprint-122-jest-toolchain-gate.test.ts` — blocks re-drift for **both** `jest`
  and `ts-jest`: the roster of workspaces whose resolved config compiles through ts-jest (including
  the five that inherit it by spreading the root config and name it nowhere themselves), that each
  declares it, and that each resolves the major it declares from its own directory.
