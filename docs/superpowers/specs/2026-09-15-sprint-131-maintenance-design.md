# Sprint 131: Maintenance Backlog — Design Spec

**Date**: 2026-09-15

**Status**: Revised for execution; PR C rollout requires a later maintainer decision

**Verified baseline**: `origin/master` `9fae79f461a909a7337859825f57c678a990d1bc`, root version `11.55.0`

**Planning / PR A branch**: `agent/codex/sprint-131-maintenance`

## Overview

Address BUG-045 (expected missing community config), BUG-034 (messaging-service test coverage), BUG-036 (Docker readiness), and the seven Dependabot major upgrades #224–#230. Plan BUG-033 separately: discovery and impact measurement may proceed, but the maintainer has deferred approval to enable broad test promotion.

No schema or API contract changes are planned. Each release uses one branch and one PR, followed by deployment and health verification. Keep the seven major upgrades separate because their runtime, framework, scheduling, and module-format risks differ.

### Core principle: verification must execute the behavior it claims to prove

A red run must fail an assertion in a discovered test. A green run must execute the intended tests. Fixture-only tests and empty suites cannot substitute for evidence from the actual workspace.

## Decisions and scope

| Decision | Owner / state |
|---|---|
| Planning edits and branch | Codex; explicitly handed over by the maintainer on 2026-09-15 |
| Dependency/lockfile lane | **Codex**, including messaging declarations, explicitly allocated on 2026-09-15 |
| BUG-033 rollout | **Approval deferred** by the maintainer on 2026-09-15; measure the exact scope first |
| Expo reporting follow-up | Deferred outside this sprint; no standalone Expo PR |
| Version allocation | Derived from live master at each merge; no preassigned numeric slots |
| Merge/deploy authorization | Per PR, remains with the maintainer; planning approval does not authorize merges |

The Sprint 122 decision was explicitly “not extended in this PR”
(`docs/adr/ADR-088-test-tier-truthfulness.md:142`), not a permanent ban. The current maintainer
decision nevertheless withholds rollout approval. A separate commit does not prevent automatic
promotion: root `package.json:17` invokes the promoter after `npm test`.

## Release sequence

The labels below identify scope, not preallocated versions. Nine PRs can proceed now; PR C adds a
tenth deployment only if approved. Each subsequent implementation PR gets a focused plan and fresh
execution chat; the rolling handoff points to that PR's next task.

| Order | PR / branch suffix | Scope | Acceptance |
|---|---|---|---|
| 1 | A / `sprint-131-maintenance` | BUG-045 + planning and Sprint 130 archive | Expected 404 produces null config and no application error log |
| 2 | B / `sprint-131-test-readiness` | BUG-034 messaging harness/declarations; BUG-036 Docker readiness | Real blocking messaging coverage and bounded readiness checks |
| 3–9 | D1–D7 / `sprint-131-<package>` | One major dependency upgrade per PR | Strict install, importer-specific tests/builds, deploy health |
| Conditional | C / `sprint-131-promoter` | BUG-033 matcher and approved promotions only | Inventory approved; actual moved suites pass together in blocking tier |

All branches use the `agent/codex/` prefix. C may be scheduled after B or after the upgrades, but
must remeasure against its actual base. If approval remains deferred, BUG-033 stays open and the
handoff explicitly records it as unfinished; do not claim the entire backlog cleared.

## PR A — expected missing config (BUG-045)

The config route returns 404 for no row (`services/community-service/src/routes/config.ts:69`).
The API error interceptor preserves the rejection (`apps/frontend/src/lib/api.ts:166`), so
`fetchConfig` can inspect `err.response?.status`. The hook currently logs every failure
(`apps/frontend/src/hooks/useCommunityData.ts:111`).

Handle only HTTP 404 as `config: null`; retain the existing error log for 500, network errors and
other unexpected failures. Tests must verify both halves using the actual hook. Audit norms and
stats without expanding this PR unless their route semantics prove the same expected absence.

**Acceptance boundary:** no application-generated `Failed to load configuration` log for the
404, including after a previously loaded config becomes absent. The HTTP response remains 404.
The browser's own failed-request diagnostic may remain. Update BUG-045 to describe that distinction;
do not mark “zero console errors” as achieved. Eliminating the HTTP-level diagnostic would require
separate approval to change the API/request contract.

## PR B — test readiness (BUG-034, BUG-036)

### Messaging-service

Add a local Jest config using notification-service's tier matching and empty
`setupFilesAfterEnv` as the model (`services/notification-service/jest.config.js`).
Declare the test tools in the workspace and splice its lock entry.

Also declare every runtime package imported directly: `cors`, `dotenv`, `express`,
`jsonwebtoken`, and `pg` are imported at
`services/messaging-service/src/index.ts:1` and `src/database/db.ts:1`, but missing from its
manifest. Reuse compatible baseline declarations/resolutions after reading the current root
manifest and lock; do not introduce major upgrades in B. Audit the remaining imports too.
Root `package.json` currently declares these packages, so D1 may silently change messaging's
inherited dotenv version; disappearance from resolution is a risk, not an established outcome.

Test the actual `messageService` with a mocked database module. Required cases: unauthorized
`getMessages`, authorized chronological ordering/pagination, unauthorized `sendMessage`, and
successful insert → conversation update → sender lookup. No Redis or Socket.IO startup.

The tier-parity gate has a generic allowance for workspaces with no tests, not a named messaging
exemption (`tests/regression/sprint-122-tier-parity.test.ts`). Preserve that general empty-tier
contract; add explicit assertions that messaging has a test script and nonempty blocking test
discovery. Remove stale explanatory comments once the new coverage is real.

### Docker readiness

Replace `sleep 30` and the immediate checks in `.github/workflows/test.yml:126-131` with a
bounded retry that requires both auth health and frontend HTTP success. Preserve failure logs.
Bound each HTTP attempt as well as retry count/delay; a fixed attempt count with an unbounded
HTTP call is not a hard timeout. Prove retries and exhaustion with scripted HTTP outcomes, not
only a regex checking that the YAML contains “retry”.

## PR C — isolated, approval-gated promoter rollout (BUG-033)

The existing discovery matcher accepts only `.test.ts`
(`scripts/promote-tdd-tests.js:33`). The reviewed frontend inventory on 2026-09-15 is **76 files:
74 .tsx + 2 .ts**. Current passing counts are **UNVERIFIED**; July's 67/74 suites and 442 tests are
historical, not a release estimate.

Before modifying the matcher, inventory **all service and app TDD workspaces**, since a global
matcher affects JavaScript services as well as frontend. Run suites without invoking the promoter;
record discovered file identities, pass/fail/skip counts, test totals and durations. Check target
basename collisions, because the current mover flattens source paths into `tests/regression/`.

Present the exact proposed move list, failures left in TDD, expected runtime and destination
collisions for maintainer review. Do not enable the broader matcher or run the mass mover until
rollout is approved. After approval, prove four suffixes and excluded suffixes with temporary
fixtures; make the discovery helper testable if needed. Promote only the reviewed set, resolve
collisions explicitly, and run the resulting blocking suite together. A matcher-only commit is
not permission to let `posttest` sweep other suites.

Update ADR-088 and BUG-033 with measured current facts while preserving the historical rationale.
`scripts/claude.md:10` currently describes `tests/tdd/*`, not a .ts-only filter; update it only if
the actual planned interface changes, not to “correct” text it never contained.

## Dependency upgrades

The table is a **manifest-declarer baseline**, not a complete importer inventory. Scan actual
imports before each upgrade, repair missing declarations surgically, then record the consumer
set in that PR's focused plan. B must land before D1.

| PR | Proposal | Baseline declarers / required focused validation |
|---|---|---|
| D1 | #226 dotenv 16 → 17 | root, simulation, tests/e2e, tests/load, tests; include messaging after B and every other actual importer; validate environment loading |
| D2 | #228 node-cron 3 → 4 | cleanup, reputation; scheduling lifecycle and callback tests |
| D3 | #224 express-rate-limit 7 → 8 | root/shared/geocoding declarations vary; inspect each; middleware construction, proxy behavior and types |
| D4 | #230 expo-server-sdk 6 → 7 | notification; push payload and response handling |
| D5 | #225 node-fetch 2 → 3 | geocoding; audit CommonJS loaders and prove ESM boundary behavior |
| D6 | #227 zod 3 → 4 | root/shared; schema semantics, downstream types and full suite |
| D7 | #229 next 15 → 16 | frontend/landing; builds, runtime, configuration and community-page browser checks |

Target patch releases come from the live proposal at execution time. Dependabot titles are not
compatibility proof. Strict install, affected tests and type/build checks are required per PR.
Standalone `tests/e2e` and `tests/load` projects may have separate locks; inspect their ownership
and lockfiles rather than assuming the root lock covers them.

## Deferred Expo workflow observation

`.github/workflows/expo-sdk-drift.yml` already normalizes its report output and ties close to
a successful gate status. Normal emitted outputs make report and close mutually exclusive.
The remaining concern is setup/install or early check failure before outputs exist: subsequent
steps can be skipped by the default success condition. If scheduled later, file this as a separate
bug with a failure-state reproducer and a reporting fallback; do not conflate it with resolved
BUG-035 or silently add a tenth scope item here.

## Data model and API endpoints

No database, schema, endpoint or response-contract changes. Configuration absence remains 404.

## User guide and documentation updates

- A: BUG-045's precise resolution, frontend context, and any guide that actually describes config defaults.
- B: messaging `CONTEXT.md`, `services/registry.json`, testing guide, BUG-034/036, relevant workflow documentation.
- C, only after approval: testing guide and ADR-088's new amendment, BUG-033, measured promotions and remaining failures.
- D1–D7: changed workspace context/registry entries and verified migration guidance.
- Generate landing documentation from sources; retain substantive tracked changes and discard timestamp churn.
- Preserve Sprint 130's archive and dated obligations; reconcile CURRENT_HANDOFF against live PR/deploy state.

## Critical Implementation Notes

1. Planning belongs on `agent/codex/sprint-131-maintenance`, created from `origin/master` before committing the carried WIP and Sprint 130 archive. Never commit Sprint 131 work on the merged Sprint 130 branch.
2. Codex holds the implementation dependency/lockfile lane by the maintainer's 2026-09-15 decision, including messaging declarations. This is explicit allocation, not a reservation inferred from this handoff.
3. BUG-033 rollout approval is **deferred**. Inventory is read-only. Do not enable the wider matcher, run a mass promotion, or merge PR C before the maintainer approves the freshly measured promotion set.
4. Root `package.json:17` runs the promoter as `posttest`. A matcher-only change can therefore trigger mass moves through `npm test`; a separate commit alone does not isolate rollout.
5. Root regression commands must use the tests workspace: `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`. Prove discovery and an assertion failure; a configuration error or zero-test exit is not TDD red.
6. Messaging tests run explicitly in `tests/tdd/` before promotion. Verify at least the four specified cases executed, then move them to `regression/` and prove the blocking command discovers the file.
7. BUG-045 acceptance is no application `Failed to load configuration` log for HTTP 404, with `config === null`. The browser may still report the preserved HTTP 404; do not claim a silent Network/Console panel.
8. Do not edit `apps/frontend/src/lib/api.ts` or change the config endpoint's 404 contract. Keep non-404 failures observable.
9. Fix messaging's undeclared runtime imports before D1. All manifest edits include a surgical lockfile update and strict `npx -y npm@11.19.0 ci`; never workspace install, dedupe, or scratch lockfile regeneration.
10. A and B precede D1-D7. PR C is independent and can ship after its approval; it does not block the major upgrades. There are nine planned deploys plus one conditional promoter deploy. No numeric release slots are reserved: derive each version from current `origin/master` at merge time.
11. Every PR runs tests, `/simplify`, `/code-review`, and `/security-review`, then waits for explicit maintainer merge authorization and the preceding deploy's health verification.
12. Expo workflow reporting is deferred outside Sprint 131. Its existing report/close outputs are mutually exclusive; the follow-up concerns failures before outputs are produced. Do not reopen the resolved BUG-035.
13. Use the machine's shell correctly. On this Windows checkout use Node for JSON/HTTP probes, preserve exit codes, and keep every test command anchored to its workspace.
