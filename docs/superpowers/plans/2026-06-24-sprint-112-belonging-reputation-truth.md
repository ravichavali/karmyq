# Sprint 112: Belonging & Reputation Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an API-enforced, regression-resistant reputation disclosure boundary first, then make
My Network a prominent, truthful member experience built only on those safe contracts.

**Architecture:** PR A introduces strict shared disclosure schemas, an inventory/CI gate, one
canonical self-summary endpoint, and safe projections across reputation, governance, social graph,
invitations, paths, and exports. PR B branches from deployed PR A and consumes those contracts for
navigation, Home, Profile, My Network, and retirement of ranking UI.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 15 Pages Router, React 19, PostgreSQL 15, Zod,
Jest/Testing Library, D3, service registry governance.

## Global Constraints

- Exact ordinary-member reputation metrics are self-only; protected fields are omitted, never zeroed.
- Public provider ratings and anonymous community aggregates with at least five distinct members are
  the only public numeric exceptions.
- Internal scoring, governance thresholds, vote weights, matching, decay, and background jobs remain
  unchanged.
- All `404`/`410` denials use ADR-074:
  `{ success:false, message:string, error:string }`.
- Cross-user tests use non-zero sentinel values and assert forbidden keys are absent at every depth.
- No database migration and no scratch regeneration of `package-lock.json`.
- PR A must merge and deploy independently before PR B branches from updated `origin/master`.
- My Network is prominent on Home but remains below pending decisions and actionable requests.
- Run `/simplify` after every implementation task; run testing, `/code-review`, and
  `/security-review` before each PR merge.

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `packages/shared/src/schemas/reputationDisclosure.ts` | Strict Zod schemas, DTO types, disclosure classes, forbidden-key scanner, relationship-state enum |
| `packages/shared/src/schemas/reputationDisclosure.test.ts` | Strict-schema and forbidden-key unit tests |
| `services/reputation-service/src/utils/disclosureAuth.ts` | Self, active-membership, admin, and ≥5-member aggregate authorization helpers |
| `services/reputation-service/tests/tdd/sprint-112-reputation-boundary.test.ts` | Canonical self summary, compatibility denials, config-route isolation, ADR-074 envelopes |
| `services/social-graph-service/src/services/disclosureProjection.ts` | Safe graph/path/card/memory/invitation projections |
| `services/social-graph-service/tests/tdd/sprint-112-disclosure-projection.test.ts` | Sentinel tests for every social-graph outward contract |
| `services/community-service/tests/tdd/sprint-112-governance-export-privacy.test.ts` | Governance and export projection regression |
| `tests/fixtures/reputation-disclosure-inventory.json` | Endpoint → disclosure class → schema → test ownership |
| `tests/regression/reputation-disclosure-gate.test.ts` | Registry/inventory/schema/test/envelope drift gate |
| `docs/adr/ADR-082-reputation-disclosure-boundary.md` | Platform-wide decision and exceptions |
| `apps/frontend/src/components/reputation/SelfCommunitySummary.tsx` | One reusable self-summary presentation |
| `apps/frontend/src/components/dashboard/HomeNetworkPreview.tsx` | Home belonging preview using safe graph + canonical summary |
| `apps/frontend/tests/tdd/sprint-112-reputation-truth.test.tsx` | Profile/My Network parity and terminology |
| `apps/frontend/tests/tdd/sprint-112-network-prominence.test.tsx` | Navigation, Home altitude, and fail-soft behavior |

### Existing files to modify

| Area | Files |
|---|---|
| Shared exports | `packages/shared/index.ts`, `packages/shared/package.json`, `packages/shared/CONTEXT.md` |
| Reputation service | `src/routes/reputation.ts`, `src/routes/health.ts`, `src/services/karmaService.ts`, `CONTEXT.md` |
| Social graph | `src/database/trustEdgeDb.ts`, `src/services/pathComputation.ts`, `src/routes/trustGraph.ts`, `src/routes/paths.ts`, `src/routes/trustCard.ts`, `src/routes/invitations.ts`, `src/routes/network.ts`, `src/routes/trustDecayConfig.ts`, `CONTEXT.md` |
| Community service | `src/database/governanceDb.ts`, `src/routes/governance.ts`, `src/routes/export.ts`, `CONTEXT.md` |
| Frontend contracts | `src/lib/api.ts`, `src/lib/socialGraphClient.ts`, `src/hooks/useTrustPath.ts`, `src/components/graphs/types.ts`, `src/components/graphs/normalizeGraphData.ts`, `src/components/graphs/TrustGraphHEB.tsx`, `src/components/TrustPathBadge.tsx`, `src/components/TrustCard.tsx`, `src/components/Invitations/InviteHistory.tsx`, `src/components/profile/MemorySection.tsx`, `src/components/relationships/ReWarmingNudge.tsx` |
| Frontend prominence | `src/components/Layout.tsx`, `src/components/Feed/UnifiedFeed.tsx`, `src/pages/dashboard.tsx`, `src/pages/network.tsx`, `src/pages/profile.tsx`, `src/pages/reputation/karma.tsx`, `src/components/RightSidebar.tsx`, `src/components/GovernanceTab.tsx`, `src/lib/onboarding/workflows.ts`, `CONTEXT.md` |
| Governance/docs | `services/registry.json`, `docs/adr/README.md`, `docs/adr/ADR-081-belonging-graph-system.md`, `docs/guides/trust-graph.md`, `docs/concepts/reading-the-trust-graph.md`, `docs/concepts/trust-and-karma.md`, `docs/BUGS.md`, root `package.json`, root `package-lock.json`, `.claude/handoff/CURRENT_HANDOFF.md` |

---

## ⚠️ Critical Implementation Notes

1. `POST /paths/batch` is called by request-service, but its feed ranker uses only
   `degrees_of_separation`; remove outward `trust_score` without changing feed ranking.
2. Keep internal `path_trust_score` caching and `getTrustEdge()` calculations. Retire only the
   public arbitrary-pair `GET /trust/edge` route.
3. `GET /trust/me/memory` and `/trust/relationships/fading` currently leak `currentWeight`; project
   only `decayTier`, dates, counts, and authorized peer identity.
4. Graph database queries may keep numeric weights internally for top-149 selection and decay
   classification. Strict projection occurs before `res.json`.
5. Community export code contains legacy singular-schema names. Do not broaden S112 into schema
   cleanup; alter only the reputation sections and preserve unrelated export behavior.
6. `reputation-service/src/index.ts` already mounts authentication before both reputation routers.
   Route-level `authMiddleware` calls are redundant but out of scope unless simplification proves
   safe.
7. The legacy `GET /network` social-graph route is structural-only and may remain classified
   `ordinary_member`; no new UI may use it.
8. `/trust/decay-config*` is community policy, not personal reputation: classify GET as
   `community_aggregate` (membership-gated) and PUT as `internal` (admin).
9. Community health, milestones, community trust, and network metrics require active membership and
   five-member suppression.
10. Do not hand-edit generated landing JSON; use `npm run generate-docs`.

---

# PR A — Reputation Disclosure Boundary

## Task 1: Create PR A branch and strict shared disclosure contracts

**Files:**
- Create: `packages/shared/src/schemas/reputationDisclosure.ts`
- Create: `packages/shared/src/schemas/reputationDisclosure.test.ts`
- Modify: `packages/shared/index.ts`
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/CONTEXT.md`

**Interfaces:**
- Produces: `DisclosureClass`, `RelationshipStateSchema`, `SelfCommunityReputationSchema`,
  `GovernanceStateSchema`, `SafePersonGraphSchema`, `SafeTrustPathSchema`,
  `CommunityAggregateSchema`, `ProviderReputationSchema`, `assertNoForbiddenReputationKeys`.

- [ ] **Step 1: Create the privacy branch from remote master**

```powershell
git fetch origin
git checkout -b feature/sprint-112-reputation-disclosure-boundary origin/master
git status --short
```

Expected: branch is `feature/sprint-112-reputation-disclosure-boundary`; only the approved planning
files/backlog edits are present.

- [ ] **Step 2: Write failing strict-schema tests**

```typescript
const safeNode = { user_id: 'u2', name: 'Peer', is_current_user: false }
expect(() => SafeBelongingNodeSchema.parse({ ...safeNode, karma: 913 })).toThrow()
expect(() => SafeBelongingLinkSchema.parse({
  source: 'u1', target: 'u2', relationship_state: 'warm', effective_weight: 7.25,
})).toThrow()
expect(() => SelfCommunityReputationSchema.parse({
  scope: { type: 'community', community_id: 'c1', community_name: 'One' },
  reputation: { score: 27, scale_min: 0, scale_max: 100, tier: 'active', calculated_at: NOW },
  karma: { current: 40, trend: 'stable', half_life_days: 180, calculated_at: NOW },
  activity: { recent_helps: 2, recent_requests: 1, window_days: 30 },
})).not.toThrow()
```

- [ ] **Step 3: Run the test and verify RED**

```powershell
npx jest packages/shared/src/schemas/reputationDisclosure.test.ts --runInBand
```

Expected: FAIL because the schema module does not exist.

- [ ] **Step 4: Implement strict Zod schemas and forbidden-key recursion**

```typescript
export const DisclosureClassSchema = z.enum([
  'self', 'ordinary_member', 'provider', 'community_aggregate', 'internal',
])
export const RelationshipStateSchema = z.enum([
  'strong', 'warm', 'fading', 'nearly_forgotten',
])
export const SafeBelongingNodeSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string(),
  is_current_user: z.boolean(),
  degrees_of_separation: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
}).strict()
export const FORBIDDEN_ORDINARY_MEMBER_KEYS = new Set([
  'trust_score', 'karma', 'total_karma', 'raw_weight', 'effective_weight', 'currentWeight',
])
```

Export the module through `packages/shared/index.ts` and a
`"./schemas/reputation-disclosure"` package subpath.

- [ ] **Step 5: Run shared tests and simplify**

```powershell
npx jest packages/shared/src/schemas/reputationDisclosure.test.ts --runInBand
npm run build --workspace packages/shared
```

Expected: PASS and shared TypeScript build succeeds. Run `/simplify` on this task’s diff.

- [ ] **Step 6: Commit**

Run the mandatory `pre-commit-check` skill, then:

```powershell
git add packages/shared
git commit -m "feat(shared): define reputation disclosure contracts"
```

---

## Task 2: Add registry classification and the disclosure CI gate

**Files:**
- Create: `tests/fixtures/reputation-disclosure-inventory.json`
- Create: `tests/regression/reputation-disclosure-gate.test.ts`
- Modify: `services/registry.json`

**Interfaces:**
- Consumes: `DisclosureClassSchema`, `assertNoForbiddenReputationKeys`.
- Produces: registry field `reputation_disclosure` and inventory entries with
  `{ service, method, path, class, schema, contract_test }`.

- [ ] **Step 1: Write the failing drift-gate test**

```typescript
expect(inventoryEntry).toEqual(expect.objectContaining({
  service: expect.any(String),
  method: expect.stringMatching(/GET|POST|PUT|DELETE|PATCH/),
  path: expect.stringMatching(/^\//),
  class: expect.stringMatching(/self|ordinary_member|provider|community_aggregate|internal/),
  schema: expect.any(String),
  contract_test: expect.any(String),
}))
expect(fs.existsSync(path.join(ROOT, inventoryEntry.contract_test))).toBe(true)
```

The test must compare sensitive registry entries and inventory entries in both directions and scan
protected fixtures for forbidden nested keys.

- [ ] **Step 2: Verify RED**

```powershell
cd tests
npx jest regression/reputation-disclosure-gate.test.ts --runInBand
```

Expected: FAIL because the inventory and registry classifications do not exist.

- [ ] **Step 3: Classify all sensitive endpoints**

Include reputation self/config routes, provider routes, community aggregate routes, graph/path/card/
memory/edge/decay/network routes, invitations, governance, and export routes. Classify
`GET /trust/edge` as `ordinary_member` with planned retirement and all `:userId` config routes as
`self`.

- [ ] **Step 4: Make the gate pass**

```powershell
cd tests
npx jest regression/reputation-disclosure-gate.test.ts --runInBand
```

Expected: PASS. Run `/simplify`.

- [ ] **Step 5: Commit**

Run `pre-commit-check`, then:

```powershell
git add services/registry.json tests/fixtures/reputation-disclosure-inventory.json tests/regression/reputation-disclosure-gate.test.ts
git commit -m "test: gate reputation disclosure contracts"
```

---

## Task 3: Build the canonical self summary and harden reputation routes

**Files:**
- Create: `services/reputation-service/src/utils/disclosureAuth.ts`
- Create: `services/reputation-service/tests/tdd/sprint-112-reputation-boundary.test.ts`
- Modify: `services/reputation-service/src/services/karmaService.ts`
- Modify: `services/reputation-service/src/routes/reputation.ts`

**Interfaces:**
- Produces: `getSelfCommunityReputation(userId, communityId): Promise<SelfCommunityReputation>`,
  `requireSelf`, `requireActiveMember`, `requireCommunityAdmin`, `requireAggregateCohort`.
- New endpoint: `GET /reputation/me/community-summary?community_id=`.

- [ ] **Step 1: Write failing route/service tests**

Cover exact self summary, missing community `400 INVALID_COMMUNITY_ID`, inactive membership
`404 REPUTATION_NOT_FOUND`, cross-user compatibility reads/config routes `404
REPUTATION_NOT_FOUND`, and leaderboard `410 REPUTATION_LEADERBOARD_RETIRED`. Assert every denial
has exactly `success`, `message`, and string `error`.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace services/reputation-service -- --runInBand
```

Expected: FAIL on missing endpoint/helper and current cross-user `200`/`403`.

- [ ] **Step 3: Implement the canonical summary**

Compose existing `getUserKarmaWithDecay()` and `getUserTrustScore()` without changing their math:

```typescript
return SelfCommunityReputationSchema.parse({
  scope: { type: 'community', community_id: communityId, community_name: membership.name },
  reputation: {
    score: trust.trust_score,
    scale_min: 0,
    scale_max: 100,
    tier: reputationTier(trust.trust_score),
    calculated_at: trust.last_updated ?? now,
  },
  karma: { current: karma.karma, trend: karma.trend, half_life_days: 180, calculated_at: now },
  activity: {
    recent_helps: karma.recent_helps,
    recent_requests: karma.recent_requests,
    window_days: 30,
  },
})
```

- [ ] **Step 4: Harden all self/config compatibility endpoints**

Remove the current admin exception from trust-config reads/history. Use JWT identity plus active DB
membership. Return ADR-074 errors through `sendError`. Keep community-policy admin endpoints
admin-only.

- [ ] **Step 5: Audit and retire the member leaderboard**

```powershell
rg -n "getCommunityLeaderboard|getLeaderboard|/leaderboard/" . -g "!node_modules/**" -g "!dist/**" -g "!docs/**"
```

Record the only callers in the task notes. Keep `getCommunityLeaderboard()` temporarily if service
tests/internal code still exercise it, but the HTTP endpoint must return `410` without rows.

- [ ] **Step 6: Run focused tests and promote**

```powershell
npm run test:tdd --workspace services/reputation-service -- --runInBand
npm run test:unit --workspace services/reputation-service -- --runInBand
npm run test:regression --workspace services/reputation-service -- --runInBand
node scripts/promote-tdd-tests.js
```

Expected: all PASS. Run `/simplify`.

- [ ] **Step 7: Commit**

Run `pre-commit-check`, then:

```powershell
git add services/reputation-service
git commit -m "fix(reputation): enforce self-only reputation boundary"
```

---

## Task 4: Protect aggregate and policy endpoints

**Files:**
- Modify: `services/reputation-service/src/routes/reputation.ts`
- Modify: `services/reputation-service/src/routes/health.ts`
- Modify: `services/social-graph-service/src/routes/trustDecayConfig.ts`
- Test: `services/reputation-service/tests/tdd/sprint-112-reputation-boundary.test.ts`

**Interfaces:**
- Consumes: `requireActiveMember`, `requireAggregateCohort`, `requireCommunityAdmin`.
- Produces: membership-gated, ≥5-member aggregate reads.

- [ ] **Step 1: Add failing tests**

Test `community-trust`, `community-health`, `milestones`, and `network-metrics` for non-member denial,
four-member suppression (`404 AGGREGATE_NOT_AVAILABLE`), and five-member success. Test trust decay
config GET as member-only and PUT as admin-only.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace services/reputation-service -- --runInBand
```

- [ ] **Step 3: Implement cohort/membership gates**

Use `COUNT(*) FROM communities.members WHERE community_id=$1 AND status='active'`. Never use
client-supplied member counts. Preserve aggregate response math after authorization.

- [ ] **Step 4: Run tests, simplify, commit**

```powershell
npm run test --workspace services/reputation-service -- --runInBand
npm run test --workspace services/social-graph-service -- --runInBand
```

Run `/simplify`, `pre-commit-check`, then commit:

```powershell
git add services/reputation-service services/social-graph-service
git commit -m "fix: gate reputation aggregates and policy reads"
```

---

## Task 5: Project safe graph, path, card, memory, and edge contracts

**Files:**
- Create: `services/social-graph-service/src/services/disclosureProjection.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-112-disclosure-projection.test.ts`
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Modify: `services/social-graph-service/src/services/pathComputation.ts`
- Modify: `services/social-graph-service/src/routes/trustGraph.ts`
- Modify: `services/social-graph-service/src/routes/paths.ts`
- Modify: `services/social-graph-service/src/routes/trustCard.ts`

**Interfaces:**
- Produces: `projectPersonGraph`, `projectTrustPath`, `projectTrustCard`, `projectMemoryResponse`,
  `relationshipState(weight, threshold)`.

- [ ] **Step 1: Write sentinel projection tests**

Seed internal objects with `trust_score: 827`, `karma: 913`, `raw_weight: 41`,
`effective_weight: 37`, and `currentWeight: 29`. Assert safe outputs omit every key recursively,
while preserving names, degrees, dates, counts, graph topology, and `relationship_state`.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace services/social-graph-service -- --runInBand
```

- [ ] **Step 3: Remove personal metrics from internal person queries where unnecessary**

Graph node queries select only identity/current-user/degrees. Edge queries retain current weight only
until projection so relationship state can be computed. Path user-detail queries remove karma.

- [ ] **Step 4: Project every outward route**

Graph links return `{source,target,relationship_state,type?}`. Paths return
`relationship_state`, not `trust_score`. Memory returns no `currentWeight`.
`GET /trust/edge` returns ADR-074 `410 TRUST_EDGE_ENDPOINT_RETIRED`; keep `getTrustEdge()` internal.
Trust card removes reputation-service Axios lookup and karma-derived tier.

- [ ] **Step 5: Prove request-service feed ranking is unchanged**

Update batch path response types and run:

```powershell
npm run test:unit --workspace services/request-service -- --runInBand
npm run test:regression --workspace services/request-service -- --runInBand
```

Expected: feed ranker still scores by degrees. Update mocks that expected unused `trust_score`.

- [ ] **Step 6: Run social-graph suites, promote, simplify, commit**

```powershell
npm run test:tdd --workspace services/social-graph-service -- --runInBand
npm run test:unit --workspace services/social-graph-service -- --runInBand
npm run test:regression --workspace services/social-graph-service -- --runInBand
node scripts/promote-tdd-tests.js
```

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add services/social-graph-service services/request-service
git commit -m "fix(social-graph): project privacy-safe relationship contracts"
```

---

## Task 6: Remove invitation disclosures and protect governance

**Files:**
- Modify: `services/social-graph-service/src/routes/invitations.ts`
- Modify: `services/community-service/src/database/governanceDb.ts`
- Modify: `services/community-service/src/routes/governance.ts`
- Create: `services/community-service/tests/tdd/sprint-112-governance-export-privacy.test.ts`

**Interfaces:**
- Governance eligible member:
  `{user_id,name,eligible:true,eligibility_reason:'established_community_relationships'}`.

- [ ] **Step 1: Write failing tests**

Assert invitation history/stats omit invitee metrics; governance list/role holders omit numbers; a
failed nomination returns coarse `422 GOVERNANCE_ELIGIBILITY_NOT_MET` without score or threshold
values.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace services/community-service -- --runInBand
npm run test:tdd --workspace services/social-graph-service -- --runInBand
```

- [ ] **Step 3: Minimize queries and project DTOs**

Delete karma subqueries from invitation history and metric averages from inviter stats projection.
Governance keeps its threshold SQL internally but removes karma selection and numeric response/error
copy.

- [ ] **Step 4: Test, promote, simplify, commit**

```powershell
npm run test --workspace services/community-service -- --runInBand
npm run test --workspace services/social-graph-service -- --runInBand
node scripts/promote-tdd-tests.js
```

Run `/simplify`, `pre-commit-check`, then commit:

```powershell
git add services/community-service services/social-graph-service
git commit -m "fix: protect governance and invitation reputation"
```

---

## Task 7: Remove member reputation from community exports

**Files:**
- Modify: `services/community-service/src/routes/export.ts`
- Test: `services/community-service/tests/tdd/sprint-112-governance-export-privacy.test.ts`

- [ ] **Step 1: Add failing JSON and CSV export tests**

Assert no member row/header contains `karma`, `trust`, `rank`, or reputation transaction values.
For communities with at least five active members, allow only:

```typescript
community_reputation_summary: {
  participating_members: 5,
  transaction_count: 18,
  total_karma_points: 400,
}
```

For fewer than five members, omit `community_reputation_summary`.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace services/community-service -- --runInBand
```

- [ ] **Step 3: Replace member-level reputation exports**

Remove `karma_records`, `trust_scores`, `Total Karma`, and `Trust Score` selections. Preserve request,
match, member, norm, and settings export behavior.

- [ ] **Step 4: Test, simplify, commit**

```powershell
npm run test --workspace services/community-service -- --runInBand
```

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add services/community-service
git commit -m "fix(community): remove member reputation from exports"
```

---

## Task 8: Align frontend clients with PR A contracts

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/lib/socialGraphClient.ts`
- Modify: `apps/frontend/src/hooks/useTrustPath.ts`
- Modify: `apps/frontend/src/components/graphs/types.ts`
- Modify: `apps/frontend/src/components/graphs/normalizeGraphData.ts`
- Modify: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`
- Modify: `apps/frontend/src/components/TrustPathBadge.tsx`
- Modify: `apps/frontend/src/components/TrustCard.tsx`
- Modify: `apps/frontend/src/components/Invitations/InviteHistory.tsx`
- Modify: `apps/frontend/src/components/profile/MemorySection.tsx`
- Modify: `apps/frontend/src/components/relationships/ReWarmingNudge.tsx`
- Modify: existing Sprint 111 graph/path tests

- [ ] **Step 1: Update failing contract tests first**

Change graph fixtures to identity-only nodes and relationship-state links. Assert node details never
render reputation numbers, TrustCard has no tier/karma, InviteHistory has no karma, and path badges
have no stars/numeric path score.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace apps/frontend -- --runInBand
npm run test:regression --workspace apps/frontend -- --runInBand
```

- [ ] **Step 3: Implement typed client changes**

Add `reputationService.getMyCommunitySummary(communityId)`. Remove `getLeaderboard`. Make graph
`TrustNode` metrics optional/absent for person modes and keep community normalization structural.
Use `relationship_state`/`decayTier` in D3 styling.

- [ ] **Step 4: Run frontend suites, simplify, commit**

```powershell
npm run test:unit --workspace apps/frontend -- --runInBand
npm run test:regression --workspace apps/frontend -- --runInBand
npx tsc --noEmit --project apps/frontend/tsconfig.json
```

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add apps/frontend
git commit -m "refactor(frontend): consume safe reputation contracts"
```

---

## Task 9: PR A docs, ADR, registry, version, and release tests

**Files:**
- Create: `docs/adr/ADR-082-reputation-disclosure-boundary.md`
- Modify: docs/context/registry/version files listed in File Map
- Modify: `docs/BUGS.md` only after live validation

- [ ] **Step 1: Author ADR-082 and update ADR-081**

Record self-only metrics, provider/aggregate exceptions, five-member suppression, strict projection,
inventory gate, no admin exception, and two-PR sequence. ADR-082 remains Accepted until deploy.

- [ ] **Step 2: Update contexts and registry descriptions**

Document exact changed endpoint shapes, retirements, and disclosure classifications in reputation-,
community-, social-graph-, frontend-, and shared-package contexts.

- [ ] **Step 3: Update guides and generated landing docs**

Update existing trust graph and trust/karma concepts; run:

```powershell
npm run generate-docs
git add -f apps/landing/src/data/docs
```

- [ ] **Step 4: Bump root version to v11.19.0 in place**

Update root `package.json` and root lock metadata only. Keep workspace package versions unchanged.

- [ ] **Step 5: Run doc and disclosure gates**

```powershell
cd tests
npx jest regression/reputation-disclosure-gate.test.ts regression/doc-context-drift-gate.test.ts --runInBand
```

Expected: PASS. Run `/simplify`, `pre-commit-check`, then commit:

```powershell
git add docs services packages apps/frontend apps/landing tests package.json package-lock.json
git commit -m "docs: define reputation disclosure boundary"
```

---

## Task 10: Verify, review, merge, and deploy PR A

**Files:** PR A branch diff only.

- [ ] **Step 1: Run full automated verification**

```powershell
npx tsc --noEmit
npm test
npm run feedback:check
```

Expected: unit + regression PASS; review every feedback warning.

- [ ] **Step 2: Run all SDLC quality gates**

- `/simplify` on the full PR A diff — verification: no unresolved simplification findings.
- `/code-review` — verification: all correctness findings resolved or documented.
- `/security-review` — verification: cross-user, enumeration, projection, aggregate reconstruction,
  and export findings resolved; CodeQL false positives documented in the PR.

- [ ] **Step 3: Perform two-user human validation**

Validate self summary, cross-user reputation/config 404s, aggregate cohort behavior, governance,
graph/path/card/invitation/export responses, provider exceptions, and ADR-074 envelopes.

- [ ] **Step 4: Mark ADR-082 Implemented and BUG-024 fixed**

Do this in PR A before merge, after human validation. Record exact test/API evidence in BUG-024.

- [ ] **Step 5: Open PR A with the full contract template**

Copy `.github/pull_request_template.md`, fill every section, include security dismissals, and request
cross-agent review. Contributor agents never self-merge.

- [ ] **Step 6: Merge and deploy after Admin authorization**

Use the `/deploy` skill. Monitor GitHub Actions, verify all service health and live contracts, and
confirm v11.19.0 is live before starting PR B.

---

# PR B — My Network Prominence

## Task 11: Branch from deployed PR A and build reusable self-summary UI

**Files:**
- Create: `apps/frontend/src/components/reputation/SelfCommunitySummary.tsx`
- Create: `apps/frontend/tests/tdd/sprint-112-reputation-truth.test.tsx`
- Modify: `apps/frontend/src/pages/profile.tsx`
- Modify: `apps/frontend/src/pages/network.tsx`
- Modify: `apps/frontend/src/pages/reputation/karma.tsx`
- Modify: `apps/frontend/src/components/RightSidebar.tsx`

- [ ] **Step 1: Create PR B from updated remote master**

```powershell
git checkout master
git pull --ff-only origin master
git checkout -b feature/sprint-112-my-network-prominence origin/master
```

- [ ] **Step 2: Write failing parity/retirement tests**

Render one canonical fixture on Profile and My Network; assert exact same “Reputation score,”
“Current karma,” community name, windows, and timestamps. Assert leaderboard requests/UI and
`Top Helpers` are absent.

- [ ] **Step 3: Verify RED**

```powershell
npm run test:tdd --workspace apps/frontend -- --runInBand
```

- [ ] **Step 4: Implement `SelfCommunitySummary` and migrate pages**

The component accepts `{ communityId, summary?, loading, error, onRetry }`. Profile and Network call
only `getMyCommunitySummary`. `/reputation/karma` becomes a self-history page without rankings.
Delete leaderboard state/fetch/rendering from `RightSidebar`.

- [ ] **Step 5: Synchronize Network scope**

Add an always-visible summary community selector. Community graph mode writes the same community to
the URL `id`; ego/communities modes keep a named selected summary community without implying a
platform-wide score.

- [ ] **Step 6: Test, promote, simplify, commit**

```powershell
npm run test:tdd --workspace apps/frontend -- --runInBand
npm run test:unit --workspace apps/frontend -- --runInBand
npm run test:regression --workspace apps/frontend -- --runInBand
node scripts/promote-tdd-tests.js
```

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add apps/frontend
git commit -m "feat(frontend): unify self reputation summary"
```

---

## Task 12: Add My Network navigation and Home preview at the correct altitude

**Files:**
- Create: `apps/frontend/src/components/dashboard/HomeNetworkPreview.tsx`
- Create: `apps/frontend/tests/tdd/sprint-112-network-prominence.test.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`

**Interfaces:**
- `UnifiedFeedProps.homeAfterRequests?: React.ReactNode`.

- [ ] **Step 1: Write failing navigation and altitude tests**

Assert desktop and overflow menus contain **My Network**. Assert `homeAfterRequests` renders after
offered/suggested panels and request cards, before community texture. Assert preview failure does not
replace or hide the feed.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:tdd --workspace apps/frontend -- --runInBand
```

- [ ] **Step 3: Implement navigation**

Add `/network` active-state handling beside Communities on desktop and in `AppMenu`.

- [ ] **Step 4: Implement Home preview**

`HomeNetworkPreview` renders compact static ego `BelongingGraph`, `BelongingPulse`, canonical
community summary when scoped, and **Explore My Network →**. Pass it through
`UnifiedFeed.homeAfterRequests` so actionable rows always precede it.

- [ ] **Step 5: Test, simplify, commit**

```powershell
npm run test:tdd --workspace apps/frontend -- --runInBand
npm run test:unit --workspace apps/frontend -- --runInBand
npm run test:regression --workspace apps/frontend -- --runInBand
```

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add apps/frontend
git commit -m "feat(frontend): elevate My Network"
```

---

## Task 13: PR B docs, onboarding copy, contexts, and human validation

**Files:**
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `docs/guides/trust-graph.md`
- Modify: `docs/concepts/reading-the-trust-graph.md`
- Modify: `docs/concepts/trust-and-karma.md`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] **Step 1: Update copy**

Remove onboarding claims that request cards expose karma or numeric trust. Explain My Network,
relationship state, self-only reputation, provider exception, and community aggregate exception.

- [ ] **Step 2: Regenerate landing docs**

```powershell
npm run generate-docs
git add -f apps/landing/src/data/docs
```

- [ ] **Step 3: Run direct docs tests**

```powershell
cd tests
npx jest regression/doc-context-drift-gate.test.ts regression/reputation-disclosure-gate.test.ts --runInBand
```

- [ ] **Step 4: Human UI validation**

Verify desktop/mobile navigation, Home ordering, Profile/Network parity, community selector
synchronization, graph details, governance copy, no ranking UI, and provider/aggregate exceptions.

- [ ] **Step 5: Simplify and commit**

Run `/simplify`, `pre-commit-check`, then:

```powershell
git add apps/frontend apps/landing docs .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: explain belonging and reputation truth"
```

---

## Task 14: PR B final verification and quality gates

- [ ] **Step 1: Type check and full tests**

```powershell
npx tsc --noEmit
npm test
npm run feedback:check
```

Expected: PASS; no unreviewed feedback warnings.

- [ ] **Step 2: Final simplify**

Run `/simplify` on the full PR B diff.

Verification: no unresolved simplification findings.

- [ ] **Step 3: Code review**

Run `/code-review`.

Verification: navigation, URL synchronization, stale-response handling, fail-soft rendering, and
action-altitude findings resolved.

- [ ] **Step 4: Security review**

Run `/security-review`.

Verification: PR B introduces no direct compatibility-endpoint reads, metric recomputation, unsafe
fallbacks, or UI-only disclosure assumptions.

---

## Task 15: Merge and deploy PR B

- [ ] **Step 1: Open PR B**

Use the complete PR template. State that PR A is the deployed contract dependency and include both
automated and human validation.

- [ ] **Step 2: Obtain cross-agent review and resolve findings**

The non-authoring agent reviews; do not self-merge or independently resolve cross-agent conflicts.

- [ ] **Step 3: Merge after Admin authorization and deploy**

Use `/deploy`, monitor CI/CD, verify live My Network navigation/Home/Profile behavior and service
health.

- [ ] **Step 4: Close Sprint 112 handoff**

Update `CURRENT_HANDOFF.md` with both PRs, deployed version, gate evidence, remaining carry-forward
items, and the recommended next sprint. Claude/orchestrator marks the sprint complete.
