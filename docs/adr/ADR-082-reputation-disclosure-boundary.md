# ADR-082: Reputation Disclosure Boundary

**Status**: Accepted
**Date**: 2026-06-24
**Sprint**: 112
**Version**: 11.18.0 → 11.19.0
**Supersedes (partially)**: the graph-node numeric reputation contract from ADR-081

## Context

Sprint 111 (ADR-081) made the belonging graph coherent and added graph-node metric *redaction*, but
post-deploy validation exposed a deeper, platform-wide inconsistency:

1. **Terminology drift.** The same member, same community, showed "trust 120 · 40 karma" on one
   surface and "Trust Score 27/100 · Karma 0" on another. These are different models — graph-node
   relationship weight, normalized 0–100 reputation, raw karma, decayed karma — all rendered as
   interchangeable "trust"/"karma," making a correct system look unreliable.
2. **Local privacy fix.** Sprint 111 redacted non-caller *graph-node* metrics in React, but
   governance, trust cards, path intermediates, invitations, leaderboards, and community exports
   could still reveal another ordinary member's exact reputation. Hiding values in the client is not
   a durable boundary; the API response itself must be safe.

## Decision

Establish one platform-wide reputation disclosure policy, enforced at the API boundary.

**Core principle:** Karmyq may show how people and communities are connected, but an ordinary
member's exact reputation numbers belong only to that member.

### Disclosure classes

Every reputation-bearing outward contract belongs to exactly one class:

- `self` — exact community-scoped reputation, returned only to the authenticated caller.
- `ordinary_member` — authorized identity + structure + a coarse relationship/eligibility
  explanation. No exact reputation. Strict schemas reject `trust_score`/`karma`/`*_weight`.
- `provider` — opted-in public service-provider ratings (an explicit numeric exception; a person's
  provider role, not their private mutual-aid reputation).
- `community_aggregate` — non-identifying community totals, returned only with a ≥5 distinct-member
  cohort so they cannot be decomposed to an individual.
- `internal` — community-admin policy surfaces (decay/evolution config); never carry member rows.

There is **no administrator exception** for browsing another ordinary member's exact reputation.
Governance and community exports follow the same rule.

### Enforcement (defense in depth)

1. **Query minimization** — do not select another member's metrics when the response doesn't need them.
2. **Explicit projection** — map internal rows to strict outward DTOs at the response boundary;
   never spread database rows into responses.
3. **Strict shared schemas** — `@karmyq/shared` `reputationDisclosure` Zod schemas (`self`,
   ordinary-member graph/path/governance, provider, aggregate) are `.strict()`, so an accidental row
   spread fails projection tests rather than leaking.
4. **Cross-user tests** — authenticate as one member, seed another member's non-zero sentinel values,
   assert they are absent from the response.
5. **CI disclosure gate** — `tests/fixtures/reputation-disclosure-inventory.json` +
   `services/registry.json#reputation_disclosure` are cross-checked in both directions by
   `tests/regression/reputation-disclosure-gate.test.ts`; a new reputation-bearing endpoint cannot
   ship unclassified, schema-less, or test-less, and protected fixtures are scanned for forbidden
   keys at any depth.

### New canonical self contract

`GET /reputation/me/community-summary?community_id=` returns one `SelfCommunityReputation` (scope +
reputation score/tier + decayed karma/trend + recent activity, with scale/window/timestamps).
Profile, Home, and My Network consume this single read instead of recombining karma + trust + graph
fields. UI copy standardizes on **Reputation score** (0–100) and **Current karma** (decayed).

### Compatibility behavior

- Cross-user reads of `:userId` reputation/config endpoints return ADR-074 `404 REPUTATION_NOT_FOUND`
  (not 403 — we do not confirm a user has reputation data). No admin exception on trust-config.
- Community aggregates require active membership + ≥5 cohort, else `404 AGGREGATE_NOT_AVAILABLE`.
- The member leaderboard is retired: `410 REPUTATION_LEADERBOARD_RETIRED`, no rows.
- `GET /trust/edge` is retired: `410 TRUST_EDGE_ENDPOINT_RETIRED` (internal `getTrustEdge()` kept).
- Person graph nodes/links, trust cards, paths, invitations, governance, and exports carry identity,
  structure, and a qualitative `relationship_state` — never another member's exact metrics.

### Relationship state

Member-facing graph contracts expose `relationship_state` (`strong | warm | fading |
nearly_forgotten`, derived from the ADR-070 decay tier) instead of raw/effective edge weights. Exact
edge weights and the numeric path strength remain internal (feed ranking still uses them).

### Defense in depth — UI layer (Sprint 113 / PR A)

PR A (Sprint 112) closed the boundary in the API *contract*. Sprint 113 PR A makes the boundary
*true on the screen* — the client must render the safe contract correctly, not reintroduce a leak or
a `NaN` where a field was intentionally omitted. Three rules, all enforced by frontend TDD tests:

1. **No `NaN` on a possibly-absent field (BUG-025).** Governance/stewardship payloads project each
   member row to identity + a coarse `eligibility_reason` only — no `trust_score`/`karma`. The UI must
   never `Math.round`/`Number`/`.toFixed` an omitted field, and never paper over absence with `|| 0`
   (a fake zero is itself a disclosure anti-pattern). Omit the element or show a qualitative label
   (e.g. governance eligible-members now read "Eligible · established community relationships";
   role-holders show identity + role with no trust number). Community **aggregates** that the contract
   still returns (e.g. `maturity.avg_trust_score`) are unaffected.
2. **One canonical self read (BUG-024/026).** The member's own profile reads its reputation from the
   single `GET /reputation/me/community-summary` contract — never by separately recombining
   `getMyKarma` + `getTrustScore`, which was the dual-source mismatch that showed a member different
   numbers on profile vs. the community view. Profile copy standardizes on **Current Karma** and
   **Reputation Score** (0–100). *Scope of this PR:* `profile.tsx` is migrated. `LeftSidebar` keeps its
   direct self trust read (it must also serve the no-community "overall" case the summary endpoint
   can't); its number is consistent because it reads the same underlying trust score. The community
   member-topology surface's per-member `getTrustScore` reads (`useCommunityData`) are cross-user and
   now correctly receive `404 REPUTATION_NOT_FOUND` from the boundary.
3. **Restore the map zoom, single owner (BUG-027).** Every belonging-graph surface routes through one
   wrapper (`BelongingGraph`) → one renderer (`TrustGraphHEB`). Zoom controls (in/out/reset) mount only
   inside the renderer and are gated by `enableZoom` (now default-on in the wrapper), so no surface
   double-mounts controls. The zoom behavior pins an explicit `.extent()` so the button-driven
   `scaleBy`/`transform` stay deterministic and testable in jsdom.

These are validated by a two-user check (non-zero sentinels) before ADR-082 flips to **Implemented**.

## Consequences

- **Positive:** one consistent, truthful self-facing language; a durable API-first privacy boundary;
  a regression gate that prevents new leaks; provider accountability and community health preserved
  as explicit exceptions.
- **Costs / trade-offs:** other members' exact reputation is no longer visible anywhere (intended);
  the belonging graph shows structure, not node scores; a one-release compatibility window returns
  410/404 for retired/cross-user endpoints before old clients are fully migrated.
- **No database migration** and **no reputation-math rewrite** — ADR-037/038/039 scoring, ADR-011
  decay, governance thresholds, vote weights, matching, and background jobs are unchanged; only
  naming, projection, authorization, and client consumption changed.

## Delivery

Two ordered PRs: **PR A** (this) ships the API-enforced boundary + CI gate + canonical self summary
+ frontend contract alignment. **PR B** adds My Network navigation prominence, the Home preview, the
shared self-summary UI, and retires the leaderboard UI — built only on PR A's safe contracts.
