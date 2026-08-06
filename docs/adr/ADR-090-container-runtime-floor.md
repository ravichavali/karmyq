# ADR-090: The Container Runtime Floor Is Node 24, and It Is Enforced

**Status**: Implemented
**Date**: 2026-08-05
**Sprint**: 122
**Version**: 11.40.0
**Deciders**: Development Team
**Related**: ADR-027 (Docker Image Optimization, Deferred), ADR-028 (npm Workspace Docker Build),
ADR-059 (Dependency Security Gate), ADR-088 (Test-Tier Truthfulness), Sprint 122 PR 5

## Context

Dependabot #169 proposed `redis` (node-redis) 4.7.1 → 6.2.0. node-redis 6 declares
`engines.node: ">= 20.0.0"`. Every backend Dockerfile built and ran on **`node:18-alpine`**, and
root `package.json` declared `engines.node: ">=18.0.0"`.

npm does not enforce `engines` unless `engine-strict` is set, and this repo's `.npmrc` does not set
it. So the bump would have installed cleanly, built cleanly, passed CI, deployed cleanly, and put a
package onto a runtime that package declares it does not support. Nothing anywhere compared the two
numbers.

**redis was not the first violation.** Measured against the lockfile while writing the gate for
this ADR: **61 production packages already declared a Node floor above 18** — among them
`@expo/env` (`>=20.12.0`), the `@img/sharp-*` family (`>=20.9.0`) and `react-native-maps`
(`>= 20.19.4`). The images had been out of contract for a long time, silently. Dependabot simply
surfaced the first case where the gap was wide enough to notice.

Two further facts made the situation worse than "an old base image":

1. **Node 18 reached end-of-life on 2025-04-30 — fifteen months before this ADR.** Node 20, which
   `apps/frontend` and `tests/Dockerfile.test` were on, reached EOL on **2026-04-30**, three months
   before it. Both were receiving no security patches. (Dates from nodejs/Release `schedule.json`.)
2. **CI already ran Node 24** (`NODE_VERSION: '24.x'`, with the e2e and test workflows pinning
   `'24'`). So every green check described a runtime the demo never executed. This is the
   ADR-088 defect — a green result that is not evidence about the thing it appears to be about —
   expressed at the platform layer instead of the test layer.

`docs/IDEAS.md` had already recorded this as the first step of a "platform floor" arc
(runtime floor → `@types/node` 26 → TypeScript 7 → ESLint 10), noting that *"nothing above can be
adopted honestly until the runtime moves."* redis 6 turned that from a planned sequence into a
blocker on the PR in hand.

## Decision

**The container runtime floor is Node 24, declared in one place per surface and enforced by a
blocking test.**

1. **Every tracked Dockerfile builds and runs on `node:24-alpine`** — 23 `FROM` lines across 12
   files (11 files × builder + production stage, plus `tests/Dockerfile.test`).
2. **Root `engines.node` is `>=24.0.0`**, matching what the images actually run rather than
   understating it.
3. **`redis` moves to `^6.2.0`**, and `services/messaging-service` — its only importer — now
   **declares it**, having previously imported it while declaring nothing and surviving on the root
   declaration being hoisted.
4. **`tests/regression/sprint-122-runtime-floor-gate.test.ts` blocks** on the property: for every
   non-dev package in `package-lock.json` that declares `engines.node`, the Node major the images
   run is at least that package's minimum major; root `engines.node` states that same number; and
   CI's `NODE_VERSION` is that number too.

### Why Node 24 and not 22

| Major | Status on 2026-08-05 | EOL |
|---|---|---|
| 18 | EOL 15 months | 2025-04-30 |
| 20 | EOL 3 months | 2026-04-30 |
| 22 | Maintenance LTS | 2027-04-30 |
| **24** | **Active LTS** | **2028-04-30** |

Node 22 is a legitimate choice and is deliberately *not* listed as EOL in the gate. We chose 24
because **CI already builds and tests on 24.x**. Shipping 22 would have left the same structural
defect this ADR exists to remove — CI proving things about a runtime the demo does not run — merely
moved one major over. Aligning the container with CI is the point; 24 also buys 32 months of
support instead of 20.

### Why the gate reads the lockfile rather than a built image

The gate must run in every CI job, including ones with no Docker daemon, and `npm ci` is not a
prerequisite for it. `package-lock.json` records `engines` for 1036 of its 1835 entries, which is
enough to evaluate the property statically.

## Consequences

### Positive

- The bump that motivated this ADR is now the *cheapest* possible failure: a red test naming the
  offending package and its range, rather than a silent deploy.
- The 61 pre-existing violations are resolved as a side effect, not left as a separate to-do.
- All three surfaces — image, `engines`, CI — can no longer drift apart, in either direction. The
  gate rejects an understated floor **and** an overstated one.
- Steps 2–4 of the platform-floor arc (`@types/node` 26 → TS 7 → ESLint 10) are unblocked; they
  describe Node 24 APIs and the runtime is now Node 24.
- Node 18 and 20 are receiving no security patches. This removes both.

### Negative

- **Every backend image rebuilds on a new Node major in one deploy.** This is the largest runtime
  change in the sprint and its blast radius is all 9 services plus the frontend. Mitigations: no
  native-compilation dependency is in the production tree (`bcryptjs` and `pg` are pure JS; the
  only install-script packages — `esbuild`, `fsevents`, `msgpackr-extract`, `unrs-resolver` — are
  dev-only, and `.npmrc` sets `ignore-scripts=true` regardless per ADR-061), and CI has been
  running Node 24 for the whole sprint, so the application code is already exercised on it.
- Contributors on Node < 24 will see `EBADENGINE` warnings. That is the intended signal; npm does
  not fail on it without `engine-strict`.
- `services/messaging-service` devDependencies still declare `@types/node: ^20.10.5` while the
  runtime is 24. That is step 2 of the arc (#171) and is deliberately **not** fixed here — see
  "Not decided here".

### Limitations of the gate — stated, not glossed

Per ADR-088, a gate must not claim more than it proves:

- **It compares majors.** A package requiring `>= 24.9.0` passes on any Node 24 image even if that
  image shipped 24.0.0, because the exact patch inside `node:24-alpine` drifts and is unreadable
  without a Docker daemon. A separate assertion fails on any floor that lands *inside* the runtime
  major, forcing that case to a human instead of letting it pass quietly.
- **It reads the lockfile, not a running container.** It cannot see a package installed by
  something other than the workspace install, nor an `engines` field the lockfile omits (799 of
  1835 entries declare none).
- It does not verify that `node:24-alpine` actually resolves to a Node 24 release — that is
  Docker Hub's contract, not ours.

## Alternatives Considered

**Take redis 5 instead of 6** (`engines.node: ">= 18"`, so it fits today's images). Rejected: it
buys one Dependabot cycle and leaves 61 packages still out of contract, two EOL runtimes still
deployed, and CI still testing a runtime we do not ship. It treats the symptom Dependabot happened
to raise rather than the reason it could not be raised safely.

**Bump only `services/messaging-service` to Node 24.** Rejected: the Dockerfiles run
`npm install` at the *workspace root*, so redis 6 lands on disk in all 9 images regardless of which
one imports it. A per-service floor is not a floor, and it makes "what Node does this service run"
a per-file question.

**Set `engine-strict=true` in `.npmrc` instead of writing a gate.** Rejected as insufficient on its
own: it fails the install for the developer who runs it, but says nothing about the *image*, which
is the runtime that actually matters here. It is worth considering as a complement.

**Close #169 with rationale and defer redis to Sprint 123.** Rejected by maintainer decision: the
runtime floor is a prerequisite for three other queued majors, so paying it once here is cheaper
than paying it as a blocker three more times.

## Not decided here

- **`@types/node` 20 → 26 (#171), TypeScript 7 (#168), ESLint 10 (#170).** Steps 2–4 of the
  platform-floor arc. Now unblocked, deliberately not bundled — this PR's blast radius is already
  every deployed image.
- **`.npmrc` `engine-strict`.** Worth a decision; not taken here.
- **ADR-027 and ADR-028 contain `node:18-alpine` in their code samples.** They are historical
  decision records and are left as written; ADR-028's sample is a template for new services, and
  the gate above will fail any new service that copies it verbatim. Superseding that template is
  left to whoever next touches ADR-028.
