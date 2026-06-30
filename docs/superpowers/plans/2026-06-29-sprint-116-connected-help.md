# Connected Help and Guided Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Show reciprocal, request-scoped relationship context to helpers, requesters, and providers,
then demonstrate it through a read-only Maria story while keeping Join the Platform distinct from the
Founding Circle.

**Architecture:** Request-service owns every public authorization decision and derives both participant
IDs from an eligible request, ordinary match, or provider offer. It calls an internal-secret-protected
social-graph projection that returns a strict identity-and-structure contract; the frontend renders one
deterministic dual-ego lens on all four decision surfaces. Auth-service adds a short-lived read-only
Maria session, and karmyq.org exposes independent Explore, Join the Platform, and Founding Circle paths.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 Pages Router, React SVG, PostgreSQL 15, Axios,
Jest/Testing Library, Turbo, Bull queue infrastructure.

## Global Constraints

- Work on the current PR-A branch `agent/codex/sprint-116-relationship-shape`; do not use a worktree.
- Delivery is three ordered PRs: PR A v11.23.0 → PR B v11.24.0 → PR C v11.25.0.
- Do not start PR B until PR A is merged; do not start PR C until PR B is merged.
- Contributor agents open PRs but never merge or deploy without Admin authorization.
- The lens is request/offer-scoped. No public route may accept an arbitrary target user ID.
- Trust paths are platform-wide under ADR-077; request reachability is separate metadata.
- Exact ordinary-member reputation, karma, weights, counts, histories, and timestamps stay forbidden.
- Reciprocal calls return identical node/link/path sets; only left/right orientation and role copy change.
- Thickness carries coarse repeated history only; brightness carries no relationship meaning.
- The compact lens uses pure TypeScript geometry and React SVG; it imports no D3 code.
- Equal person nodes are mandatory; provider identity is a badge/label, not a larger node.
- Every context fetch is non-blocking; offer/accept/decline/withdraw actions remain usable on failure.
- Maria rehearsal is additive, dry-run by default, resumable, and mutates only through ordinary APIs.
- Demo tokens last 30 minutes, have no refresh token, and are server-side read-only.
- Join the Platform always targets `https://karmyq.com/register`; Founding Circle remains `/join`.
- New tests begin in `tests/tdd/` or the changed workspace's `tests/tdd/` and promote after green.
- Invoke `/pre-commit-check` before every commit; never bypass hooks.
- After each implementation task run `/simplify`; final gates also run `/code-review` and
  `/security-review`.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `packages/shared/src/schemas/relationshipContext.ts` | Strict reciprocal context DTOs and forbidden-field-safe schemas |
| `tests/tdd/sprint-116-relationship-context-contract.test.ts` | RED-first shared contract tests; later promoted to regression |
| `services/social-graph-service/src/database/relationshipContextDb.ts` | Platform-wide one-hop identity/structure reads and coarse bond inputs |
| `services/social-graph-service/src/services/relationshipContextService.ts` | Pure reciprocal selection, projection, summary inputs, and caps |
| `services/social-graph-service/src/middleware/internalAuth.ts` | Fail-closed `X-Internal-Secret` authorization |
| `services/social-graph-service/src/routes/internalRelationshipContext.ts` | Internal-only two-ID projection route |
| `services/social-graph-service/tests/tdd/sprint-116-relationship-context.test.ts` | Social-graph RED-first topology, privacy, reciprocity, and internal-auth tests |
| `services/request-service/src/db/relationshipContextDb.ts` | Derive authorized request/match/provider-offer participant pairs |
| `services/request-service/src/services/socialGraphContextClient.ts` | Timeout-bounded internal social-graph client and safe response parsing |
| `services/request-service/src/routes/relationshipContext.ts` | Three public request/offer-scoped GET routes |
| `services/request-service/tests/tdd/sprint-116-relationship-context.test.ts` | Public authorization, pair derivation, and failure-contract tests |
| `apps/frontend/src/components/relationships/relationshipLensModel.ts` | Pure deterministic dual-ego geometry |
| `apps/frontend/src/components/relationships/RelationshipLens.tsx` | Accessible presentational SVG + summary |
| `apps/frontend/src/components/relationships/RelationshipContextPanel.tsx` | Non-blocking fetch/error wrapper for the three route kinds |
| `apps/frontend/src/hooks/useRelationshipContext.ts` | Cancel-safe relationship-context fetch state |
| `apps/frontend/tests/tdd/sprint-116-relationship-lens.test.tsx` | Model, rendering, accessibility, and failure TDD tests |
| `services/simulation-service/src/scenarios/mariaRelationshipStory.ts` | Idempotent plan/apply/verify scenario logic |
| `services/simulation-service/src/scripts/rehearseMariaRelationshipStory.ts` | Dry-run-first CLI entry |
| `services/simulation-service/tests/tdd/sprint-116-maria-story.test.ts` | Planner/resume/no-direct-write tests |
| `services/auth-service/src/services/demoSessionService.ts` | Config validation and 30-minute Maria token issuance |
| `services/auth-service/tests/tdd/sprint-116-demo-session.test.ts` | Synthetic-only, fail-closed, no-refresh tests |
| `apps/frontend/src/pages/demo.tsx` | Entry disclosure, demo authentication, and guided two-offer story |
| `apps/frontend/tests/tdd/sprint-116-demo-story.test.tsx` | Demo entry/story/read-only frontend tests |
| `docs/adr/ADR-084-context-bound-connection-visibility.md` | Architectural decision for reciprocal contextual visibility |

### Existing files to modify

| File | Change |
|---|---|
| `packages/shared/src/schemas/index.ts` | Export reciprocal context schemas/types |
| `packages/shared/index.ts` | Re-export reciprocal context from the package root |
| `packages/shared/src/schemas/reputationDisclosure.ts` | Treat exact interaction-counter names as forbidden outward keys |
| `packages/shared/CONTEXT.md` | Document reciprocal context types, ordinal disclosure, and root exports |
| `packages/shared/middleware/auth.ts` | Add `sessionMode` claim and reject unsafe demo-token methods |
| `services/social-graph-service/src/index.ts` | Mount internal route before member auth middleware |
| `services/request-service/src/index.ts` | Mount relationship-context routes and record dependency |
| `services/request-service/src/db/offersDb.ts` | Return provider identity/profile fields needed by authorized review |
| `apps/frontend/src/lib/api.ts` | Add three typed context calls and demo-session call |
| `apps/frontend/src/lib/api/providerApi.ts` | Preserve typed provider offer IDs/data |
| `apps/frontend/src/pages/requests/[id].tsx` | Pre-offer ordinary-member lens |
| `apps/frontend/src/components/MyRequestsTab.tsx` | Reciprocal ordinary-offer review lens |
| `apps/frontend/src/components/SubmitOfferModal.tsx` | Provider sees requester context before submitting |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Requester reviews provider relationship context |
| `services/simulation-service/src/api-client.ts` | Provider-offer and scenario verification API methods |
| `services/simulation-service/package.json` | Add `rehearse:maria-relationship` script |
| `services/auth-service/src/routes/auth.ts` | Add `POST /auth/demo-session` |
| `apps/landing/src/lib/landingRoutes.ts` | Canonical Explore/Join Platform/Founding paths |
| `apps/landing/src/components/Header.tsx` | Render all three paths on desktop/mobile |
| `apps/landing/src/app/page.tsx` | Closing Explore + Join Platform actions and quieter Founding path |
| `apps/landing/src/lib/landingContent.ts` | Updated CTA content |
| `apps/landing/tests/regression/sprint-95-routes.test.ts` | Lock revised route/nav contract |
| `docs/adr/ADR-077-trust-path-platform-topology.md` | Record contextual platform-wide path use |
| `docs/adr/ADR-082-reputation-disclosure-boundary.md` | Permit coarse bond depth and contextual named topology |
| `docs/adr/README.md` | Index ADR-084 |
| `docs/concepts/trust-path.md` | Explain reciprocal request/offer context |
| `docs/concepts/unified-feed.md` | Explain the lens as a helping aid |
| `docs/concepts/community-and-provider-two-facets.md` | Explain provider decoration on the same person/network identity |
| `docs/guides/getting-started-guide.md` | Distinguish Explore/Join Platform/Founding Circle |
| `docs/guides/using-service-providers-guide.md` | Explain reciprocal context before/reviewing provider offers |
| `docs/guides/demo-data.md` | Document Maria's two deterministic guided stories and verification |
| `services/*/CONTEXT.md`, `apps/frontend/CONTEXT.md`, `services/registry.json` | API, dependency, disclosure, UI, demo, and version feedback loop |
| `package.json`, `package-lock.json` | Ordered minor versions v11.23.0/v11.24.0/v11.25.0 |
| `.claude/handoff/CURRENT_HANDOFF.md` | Rolling branch/PR/validation state |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. The lens is request/offer-scoped. Do not add a public route that accepts an arbitrary target user.
2. Relationship topology is reciprocal. Reversing participants may change orientation and role copy,
   but never the disclosed node/link/path sets.
3. Trust paths are platform-wide under ADR-077. Never label an exchange path as belonging to the
   request's source community.
4. Request reachability is the existing visibility boundary, including sister-community,
   trust-network, and platform scope. Do not replace it with a shared-membership check.
5. Named connections are visible to authenticated Karmyq members in this context; exact ordinary-
   member reputation, weights, counts, history text, and timestamps remain forbidden under ADR-082.
6. Request-service owns public context authorization and derives both IDs. Social-graph-service only
   receives them over the fail-closed internal boundary.
7. Preserve path nodes and shared connections before applying caps. Fill remaining slots with stable,
   non-evaluative ordering and disclose truncation.
8. `bond_depth` intentionally discloses an ordinal floor (`growing` ≥2, `established` ≥4); document
   that accepted trade-off while keeping exact count, timing, content, direction, and value private.
9. Thickness carries coarse repeated history only. Brightness carries no relationship meaning.
10. The compact lens uses pure TypeScript geometry and React SVG with zero D3 imports.
11. Providers use equal person nodes. Service type/collective are role decorations, never rank.
12. The relationship lens is non-blocking. Existing offer and acceptance actions must work through
    timeout, no-path, and service failure.
13. The ordinary Maria story must meet the rich-overlap floor (≤2-degree path, ≥3 shared one-hop
    connections, ≥4 visible one-hop nodes per side); do not validate two sparse pictures.
14. Rehearsal mutations use ordinary APIs, are dry-run by default, additive, resumable, and require
    explicit `--apply`; never seed trust edges or coordinates.
15. Demo write protection is server-side shared middleware. Hiding controls is defense in depth only.
16. Join the Platform is ordinary registration and must remain distinct from `/join`, the Founding
    Circle path, on desktop, mobile, home, and demo surfaces.
17. Update existing ADRs and docs rather than creating competing definitions of path scope,
    disclosure, provider identity, or request eligibility.

---

## PR A — Reciprocal Relationship Context (v11.23.0)

### Task 1: Strict shared relationship-context contract

**Files:**
- Create: `packages/shared/src/schemas/relationshipContext.ts`
- Create: `tests/tdd/sprint-116-relationship-context-contract.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/schemas/reputationDisclosure.ts`
- Modify: `packages/shared/index.ts`
- Modify: `packages/shared/CONTEXT.md`

**Interfaces:**
- Produces: `BondDepth`, `ContextNode`, `ContextLink`, `RelationshipContext`,
  `relationshipContextSchema`, and `classifyBondDepth(interactionCount)`.
- Consumers: social-graph projection, request-service parser, frontend API/types.

- [ ] **Step 1: Write the failing strict-schema tests**

```ts
expect(classifyBondDepth(1)).toBe('forming')
expect(classifyBondDepth(2)).toBe('growing')
expect(classifyBondDepth(4)).toBe('established')
expect(classifyBondDepth(99)).toBe('established') // ordinal floor, never exact count
expect(() => relationshipContextSchema.parse({ ...validContext, trust_score: 77 })).toThrow()
expect(() => relationshipContextSchema.parse({
  ...validContext,
  links: [{ ...validContext.links[0], raw_weight: 9 }],
})).toThrow()
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run: `npx jest tests/tdd/sprint-116-relationship-context-contract.test.ts --runInBand`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement the strict DTOs and pure classifier**

```ts
export const bondDepthSchema = z.enum(['forming', 'growing', 'established'])
export type BondDepth = z.infer<typeof bondDepthSchema>

export function classifyBondDepth(count: number): BondDepth {
  if (count >= 4) return 'established'
  if (count >= 2) return 'growing'
  return 'forming'
}

export const contextNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  communities: z.array(z.object({ id: z.string().uuid(), name: z.string() }).strict()),
}).strict()
```

Define the remaining strict objects exactly as the spec's outward contract. Keep `path.scope` as the
literal `platform`; keep `visibilityScope` and `reachability` separate; reject unknown keys at every
level.

- [ ] **Step 4: Run RED→GREEN and type-check shared**

Run: `npx jest tests/tdd/sprint-116-relationship-context-contract.test.ts --runInBand`

Run: `npx tsc -p packages/shared/tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 5: Simplify, pre-commit-check, and commit**

```powershell
git add packages/shared/src/schemas/relationshipContext.ts packages/shared/src/schemas/index.ts tests/tdd/sprint-116-relationship-context-contract.test.ts
git commit -m "feat: define reciprocal relationship context contract"
```

### Task 2: Platform-wide reciprocal projection

**Files:**
- Create: `services/social-graph-service/src/database/relationshipContextDb.ts`
- Create: `services/social-graph-service/src/services/relationshipContextService.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-116-relationship-context.test.ts`
- Create: `services/social-graph-service/tests/tdd/sprint-116-relationship-context-db.test.ts`

**Interfaces:**
- Consumes: shared context identity/link primitives, `classifyBondDepth`, and platform-wide completed-
  help topology.
- Produces: `buildRelationshipContext(viewerId, counterpartId, options):
  Promise<RelationshipContextProjection>` — identity + topology only, with no request/provider data.

- [ ] **Step 1: Write failing projection tests**

Cover direct, 2-degree, 6-degree, and no-path pairs; reciprocal set equality; path/shared-node cap
precedence; stable-ID fill; provider-free identity projection; and nested forbidden-key absence.

```ts
const ab = await buildRelationshipContext(A, B, { capPerSide: 8 })
const ba = await buildRelationshipContext(B, A, { capPerSide: 8 })
expect(new Set(ab.links.map(linkKey))).toEqual(new Set(ba.links.map(linkKey)))
expect(new Set(ab.networks.shared.map(n => n.id))).toEqual(new Set(ba.networks.shared.map(n => n.id)))
expect(ab.path.scope).toBe('platform')
```

- [ ] **Step 2: Run the social-graph TDD file and confirm RED**

Run: `npm --workspace @karmyq/social-graph-service exec -- jest tests/tdd/sprint-116-relationship-context.test.ts --runInBand`

Expected: FAIL because query/service modules do not exist.

- [ ] **Step 3: Implement minimized database reads**

`relationshipContextDb.ts` must export:

```ts
export async function getPublicOneHop(userIds: [string, string]): Promise<InternalContextRow[]>
export async function getVisibleCommunities(userIds: string[]): Promise<Map<string, CommunityIdentity[]>>
```

Build topology from completed `requests.matches` plus authoritative active identities. Aggregate any
community-specific trust-edge rows by unordered pair only long enough to derive qualitative
`relationship_state`, summed interaction count, and `bond_depth`; do not return internal numbers.

- [ ] **Step 4: Implement pure reciprocal selection**

```ts
const mandatory = new Set([viewerId, counterpartId, ...pathIds, ...sharedDirectIds])
const fill = (ids: string[]) => ids.filter(id => !mandatory.has(id)).sort().slice(0, remaining)
```

Always include anchors, path, then mutual direct connections. Fill each side by stable ID, use the
same unordered edge-key function in both orientations, and build summary facts without evaluative
language.

`RelationshipContextProjection` intentionally stops before the full outward shared contract:
social-graph-service cannot truthfully derive request reachability or provider role from two user IDs.
Task 4 decorates this projection with its authorized `ContextPair`, then parses the final
`RelationshipContextSchema` before returning it.

- [ ] **Step 5: Run focused tests and type-check**

Run: `npm --workspace @karmyq/social-graph-service exec -- jest tests/tdd/sprint-116-relationship-context.test.ts --runInBand`

Run: `npx tsc -p services/social-graph-service/tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 6: Simplify, pre-commit-check, and commit**

```powershell
git add services/social-graph-service/src/database/relationshipContextDb.ts services/social-graph-service/src/services/relationshipContextService.ts services/social-graph-service/tests/tdd/sprint-116-relationship-context.test.ts
git commit -m "feat: build reciprocal relationship context projection"
```

### Task 3: Fail-closed internal social-graph route

**Files:**
- Create: `services/social-graph-service/src/middleware/internalAuth.ts`
- Create: `services/social-graph-service/src/routes/internalRelationshipContext.ts`
- Modify: `services/social-graph-service/src/index.ts`
- Modify: `services/social-graph-service/tests/tdd/sprint-116-relationship-context.test.ts`

**Interfaces:**
- Consumes: `buildRelationshipContext(viewerId, counterpartId, { capPerSide: 8 })`.
- Produces: `POST /internal/relationship-context`, callable only by request-service.

- [ ] **Step 1: Add RED route/security tests**

Assert missing `INTERNAL_SECRET` configuration returns 503, missing/wrong header returns 403, correct
header plus two UUIDs returns the strict provider-free topology projection, malformed IDs return 400,
and the route is not behind member JWT auth.

- [ ] **Step 2: Implement constant-time internal-secret middleware**

```ts
const configured = process.env.INTERNAL_SECRET
if (!configured) return res.status(503).json({ success: false, message: 'Internal route unavailable', error: 'SERVICE_UNAVAILABLE' })
const supplied = req.header('x-internal-secret') ?? ''
if (!safeEqual(configured, supplied)) return res.status(403).json({ success: false, message: 'Forbidden', error: 'FORBIDDEN' })
next()
```

Use equal-length buffers before `timingSafeEqual`; never log either secret.

- [ ] **Step 3: Mount before `app.use(authMiddleware)`**

```ts
app.use('/internal/relationship-context', rateLimiters.readLight, internalAuth, internalRelationshipContextRoutes)
app.use(authMiddleware)
```

- [ ] **Step 4: Run tests/type-check and commit**

Run: `npm --workspace @karmyq/social-graph-service exec -- jest tests/tdd/sprint-116-relationship-context.test.ts --runInBand`

Run: `npx tsc -p services/social-graph-service/tsconfig.json --noEmit`

Then run `/simplify` and `/pre-commit-check`.

```powershell
git add services/social-graph-service/src/middleware/internalAuth.ts services/social-graph-service/src/routes/internalRelationshipContext.ts services/social-graph-service/src/index.ts services/social-graph-service/tests/tdd/sprint-116-relationship-context.test.ts
git commit -m "feat: expose fail-closed internal relationship context"
```

### Task 4: Request/offer-scoped public authorization

**Files:**
- Create: `services/request-service/src/db/relationshipContextDb.ts`
- Create: `services/request-service/src/services/socialGraphContextClient.ts`
- Create: `services/request-service/src/routes/relationshipContext.ts`
- Create: `services/request-service/tests/tdd/sprint-116-relationship-context.test.ts`
- Modify: `services/request-service/src/index.ts`

**Interfaces:**
- Consumes: internal social route and strict shared schema.
- Produces: the three public GET routes from the spec; never accepts `targetUserId`.

- [ ] **Step 1: Write RED authorization tests**

Cover same/sister/trust-network/platform request reachability; own request; unreachable request;
ordinary match participant/nonparticipant; provider-offer owner/provider/nonparticipant; mismatched
request/offer IDs; internal timeout; invalid internal response; and no-target-ID route inventory.

- [ ] **Step 2: Implement participant resolvers**

```ts
export type ContextPair = {
  viewerId: string
  counterpartId: string
  requestId: string
  visibilityScope: 'community' | 'trust_network' | 'platform'
  reachability: 'same_community' | 'sister_community' | 'trust_network' | 'platform'
  provider?: { serviceType: string; collectiveName?: string }
}
```

`resolveRequestPair` must call the existing `getRequestReachability`; `resolveMatchPair` and
`resolveProviderOfferPair` must select both participants and verify the route's request ID in the same
query. Return 404 for absent resources, 403 for known-but-unauthorized participants, and no context for
the request owner on the pre-offer route.

- [ ] **Step 3: Implement a timeout-bounded internal client**

```ts
const response = await axios.post(url, { viewerId, counterpartId }, {
  timeout: 2500,
  headers: { 'x-internal-secret': requiredInternalSecret() },
})
return relationshipContextSchema.parse(response.data.data)
```

Never forward the browser Authorization header to the internal endpoint. Map timeout/unavailable to
503 `RELATIONSHIP_CONTEXT_UNAVAILABLE`; never fabricate an empty strong relationship.

- [ ] **Step 4: Add the three GET routes and strict role decoration**

Call the common resolver/client/projector. Add provider metadata only for provider offers. Orient the
response around the authenticated caller and generate summary copy from returned structural facts.

- [ ] **Step 5: Run tests/type-check and commit**

Run: `npm --workspace karmyq-request-service exec -- jest tests/tdd/sprint-116-relationship-context.test.ts --runInBand`

Run: `npx tsc -p services/request-service/tsconfig.json --noEmit`

Then run `/simplify` and `/pre-commit-check`.

```powershell
git add services/request-service/src/db/relationshipContextDb.ts services/request-service/src/services/socialGraphContextClient.ts services/request-service/src/routes/relationshipContext.ts services/request-service/src/index.ts services/request-service/tests/tdd/sprint-116-relationship-context.test.ts
git commit -m "feat: authorize request-scoped relationship context"
```

### Task 5: Deterministic reciprocal lens renderer

**Files:**
- Create: `apps/frontend/src/components/relationships/relationshipLensModel.ts`
- Create: `apps/frontend/src/components/relationships/RelationshipLens.tsx`
- Create: `apps/frontend/tests/tdd/sprint-116-relationship-lens.test.tsx`

**Interfaces:**
- Consumes: strict `RelationshipContext`.
- Produces: `buildRelationshipLensModel(context, width, height)` and
  `<RelationshipLens context width? height? />`.

- [ ] **Step 1: Write exact RED geometry and semantic tests**

Lock anchors at mirrored fixed positions, path nodes across the center, shared nodes in the overlap,
one-sided fans behind their anchor, stable coordinates after input reorder, equal person radii, and
widths `{ forming: 1.2, growing: 1.9, established: 2.8 }`. Add a source/import guard proving the lens
model and renderer do not import `d3`.

- [ ] **Step 2: Implement the pure model**

```ts
const viewerAnchor = { x: width * 0.28, y: height * 0.5 }
const counterpartAnchor = { x: width * 0.72, y: height * 0.5 }
const orderedPath = context.path.nodes.slice(1, -1)
const xForPath = (index: number) => viewerAnchor.x + ((index + 1) / (orderedPath.length + 1)) * (counterpartAnchor.x - viewerAnchor.x)
```

Use fixed upper/lower fan slots sorted by stable ID. Do not run force simulation or derive clusters.

- [ ] **Step 3: Implement accessible SVG and text fallback**

Render a fixed viewBox, `<title>` for each person/edge, equal circles, provider badge outside the
person circle, visible community labels, and the server summary in a normal paragraph. Do not map
relationship state to opacity; use text/title for temporal state.

- [ ] **Step 4: Run frontend tests/type-check and commit**

Run: `npm --workspace karmyq-frontend exec -- jest tests/tdd/sprint-116-relationship-lens.test.tsx --runInBand`

Run: `npx tsc -p apps/frontend/tsconfig.json --noEmit`

Then run `/simplify` and `/pre-commit-check`.

```powershell
git add apps/frontend/src/components/relationships/relationshipLensModel.ts apps/frontend/src/components/relationships/RelationshipLens.tsx apps/frontend/tests/tdd/sprint-116-relationship-lens.test.tsx
git commit -m "feat: render reciprocal relationship lens"
```

### Task 6: PR A documentation, version, gates, and PR contract

**Files:**
- Modify: `docs/adr/ADR-077-trust-path-platform-topology.md`
- Modify: `docs/adr/ADR-082-reputation-disclosure-boundary.md`
- Create: `docs/adr/ADR-084-context-bound-connection-visibility.md`
- Modify: `docs/adr/README.md`
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `package.json`, `package-lock.json`

**Interfaces:** Documents and releases the PR-A contract at v11.23.0.

- [ ] **Step 1: Update ADRs, contexts, registry, and version**

Run: `npm version 11.23.0 --no-git-tag-version`

Record all three public routes, the internal dependency/secret, disclosure class, strict response,
reciprocity, and no-search rule. ADR-082 must state that public bands intentionally reveal the ordinal
floors `growing` ≥2 and `established` ≥4 while exact history remains private. Add request-service →
social-graph-service dependency to the registry.

- [ ] **Step 2: Promote green PR-A TDD tests**

Move stable tests from `tests/tdd/` to the corresponding `tests/regression/` locations and rerun the
focused suites. Keep any database-dependent end-to-end fixture in TDD until its real environment pass.

- [ ] **Step 3: Run PR-A gates**

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npm run feedback:check`

Run `/simplify`, `/code-review`, and `/security-review`; resolve all real findings.

- [ ] **Step 4: Commit, push, and open PR A**

Invoke `/pre-commit-check`, then commit all PR-A docs/version/test promotions. Push only the current
agent branch. Copy `.github/pull_request_template.md`, fill every section, and open the PR without
merging. Wait for cross-agent review, Admin merge, deploy, and PR-A live contract validation before
creating PR B from updated `origin/master`.

---

## PR B — Helping Decision Surfaces (v11.24.0)

### Task 7: Non-blocking context fetch wrapper and ordinary pre-offer surface

**Files:**
- Create: `apps/frontend/src/hooks/useRelationshipContext.ts`
- Create: `apps/frontend/src/components/relationships/RelationshipContextPanel.tsx`
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/pages/requests/[id].tsx`
- Modify: `apps/frontend/tests/tdd/sprint-116-relationship-lens.test.tsx`

**Interfaces:**
- Produces: union props `{ kind:'request'; requestId } | { kind:'match'; requestId; matchId } |
  { kind:'provider-offer'; requestId; offerId }`.

- [ ] **Step 1: Branch PR B after PR A merge and write RED surface tests**

Create `agent/codex/sprint-116-offer-context` from merged `origin/master`. Assert context appears only
for `viewer_relation === 'can_offer'`; loading is quiet; 403/404 suppresses the panel; 5xx shows a
small unavailable note; Offer remains enabled in every failure state.

- [ ] **Step 2: Implement typed API methods and cancel-safe hook**

```ts
getRequestRelationshipContext: (requestId: string) => requestApi.get(`/requests/${encodeURIComponent(requestId)}/relationship-context`)
getMatchRelationshipContext: (requestId: string, matchId: string) => requestApi.get(`/requests/${encodeURIComponent(requestId)}/matches/${encodeURIComponent(matchId)}/relationship-context`)
getProviderOfferRelationshipContext: (requestId: string, offerId: string) => requestApi.get(`/requests/${encodeURIComponent(requestId)}/provider-offers/${encodeURIComponent(offerId)}/relationship-context`)
```

The hook must ignore stale resolutions after props change/unmount and expose `{ data, loading, error }`.

- [ ] **Step 3: Integrate after request identity and before the action boundary**

Render `<RelationshipContextPanel kind="request" requestId={detail.id} />` only for eligible
non-owner viewers. Do not modify `handleOffer` or server-derived `viewer_relation`.

```tsx
{detail.viewer_relation === 'can_offer' && (
  <RelationshipContextPanel kind="request" requestId={detail.id} />
)}
```

- [ ] **Step 4: Test, simplify, pre-commit-check, and commit**

Run the focused frontend TDD file and `npx tsc -p apps/frontend/tsconfig.json --noEmit`.

### Task 8: Reciprocal ordinary-offer review

**Files:**
- Modify: `apps/frontend/src/components/MyRequestsTab.tsx`
- Create: `apps/frontend/tests/tdd/sprint-116-ordinary-offer-context.test.tsx`

**Interfaces:** Consumes `<RelationshipContextPanel kind="match" requestId matchId />`.

- [ ] **Step 1: Write RED tests for requester review and mutuality**

Expand an ask with a proposed match; assert the panel precedes Accept/Decline, uses the authenticated
requester as “you,” and action buttons remain enabled if the context call rejects.

- [ ] **Step 2: Render the match-scoped panel inside each expanded proposed offer**

Keep existing fetch/accept/reject logic. Do not revive the unused `OfferItem` component or create a
second graph implementation.

```tsx
<RelationshipContextPanel kind="match" requestId={r.id} matchId={offer.id} />
```

- [ ] **Step 3: Run focused tests/type-check, simplify, pre-commit-check, and commit**

Run: `npm --workspace karmyq-frontend exec -- jest tests/tdd/sprint-116-ordinary-offer-context.test.tsx --runInBand`

### Task 9: Provider sees requester; requester sees provider

**Files:**
- Modify: `apps/frontend/src/components/SubmitOfferModal.tsx`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`
- Modify: `apps/frontend/src/lib/api/providerApi.ts`
- Modify: `services/request-service/src/db/offersDb.ts`
- Create: `apps/frontend/tests/tdd/sprint-116-provider-offer-context.test.tsx`

**Interfaces:** Consumes request-scoped panel in provider modal and provider-offer-scoped panel in
requester review.

- [ ] **Step 1: Write RED provider tests**

Assert the provider modal shows requester context before Submit; requester review shows service type
and collective label; person radius remains equal; and all offer actions survive context failure.

- [ ] **Step 2: Enrich authorized provider-offer rows**

Join `provider.provider_profiles`/collective membership as already modeled by provider routes and
return `provider_user_id`, display name, service type, and optional collective name only to the request
owner. Do not expose mutual-aid reputation fields.

- [ ] **Step 3: Integrate both provider directions**

Place request-scoped context above price/note submission in `SubmitOfferModal`. In `CommitmentsTab`,
place provider-offer context inside each pending offer row before Accept/Decline.

```tsx
<RelationshipContextPanel kind="request" requestId={requestId} />
<RelationshipContextPanel kind="provider-offer" requestId={req.id} offerId={offer.id} />
```

- [ ] **Step 4: Run request/frontend tests and commit**

Run focused request-service provider tests, focused frontend TDD, and both workspace type checks.
Run `/simplify` and `/pre-commit-check` before committing.

### Task 10: Deterministic Maria ordinary/provider rehearsal

**Files:**
- Create: `services/simulation-service/src/scenarios/mariaRelationshipStory.ts`
- Create: `services/simulation-service/src/scripts/rehearseMariaRelationshipStory.ts`
- Create: `services/simulation-service/tests/tdd/sprint-116-maria-story.test.ts`
- Modify: `services/simulation-service/src/api-client.ts`
- Modify: `services/simulation-service/package.json`

**Interfaces:** Produces `planMariaRelationshipStory(state)`, `applyMariaRelationshipStory(plan,
clients)`, and CLI `npm --workspace @karmyq/simulation-service run rehearse:maria-relationship --
[--apply]`.

- [ ] **Step 1: Write RED planner/idempotency tests**

Fixture Maria as requester, one ordinary responder, and one provider. Require one cross-community
visibility case, two valid offers, an ordinary story with path degree ≤2,
`networks.shared.length >= 3`, and at least four visible one-hop nodes per side, plus a provider
no/low-overlap contrast, dry-run default, second-run zero mutation work, and no direct product-table
write API.

- [ ] **Step 2: Implement pure plan/verify state**

```ts
export type MariaStoryPlan = {
  actions: StoryAction[]
  expected: {
    ordinary: { requestId?: string; matchId?: string }
    provider: { requestId?: string; offerId?: string }
  }
}
```

Resolve existing state first. Only absent requests/offers/history become actions. Verification must
produce the exact IDs later configured for demo sessions. Choose the ordinary counterpart only after
reading current degree/overlap; if the rich floor is not met, plan the minimum ordinary API
request→offer→accept→two-sided-completion actions needed to meet it.

- [ ] **Step 3: Implement API-only apply and explicit CLI gate**

When `--apply` is absent, print actions and exit 0 without mutation. When present, print environment
and persona, execute ordinary APIs, then re-read and verify. Never call `getPool()` for writes.

- [ ] **Step 4: Run simulation tests/type-check, simplify, pre-commit-check, and commit**

Run: `npm --workspace @karmyq/simulation-service exec -- jest tests/tdd/sprint-116-maria-story.test.ts --runInBand`

Run: `npx tsc -p services/simulation-service/tsconfig.json --noEmit`

### Task 11: PR B docs, v11.24.0, gates, and live validation

**Files:**
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/simulation-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `docs/concepts/trust-path.md`, `docs/concepts/unified-feed.md`
- Modify: `docs/concepts/community-and-provider-two-facets.md`
- Modify: `docs/guides/using-service-providers-guide.md`, `docs/guides/demo-data.md`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Document surfaces/rehearsal and bump v11.24.0**

Run: `npm version 11.24.0 --no-git-tag-version`

- [ ] **Step 2: Promote green PR-B tests and run gates**

Promote stable TDD files to regression, then run `npm test`, root `npx tsc --noEmit`,
`npm run feedback:check`, `/simplify`, `/code-review`, and `/security-review`.

Pre-check the recurring CodeQL `js/request-forgery` candidate on new browser `api.ts` methods. Dismiss
only after verifying encoded path parameters and the configured Axios base URL match the established
false-positive pattern; record the alert link and justification in the PR body.

- [ ] **Step 3: Open PR B and stop for Admin merge/deploy**

Use the full PR template. After authorized deploy, Admin authorizes rehearsal `--apply`; record the two
verified story IDs and live five-second results. Do not create PR C until this validation passes.

---

## PR C — Guided Entry and Join the Platform (v11.25.0)

### Task 12: Fail-closed read-only Maria sessions

**Files:**
- Modify: `packages/shared/middleware/auth.ts`
- Modify: `packages/shared/src/middleware/__tests__/errorContract.test.ts` or add focused shared auth test
- Create: `services/auth-service/src/services/demoSessionService.ts`
- Create: `services/auth-service/tests/tdd/sprint-116-demo-session.test.ts`
- Modify: `services/auth-service/src/routes/auth.ts`

**Interfaces:** Adds `JWTPayload.sessionMode?: 'demo_read_only'` and `POST /auth/demo-session` returning
`{ user, token, demo: { expiresInMinutes: 30, stories } }` with no refresh token.

- [ ] **Step 1: Branch PR C after PR B merge and write RED middleware/route tests**

Test disabled config, missing IDs, non-`@test.karmyq.com`, inactive/admin persona, story ownership
mismatch, success without refresh token, 30-minute expiry, GET/HEAD/OPTIONS allowed, and
POST/PUT/PATCH/DELETE rejected with 403 by shared middleware.

- [ ] **Step 2: Add shared server-side write guard**

```ts
if (decoded.sessionMode === 'demo_read_only' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
  return sendForbidden(res, 'This demo session is read-only', { requestId: (req as any).id })
}
```

Attach `req.user` only after the guard passes. Ordinary JWT behavior must remain byte-for-byte
equivalent in tests.

- [ ] **Step 3: Implement configured session service**

Read `DEMO_SESSION_ENABLED`, `DEMO_PERSONA_EMAIL`, `DEMO_ORDINARY_REQUEST_ID`,
`DEMO_ORDINARY_MATCH_ID`, `DEMO_PROVIDER_REQUEST_ID`, and `DEMO_PROVIDER_OFFER_ID`. Verify all rows,
roles, and ownership before signing. `DEMO_PERSONA_EMAIL` is the only permitted identity, but
configuration never overrides the independent requirement that the resolved account be active,
non-admin, and end in `@test.karmyq.com`. Return one generic 503 `DEMO_UNAVAILABLE` for every
config/state failure so resource existence is not leaked.

- [ ] **Step 4: Run shared/auth tests and type-check; simplify, pre-commit-check, commit**

### Task 13: Guided Maria offer-comparison page

**Files:**
- Create: `apps/frontend/src/pages/demo.tsx`
- Create: `apps/frontend/tests/tdd/sprint-116-demo-story.test.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

**Interfaces:** Consumes demo session and both offer-scoped `RelationshipContextPanel` variants.

- [ ] **Step 1: Write RED page tests**

Cover disclosure before entry, Explore as Maria success, no refresh token storage, ordinary/provider
story switch, Join the Platform and login alternatives, unavailable state, and absence of mutating
controls under demo mode.

- [ ] **Step 2: Implement entry/session persistence**

Store `token`, `user`, and `demoContext`; explicitly remove `refreshToken`. Rehydrate only while the
token is valid. Render the two configured stories and their lens/offer metadata without Accept,
Decline, Withdraw, Submit, or Complete controls.

```ts
localStorage.setItem('token', session.token)
localStorage.setItem('user', JSON.stringify(session.user))
localStorage.setItem('demoContext', JSON.stringify(session.demo))
localStorage.removeItem('refreshToken')
```

- [ ] **Step 3: Run focused frontend tests/type-check; simplify, pre-commit-check, commit**

### Task 14: Explore, Join the Platform, and Founding Circle paths

**Files:**
- Modify: `apps/landing/src/lib/landingRoutes.ts`
- Modify: `apps/landing/src/components/Header.tsx`
- Modify: `apps/landing/src/app/page.tsx`
- Modify: `apps/landing/src/lib/landingContent.ts`
- Modify: `apps/landing/tests/regression/sprint-95-routes.test.ts`

**Interfaces:** Produces canonical constants for Explore (`https://karmyq.com/demo`), Join Platform
(`https://karmyq.com/register`), and Founding Circle (`/join`).

- [ ] **Step 1: Turn route regression RED**

Assert desktop/mobile data contracts contain all three labels/destinations; Story is not duplicated
in nav because the logo owns home; Join Platform never equals `/join`; home closing has Explore + Join
Platform + quieter Founding link.

- [ ] **Step 2: Implement route constants and render all paths**

Replace singular `CTA_LINK` with explicit `EXPLORE_LINK`, `JOIN_PLATFORM_LINK`, and
`FOUNDING_CIRCLE_LINK`. Keep external anchors safe and keyboard-visible. Do not hide either Join path
inside the mobile menu's primary Explore action.

```ts
export const EXPLORE_LINK = { label: 'Explore the live demo', href: 'https://karmyq.com/demo' } as const
export const JOIN_PLATFORM_LINK = { label: 'Join the Platform', href: 'https://karmyq.com/register' } as const
export const FOUNDING_CIRCLE_LINK = { label: 'Join the Founding Circle', href: '/join' } as const
```

- [ ] **Step 3: Run landing regression/build; simplify, pre-commit-check, commit**

Run: `npx jest --config apps/landing/jest.config.js --runTestsByPath apps/landing/tests/regression/sprint-95-routes.test.ts --runInBand --no-cache`

Run: `npm --workspace karmyq-landing run build`

### Task 15: Final docs, contexts, registry, test promotion, and v11.25.0

**Files:**
- Modify: all documentation/context/registry files listed in the File Map
- Modify: `package.json`, `package-lock.json`
- Move: stable Sprint 116 TDD tests to corresponding regression directories

- [ ] **Step 1: Complete documentation feedback loops**

Document demo env vars, shared middleware behavior, request→social internal dependency, provider role,
context-bound visibility, Maria story, and three entry paths. Generate landing docs artifacts using the
repo's established docs command, then verify the generator did not silently drop navigation entries:

```powershell
rg -n 'docs/guides/(getting-started-guide|using-service-providers-guide|demo-data)' apps/landing/src/data/docs/nav.json
git diff -- apps/landing/src/data/docs/nav.json
```

Run the direct doc-context drift test after this verification.

- [ ] **Step 2: Bump v11.25.0 and update registry versions**

Run: `npm version 11.25.0 --no-git-tag-version`

- [ ] **Step 3: Promote only green/stable TDD suites**

Use `scripts/promote-tdd-tests.js` or explicit `Move-Item` within the same workspace. Rerun each moved
suite at its new path and verify no undocumented `.skip` remains.

- [ ] **Step 4: Run feedback/type/docs checks and commit**

Run: `npm run feedback:check`

Run: `npx tsc --noEmit`

Run: `npx jest tests/regression/doc-context-drift-gate.test.ts --runInBand`

Invoke `/pre-commit-check`, then commit.

### Task 16: SDLC quality gates

- [ ] **Testing gate**

Run `npm test`. Expected: all unit/regression tasks green, no new skip.

- [ ] **Simplify gate**

Run `/simplify` on `origin/master...HEAD`. Verify one shared context panel/model, one participant
resolver family, and no duplicated provider/ordinary graph renderer.

- [ ] **Code-review gate**

Run `/code-review` on the branch diff. Resolve correctness findings, especially authorization
ordering, reciprocity, stale async updates, and route shadowing. Re-run focused tests.

- [ ] **Security-review gate**

Run `/security-review`. Verify internal secret fails closed and is never logged; no arbitrary target
route; demo writes rejected in shared middleware; response schemas reject forbidden metrics; no
unencoded path parameters or unsafe SVG/HTML sinks. Check any `js/request-forgery` finding on new
frontend API methods against the configured-browser-baseURL false-positive pattern; record justified
dismissals with alert links in the PR body.

### Task 17: Final type/build/pre-push and five-second validation

- [ ] Run root type, test, build, feedback, audit, and diff checks

```powershell
npx tsc --noEmit
npm test
npm run build
npm run feedback:check
npm audit --audit-level=high
git diff --check origin/master...HEAD
```

- [ ] Validate Maria locally or in the authorized demo environment

For both ordinary and provider stories, verify reciprocal orientation as each participant where
possible, one cross-community case, action resilience on forced context failure, desktop/mobile,
keyboard, reduced motion, and the three five-second questions from the spec.

- [ ] Invoke `/pre-commit-check`, commit any gate fixes, and ensure a clean tree

### Task 18: PR C, merge recommendation, and authorized deploy

- [ ] Push PR-C branch and open a complete PR contract

Copy `.github/pull_request_template.md`; include versions, migrations (`none`), tests, privacy model,
internal secret, demo session, Maria evidence, risks, rollback, and security dismissals.

- [ ] Wait for required CI and cross-agent review

Required checks include type/tests, PR contract, dependency audit, CodeQL, and deploy gates. Resolve
findings with new commits; never rewrite another agent's branch.

- [ ] Obtain Admin merge and deploy authorization

Contributor agents do not merge. Once Admin authorizes and Claude recommends merge readiness, execute
only the authorized merge/deploy workflow using `/deploy`.

- [ ] Monitor deploy and validate live truth

Confirm GitHub Actions deployment, service health, `/auth/demo-session`, server-side demo write 403,
Maria ordinary/provider stories, requester/helper reciprocity, cross-community rendering,
`karmyq.org` desktop/mobile Explore + Join Platform + Founding Circle, and ordinary registration.
Update `CURRENT_HANDOFF.md` with immutable PR/run links and live evidence.
