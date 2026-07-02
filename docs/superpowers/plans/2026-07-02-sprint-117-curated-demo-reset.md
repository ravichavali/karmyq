# Controlled Demo Reset and Curated Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile additive demo rehearsal with a guarded full reset, deterministic
age-aware curated fixtures, server-generated Maria story IDs, and privacy-scoped API verification.

**Architecture:** A typed fixture manifest compiles semantic keys and reset-relative ages into a
transactional PostgreSQL baseline. Shared pure projection rules keep historical trust/reputation
state aligned with live event behavior; ordinary APIs create the finite live Maria decisions, and a
non-admin verifier is the only authority that can publish demo configuration or resume mutation.

**Tech Stack:** Node.js/TypeScript, PostgreSQL 15, `pg`, Express service APIs, Bull/Redis event
projection, Jest, Next.js 14/15 workspace, Bash/PowerShell operator wrappers.

## Global Constraints

- Work on `agent/codex/sprint-117-curated-demo-reset`; never commit or push directly to `master`.
- No git worktrees. Claude and Codex share one physical tree; it must be clean at role handoff.
- Version target is `v11.26.0` from `v11.25.3`.
- Planned demo downtime is approved, but merge and deploy still require explicit Admin authorization.
- Reset is dry-run by default. Mutation requires `--apply`, demo fingerprint, advisory lock, paused
  mutation jobs, and a completed restorable backup.
- One UTC reset anchor drives all ages; fixed calendar dates and frozen clocks are forbidden.
- Maria Reyes is synthetic, active, member-only, never admin/moderator, and excluded from simulation.
- Every protected story dependency is excluded from simulation, not only `DEMO_PERSONA_EMAIL`.
- Historical UUIDs derive from semantic keys; live request/match/offer IDs are server-generated and
  published only after authoritative readback.
- The ordinary story must retain ≤2-degree path, ≥3 shared named people, and ≥4 visible one-hop people
  per side. Provider contrast must remain truthful.
- No arbitrary trust edges, reputation scores, immortality, or demo-only decay/retention exceptions.
- Trust topology is platform-wide; strength/membership are scoped; request reachability stays separate.
- Ordinary API validation must prove reciprocal topology, unrelated-member denial, ADR-082 field
  privacy, and demo-session write rejection.
- Health is read-only. Story rotation is explicit and never triggers a full reset.
- Put tuning in the manifest; privacy, lifecycle, cohort, simulator, and story floors cannot be tuned
  away.
- New tests begin in each affected workspace's `tests/tdd/` and promote to regression only after green.
- Run `/simplify` after every implementation task. Before every commit, run `/pre-commit-check`.
- Final branch gates are testing, `/simplify`, `/code-review`, and `/security-review`.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `services/simulation-service/src/fixtures/curatedDemo/types.ts` | Manifest, semantic key, compiled baseline, reset plan, verification, and dependency interfaces. |
| `services/simulation-service/src/fixtures/curatedDemo/manifest.ts` | The tunable 30–40-person, six-community curated fixture source and protected-email export. |
| `services/simulation-service/src/fixtures/curatedDemo/compiler.ts` | Validate semantic references/invariants; derive UUIDs, relative timestamps, and projection inputs. |
| `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` | Classify all application tables as reset/reseed/preserve and fail on schema drift. |
| `services/simulation-service/src/fixtures/curatedDemo/resetCoordinator.ts` | Dry-run/apply orchestration, fingerprint, backup, advisory lock, transaction, and recovery state. |
| `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts` | Dependency-ordered source/projection inserts through one PostgreSQL transaction client. |
| `services/simulation-service/src/fixtures/curatedDemo/verifier.ts` | Non-admin API acceptance checks and machine-readable health report. |
| `services/simulation-service/src/fixtures/curatedDemo/storyLifecycle.ts` | Create, verify, rotate, and retire live Maria stories using ordinary APIs. |
| `services/simulation-service/src/fixtures/curatedDemo/configPublisher.ts` | Allowlisted, backed-up, atomic `.env.demo` story-variable replacement. |
| `services/simulation-service/src/scripts/resetDemoData.ts` | Dry-run-by-default full-reset CLI. |
| `services/simulation-service/src/scripts/verifyDemoData.ts` | Read-only fixture-health CLI. |
| `services/simulation-service/src/scripts/rotateMariaStories.ts` | Explicit live-story rotation CLI. |
| `packages/shared/src/projections/completedExchange.ts` | Pure timestamp-aware trust/karma projection rules shared by live handlers and fixture compiler. |
| `packages/shared/src/projections/index.ts` | Projection exports. |
| `services/simulation-service/tests/tdd/sprint-117-manifest-compiler.test.ts` | Manifest/UUID/age/invariant TDD contract. |
| `services/simulation-service/tests/tdd/sprint-117-reset-safety.test.ts` | Environment, table policy, backup, lock, transaction, and dry-run TDD contract. |
| `packages/shared/src/projections/__tests__/completedExchange.test.ts` | Pure chronological projection contract. |
| `services/social-graph-service/tests/tdd/sprint-117-projection-time.test.ts` | Live social projection honors source event time. |
| `services/reputation-service/tests/tdd/sprint-117-projection-time.test.ts` | Live karma projection honors source event time. |
| `services/simulation-service/tests/tdd/sprint-117-api-verifier.test.ts` | API privacy, reciprocal topology, story coherence, and health TDD contract. |
| `services/simulation-service/tests/tdd/sprint-117-story-operations.test.ts` | Rotation, env publication, and fail-closed operations TDD contract. |
| `services/simulation-service/tests/tdd/sprint-117-protected-core.test.ts` | Every protected fixture identity is absent from simulator queries. |
| `tests/tdd/sprint-117-demo-reset.integration.test.ts` | Migrated-DB double reset, age, FK, cleanup, and API integration rehearsal. |

### Existing files to modify

| File | Change |
|---|---|
| `services/simulation-service/src/scenarios/mariaRelationshipStory.ts` | Keep story floor/apply primitives; add explicit fresh-story and retirement semantics. |
| `services/simulation-service/src/scripts/rehearseMariaRelationshipStory.ts` | Reduce to compatibility wrapper over the new story lifecycle/verifier. |
| `services/simulation-service/src/api-client.ts` | Add exact existing read methods needed by the verifier. |
| `services/simulation-service/src/db-user-loader.ts` | Exclude the manifest's full protected email set from actor selection/counts. |
| `services/simulation-service/package.json` | Add reset/verify/rotate scripts and explicit `@karmyq/shared` dependency. |
| `packages/shared/package.json`, `packages/shared/index.ts` | Export `./projections/completed-exchange`. |
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Use shared projection math and optional source timestamp/queryable context. |
| `services/social-graph-service/src/services/trustEdgeService.ts` | Thread completion timestamp through community reconciliation. |
| `services/social-graph-service/src/events/subscriber.ts` | Read additive `completed_at` and project connections at source time. |
| `services/reputation-service/src/services/karmaAllocation.ts` | Re-export shared allocation logic for compatibility. |
| `services/reputation-service/src/services/karmaService.ts` | Use shared projection allocation and optional source timestamp/queryable context. |
| `services/reputation-service/src/events/subscriber.ts` | Thread additive `completed_at` into karma projection. |
| `services/request-service/src/routes/matches.ts` | Publish `completed_at` on `match_completed`. |
| `scripts/truncate-database.sh`, `scripts/truncate-database.bat`, `scripts/truncate-database.sql` | Replace unsafe legacy behavior with the single guarded CLI path/refusal message. |
| `scripts/deploy.sh` | Pass no implicit reset; add safe post-deploy operator hints and protected-fixture verification. |
| `scripts/README.md`, `docs/README.md` | Document the only supported reset, verify, rotate, and recovery commands. |
| `docs/guides/demo-data.md` | Explain curated baseline, finite ages, protected core, and ambient simulation. |
| `docs/adr/ADR-024-synthetic-user-simulation.md` | Amend stale “manual reset rejected” and continuous-only assumptions. |
| `docs/adr/ADR-084-context-bound-connection-visibility.md` | Replace additive rehearsal note with curated/verified story contract. |
| `apps/landing/src/data/docs/guides/demo-data.json` | Landing copy for the updated demo guide. |
| `apps/landing/src/data/docs/concepts/adr-024-synthetic-user-simulation.json` | Generated/published ADR-024 amendment. |
| `apps/landing/src/data/docs/concepts/adr-084-context-bound-connection-visibility.json` | Generated/published ADR-084 amendment. |
| `apps/landing/src/data/docs/services/simulation-service.json` | Reset/health/rotation operating model. |
| `apps/landing/src/data/docs/nav.json` | Verify existing guide/ADR links remain present after generation. |
| `services/simulation-service/CONTEXT.md`, `services/auth-service/CONTEXT.md` | Operational contracts and verified-ID/non-admin requirements. |
| `services/social-graph-service/CONTEXT.md`, `services/reputation-service/CONTEXT.md`, `services/request-service/CONTEXT.md` | Add source-time event projection behavior. |
| `services/registry.json` | Update simulation notes and `match_completed.completed_at` event contract if represented. |
| `package.json`, `package-lock.json` | Version `11.26.0` and workspace dependency lock update. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Execution/deploy state throughout the sprint. |

---

## ⚠️ Critical Implementation Notes (read before Task 1)

1. PostgreSQL catalogs, not `scripts/truncate-database.sql`, define table coverage. A new unclassified
   table is a hard failure.
2. The reset must not expose a generic production database wipe. Fingerprint the demo using an
   explicit environment marker plus database identity; fail unknown targets.
3. The backup must complete before the transaction starts. Post-seed API failure does not silently
   restore while services are live; keep maintenance mode and present bounded restore/rerun actions.
4. Use a single `pg.PoolClient` for truncate, baseline source inserts, and projection inserts so the
   database portion is atomic.
5. Semantic UUIDs apply only to historical baseline rows. Do not force IDs into ordinary API creates.
6. Projection functions take `occurredAt` explicitly and sort exchanges chronologically. Defaulting to
   `new Date()` is allowed only for live events that genuinely lack the additive timestamp.
7. `match_completed` remains backward compatible: `completed_at` is optional for old queued events.
8. The fixture manifest declares completed exchanges and feedback, never raw trust edges or exact
   trust scores. Pure shared functions derive projection rows.
9. `@karmyq/shared` subpath imports require a package export and explicit workspace dependencies before
   Turbo/CI can build in the correct order.
10. Maria/helper/provider/shared-neighbor protection comes from the manifest's semantic classification,
    not a hand-maintained second email list.
11. `ApiClient` response methods consume interceptor-unwrapped `res.data`, not `res.data.data`.
12. The verifier authenticates each candidate with that candidate's token where privacy scope requires
    it. Maria cannot inspect an arbitrary cross-community neighborhood.
13. Verify response keys recursively against ADR-082 forbidden sets while allowing `bond_depth` and the
    provider-rating exception.
14. Configuration publication touches only `DEMO_PERSONA_EMAIL` and the four story ID variables. It
    creates a timestamped `.env.demo` backup and uses same-directory atomic rename.
15. Do not auto-reset or auto-rotate in deploy, cron, PM2, or health checks.
16. Replace the old truncate entry points; do not leave a second destructive path behind.
17. Docker is unavailable in the local Windows environment. DB-backed apply and full API validation
    remain TDD until the Admin-authorized deployed rehearsal, but pure/unit/regression gates must pass.
18. Fixture credentials come only from `DEMO_PERSONA_PASSWORD` at apply time. Hash once with
    `bcryptjs` cost 12, pass the hash into `baselineWriter`, and never place plaintext/hash in the
    manifest, dry-run plan, logs, verification report, backup name, or committed files.

---

## Task 1: Lock the Manifest Contract with Failing Tests

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-117-manifest-compiler.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: required signatures for `semanticUuid`, `compileManifest`, `getProtectedFixtureEmails`,
  and the manifest invariants implemented in Task 2.

- [ ] **Step 0: Verify the execution branch and clean shared tree**

```powershell
git branch --show-current
git status --short
```

Expected: `agent/codex/sprint-117-curated-demo-reset` and no uncommitted files from another agent.

- [ ] **Step 1: Write compiler contract tests before implementation**

```ts
import {
  compileManifest,
  semanticUuid,
} from '../../src/fixtures/curatedDemo/compiler';
import {
  CURATED_DEMO_MANIFEST,
  getProtectedFixtureEmails,
} from '../../src/fixtures/curatedDemo/manifest';

const A = new Date('2026-07-02T12:00:00.000Z');
const B = new Date('2027-01-15T09:30:00.000Z');

describe('Sprint 117 curated manifest compiler', () => {
  it('derives stable UUIDs while shifting every age by the reset anchor', () => {
    expect(semanticUuid('person.maria')).toBe(semanticUuid('person.maria'));
    expect(semanticUuid('person.maria')).not.toBe(semanticUuid('person.helper'));
    const a = compileManifest(CURATED_DEMO_MANIFEST, A);
    const b = compileManifest(CURATED_DEMO_MANIFEST, B);
    expect(a.people.map(x => x.id)).toEqual(b.people.map(x => x.id));
    expect(b.requests[0].createdAt.getTime() - a.requests[0].createdAt.getTime())
      .toBe(B.getTime() - A.getTime());
  });

  it('keeps Maria active, member-only, protected, and outside every admin role', () => {
    const compiled = compileManifest(CURATED_DEMO_MANIFEST, A);
    const maria = compiled.people.find(p => p.key === 'person.maria')!;
    const memberships = compiled.memberships.filter(m => m.userId === maria.id);
    expect(maria.classification).toBe('protected');
    expect(memberships.some(m => m.status === 'active')).toBe(true);
    expect(memberships.every(m => m.role === 'member')).toBe(true);
    expect(getProtectedFixtureEmails()).toContain(maria.email);
  });

  it('rejects dangling references, impossible lifecycle, low cohorts, and a tunable-away rich floor', () => {
    expect(() => compileManifest({ ...CURATED_DEMO_MANIFEST, memberships: [{ user: 'missing', community: 'missing', role: 'member', status: 'active', joinedAge: 'P1D' }] }, A))
      .toThrow(/unknown semantic key/i);
    expect(() => compileManifest({ ...CURATED_DEMO_MANIFEST, tuning: { ...CURATED_DEMO_MANIFEST.tuning, minSharedPeople: 0 } }, A))
      .toThrow(/hard floor/i);
  });
});
```

- [ ] **Step 2: Run the focused test and prove RED**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand tests/tdd/sprint-117-manifest-compiler.test.ts
```

Expected: FAIL because the curated manifest modules do not exist.

- [ ] **Step 3: Run `/pre-commit-check` and commit the RED TDD contract**

```powershell
git add services/simulation-service/tests/tdd/sprint-117-manifest-compiler.test.ts
git commit -m "test: define curated demo manifest contract"
```

---

## Task 2: Implement the Typed Manifest and Compiler

**Files:**
- Create: `services/simulation-service/src/fixtures/curatedDemo/types.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/manifest.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/compiler.ts`
- Modify: `services/simulation-service/package.json`
- Test: `services/simulation-service/tests/tdd/sprint-117-manifest-compiler.test.ts`

**Interfaces:**
- Consumes: Task 1's test contract.
- Produces:
  - `semanticUuid(key: SemanticKey): string`
  - `compileManifest(manifest: DemoFixtureManifest, anchor: Date): CompiledDemoBaseline`
  - `getProtectedFixtureEmails(): string[]`
  - `CURATED_DEMO_MANIFEST: DemoFixtureManifest`

- [ ] **Step 1: Define exact domain types and hard floors**

```ts
export type SemanticKey = `${'person'|'community'|'request'|'exchange'|'provider'|'activity'}.${string}`;
export type FixtureAge = `P${number}D` | `PT${number}H`;
export type FixtureClassification = 'protected' | 'ambient';

export const STORY_HARD_FLOOR = Object.freeze({
  maxPathDegree: 2,
  minSharedPeople: 3,
  minOneHopPerSide: 4,
});

export interface DemoFixtureManifest {
  version: 1;
  tuning: {
    peopleTarget: number;
    minimumStoryRunwayDays: number;
    maxPathDegree: number;
    minSharedPeople: number;
    minOneHopPerSide: number;
  };
  people: FixturePerson[];
  communities: FixtureCommunity[];
  memberships: FixtureMembership[];
  requests: HistoricalRequestFixture[];
  exchanges: HistoricalExchangeFixture[];
  providers: ProviderFixture[];
  governance: GovernanceFixture[];
  activities: ActivityFixture[];
  expectedBehaviors: FixtureExpectation[];
}
```

- [ ] **Step 2: Author the curated graph by semantic key**

Use 36 people and six communities. The manifest must explicitly include Maria, one rich helper, one
low-overlap provider, three shared neighbors, at least one exclusive neighbor per side, a bridge, an
isolate, an inaccessible outsider, separate stewards, and ambient actors. Encode completed exchanges
that create the required topology plus fresh/7d/14d/30d/60d/180d/six-month age lanes. Do not include a
`trustEdges` or `trustScores` property.

```ts
export const CURATED_PEOPLE: FixturePerson[] = [
    { key: 'person.maria', name: 'Maria Reyes', email: 'maria.reyes@test.karmyq.com', classification: 'protected' },
    { key: 'person.helper', name: 'Elena Torres', email: 'elena.torres@test.karmyq.com', classification: 'protected' },
    { key: 'person.provider', name: 'Noah Williams', email: 'noah.williams@test.karmyq.com', classification: 'protected' },
    { key: 'person.shared-sophia', name: 'Sophia Chen', email: 'sophia.chen@test.karmyq.com', classification: 'protected' },
    { key: 'person.shared-james', name: 'James Okafor', email: 'james.okafor@test.karmyq.com', classification: 'protected' },
    { key: 'person.shared-priya', name: 'Priya Sharma', email: 'priya.sharma@test.karmyq.com', classification: 'protected' },
    { key: 'person.maria-exclusive', name: 'Wei Zhang', email: 'wei.zhang@test.karmyq.com', classification: 'protected' },
    { key: 'person.helper-exclusive', name: 'Fatima Alhassan', email: 'fatima.alhassan@test.karmyq.com', classification: 'protected' },
    { key: 'person.bridge', name: 'Amina Baptiste', email: 'amina.baptiste@test.karmyq.com', classification: 'protected' },
    { key: 'person.steward-mutual-aid', name: 'David Rodriguez', email: 'david.rodriguez@test.karmyq.com', classification: 'ambient' },
    { key: 'person.steward-southeast', name: 'Nadia Ito', email: 'nadia.ito@test.karmyq.com', classification: 'ambient' },
    { key: 'person.steward-tools', name: 'Samuel Green', email: 'samuel.green@test.karmyq.com', classification: 'ambient' },
    { key: 'person.steward-providers', name: 'Grace Kim', email: 'grace.kim@test.karmyq.com', classification: 'ambient' },
    { key: 'person.steward-rides', name: 'Omar Hassan', email: 'omar.hassan@test.karmyq.com', classification: 'ambient' },
    { key: 'person.steward-group', name: 'Lucy Martinez', email: 'lucy.martinez@test.karmyq.com', classification: 'ambient' },
    { key: 'person.isolate', name: 'Evelyn Brooks', email: 'evelyn.brooks@test.karmyq.com', classification: 'ambient' },
    { key: 'person.outsider', name: 'Marcus Lee', email: 'marcus.lee@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-01', name: 'Lena Patel', email: 'lena.patel@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-02', name: 'Theo Johnson', email: 'theo.johnson@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-03', name: 'Maya Wilson', email: 'maya.wilson@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-04', name: 'Ibrahim Diallo', email: 'ibrahim.diallo@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-05', name: 'Hana Suzuki', email: 'hana.suzuki@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-06', name: 'Mateo Garcia', email: 'mateo.garcia@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-07', name: 'Zara Ahmed', email: 'zara.ahmed@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-08', name: 'Caleb Brown', email: 'caleb.brown@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-09', name: 'Nora Thompson', email: 'nora.thompson@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-10', name: 'Diego Morales', email: 'diego.morales@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-11', name: 'Leila Haddad', email: 'leila.haddad@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-12', name: 'Jonas Miller', email: 'jonas.miller@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-13', name: 'Sofia Rivera', email: 'sofia.rivera@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-14', name: 'Kwame Mensah', email: 'kwame.mensah@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-15', name: 'Anika Singh', email: 'anika.singh@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-16', name: 'Ben Carter', email: 'ben.carter@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-17', name: 'Rosa Flores', email: 'rosa.flores@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-18', name: 'Malik Robinson', email: 'malik.robinson@test.karmyq.com', classification: 'ambient' },
    { key: 'person.ambient-19', name: 'Chloe Nguyen', email: 'chloe.nguyen@test.karmyq.com', classification: 'ambient' },
];

export const CURATED_COMMUNITIES: FixtureCommunity[] = [
    { key: 'community.portland-mutual-aid', name: 'Portland Mutual Aid Network', type: 'mutual_aid' },
    { key: 'community.southeast-pdx', name: 'Southeast PDX Helpers', type: 'neighborhood' },
    { key: 'community.tool-library', name: 'Portland Tool Library & Share', type: 'sharing' },
    { key: 'community.providers', name: 'PDX Service Providers Network', type: 'professional' },
    { key: 'community.rides', name: 'PDX Rides Collective', type: 'professional' },
    { key: 'community.weekend-group', name: 'Portland Weekend Helpers', type: 'group' },
];
```

Assemble `CURATED_DEMO_MANIFEST` with these two complete registries plus explicit memberships,
requests, exchanges, providers, governance, activities, and expectations. The required relationship history is:
Maria↔Sophia (4 exchanges), helper↔Sophia (2), Maria↔James (2), helper↔James (2), Maria↔Priya (1),
helper↔Priya (1), Maria↔Wei (2), helper↔Fatima (2), and Maria↔Amina↔provider as the low-overlap bridge.
Use ages `P3D`, `P12D`, `P45D`, `P120D`, and `P179D` across those histories. Add ambient exchanges
only to create the documented redundant/sparse/isolate and pulse states; none may alter the protected
story floor. Every one of the six communities gets a separate steward and at least five active members.

- [ ] **Step 3: Implement UUID, duration, reference, lifecycle, cohort, and floor validation**

```ts
import { createHash } from 'node:crypto';
const FIXTURE_NAMESPACE = '75648739-6e64-4d8b-b594-0fd70f609d2d';

export function semanticUuid(key: SemanticKey): string {
  const namespace = Buffer.from(FIXTURE_NAMESPACE.replaceAll('-', ''), 'hex');
  const bytes = createHash('sha1').update(namespace).update(key, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ageFrom(anchor: Date, age: FixtureAge): Date {
  const match = /^(?:P(?:(\d+)D)|PT(\d+)H)$/.exec(age);
  if (!match) throw new Error(`Invalid fixture age: ${age}`);
  const ms = Number(match[1] ?? 0) * 86_400_000 + Number(match[2] ?? 0) * 3_600_000;
  return new Date(anchor.getTime() - ms);
}
```

Compile to dependency-ordered rows plus projection events. Enforce unique semantic keys, known
references, six communities, 30–40 people, ≥5 active members in aggregate communities, valid states,
Maria member-only status, and hard-floor values.

- [ ] **Step 4: Run GREEN checks**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand tests/tdd/sprint-117-manifest-compiler.test.ts
npm --workspace @karmyq/simulation-service run build
```

Expected: manifest tests PASS and TypeScript exits 0.

- [ ] **Step 5: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add services/simulation-service/src/fixtures/curatedDemo services/simulation-service/tests/tdd/sprint-117-manifest-compiler.test.ts services/simulation-service/package.json
git commit -m "feat: add deterministic curated demo manifest"
```

---

## Task 3: Lock the Reset Safety Contract with Failing Tests

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-117-reset-safety.test.ts`

**Interfaces:**
- Consumes: `CompiledDemoBaseline` from Task 2.
- Produces: required reset/table-policy interfaces implemented in Task 4.

- [ ] **Step 1: Write fail-closed safety tests**

```ts
import { classifyTables, MANAGED_SCHEMAS } from '../../src/fixtures/curatedDemo/tablePolicy';
import { buildResetPlan, executeReset } from '../../src/fixtures/curatedDemo/resetCoordinator';

describe('Sprint 117 reset safety', () => {
  it('fails when a managed application table is unclassified', () => {
    expect(() => classifyTables([{ schema: 'requests', table: 'new_table' }]))
      .toThrow(/unclassified table requests\.new_table/i);
  });

  it('is dry-run by default and never calls backup, lock, or transaction', async () => {
    const deps = fakeResetDeps();
    const result = await executeReset({ apply: false }, deps);
    expect(result.mode).toBe('dry-run');
    expect(deps.backup).not.toHaveBeenCalled();
    expect(deps.withTransaction).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'production'])('rejects %s fingerprints before backup', async environment => {
    const deps = fakeResetDeps({ fingerprint: { environment, database: 'karmyq_prod' } });
    await expect(executeReset({ apply: true }, deps)).rejects.toThrow(/demo fingerprint/i);
    expect(deps.backup).not.toHaveBeenCalled();
  });

  it('requires backup, advisory lock, paused jobs, and one rolled-back transaction', async () => {
    const deps = fakeResetDeps({ transactionError: new Error('seed failed') });
    await expect(executeReset({ apply: true }, deps)).rejects.toThrow('seed failed');
    expect(deps.pauseMutation.mock.invocationCallOrder[0]).toBeLessThan(deps.backup.mock.invocationCallOrder[0]);
    expect(deps.backup.mock.invocationCallOrder[0]).toBeLessThan(deps.acquireLock.mock.invocationCallOrder[0]);
    expect(deps.rollback).toHaveBeenCalledTimes(1);
    expect(deps.enableDemo).not.toHaveBeenCalled();
  });
});
```

The test helper supplies typed Jest mocks for every `ResetDependencies` method; do not use `any`.

- [ ] **Step 2: Run and prove RED**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand tests/tdd/sprint-117-reset-safety.test.ts
```

Expected: FAIL because table policy/reset coordinator modules do not exist.

- [ ] **Step 3: Run `/pre-commit-check` and commit RED tests**

```powershell
git add services/simulation-service/tests/tdd/sprint-117-reset-safety.test.ts
git commit -m "test: define fail-closed demo reset safety"
```

---

## Task 4: Implement Table Coverage and the Guarded Reset Coordinator

**Files:**
- Create: `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/resetCoordinator.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts`
- Create: `services/simulation-service/src/scripts/resetDemoData.ts`
- Modify: `services/simulation-service/package.json`
- Test: `services/simulation-service/tests/tdd/sprint-117-reset-safety.test.ts`

**Interfaces:**
- Consumes: `compileManifest` and `CompiledDemoBaseline` from Task 2.
- Produces:
  - `classifyTables(catalog: CatalogTable[]): ClassifiedTableSet`
  - `buildResetPlan(deps, anchor): Promise<ResetPlan>`
  - `executeReset(options: ResetOptions, deps: ResetDependencies): Promise<ResetResult>`
  - `writeBaseline(client: PoolClient, baseline: CompiledDemoBaseline): Promise<void>`

- [ ] **Step 1: Classify every current application table explicitly**

```ts
export const MANAGED_SCHEMAS = [
  'auth', 'communities', 'requests', 'provider', 'reputation', 'messaging',
  'notifications', 'feedback', 'governance', 'events', 'feed', 'social_graph',
] as const;

export const TABLE_POLICY: Record<string, 'reset'|'reseed'|'preserve'> = {
  'auth.users': 'reset',
  'auth.sessions': 'reset',
  'auth.refresh_tokens': 'reset',
  'communities.communities': 'reset',
  'communities.members': 'reset',
  'communities.settings': 'reseed',
  'requests.help_requests': 'reset',
  'requests.request_communities': 'reset',
  'requests.retention_config': 'reseed',
  'social_graph.trust_decay_config': 'reseed',
};
```

Complete the object for every catalog table returned from the managed schemas. Preserve only migration
bookkeeping and immutable schema/UI catalogs with a written reason. Include the public geocoding cache
in a separate explicit `reset` entry even though it is outside the schema list.

- [ ] **Step 2: Implement dry-run planning and the demo fingerprint**

```ts
export interface DemoFingerprint {
  environment: string;
  database: string;
  marker: string | null;
}

export function assertDemoFingerprint(f: DemoFingerprint): void {
  if (f.environment !== 'demo' || f.marker !== 'karmyq-demo-reset-v1') {
    throw new Error(`Refusing reset: demo fingerprint mismatch for ${f.database}`);
  }
}
```

Read the marker from an explicit server environment value (`DEMO_RESET_MARKER`) and report database
identity plus row counts. Do not infer safety from `localhost`, Docker, or database name alone.

- [ ] **Step 3: Implement ordered apply orchestration**

```ts
export async function executeReset(options: ResetOptions, deps: ResetDependencies): Promise<ResetResult> {
  const plan = await buildResetPlan(deps, options.anchor ?? new Date());
  if (!options.apply) return { mode: 'dry-run', plan };
  assertDemoFingerprint(plan.fingerprint);
  await deps.disableDemo();
  await deps.pauseMutation();
  const backup = await deps.backup();
  if (!backup.verified) throw new Error('Refusing reset: backup is not verified');
  const release = await deps.acquireLock();
  try {
    const fixturePassword = deps.readSecret('DEMO_PERSONA_PASSWORD');
    if (!fixturePassword) throw new Error('Refusing reset: DEMO_PERSONA_PASSWORD is missing');
    const credentialHash = await deps.hashPassword(fixturePassword, 12);
    await deps.withTransaction(client => deps.writeBaseline(client, plan.baseline, plan.tables, credentialHash));
    return { mode: 'applied-awaiting-validation', plan, backupPath: backup.path };
  } finally {
    await release();
  }
}
```

`withTransaction` must issue `BEGIN`, `COMMIT`, and `ROLLBACK` on the same client. Build the backup with
`pg_dump --format=custom --file=C:\tmp\karmyq-demo-20260702T120000Z.dump` through an injected
argument-array process runner (the runtime path uses the actual UTC timestamp and configured backup
directory);
never concatenate secrets into a shell string or log the database URL. Add `bcryptjs` plus its types
to the simulation workspace and inject the cost-12 hasher so unit tests never perform expensive real
hashing.

- [ ] **Step 4: Implement the CLI**

Parse only `--apply`, `--anchor=2026-07-02T12:00:00.000Z`, and
`--backup-dir=C:\tmp\karmyq-demo-backups`. Unknown flags fail. Print JSON for
automation and a concise human summary. Default execution calls `executeReset({ apply: false })`.

- [ ] **Step 5: Run focused tests and build**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand tests/tdd/sprint-117-reset-safety.test.ts
npm --workspace @karmyq/simulation-service run build
```

Expected: reset safety tests PASS; CLI compilation exits 0.

- [ ] **Step 6: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add services/simulation-service/src/fixtures/curatedDemo services/simulation-service/src/scripts/resetDemoData.ts services/simulation-service/tests/tdd/sprint-117-reset-safety.test.ts services/simulation-service/package.json
git commit -m "feat: add guarded transactional demo reset"
```

---

## Task 5: Lock Timestamp-Faithful Projection Behavior with Failing Tests

**Files:**
- Create: `packages/shared/src/projections/__tests__/completedExchange.test.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-117-projection-time.test.ts`
- Create: `services/reputation-service/tests/tdd/sprint-117-projection-time.test.ts`

**Interfaces:**
- Consumes: compiled chronological exchange inputs from Task 2.
- Produces: projection signatures and optional `completed_at` behavior implemented in Task 6.

- [ ] **Step 1: Write pure chronological projection tests**

```ts
import { projectCompletedExchanges } from '../completedExchange';

it('derives count, stability, last interaction, and karma from chronological source events', () => {
  const events = [
    exchange('exchange.old', '2026-01-01T00:00:00Z'),
    exchange('exchange.new', '2026-06-29T00:00:00Z'),
  ];
  const result = projectCompletedExchanges(events, projectionConfig({ growthRate: 0.2 }));
  expect(result.trustEdges[0]).toMatchObject({
    matchCompletedCount: 2,
    stability: 1.44,
    lastInteractionAt: new Date('2026-06-29T00:00:00Z'),
  });
  expect(result.karmaRecords.map(x => x.createdAt)).toEqual([
    new Date('2026-01-01T00:00:00Z'),
    new Date('2026-01-01T00:00:00Z'),
    new Date('2026-01-01T00:00:00Z'), // first-help bonus
    new Date('2026-06-29T00:00:00Z'),
    new Date('2026-06-29T00:00:00Z'),
  ]);
});
```

- [ ] **Step 2: Write live-handler source-time tests**

Assert social-graph connection/trust-edge SQL receives `2026-06-29T00:00:00Z`, reputation karma
inserts receive the same time, and payloads without `completed_at` still use an injected current time.

```ts
await handleMatchCompleted({
  request_id: REQUEST_ID,
  requester_id: MARIA_ID,
  responder_id: HELPER_ID,
  completed_at: '2026-06-29T00:00:00.000Z',
});
expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('last_interaction_at'),
  expect.arrayContaining([new Date('2026-06-29T00:00:00.000Z')]));
```

- [ ] **Step 3: Run and prove RED**

```powershell
npm --workspace @karmyq/shared test -- --runInBand completedExchange.test.ts
npm --workspace @karmyq/social-graph-service test -- --runInBand sprint-117-projection-time.test.ts
npm --workspace karmyq-reputation-service test -- --runInBand sprint-117-projection-time.test.ts
```

Expected: FAIL because shared projection exports and source-time parameters do not exist.

- [ ] **Step 4: Run `/pre-commit-check` and commit RED tests**

```powershell
git add packages/shared/src/projections/__tests__ services/social-graph-service/tests/tdd/sprint-117-projection-time.test.ts services/reputation-service/tests/tdd/sprint-117-projection-time.test.ts
git commit -m "test: define timestamp-faithful exchange projections"
```

---

## Task 6: Implement Shared Projection Replay and Adapt Live Events

**Files:**
- Create: `packages/shared/src/projections/completedExchange.ts`
- Create: `packages/shared/src/projections/index.ts`
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/index.ts`
- Modify: `services/simulation-service/package.json`
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Modify: `services/social-graph-service/src/services/trustEdgeService.ts`
- Modify: `services/social-graph-service/src/events/subscriber.ts`
- Modify: `services/reputation-service/src/services/karmaAllocation.ts`
- Modify: `services/reputation-service/src/services/karmaService.ts`
- Modify: `services/reputation-service/src/events/subscriber.ts`
- Modify: `services/request-service/src/routes/matches.ts`
- Modify: `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts`
- Test: Task 5 test files

**Interfaces:**
- Consumes: Task 5 contracts and `CompiledDemoBaseline.projectionEvents`.
- Produces:
  - `projectCompletedExchanges(events, config): CompletedExchangeProjection`
  - optional `completed_at` in `MatchCompletedPayload`
  - live projection contexts accepting `occurredAt` and an optional `Queryable`
  - baseline writer inserts projection output inside the reset transaction.

- [ ] **Step 1: Implement the shared pure projector**

```ts
export interface CompletedExchangeEvent {
  key: string;
  matchId: string;
  requestId: string;
  requesterId: string;
  responderId: string;
  communityIds: string[];
  requestType: string;
  completedAt: Date;
}

function normalizeProjectionPair(userA: string, userB: string): { userIdA: string; userIdB: string } {
  return userA.localeCompare(userB) <= 0
    ? { userIdA: userA, userIdB: userB }
    : { userIdA: userB, userIdB: userA };
}

function karma(
  userId: string,
  communityId: string,
  points: number,
  reason: ProjectedKarmaRecord['reason'],
  event: CompletedExchangeEvent,
): ProjectedKarmaRecord {
  return { userId, communityId, points, reason, relatedEntityId: event.matchId, createdAt: event.completedAt };
}

export function projectCompletedExchanges(
  input: CompletedExchangeEvent[],
  config: CompletedExchangeProjectionConfig,
): CompletedExchangeProjection {
  const events = [...input].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.key.localeCompare(b.key));
  const trustEdges = new Map<string, ProjectedTrustEdge>();
  const connections = new Map<string, ProjectedConnection>();
  const karmaRecords: ProjectedKarmaRecord[] = [];
  const helperCounts = new Map<string, number>();
  for (const event of events) {
    const pair = normalizeProjectionPair(event.requesterId, event.responderId);
    const connectionKey = `${pair.userIdA}:${pair.userIdB}`;
    const connection = connections.get(connectionKey);
    connections.set(connectionKey, {
      userIdA: pair.userIdA,
      userIdB: pair.userIdB,
      firstConnectedAt: connection?.firstConnectedAt ?? event.completedAt,
      lastInteractionAt: event.completedAt,
    });
    const communityConfigs = event.communityIds.slice(0, 3).map(config.forCommunity);
    for (const community of communityConfigs) {
      const edgeKey = `${connectionKey}:${community.communityId}`;
      const previous = trustEdges.get(edgeKey);
      const matchCompletedCount = (previous?.matchCompletedCount ?? 0) + 1;
      trustEdges.set(edgeKey, {
        userIdA: pair.userIdA,
        userIdB: pair.userIdB,
        communityId: community.communityId,
        matchCompletedCount,
        rawWeight: matchCompletedCount * community.matchCompletedWeight,
        stability: (previous?.stability ?? 1) * (1 + community.stabilityGrowthRate),
        firstInteractionAt: previous?.firstInteractionAt ?? event.completedAt,
        lastInteractionAt: event.completedAt,
      });
    }
    for (const allocation of allocateKarma(communityConfigs, config.baseKarmaPool, event.requestType)) {
      karmaRecords.push(
        karma(event.responderId, allocation.community_id, allocation.helperPoints, 'Provided help', event),
        karma(event.requesterId, allocation.community_id, allocation.requesterPoints, 'Received help', event),
      );
      const helperKey = `${event.responderId}:${allocation.community_id}`;
      const count = (helperCounts.get(helperKey) ?? 0) + 1;
      helperCounts.set(helperKey, count);
      if (count === 1) karmaRecords.push(karma(event.responderId, allocation.community_id, 15, 'First help in community', event));
      if (count === 10) karmaRecords.push(karma(event.responderId, allocation.community_id, 25, '10 exchanges milestone', event));
      if (count === 50) karmaRecords.push(karma(event.responderId, allocation.community_id, 50, '50 exchanges milestone', event));
      if (count === 100) karmaRecords.push(karma(event.responderId, allocation.community_id, 100, '100 exchanges milestone', event));
    }
  }
  return { trustEdges: [...trustEdges.values()], connections: [...connections.values()], karmaRecords };
}
```

Move the pure `allocateKarma` implementation into this shared projection module (or an adjacent shared
file exported from the same subpath). Keep `services/reputation-service/src/services/karmaAllocation.ts`
as a compatibility re-export so existing imports/tests do not churn.

- [ ] **Step 2: Make live social projection timestamp-aware**

```ts
export interface ProjectionContext {
  db?: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
  occurredAt?: Date;
}

const COUNT_COLUMN: Record<InteractionType, string> = {
  match_completed: 'match_completed_count',
  endorsement: 'endorsement_count',
  karma_given: 'karma_given_count',
  event: 'event_count',
};

export async function upsertTrustEdge(params: TrustEdgeParams, context: ProjectionContext = {}): Promise<void> {
  const db = context.db ?? pool;
  const occurredAt = context.occurredAt ?? new Date();
  const { userIdA, userIdB } = normalizePair(params.userA, params.userB);
  const countColumn = COUNT_COLUMN[params.interactionType];
  await db.query(`INSERT INTO social_graph.trust_edges
    (user_id_a, user_id_b, community_id, ${countColumn}, raw_weight, last_interaction_at)
    VALUES ($1, $2, $3, 1, 0, $4)
    ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
      ${countColumn} = social_graph.trust_edges.${countColumn} + 1,
      last_interaction_at = GREATEST(social_graph.trust_edges.last_interaction_at, $4)`,
    [userIdA, userIdB, params.communityId, occurredAt]);
}
```

Thread `occurredAt` through `processMatchCompleted` and `reconcileMatchCompletedCommunities`. Update
`social_graph.connections.first_connected_at` with `LEAST` and `last_interaction_at` with `GREATEST`.

- [ ] **Step 3: Make live karma projection timestamp-aware**

Extend `MatchCompletionData` with `completed_at?: string|Date`, inject a `Queryable`, and insert
`created_at` explicitly for Provided/Received/bonus records. Keep live default behavior unchanged.
Do not let old out-of-order events move `last_interaction_at` backward.

- [ ] **Step 4: Publish the authoritative completion timestamp**

In `matches.ts`, include the DB-returned completion value:

```ts
await publishEvent('match_completed', {
  match_id: id,
  request_id: match.request_id,
  requester_id: match.requester_id,
  responder_id: match.responder_id,
  completed_at: completedMatch.completed_at,
});
```

Use the actual local variable names from the route; do not issue a second timestamp query.

- [ ] **Step 5: Insert batch projections inside the baseline transaction**

`baselineWriter` calls `projectCompletedExchanges`, then inserts connections, trust edges, karma
records, and trust-score inputs through its `PoolClient`. It never imports another service's source.

- [ ] **Step 6: Run focused and cross-workspace GREEN checks**

```powershell
npm --workspace @karmyq/shared test -- --runInBand completedExchange.test.ts
npm --workspace @karmyq/social-graph-service test -- --runInBand sprint-117-projection-time.test.ts
npm --workspace karmyq-reputation-service test -- --runInBand sprint-117-projection-time.test.ts
npm --workspace karmyq-request-service test -- --runInBand
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p services/simulation-service/tsconfig.json
```

Expected: all focused suites PASS; both type checks exit 0.

- [ ] **Step 7: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add packages/shared services/social-graph-service services/reputation-service services/request-service services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts services/simulation-service/package.json
git commit -m "feat: replay completed exchanges at source time"
```

---

## Task 7: Lock API Verification and Story Operations with Failing Tests

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-117-api-verifier.test.ts`
- Create: `services/simulation-service/tests/tdd/sprint-117-story-operations.test.ts`

**Interfaces:**
- Consumes: manifest expectations, existing `MariaStoryPlan`, and `ApiClient`.
- Produces: verifier/story/config interfaces implemented in Task 8.

- [ ] **Step 1: Write the API verifier contract**

```ts
import { verifyCuratedDemo } from '../../src/fixtures/curatedDemo/verifier';

it('reports ready only for non-admin coherent reciprocal privacy-safe stories', async () => {
  const report = await verifyCuratedDemo(fakeWorld({
    mariaRoles: ['member'],
    reciprocalTopology: true,
    unrelatedContextStatus: 404,
    ordinaryFloor: { pathDegree: 2, sharedConnections: 3, mariaOneHop: 4, helperOneHop: 4 },
    runwayDays: 59,
  }));
  expect(report.ready).toBe(true);
  expect(report.storyIds).toEqual({ ordinaryRequestId: ORD_REQ, ordinaryMatchId: MATCH, providerRequestId: PROV_REQ, providerOfferId: OFFER });
});

it.each([
  ['admin Maria', { mariaRoles: ['admin'] }],
  ['forbidden metric', { ordinaryContext: { trust_score: 91 } }],
  ['unrelated access', { unrelatedContextStatus: 200 }],
  ['short runway', { runwayDays: 10 }],
])('fails closed for %s', async (_name, patch) => {
  const report = await verifyCuratedDemo(fakeWorld(patch));
  expect(report.ready).toBe(false);
  expect(report.storyIds).toBeUndefined();
});
```

Also assert the exact reciprocal node/link/path sets, provider decoration, aggregate cohort behavior,
self-only reputation, feed/reachability cases, retention/pulse/governance/activity expectations, and a
403 demo write.

- [ ] **Step 2: Write rotation/config publication tests**

```ts
it('publishes only after replacement stories verify, then retires old stories', async () => {
  const calls: string[] = [];
  await rotateStories(rotationDeps(calls));
  expect(calls).toEqual(['create', 'verify', 'backup-env', 'replace-env', 'restart-auth', 'verify-demo-session', 'retire-old']);
});

it('does not touch env or old stories when verification fails', async () => {
  const deps = rotationDeps([], { verifyReady: false });
  await expect(rotateStories(deps)).rejects.toThrow(/not ready/i);
  expect(deps.publishConfig).not.toHaveBeenCalled();
  expect(deps.retireOld).not.toHaveBeenCalled();
});
```

Assert config publication rejects unknown variable names, creates a backup first, replaces exactly the
five allowlisted values, and writes via same-directory temporary file plus atomic rename.

- [ ] **Step 3: Run and prove RED**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand sprint-117-api-verifier.test.ts sprint-117-story-operations.test.ts
```

Expected: FAIL because verifier/story/config modules do not exist.

- [ ] **Step 4: Run `/pre-commit-check` and commit RED tests**

```powershell
git add services/simulation-service/tests/tdd/sprint-117-api-verifier.test.ts services/simulation-service/tests/tdd/sprint-117-story-operations.test.ts
git commit -m "test: define curated demo API acceptance contract"
```

---

## Task 8: Implement Verifier, Story Lifecycle, Health, Rotation, and Config Publication

**Files:**
- Create: `services/simulation-service/src/fixtures/curatedDemo/verifier.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/storyLifecycle.ts`
- Create: `services/simulation-service/src/fixtures/curatedDemo/configPublisher.ts`
- Create: `services/simulation-service/src/scripts/verifyDemoData.ts`
- Create: `services/simulation-service/src/scripts/rotateMariaStories.ts`
- Modify: `services/simulation-service/src/scenarios/mariaRelationshipStory.ts`
- Modify: `services/simulation-service/src/scripts/rehearseMariaRelationshipStory.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/src/scripts/resetDemoData.ts`
- Modify: `services/simulation-service/package.json`
- Test: Task 7 test files

**Interfaces:**
- Consumes: manifest expectations, compiled story identities, existing story planner/apply functions.
- Produces:
  - `verifyCuratedDemo(deps): Promise<DemoVerificationReport>`
  - `createFreshStories(deps): Promise<VerifiedStoryIds>`
  - `rotateStories(deps): Promise<RotationResult>`
  - `publishDemoConfig(path, values, fsDeps): Promise<ConfigBackup>`
  - CLI scripts `reset:demo`, `verify:demo`, `rotate:demo-stories`.

- [ ] **Step 1: Add exact unwrapped API reads**

Add methods for existing endpoints only: request detail, curated/feed, relationship contexts, trust
graph/neighborhood, self community summary, provider routes, community aggregate/pulse/governance,
retention policy, and demo-session probe. Every method returns `res.data` because the interceptor has
already unwrapped the envelope.

```ts
async getRetentionPolicy(communityId: string): Promise<RetentionPolicyResponse> {
  return this.client.get('/requests/retention-policy', { params: { communityId } });
}
```

- [ ] **Step 2: Implement recursive privacy and reciprocal checks**

```ts
const FORBIDDEN_ORDINARY_KEYS = new Set([
  'trust_score', 'karma', 'raw_weight', 'effective_weight', 'current_weight',
  'interaction_count', 'match_completed_count', 'last_interaction_at',
]);

export function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => findForbiddenKeys(item, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(FORBIDDEN_ORDINARY_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(child, `${path}.${key}`),
  ]);
}
```

Canonicalize nodes/links/path by stable IDs and compare both orientations. Validate Maria's roles from
live communities, not JWT claims alone. The unrelated viewer must receive the route's safe denial.

- [ ] **Step 3: Build fresh stories through ordinary APIs and authoritative readback**

Refactor the reusable login/gather/readback functions out of `rehearseMariaRelationshipStory.ts`.
Select only manifest-declared helper/provider identities. Reuse `applyMariaRelationshipStory` for
creation but forbid repair actions: the curated historical baseline must already satisfy the floor.
Return IDs only from the final verifier report.

- [ ] **Step 4: Implement backed-up allowlisted config publication**

```ts
export const DEMO_CONFIG_KEYS = [
  'DEMO_PERSONA_EMAIL', 'DEMO_ORDINARY_REQUEST_ID', 'DEMO_ORDINARY_MATCH_ID',
  'DEMO_PROVIDER_REQUEST_ID', 'DEMO_PROVIDER_OFFER_ID',
] as const;
```

Reject missing/extra keys. Copy `.env.demo` to `.env.demo.<UTC>.bak`, replace only anchored key lines in
memory, write `.env.demo.tmp` in the same directory with restrictive permissions, then rename.

- [ ] **Step 5: Wire reset completion, health, and rotation CLIs**

`reset:demo -- --apply` stops after DB apply if API validation fails. On success it creates stories,
verifies, optionally publishes with `--publish-config`, restarts auth through an injected runner,
re-verifies demo-session, enables demo, resumes cleanup, and finally resumes ambient simulation.
`verify:demo` is read-only. `rotate:demo-stories` is dry-run unless `--apply` and never calls reset.

- [ ] **Step 6: Keep rehearsal as a compatibility wrapper**

`rehearse:maria-relationship` prints a deprecation line and calls the new dry-run story planner/verifier;
it must not retain a separate implementation path.

- [ ] **Step 7: Run GREEN tests and build**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand sprint-117-api-verifier.test.ts sprint-117-story-operations.test.ts sprint-116-maria-story.test.ts
npm --workspace @karmyq/simulation-service run build
```

Expected: all named suites PASS and build exits 0.

- [ ] **Step 8: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add services/simulation-service
git commit -m "feat: verify and rotate curated Maria stories"
```

---

## Task 9: Protect the Fixture Core and Replace Legacy Reset Entrypoints

**Files:**
- Create: `services/simulation-service/tests/tdd/sprint-117-protected-core.test.ts`
- Modify: `services/simulation-service/src/db-user-loader.ts`
- Modify: `scripts/truncate-database.sh`
- Modify: `scripts/truncate-database.bat`
- Modify: `scripts/truncate-database.sql`
- Modify: `scripts/deploy.sh`
- Modify: `services/simulation-service/package.json`

**Interfaces:**
- Consumes: `getProtectedFixtureEmails()` from Task 2 and the reset/verify CLIs from Tasks 4/8.
- Produces: one simulator actor filter and one supported operator reset path.

- [ ] **Step 1: Write protected-core and legacy-path tests first**

```ts
it('binds every protected manifest email as an exclusion in actor and count queries', async () => {
  const protectedEmails = getProtectedFixtureEmails();
  await getRandomUser();
  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain('lower(email) <> ALL');
  expect(params).toContainEqual(protectedEmails.map(x => x.toLowerCase()));
});
```

Add source-contract assertions that the shell/batch wrappers invoke `reset:demo`, direct SQL refuses
destructive execution, deploy never contains `reset:demo -- --apply`, and post-deploy output recommends
read-only `verify:demo` only.

- [ ] **Step 2: Run the new test and prove RED**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand sprint-117-protected-core.test.ts
```

Expected: FAIL because actor filtering still excludes only the configured Maria email.

- [ ] **Step 3: Implement one parameterized protected filter**

```ts
export function buildActorPoolPredicate(): { where: string; params: unknown[] } {
  const protectedEmails = getProtectedFixtureEmails().map(email => email.toLowerCase());
  return {
    where: `${SIM_ACTOR_POOL_FILTER} AND lower(email) <> ALL($1::text[])`,
    params: [protectedEmails],
  };
}
```

Use this predicate in random selection, counts, and any bulk actor loader. Preserve the `@karmyq.test`
fixture exclusion and `@test.karmyq.com` inclusion.

- [ ] **Step 4: Replace legacy reset paths**

- Bash delegates arguments to `npm --workspace @karmyq/simulation-service run reset:demo -- "$@"`.
- Batch delegates `%*` to the same npm script.
- SQL prints a refusal explaining that backup/fingerprint/lock cannot be guaranteed and terminates
  before any `TRUNCATE`.
- Deploy prints the `verify:demo` command after service health. It never resets or rotates.

- [ ] **Step 5: Verify scripts and tests**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand sprint-117-protected-core.test.ts sprint-116-demo-persona-exclusion.test.ts
bash -n scripts/truncate-database.sh
bash -n scripts/deploy.sh
```

Expected: both suites PASS and Bash syntax checks exit 0.

- [ ] **Step 6: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add services/simulation-service scripts/truncate-database.sh scripts/truncate-database.bat scripts/truncate-database.sql scripts/deploy.sh
git commit -m "fix: protect curated fixtures from ambient mutation"
```

---

## Task 10: Prove Full-Reset Determinism in a Migrated Database

**Files:**
- Create: `tests/tdd/sprint-117-demo-reset.integration.test.ts`
- Modify: `services/simulation-service/src/fixtures/curatedDemo/baselineWriter.ts`
- Modify: `services/simulation-service/src/fixtures/curatedDemo/resetCoordinator.ts`
- Modify: `services/simulation-service/src/fixtures/curatedDemo/manifest.ts`

**Interfaces:**
- Consumes: reset/compiler/projection modules and current migrations.
- Produces: DB-backed evidence for table coverage, FK integrity, idempotent second reset, relative age,
  cleanup state, and no overdue unprocessed rows.

- [ ] **Step 1: Write the integration test before implementing the remaining baseline insert paths**

```ts
describe('Sprint 117 full demo reset', () => {
  it('applies twice with stable historical IDs and a shifted anchor', async () => {
    const first = await applyToTestDb(new Date('2026-07-02T12:00:00Z'));
    const second = await applyToTestDb(new Date('2026-08-02T12:00:00Z'));
    expect(second.semanticIds).toEqual(first.semanticIds);
    expect(second.requestCreatedAtMs - first.requestCreatedAtMs).toBe(31 * 86_400_000);
    expect(second.foreignKeyViolations).toEqual([]);
    expect(second.unclassifiedTables).toEqual([]);
    expect(second.overdueUnprocessedRows).toEqual([]);
  });
});
```

The test uses only a database whose fingerprint marker is created by test setup. It never points at
the deployed demo. Validate exact counts from the compiled baseline rather than hard-coding SQL totals.

- [ ] **Step 2: Run against the migrated integration database and prove RED if Docker is available**

```powershell
npm --workspace @karmyq/tests run test:tdd -- --runInBand sprint-117-demo-reset.integration.test.ts
```

Expected locally without Docker: suite reports its existing documented DB prerequisite and remains in
TDD. In CI/deployed test infrastructure: FAIL on the first missing insert/table classification.

- [ ] **Step 3: Complete dependency-ordered baseline inserts**

Use parameterized `PoolClient.query` calls only. Insert users → communities/config → memberships →
providers/activities → historical requests/junctions/matches/feedback → shared projections → forgotten
sentinels. Accept the one runtime credential hash as a parameter for `auth.users`; never read a secret
inside the manifest/compiler. Do not disable constraints or `session_replication_role`; FK order is
part of correctness.

- [ ] **Step 4: Add cleanup-boundary assertions**

Assert fresh requests are unexpired, expired examples have `expired=true`, >180-day completed content
already carries `[forgotten]`/`{}` sentinels, near-threshold trust examples are not story dependencies,
and Maria live-story prerequisites remain above floor.

- [ ] **Step 5: Run available checks**

```powershell
npm --workspace @karmyq/simulation-service test -- --runInBand
npm --workspace @karmyq/simulation-service run build
npm --workspace @karmyq/tests run test:tdd -- --runInBand sprint-117-demo-reset.integration.test.ts
```

Expected: pure/service tests PASS; DB suite PASS where PostgreSQL is available or remains explicitly
TDD with the documented environment prerequisite locally.

- [ ] **Step 6: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add tests/tdd/sprint-117-demo-reset.integration.test.ts services/simulation-service/src/fixtures/curatedDemo
git commit -m "test: prove curated demo reset determinism"
```

---

## Task 11: Ship Operator, Architecture, Context, and Landing Documentation

**Files:**
- Modify: `docs/guides/demo-data.md`
- Modify: `docs/adr/ADR-024-synthetic-user-simulation.md`
- Modify: `docs/adr/ADR-084-context-bound-connection-visibility.md`
- Modify: `scripts/README.md`
- Modify: `docs/README.md`
- Modify: `services/simulation-service/CONTEXT.md`
- Modify: `services/auth-service/CONTEXT.md`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/reputation-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/guides/demo-data.json`
- Modify: `apps/landing/src/data/docs/concepts/adr-024-synthetic-user-simulation.json`
- Modify: `apps/landing/src/data/docs/concepts/adr-084-context-bound-connection-visibility.json`
- Modify: `apps/landing/src/data/docs/services/simulation-service.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: final CLI names/contracts and event payload from Tasks 4–10.
- Produces: v11.26.0 public/operator truth and generated landing docs.

- [ ] **Step 1: Update the user guide without implying real-user activity**

State that the demo begins from a deterministic, age-aware synthetic baseline and then permits ambient
synthetic activity. Explain protected Maria stories, finite expiry, designed-to-forget behavior, and
that numbers/people are illustrative—not real users or frozen screenshots.

- [ ] **Step 2: Amend ADR-024 and ADR-084**

ADR-024 records the hybrid baseline + ambient decision, guarded reset, relative ages, and why manual
opaque SQL/API-only replay were rejected. Correct its stale title numbering if the document still says
`ADR-006`, and mark the implemented parts accurately. ADR-084 replaces additive candidate discovery
with a curated historical floor plus API-created live story and API verification.

- [ ] **Step 3: Document exact operator commands**

```powershell
# Read-only plan
npm --workspace @karmyq/simulation-service run reset:demo

# Read-only health
npm --workspace @karmyq/simulation-service run verify:demo

# Destructive operation — approved downtime only
npm --workspace @karmyq/simulation-service run reset:demo -- --apply --publish-config

# Finite-story replacement, not a full reset
npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config
```

Include backup location, maintenance behavior, recovery choices, and the explicit prohibition on
running raw `truncate-database.sql`.

- [ ] **Step 4: Update service contexts and registry**

Document protected/ambient ownership, source-time projection, `completed_at` compatibility, verifier
classes, and story-ID publication. Update simulation-service notes plus request/social-graph/reputation
service notes in `services/registry.json` to describe optional `match_completed.completed_at`; do not
invent CLI endpoints in `apis.provides`.

- [ ] **Step 5: Set version and regenerate landing docs**

```powershell
npm version 11.26.0 --no-git-tag-version
npm --workspace karmyq-landing run generate-docs
```

Verify `nav.json` still contains `demo-data`, `adr-024-*`, and
`adr-084-*`; reapply if generation reverts it.

- [ ] **Step 6: Verify docs directly**

```powershell
npm --workspace karmyq-landing test -- --runInBand
npm --workspace karmyq-landing run build
npx jest tests/regression/doc-context-drift-gate.test.ts --runInBand --forceExit
npm run feedback:check
git diff --check
```

Expected: landing tests/build, doc drift 5/5, feedback, and whitespace checks PASS.

- [ ] **Step 7: Run `/simplify`, `/pre-commit-check`, and commit**

```powershell
git add docs scripts/README.md services/simulation-service/CONTEXT.md services/auth-service/CONTEXT.md services/social-graph-service/CONTEXT.md services/reputation-service/CONTEXT.md services/request-service/CONTEXT.md services/registry.json apps/landing/src/data/docs package.json package-lock.json
git commit -m "docs: publish curated demo reset operating model"
```

---

## Task 12: Run All Four SDLC Quality Gates

**Files:**
- Modify: any file required to resolve a real finding.
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: the complete branch diff.
- Produces: written green evidence for testing, simplify, code review, and security review.

- [ ] **Step 1: Testing gate**

```powershell
npm test
```

If Windows Turbo hits the known Jest shared-cache `EPERM`, rerun affected workspaces directly using
`C:\tmp\jest-s117-shared`, `C:\tmp\jest-s117-simulation`, `C:\tmp\jest-s117-unit`, and
`C:\tmp\jest-s117-regression`; record both the parallel failure and isolated green counts. Do not
dismiss assertion failures as cache races.

- [ ] **Step 2: Run final `/simplify` on the branch diff**

Verification: record “no findings” or commit each accepted simplification with focused tests.

- [ ] **Step 3: Run `/code-review` on `origin/master...HEAD`**

Verification: resolve every correctness/privacy/operations finding or document evidence-backed pushback
in the PR body. Re-run affected tests after fixes.

- [ ] **Step 4: Run `/security-review` on `origin/master...HEAD`**

Review database fingerprint bypass, shell injection, backup leakage, env-file permissions, log secrets,
path traversal, dynamic SQL identifiers, SSRF/API bases, arbitrary production wipe exposure, and
authorization scope. Verification: no unresolved HIGH/MEDIUM; record justified dismissals in the PR.

- [ ] **Step 5: Run dependency and disclosure gates**

```powershell
npm audit --audit-level=high
npx jest tests/regression/reputation-disclosure-gate.test.ts --runInBand --forceExit
```

Expected: zero high/critical vulnerabilities; disclosure gate PASS.

- [ ] **Step 6: Update handoff with gate evidence and commit through `/pre-commit-check`**

```powershell
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: record Sprint 117 quality gates"
```

---

## Task 13: Final Type, Test, Feedback, and Pre-Push Verification

**Files:**
- Modify: only files needed to resolve final verification failures.

**Interfaces:**
- Consumes: gate-clean branch.
- Produces: push-ready branch and filled PR evidence.

- [ ] **Step 1: Type-check every affected workspace**

```powershell
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p services/simulation-service/tsconfig.json
npx tsc --noEmit -p services/social-graph-service/tsconfig.json
npx tsc --noEmit -p services/reputation-service/tsconfig.json
npx tsc --noEmit -p services/request-service/tsconfig.json
```

Expected: all exit 0.

- [ ] **Step 2: Run affected suites serially**

```powershell
npm --workspace @karmyq/shared test -- --runInBand
npm --workspace @karmyq/simulation-service test -- --runInBand
npm --workspace @karmyq/social-graph-service test -- --runInBand
npm --workspace karmyq-reputation-service test -- --runInBand
npm --workspace karmyq-request-service test -- --runInBand
npm --workspace @karmyq/tests run test:unit -- --runInBand --forceExit
npm --workspace @karmyq/tests run test:regression -- --runInBand --forceExit
```

Expected: all unit/regression suites PASS. Promote green Sprint 117 TDD tests to regression; keep only
the DB-backed rehearsal in TDD until its deployed PostgreSQL pass.

- [ ] **Step 3: Run governance checks**

```powershell
npm run analyze:services
npm run feedback:check
git diff --check
git status --short
```

Expected: dependency analysis clean, feedback actions resolved, no whitespace errors, and only intended
files changed.

- [ ] **Step 4: Run reset/health CLIs in read-only mode**

```powershell
npm --workspace @karmyq/simulation-service run reset:demo
npm --workspace @karmyq/simulation-service run verify:demo
```

Expected without deployed credentials: reset prints a non-mutating plan or a clear missing-fingerprint
refusal; verifier prints a clear unavailable result. Neither changes DB, env, processes, or files.

- [ ] **Step 5: Run `/pre-commit-check` and commit final fixes if needed**

If a verification failure required a fix, return to the owning task's exact file list, stage only
those paths, and commit `fix: resolve Sprint 117 verification findings`. Omit the commit when no final
fixes exist; do not create an empty marker commit.

---

## Task 14: PR, Merge, Deploy, Controlled Reset, and Human Validation

**Files:**
- Modify: `.github/pull_request_template.md` only as a temporary body source; do not change it.
- Modify: `.claude/handoff/CURRENT_HANDOFF.md` with final deployed evidence before the PR's last commit.

**Interfaces:**
- Consumes: push-ready branch, deployment skill, approved planned downtime.
- Produces: merged v11.26.0, restored public demo, verified story IDs, and completed Sprint 117 handoff.

- [ ] **Step 1: Fill the complete PR contract**

Copy `.github/pull_request_template.md`, fill every header, and include:

- table classification/reset scope;
- backup/fingerprint/lock/transaction controls;
- fixture counts and temporal lanes;
- story/API privacy evidence;
- local Docker limitation and deployed integration gate;
- testing/simplify/code/security review evidence;
- security dismissals with links or “None.”

- [ ] **Step 2: Push and open the PR**

```powershell
git push -u origin agent/codex/sprint-117-curated-demo-reset
gh pr create --base master --head agent/codex/sprint-117-curated-demo-reset --title "Sprint 117: controlled demo reset and curated fixtures" --body-file C:\tmp\sprint-117-pr.md
```

Use a workspace-local temporary body file created through the normal editor/apply-patch workflow and
remove it after PR creation. Monitor required checks; resolve failures rather than bypassing hooks.

- [ ] **Step 3: Obtain cross-agent review and explicit Admin merge/deploy authorization**

Claude owns merge-readiness recommendation and Sprint completion. Contributor agents do not self-merge.
When Admin explicitly authorizes, use the documented squash admin override if the solo-review rule is
the only blocker. Verify PR state after any `gh` fast-forward warning.

- [ ] **Step 4: Use the project `/deploy` skill**

Deploy through GitHub Actions first. Confirm v11.26.0 services are healthy before reset. Do not run the
destructive command as an automatic deployment hook.

- [ ] **Step 5: Begin approved maintenance and run dry-run**

On the demo host:

```bash
npm --workspace @karmyq/simulation-service run reset:demo
```

Review database fingerprint, every classified table/count, compiled fixture counts, reset anchor,
backup destination, paused processes, and planned story actions. Abort on any mismatch.

- [ ] **Step 6: Execute the controlled full reset**

```bash
npm --workspace @karmyq/simulation-service run reset:demo -- --apply --publish-config
```

Capture backup path, reset anchor, stable historical fixture checksum, server-generated four story IDs,
API report, expiry runway, config backup, auth restart, cleanup resume, and simulator resume. Any failure
keeps the demo disabled; follow the printed rerun/restore path.

- [ ] **Step 7: Promote the deployed DB integration test**

Run `sprint-117-demo-reset.integration.test.ts` against the reset environment. It must pass twice/reset-
anchor behavior before moving from TDD to regression in the final PR update. If promotion needs a code
commit, repeat CI and deploy before public enablement.

- [ ] **Step 8: Run the human validation contract**

- API: `verify:demo` reports ready, reciprocal topology, privacy denials, 403 demo write, and ≥14-day
  runway.
- DB: no FK violations/unclassified tables/overdue unprocessed rows; backup is restorable.
- UI desktop/mobile: guided `/demo`, Home, Community, Network, Profile/Memory, Providers, and retention
  transparency render coherent curated states.
- Five-second test: viewer can explain connection, belonging, and provider role.
- Wait for ambient simulation activity, rerun health, and prove protected stories remain unchanged.

- [ ] **Step 9: Update handoff and close only with Claude/Admin authority**

Record merge SHA, deploy run, backup, anchor, verified IDs (IDs are not secrets), health output, fixture
checksum, human validation, any tuning follow-up, and next health/rotation date. Claude is the only agent
that marks Sprint 117 complete.

---

## Success Criteria

- One supported full-reset command is dry-run by default and cannot target an unknown environment.
- Every current application table is explicitly reset/reseeded/preserved; schema drift fails closed.
- A verified backup precedes mutation; historical baseline/projections apply atomically.
- Two resets reproduce stable historical IDs and behavior with timestamps shifted by the reset anchor.
- Maria remains an active non-admin and all protected dependencies remain untouched by simulation.
- Live story IDs are server-generated, authoritative-readback verified, atomically published, and have
  at least 14 days of runway.
- Ordinary rich floor, provider contrast, reciprocal topology, reachability, unrelated denial, and
  ADR-082 privacy checks pass through outward APIs.
- Age-sensitive pulse, expiry, retention, decay, karma, memory, dibs, and governance fixtures match the
  implemented platform rules.
- Health is read-only; rotation replaces only finite live stories; neither can trigger a full reset.
- Unit/regression, TypeScript, docs, feedback, simplify, code review, security review, CI, deployed DB,
  API, DB sanity, and desktop/mobile human validation are green.
