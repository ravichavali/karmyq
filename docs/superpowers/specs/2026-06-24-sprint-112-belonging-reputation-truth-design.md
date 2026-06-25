# Sprint 112: Belonging & Reputation Truth — Design Spec

**Date**: 2026-06-24
**Status**: Approved
**Version**: v11.18.0 → v11.19.0
**Sprint Branches**:
`feature/sprint-112-reputation-disclosure-boundary` (PR A) →
`feature/sprint-112-my-network-prominence` (PR B, branched from merged PR A)
**ADR**: New ADR-082 — Reputation Disclosure Boundary
**Primary Backlog**: BUG-024 + 2026-06-24 belonging-graph prominence idea

---

## Overview

Sprint 111 made the belonging graph coherent, explorable, and privacy-aware, but post-deploy
validation exposed a deeper product inconsistency. The same member in the same community can see
“trust 120 · 40 karma” on one surface and “Trust Score 27/100 · Karma 0” on another. These values
come from different models: graph-node relationship weight, normalized reputation score, raw karma,
and decayed karma. Presenting all of them as interchangeable “trust” and “karma” makes the platform
look unreliable even when each calculation is individually correct.

The same audit found that the privacy repair was too local. Sprint 111 redacted non-caller graph-node
metrics, but governance, trust cards, path intermediates, invitations, leaderboards, and community
exports can still reveal another ordinary member’s exact reputation values. Hiding those values in
React is not a durable privacy boundary; the API response itself must be safe.

Sprint 112 establishes one platform-wide reputation disclosure policy and then raises the belonging
graph to the product altitude promised by ADR-081. Exact personal reputation is self-only.
Member-facing relationship and governance surfaces receive structure and coarse explanations, not
another person’s scores. Public provider ratings and anonymous community aggregates remain explicit,
typed exceptions. `/network` becomes **My Network** in the primary navigation and gains a prominent
Home preview, while Profile and My Network consume the same canonical self-metrics contract.

### Core Principle: Show belonging; protect scoring

Karmyq may show how people and communities are connected, but an ordinary member’s exact reputation
numbers belong only to that member.

---

## Multi-Sprint Arc

### Sprint 110 — Belonging Graph Research (complete)

Audited the graph system, studied reference products, and proposed ADR-081.

### Sprint 111 — Belonging Graph System (complete)

Shipped one D3 engine, one graph model, `/network`, progressive exploration, and graph-specific
metric redaction as v11.18.0.

### Sprint 112 — Belonging & Reputation Truth (this sprint)

Generalize privacy into a platform boundary, reconcile self-facing terminology and data sources, and
make My Network a first-class product destination.

### Later — Onboarding and narrative growth

An onboarding moment that introduces a new member’s growing network remains a later UX sprint. It is
not required to establish the disclosure boundary or elevate the existing explorer.

---

## Disclosure Policy

### Policy matrix

| Subject / surface | Exact personal reputation | Coarse explanation | Structure / identity |
|---|---:|---:|---:|
| Authenticated member viewing self | Allowed, community-scoped | Allowed | Allowed |
| Authenticated member viewing another ordinary member | Forbidden | Allowed | Allowed when already authorized by the surface |
| Governance eligibility | Internal calculation only | Allowed | Allowed to community members |
| Public provider profile | Provider rating fields allowed | Allowed | Allowed |
| Anonymous community health aggregate | Aggregate only | Allowed | No member-level breakdown |
| Internal jobs, ranking, voting, and eligibility calculations | Allowed internally | N/A | N/A |

“Exact personal reputation” includes:

- normalized reputation/trust scores;
- raw or decayed karma totals and transaction values;
- personal reputation ranks and leaderboards;
- exact member-level trust-weight sums;
- derived tiers that directly reveal private thresholds or totals;
- another member’s reputation history, badge/milestone evidence, or metric averages.

“Structure” includes authorized names, graph adjacency, degrees of separation, community membership
already visible on that surface, invitation relationships, and governance roles. Structure does not
grant permission to attach exact reputation values.

### Explicit exceptions

1. **Provider reputation** is a separate public domain contract. Public provider stars, completion
   rate, response rate, and provider trust score remain visible because they describe an opted-in
   service-provider role, not the person’s private mutual-aid reputation.
2. **Community aggregates** remain visible only when they cannot be decomposed into an individual
   member’s value. Existing community health, maturity, density, and reciprocity measures qualify.
3. **Internal decisions** may use exact values. Fission/fusion vote weighting, governance threshold
   checks, matching/ranking, and background jobs keep their calculations; only their outward
   projection changes.

There is no administrator exception for browsing another member’s exact ordinary reputation.
Administrative exports and stewardship screens must follow the same disclosure rule.

---

## New Concepts

### Reputation score

The canonical self-facing 0–100 score from the reputation service’s multi-signal model
(ADR-037/038/039). UI copy uses **Reputation score**, not the ambiguous bare term “trust.”

### Current karma

The member’s community-scoped karma after the documented decay policy is applied. UI copy uses
**Current karma** and states the decay policy. Raw ledger totals remain internal/accounting data.

### Relationship state

A qualitative description of a pairwise bond or graph edge:
`strong | warm | fading | nearly_forgotten`. It is derived from the existing decay tier and is not
an individual reputation score. Member-facing graph contracts use this state rather than exposing
raw/effective edge weights.

### Governance eligibility

A coarse, explainable result:

```typescript
type GovernanceEligibilityReason =
  | 'established_community_relationships'
  | 'eligibility_threshold_not_met'
```

Eligible-member copy:

> Eligibility threshold met through established community relationships.

The numeric threshold and score may be used internally. Another member’s value is never returned.
Community-level maturity may still show an aggregate and the configured policy threshold because
neither is a member’s personal score.

### Disclosure class

Every reputation-bearing outward contract belongs to one of four classes:
`self | ordinary_member | provider | community_aggregate`. Shared strict schemas define which
fields each class may contain.

---

## Architecture

### Delivery sequence: two independently mergeable PRs

Sprint 112 is one product arc with two ordered PRs:

1. **PR A — Reputation disclosure boundary (privacy-critical).** Shared strict schemas, endpoint
   inventory/classification, canonical self summary, self-only compatibility hardening, governance
   projection, graph/path/trust-card/invitation/export cleanup, leaderboard retirement, tests, ADR,
   registry/context/docs, and the CI disclosure gate. PR A is independently deployable and must not
   wait for navigation or Home-preview work.
2. **PR B — My Network prominence.** Primary/overflow navigation, Home preview, canonical self
   summary on Profile and My Network, terminology cleanup, leaderboard UI removal, and frontend/docs
   tests. PR B starts from deployed/merged PR A contracts and cannot weaken or bypass them.

If PR B uncovers a privacy defect, fix it in the boundary layer and add the regression to PR A’s
contract suite (or a focused boundary follow-up), not as a client-side workaround.

### Central contract boundary

Add strict Zod-backed disclosure schemas to `@karmyq/shared`:

```typescript
type DisclosureClass =
  | 'self'
  | 'ordinary_member'
  | 'provider'
  | 'community_aggregate'

interface SelfCommunityReputation {
  scope: {
    type: 'community'
    community_id: string
    community_name: string
  }
  reputation: {
    score: number
    scale_min: 0
    scale_max: 100
    tier: 'new' | 'active' | 'trusted' | 'highly_trusted'
    calculated_at: string
  }
  karma: {
    current: number
    trend: 'growing' | 'stable' | 'declining'
    half_life_days: number
    calculated_at: string
  }
  activity: {
    recent_helps: number
    recent_requests: number
    window_days: 30
  }
}

interface PublicMemberIdentity {
  user_id: string
  name: string
}

interface GovernanceEligibleMember extends PublicMemberIdentity {
  eligible: true
  eligibility_reason: 'established_community_relationships'
}

interface SafeBelongingNode extends PublicMemberIdentity {
  is_current_user: boolean
  degrees_of_separation?: 0 | 1 | 2 | 3
}

interface SafeBelongingLink {
  source: string
  target: string
  relationship_state: 'strong' | 'warm' | 'fading' | 'nearly_forgotten'
  type?: 'organic' | 'fission'
}
```

Schemas are `.strict()`: extra properties such as `trust_score`, `karma`, `total_karma`,
`raw_weight`, or `effective_weight` cause projection tests to fail rather than being silently
passed through. Services calculate with rich internal rows and explicitly project to these outward
DTOs at the final response boundary.

Provider and aggregate schemas use distinct names and modules. They do not weaken the
ordinary-member schema with optional reputation fields.

### Defense in depth

1. **Query minimization** — do not select another member’s exact metrics when a response does not
   need them.
2. **Explicit projection** — map internal rows to strict outward DTOs; never spread database rows
   into API responses.
3. **Shared typed schemas** — self, ordinary-member, provider, and aggregate responses are separate
   types.
4. **Cross-user endpoint tests** — authenticate as one member and assert another member’s seeded
   sentinel values are absent.
5. **CI disclosure gate** — maintain an explicit inventory of reputation-bearing outward endpoints.
   The gate asserts every inventory entry has a disclosure class, an approved strict schema, and a
   test fixture; newly registered reputation-bearing endpoints cannot ship unclassified.

The inventory is contract-based, not a naive repository-wide ban on words such as `karma`.
Internal calculations, database columns, provider schemas, and aggregate schemas legitimately use
those names.

`services/registry.json` endpoint objects under the sensitive roots (`/reputation`, `/trust`,
`/invitations`, governance, and member-level exports) receive a
`reputation_disclosure: self | ordinary_member | provider | community_aggregate | internal`
classification. `tests/fixtures/reputation-disclosure-inventory.json` maps each classified outward
endpoint to its strict schema and contract test. The CI gate compares the registry and inventory in
both directions, so a newly registered sensitive endpoint cannot omit classification or test
coverage.

---

## Data Model

No database schema change is required.

Existing sources remain authoritative:

- `reputation.karma_records` — append-only karma ledger;
- reputation-service trust calculation — normalized 0–100 self reputation;
- `social_graph.trust_edges_live` — internal relationship strength and decay;
- governance’s trust-weight sum — internal eligibility calculation;
- provider reputation tables — public provider-domain exception;
- community health tables/queries — anonymous aggregate exception.

This sprint changes naming, projection, authorization, and client consumption—not reputation math.
An aggregate is outward-safe only when it covers at least five distinct members. Results below that
cohort size are suppressed rather than returned with identifying or reconstructable values.

---

## API Endpoints

### New canonical self endpoint

#### `GET /reputation/me/community-summary?community_id=<uuid>`

**Auth:** authenticated member; requested community must be one of the caller’s active memberships.

**Response:** `SelfCommunityReputation`.

This single read combines:

- normalized 0–100 reputation score;
- current decayed karma;
- karma trend;
- recent help/request counts;
- explicit scope, scale, decay window, activity window, and calculation timestamps.

Profile and My Network consume this endpoint. Neither surface independently combines
`GET /me/karma`, `GET /trust/:userId/:communityId`, or graph-node fields.

### Reputation-service compatibility hardening

| Endpoint | Sprint 112 behavior |
|---|---|
| `GET /reputation/karma/:userId` | Self-only; non-self returns `404` to avoid metric/account probing. Existing self clients migrate to the canonical summary. |
| `GET /reputation/trust/:userId` | Self-only; non-self returns `404`. |
| `GET /reputation/trust/:userId/:communityId` | Self-only + active-membership scope; non-self/inaccessible returns `404`. |
| `GET /reputation/history/:userId` | Self-only; non-self returns `404`. |
| `GET /reputation/badges/:userId` and `/users/:userId/badges` | Self-only; milestone evidence can reveal private reputation. |
| `GET /reputation/leaderboard/:communityId` | Retired. Return `410 REPUTATION_LEADERBOARD_RETIRED` for one compatibility release, then remove. |

The authenticated identity always comes from the verified JWT. A path parameter never grants
access to another member’s metrics.

Before retiring the leaderboard, search the entire repository for
`getCommunityLeaderboard`, `/leaderboard/`, and `getLeaderboard`. Confirm that no governance,
ranking, feed, simulation, mobile, or internal-service path depends on the endpoint or service
function. Internal aggregate calculations must not be removed merely because the member-facing
leaderboard is retired.

Every new `404`/`410` response uses the ADR-074 envelope:

```json
{
  "success": false,
  "message": "Human-readable explanation",
  "error": "STABLE_ERROR_CODE"
}
```

Self-only denial uses `404 REPUTATION_NOT_FOUND`; leaderboard retirement uses
`410 REPUTATION_LEADERBOARD_RETIRED`. Bare status responses are forbidden.

### Reputation configuration and aggregate classifications

The disclosure inventory pre-classifies the remaining sensitive-root endpoints:

| Endpoint | Disclosure class | Sprint 112 rule |
|---|---|---|
| `GET /reputation/community-trust/:communityId` | `community_aggregate` | Keep the aggregate response; require active community membership and ≥5-member suppression. |
| `GET /reputation/community-health/:communityId` | `community_aggregate` | Keep non-identifying health/trend aggregates; require active membership and ≥5-member suppression. |
| `GET /reputation/milestones/:communityId` | `community_aggregate` | Keep community achievements; require active membership and ≥5-member suppression. |
| `GET /reputation/network-metrics/:communityId` | `community_aggregate` | Keep non-identifying network aggregates; require active membership and ≥5-member suppression. |
| `GET /reputation/trust-config/:userId/:communityId` | `self` | Caller must equal `:userId` and be an active member; otherwise ADR-074 `404 REPUTATION_NOT_FOUND`. |
| `PUT /reputation/trust-config/:userId/:communityId` | `self` | Same self + membership authorization; it remains a self preference mutation. |
| `GET /reputation/trust-config/:userId/:communityId/history` | `self` | Self-only; evolution history is personal configuration history. |
| `GET /reputation/users/:userId/effective-params` | `self` | Self-only; effective personal thresholds/weights never leave the caller boundary. |
| `GET /reputation/users/:userId/evolution-global` | `self` | Self-only. |
| `PUT /reputation/users/:userId/evolution-global` | `self` | Self-only. |
| `GET/PUT /reputation/communities/:communityId/trust-evolution` | `internal` | Community-admin configuration surface; returns community policy, never member parameters. |
| `GET /reputation/community/:communityId/evolution/history` | `internal` | Community-admin policy history; audit response to ensure no personal member parameters are included. |
| `GET /reputation/community/:communityId/evolution/summary` | `internal` | Community-admin aggregate summary; no member rows. |
| `PUT /reputation/community/:communityId/evolution/toggle` | `internal` | Community-admin configuration mutation. |

Implementation must test every `:userId` configuration route with a different authenticated caller
and non-zero/different personal parameters. A path parameter must never authorize reading another
member’s trust weights, carry factors, or evolution history.

### Governance response

`GET /communities/:id/governance` keeps settings, aggregate maturity, nominations, ratification
counts, and roles. Member-level projections become:

```typescript
eligible_members: Array<{
  user_id: string
  name: string
  eligible: true
  eligibility_reason: 'established_community_relationships'
}>

role_holders: Array<{
  user_id: string
  name: string
  role: 'admin' | 'moderator'
}>
```

The service continues to calculate exact trust-weight sums to determine eligibility and validate a
nomination. It does not select karma for the response and does not return member trust totals.

### Social-graph response changes

All person graph endpoints return `SafeBelongingNode` and `SafeBelongingLink`:

- `GET /trust/graph`
- `GET /trust/graph/:communityId`
- `GET /trust/graph/:communityId/full`
- `GET /trust/neighborhood/:userId`

Person nodes no longer contain `trust_score` or `karma`, including the caller’s node. Exact self
metrics come only from the canonical reputation endpoint. Links no longer expose
`raw_weight`/`effective_weight`; they expose qualitative `relationship_state` plus structural
source/target/type fields. The D3 renderer maps relationship states to visual width/opacity.

`GET /trust-card/:targetUserId` removes target karma and karma-derived trust tier. It returns
authorized identity, path, degrees, path type, scope, and a coarse relationship explanation.

`GET /paths/:targetUserId` and `POST /paths/batch` remove intermediate-node karma and rename/remove
the outward numeric `trust_score`. Feed ranking may continue using internal numeric path strength;
member-facing responses receive degrees, topology, connection type, and a coarse relationship band.
The request-service feed currently consumes only degrees from `/paths/batch`, so removing its unused
numeric field does not change ranking.

Invitation history removes `invitee.karma`. Invitation stats remove `avg_invitee_karma` and
`avg_invitee_trust_score`; counts, acceptance rate, network size, and inviter tier may remain.

`GET /trust/edge` is retired with ADR-074
`410 TRUST_EDGE_ENDPOINT_RETIRED`: it has no runtime caller and currently permits arbitrary
member-pair metric lookup. The internal `getTrustEdge()` database helper remains for path
calculation.

`GET /trust/me/memory` and `GET /trust/relationships/fading` keep the caller-relative peer identity,
decay tier, last-interaction date, and completed-interaction count, but remove exact
`currentWeight`. The legacy `GET /network` route remains a structural ordinary-member contract and
does not gain reputation fields.

`GET /trust/decay-config` and `GET /trust/decay-config/:communityId` are classified community policy
aggregates; the community-specific read requires active membership. `PUT /trust/decay-config/:communityId`
remains an internal community-admin policy mutation.

### Community exports

Member-level stewardship exports must remove ordinary-member karma totals, trust scores, ranks, and
transaction values. Self-data export remains a separate privacy right and may include the caller’s
own complete reputation record. Community aggregate reports may retain non-identifying totals and
averages only when small-cell suppression prevents reconstruction of an individual.

---

## Frontend Changes

### Primary navigation

Add **My Network** → `/network` to the authenticated top-level navigation. It is visible alongside
Communities on desktop and in the responsive overflow menu. The wordmark remains Home.

### Home preview

Add a prominent **Your network** section to Dashboard Home after the primary decision/action band
and before lower-altitude feed texture. It includes:

- a compact static ego belonging graph;
- “You’re connected to N people across M communities”;
- the selected community’s self reputation summary when a community is selected;
- an explicit **Explore My Network →** link.

The preview remains secondary to urgent/actionable help decisions. Elevating belonging must not push
pending decisions below decorative content.

### My Network

The existing `/network` explorer remains the full experience. Add a self-summary panel using the
same canonical endpoint as Profile:

- **Reputation score** — “27 out of 100,” with tier and community name;
- **Current karma** — decayed, with half-life explained;
- recent helps and requests — explicitly “last 30 days.”

The summary has an explicit community selector in every explorer mode. It defaults to the current
active community when available, otherwise the first active membership. In community graph mode,
the graph’s selected community and summary scope stay synchronized. Ego and communities modes may
remain structurally cross-community, but their exact self metrics always name one selected community;
they never imply that a community score is platform-wide.

The graph itself shows relationship structure and qualitative relationship state. It does not show
node-level reputation numbers.

### Profile

Replace the current two-request metric assembly with the canonical self summary. Remove ambiguous
copy:

- “Trust Score” → “Reputation score”;
- “Karma Points” → “Current karma”;
- include community scope, scale, activity window, decay policy, and calculation time;
- eliminate nested response fallbacks that obscure contract drift.

### Governance

Eligible members show:

> Eligible for stewardship — eligibility threshold met through established community relationships.

Role holders show role only. No ordinary member’s trust or karma appears.

### Retired personal-ranking UI

Remove the ordinary-member karma leaderboard from `/reputation/karma` and any dormant sidebar
leaderboard. Replace competitive ranking copy with the member’s own community-scoped history and a
link to the explanation of reputation privacy.

### Provider and aggregate exceptions

Provider cards/pages keep provider-specific ratings and labels. Community health/maturity surfaces
keep aggregate measures. Their types and copy must make the domain explicit:
**Provider rating** and **Community health**, never generic “your trust.”

---

## Error Handling

- Missing/invalid `community_id` on the self summary returns `400`.
- A community outside the caller’s active memberships returns `404`.
- Non-self access to compatibility reputation endpoints returns `404`, not `403`, to avoid
  confirming that a user has reputation data.
- A schema projection failure is logged as a server contract violation and returns the canonical
  `500 INTERNAL_ERROR` envelope; it must never fall back to returning an unvalidated row.
- Home/Profile/My Network fail independently: if self metrics are unavailable, belonging structure
  still renders with a quiet retry state. No stale or zero-filled metric is presented as truth.

---

## Test Plan

### Shared contract tests

- Strict ordinary-member schemas reject `trust_score`, `karma`, `total_karma`, `raw_weight`, and
  `effective_weight`.
- Self schema accepts the canonical scoped summary and rejects missing scope/scale/window metadata.
- Provider and aggregate schemas accept only their explicit exception fields.

### Service tests

- Reputation summary returns exact values only for the authenticated caller and selected active
  community.
- Every compatibility metric endpoint returns `404` for cross-user access.
- Leaderboard returns the retirement contract and no ranked member rows.
- Governance uses exact values internally for eligibility but its response contains only identity,
  eligibility, reason, and role.
- Graph, neighborhood, trust-card, path, invitation, and export responses omit seeded sentinel
  reputation values for other members.
- Provider-rating and community-aggregate responses remain available.

### Frontend tests

- Profile and My Network call the same canonical summary method and render the same values/labels.
- Home preview appears below actionable decisions, links to `/network`, and fails softly.
- Primary and overflow navigation both expose My Network.
- Governance renders coarse eligibility copy and cannot render numeric member reputation fields.
- Graph node detail shows relationship context, never trust/karma values.
- Karma leaderboard UI is absent.

### CI disclosure regression gate

Create an explicit endpoint inventory covering every reputation-bearing outward contract. The gate
fails when:

1. an entry lacks a disclosure class;
2. an entry lacks a strict response schema;
3. an entry lacks a cross-user or exception test;
4. a protected response fixture contains a forbidden key at any nesting depth;
5. a new registry endpoint is marked reputation-bearing but is missing from the inventory.

This gate supplements endpoint tests; it does not attempt to prove privacy through source-text grep
alone.

The gate also asserts that protected `404`/`410` fixtures use the ADR-074 string-code envelope and
that every `:userId` reputation/config route has an explicit cross-user denial fixture.

### Human validation

Use two demo identities with deliberately different sentinel values:

1. As Maria, compare Profile and My Network in the same selected community; reputation, karma,
   recent activity, scope, and labels match exactly.
2. As Maria, inspect another member through community graph, trust card/path, invitations,
   governance, and exports; no exact personal reputation appears in UI or network responses.
3. As the second member, repeat against Maria to prove the rule is caller-relative.
4. Confirm governance eligibility and nomination still function.
5. Confirm provider ratings remain public and community aggregate health still renders.
6. Confirm My Network is reachable from desktop navigation, responsive overflow, and Home preview.
7. Confirm urgent decisions remain above the Home graph preview.

---

## User Guide & Doc Updates

- Create **ADR-082: Reputation Disclosure Boundary** and mark it Implemented only after deployment.
- Update ADR-081 to reference ADR-082 and remove graph nodes’ numeric reputation contract.
- Update `docs/guides/trust-graph.md`: My Network navigation, relationship-state language, and why
  other members’ scores are absent.
- Update `docs/concepts/reading-the-trust-graph.md`: belonging structure is not a reputation
  leaderboard.
- Update the existing reputation/karma guide or concept page found during implementation; do not
  create a duplicate. Define Reputation score, Current karma, relationship state, provider rating,
  and community aggregate.
- Update onboarding workflow copy for navigation/terminology changes, but do not add the deferred
  onboarding graph experience.
- Regenerate landing docs through `scripts/generate-docs.ts`; never hand-edit generated output.
- Mark BUG-024 fixed with the canonical contract and disclosure audit evidence.

---

## Critical Implementation Notes

1. **The boundary is API-first.** UI hiding is defense in depth, not the privacy control.
2. **Remove, do not zero.** Protected DTOs omit forbidden fields entirely. `0` is still a value and
   invites clients to treat redacted data as real data.
3. **One self source.** Profile, Home preview, and My Network consume
   `GET /reputation/me/community-summary`; they do not recompute or merge reputation values.
4. **No reputation-math rewrite.** ADR-037/038/039 scoring, ADR-011 decay, governance thresholds,
   vote weights, matching, and internal jobs remain intact.
5. **Graph strength is relational, not personal.** Outward graph links use qualitative
   `relationship_state`; exact edge weights remain internal.
6. **No admin browsing exception.** Governance and community exports cannot expose another ordinary
   member’s exact metrics.
7. **Provider fields are domain-specific exceptions.** Keep them in provider DTOs; never add optional
   provider fields to the ordinary-member schema.
8. **Aggregates require non-identification.** Do not publish member-level rows disguised as an
   aggregate. Suppress cohorts with fewer than five distinct members.
9. **Cross-user tests need non-zero sentinels.** A response full of zeroes cannot prove a leak is
   absent.
10. **Trust paths and invitations are in scope.** Removing graph-node metrics alone does not satisfy
    the platform-wide rule.
11. **Retire member leaderboards.** Competitive ranking contradicts exact-metrics self-only privacy.
    Audit all internal callers before removal; do not delete an internal calculation that happens to
    share the service function.
12. **ADR-074 on every denial.** Self-only `404` and retirement `410` responses always include
    `{ success:false, message:string, error:string }`.
13. **Classify configuration routes now.** Every `:userId` trust/evolution configuration endpoint is
    self-only; community policy endpoints are internal/admin; community trust/network reads are
    aggregate exceptions with membership and cohort safeguards.
14. **Privacy ships first.** PR A is independently mergeable and deployable; PR B cannot delay it.
15. **Action altitude wins on Home.** The belonging preview is prominent but remains below pending
    decisions and urgent help actions.
16. **No schema migration.** If implementation appears to require one, stop and revisit the design.
17. **Docs and registry must describe the changed contracts.** Update reputation-, community-, and
    social-graph-service contexts plus `services/registry.json`.
18. **Preserve public exceptions in tests.** The privacy gate must not accidentally erase provider
    accountability or anonymous community health.

---

## Success Criteria

Sprint 112 is done when:

1. Maria sees one matching community-scoped self summary on Profile and My Network.
2. No ordinary member endpoint exposes another member’s exact personal reputation.
3. Governance remains understandable and operational through coarse eligibility explanations.
4. Provider ratings and anonymous community aggregates remain available.
5. My Network is a first-class navigation destination with a prominent, correctly ordered Home
   preview.
6. The disclosure inventory and CI gate prevent an unclassified reputation-bearing contract from
   merging.
7. Unit, regression, cross-user API, type, docs, simplify, code-review, security-review, and human
   validation gates pass.
