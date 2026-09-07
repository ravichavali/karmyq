# Sprint 128 PR B: Security maintenance — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially; one dependency holder.

**Goal:** Distinguish unavailable audit evidence from a clean report and resolve dated security/SDK maintenance.
**Architecture:** Harden the current audit boundary, retain exact reviewed exception registries and verify dependency policy against the SDK-managed inventory.
**Tech stack:** CommonJS scripts, Jest/TypeScript, npm lockfile, Expo SDK 57, YAML.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`, PR B.
**Branch:** `agent/codex/sprint-128-security-maintenance`, created after PR A deploy verification.
**Global constraints:** All ten Critical implementation notes in the sprint index apply verbatim.

## File map

Modify `scripts/audit-exemptions.js`, `tests/regression/sprint-75-security-gate.test.ts`,
`tests/regression/sprint-123-audit-exemption-gate.test.ts`, `.github/dependabot.yml`,
`tests/regression/sprint-122-expo-sdk-alignment.test.ts`, `security/audit-exemptions.json` when an
exact decision is approved, `apps/mobile/package.json`, `package-lock.json`, `apps/mobile/claude.md`,
`scripts/claude.md`, `docs/BUGS.md`, `docs/adr/ADR-059-dependency-security-gate.md`,
`docs/concepts/how-karmyq-learns.md`, `.claude/handoff/CURRENT_HANDOFF.md`.
Update `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md` and its `.json` sidecar,
and `docs/gotchas/dependabot-regenerates-expo-sdk-breaks.md` and its `.json` sidecar, so they
describe the fixed state.
Create `tests/regression/sprint-128-audit-response-contract.test.ts` for cross-repo audit behavior.
If needed, modify `tests/package.json` solely to declare a parser actually imported by the new
Dependabot assertion; do not rely on hoisted/transitive availability. `security/expo-divergences.json`
changes only if the live result proves an existing entry stale/mismatched or a new decision is approved.
No service dependency/endpoint change is anticipated; update registry/CONTEXT only if the actual dependency impact requires it.

## Task 1: Take the sequential dependency task and capture evidence

**Files:** Canonical context, `scripts/claude.md`, `tests/claude.md`, `apps/mobile/claude.md`, scoped gotchas, manifests and security registries.

- [ ] Confirm PR A merged/deployed and clean checkout. Record the approved single stream as the
  dependency holder for PR B; reconcile with the maintainer only if a new competing task exists.
  Open Dependabot proposals do not hold the lane. Planning approval did not renew the exemptions.
- [ ] Fetch then create this branch from `origin/master`; update the single-stream handoff immediately.
- [ ] Read all matching gotchas with `node scripts/gotcha-check.js --for scripts/audit-exemptions.js .github/dependabot.yml apps/mobile/package.json`.
- [ ] Capture actual stdout and exit statuses from `node scripts/check-image-size-upstream.js --json`
  and `node scripts/expo-divergences.js`. Check issue #206 and the latest scheduled run as supporting history.
- [ ] Verification: list exact current blockers and the expiry date. Plan remediation by September 12;
  if the date has passed, make security resolution the immediate blocking task and alert the maintainer.

## Task 2: Prove BUG-038 and its subprocess cases before changing logic

**Files:** Create the audit response contract regression; extend the existing exemption regression.

- [ ] Use systematic-debugging and TDD. Add a failing direct evaluator test with both registries:

```typescript
const gate = require('../../scripts/audit-exemptions');
const now = new Date('2026-09-07T12:00:00Z');
const entry = {
  package: 'image-size', advisory: 'GHSA-w3rx-r6r6-pgpr', severity: 'high',
  rationale: 'Synthetic test of unavailable audit evidence, not an approved real exemption.',
  decision: 'Test fixture only', owner: 'test', created: '2026-09-01', expires: '2026-09-10',
};
it.each([{ exemptions: [] }, { exemptions: [entry] }])(
  'rejects npm error JSON before matching exemptions', registry => {
    const result = gate.evaluateAudit({ error: { code: 'E503', summary: 'unavailable' } }, registry, now);
    expect(result.ok).toBe(false);
    expect(result.unused).toEqual([]);
    expect(result.errors.join(' ')).toMatch(/audit.*(unavailable|invalid)/i);
    expect(result.errors.join(' ')).not.toMatch(/remove it|upstream may be fixed/i);
  },
);
```

- [ ] Add exact cases: null, array, `{}`, absent/null/array vulnerabilities, error plus an empty
  vulnerability map, malformed entries, invalid JSON, empty stdout, process spawn error/signal,
  timeout, valid zero report, valid nonzero advisory report, valid unmatched exemption.
- [ ] Test process behavior by injecting a fake `child_process.execFileSync` at the module boundary
  in a child test harness, preserving real `runAudit`/CLI evaluation; do not mock the evaluator or
  add a production environment flag to bypass npm. Follow the repository's constant-fixture
  patterns. Assert exit code and absence of clean/removal output for each unavailable case.
- [ ] Run from `tests/`: `npx jest regression/sprint-128-audit-response-contract.test.ts --runInBand`.
  Verification: reproduce the original empty-registry false pass before implementation.

## Task 3: Validate audit evidence before exemption evaluation

**Files:** `scripts/audit-exemptions.js`, existing audit tests.

- [ ] Define an internal validator for the report shape actually consumed. At minimum require a
  non-array object, no own `error` field, a non-array object `vulnerabilities`, and valid
  vulnerability entries (`name`, recognized severity, `via` array). Reject unknown report structure
  explicitly; do not silently drop malformed high/critical entries.
- [ ] Preserve `evaluateAudit(report, registry, now)` and its result keys. Its error return must be:

```javascript
return {
  ok: false,
  errors: ['Audit evidence unavailable or invalid; retry the audit before evaluating exemptions.'],
  blocking: [], cleared: [], unused: [],
};
```

- [ ] Apply report validation before unmatched-exemption logic. Reuse it in `runAudit`; process
  failure/timeout/signal is not a clean result even if partial stdout parses. Accept only supported
  npm success/finding exit statuses with a valid report. Keep shell execution arguments constant.
- [ ] Route Sprint 75's raw-metadata read through the validated acquisition and give a clear error
  if metadata is unavailable; keep raw count assertions rather than deleting them.
- [ ] Run new and existing audit regressions directly. Verification: all negative cases fail for
  the right reason; valid zero/advisory cases retain previous policy and critical always blocks.

## Task 4: Resolve expiry and align the mobile dependency surface

**Files:** Audit registry, mobile manifest/lockfile, dependency config and alignment test; divergence registry if evidence requires.

- [ ] Use Task 1 measurements to select a compatible fix or prepare exact proposed exemption
  entries (identity, reason, owner, decision, creation/expiry). Obtain maintainer decision on the
  concrete entries before recording approval or extending validity. No wider than 30 days; no
  critical exemption. Recheck that exact advisories still apply after any SDK patch changes.
- [ ] Inventory importers/declarers before dependency changes. For each SDK drift, read the live
  expected range and resolved package metadata; surgically edit mobile manifest and matching lock
  nodes/edges. Keep SDK major 57 and existing deliberate Jest divergences when still valid.
- [ ] Add version-update ignores for SDK-managed names to the root npm update entry. In the
  existing SDK alignment regression, parse real `.github/dependabot.yml` and require exact set
  equality with `Object.keys(SDK_PINNED)` plus Expo-family mobile declarations minus the existing
  `INDEPENDENTLY_VERSIONED` exclusions. Define version-update ignores explicitly; do not weaken
  independent security-advisory handling. Avoid global wildcards swallowing unrelated packages.
- [ ] Add negative fixtures removing a managed ignore, adding an unrelated ignore and changing a
  managed name. Test failure is required; a hand-copied second list is not the expected set.
- [ ] If YAML parsing needs a direct test dependency, read its installed manifest/version and
  declare it in `tests/package.json` with surgical lockfile edits. No install-workspace or regeneration.
- [ ] Run strict `npm ci`; inspect lockfile diff for unrelated churn. Run `node scripts/expo-divergences.js`,
  `node scripts/audit-exemptions.js`, mobile tests and mobile `npm run type-check`.
  Verification: real gates succeed; no forced green via ignored failures or widened exceptions.

## Task 5: Update durable docs and regression tier

**Files:** Documentation paths in file map; existing gotcha sidecars and prose.

- [ ] Close BUG-038 only after its reproduction passes. Update ADR-059 to distinguish invalid
  evidence from stale entries; preserve expiry policy. Update existing gotchas to describe the
  repaired behavior and supporting regression rather than leaving their defect claims current.
- [ ] Record actual mobile versions and tested commands in `apps/mobile/claude.md`; do not copy issue #206's old pins.
- [ ] Update learning concept with the verified unavailable-evidence example; regenerate landing docs from sources.
- [ ] Run `node scripts/gotcha-check.js`, direct doc gate, both audit gates, Expo alignment/divergence
  regressions. Root cross-repo tests remain in blocking regression, not root TDD.
- [ ] Verification: no endpoint/event change means no invented registry API entry. If dependencies
  affect a service, update its CONTEXT/registry and run `npm run analyze:services` for that real change.

## Task 6: All SDLC gates

**Files:** Full PR B diff and validation evidence.

- [ ] **Testing:** run direct changed regressions, strict install, mobile type-check/tests and full `npm test`; verify real exit statuses.
- [ ] **`/simplify`:** one PR pass; verify the validator and SDK identity checks avoid duplicate policy maps.
- [ ] **`/code-review`:** independent reviewer uses high effort for security/process boundaries; verify schema/exit-status fixtures cover actual failure routes.
- [ ] **`/security-review`:** verify no arbitrary path/command input, secret-bearing error echoes, expiry bypass or weakened severity policy; resolve findings.
- [ ] Verification: each gate's result and finding disposition is recorded in the PR, not merely a checked box.

## Task 7: Final type-check, commit and PR preparation

**Files:** Handoff, source docs, release fields and complete PR template.

- [ ] Confirm mobile `npm run type-check`; run tests workspace `npx tsc --noEmit` for changed TypeScript tests.
  Confirm Task 6's `npm test` result and run staged `npm run feedback:check`. Repeat install/tests/type-check
  only if later changes invalidate their evidence; do not replace strict `npm ci` with a dry-run.
- [ ] Revert only generated timestamp/HEAD churn; `git diff --check`; pre-commit-check before commit.
- [ ] Re-derive version from master, push with normal hooks, open PR B with full template and
  exact approved security decisions. No bulk merge/dismissal/closure of unrelated proposals.
- [ ] Verification: CI is green and exemptions remain valid at the actual merge date; if expired, resolve the exact decision first.

## Task 8: Authorized merge/deploy and next handoff

**Files:** GitHub PR/run state and handoff.

- [ ] Claude recommends readiness; obtain explicit maintainer merge authorization and use corrected deploy skill.
- [ ] Wait for deploy plus health verification. Verify fresh audit/SDK evidence and link the runs;
  an old green scheduled check is not verification of the merged dependency tree.
- [ ] Record completed fixes and unresolved queued dependency proposals. Next fresh chat executes PR C
  from updated `origin/master`. Capture any deadline/ownership/review friction for the retrospective.
- [ ] Verification: clean tree, deployed PR B, no expired exception and no hidden integration/dependency blocker.
