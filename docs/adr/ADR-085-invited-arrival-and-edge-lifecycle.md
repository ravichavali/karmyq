# ADR-085: Invited Arrival & the Edge Lifecycle

**Status**: Implemented
**Date**: 2026-07-08 (Accepted) → 2026-07-09 (Implemented — PR #146 deployed `b0267c8f`, demo validation passed)
**Sprint**: 118
**Version**: 11.27.0
**Builds on**: [ADR-070](ADR-070-trust-edge-decay.md) (decay tiers), [ADR-077](ADR-077-trust-path-platform-topology.md) (platform-wide path topology), [ADR-082](ADR-082-reputation-disclosure-boundary.md) (disclosure boundary), [ADR-083](ADR-083-contextual-belonging-graph-rendering.md) (earned structure)

## Context

Three related gaps kept the belonging graph from telling a member's story end-to-end:

1. **Joining was transactional.** Open registration dumped a new member onto a community list to
   shop from; the invitation path — the one moment where a real relationship enters the platform —
   rendered as another registration form and never showed that relationship. A member first met
   their belonging graph long after joining, as a sparse-ego empty state on `/network`.
2. **The edge story was half-told.** Links carry `decayTier`
   (strong/warm/fading/nearly_forgotten) rendered as opacity bands with an inline legend — the
   *fading* half of a bond's life. Nothing marked a bond as newly *born*.
3. **Connection claims and the graph disagreed (BUG-028).** The connection badge derived
   "connected" from all-time completed `requests.matches` (no decay, no liveness, no membership
   filter) plus shared-community and invitation-chain fallbacks, while the graph disclosed only
   decay-adjusted `trust_edges_live` with active-membership joins. On the curated demo, 742 of
   2103 completed-match pairs had no trust edge at all — the badge celebrated connections the
   graph could not substantiate.

## Decision

**The graph is alive: bonds are visibly born at arrival, visibly strengthen and fade, and every
surface that claims a connection must substantiate it from the edge set the graph discloses.**

### 1. Invite-primary join funnel with a dedicated arrival moment

- `/invite/[code]` **is the landing**: the inviter and community are the context; account creation
  happens inside that context. `/register` stays fully supported but nudges toward invitations.
- Both paths converge on a **dedicated, skippable `/welcome` route** — the arrival moment — shown
  once per account after the first community join. It renders the member's **actual** nascent
  belonging graph (never a stock illustration): you on the ring of the community you just joined,
  plus, on the invite path, the **invitation bond** to your inviter. One guided action follows
  (the community's open asks). Completion and skip are equally graceful: both write the gate key
  and land the same place.
- The arrival gate is **user-scoped** (`karmyq_onboarded:<userId>`), written **only** when
  `/welcome` completes or is skipped. The legacy browser-global `karmyq_onboarded` key is still
  honored so existing users see nothing new.
- A purpose-built `ArrivalGraph` reuses the community-ring primitives but is **never gated on
  edge count** — a zero-trust-edge arrival is the intended picture, not an empty state.

### 2. The invitation bond is provenance, not trust

Invitation acceptance writes `auth.user_invitations` / `users.invited_by` / membership — no trust
edge. The arrival renders the bond from the invite-funnel context itself (validate/accept
responses), visually distinct from every trust edge (dashed, new-bond hue), with explicit copy
that the bond *becomes* trust when you help each other. **No trust edge is ever manufactured from
an invitation** (earned-structure principle, ADR-070/077/083). The ego graph gains no invitation
edges.

### 3. `formed_recently` — the growing half of the edge story

- The neighborhood links query gains `MIN(tel.created_at) AS formed_at` per grouped pair: the
  pair's **first** formation across communities is the relationship's age, so a long-standing
  pair adding an edge in a new community is **not** new.
- The disclosure projection derives `formed_recently: boolean` against a single **30-day window
  constant** (`FORMED_RECENTLY_WINDOW_DAYS`), fail-closed (missing or unparseable formation date
  is never "new"). The timestamp stays internal; only the boolean leaves the server (ADR-082).
- It **supplements** the existing `relationship_state`/`decayTier` contract — never replaces it.
  The client renders new bonds with a distinct stroke + width layered **on top of** the untouched
  decay opacity bands, and the existing inline ego legend gains a "New bond" entry. No layout
  changes (ADR-083 orbits untouched).

### 4. Connection paths derive from the disclosed edge set (BUG-028 fix)

`computeShortestPath` now BFS-walks `social_graph.trust_edges_live` with both endpoints active
members of the edge's community — the same rows the neighborhood graph disclosed — instead of
raw all-time completed matches. Topology stays platform-wide (union across communities,
ADR-077 preserved). The shared-community and invitation-chain fallbacks remain, worded
truthfully ("Fellow member…", "Joined through…"). The BFS also fixes an ordering bug that
silently dropped exactly-3° paths.

## Consequences

### Positive

- A new member's first minute shows them *inside* their graph with a real relationship, not a
  form and a list; the invitation path is celebrated without corrupting earned structure.
- The ego graph now tells both halves of a bond's life qualitatively (new-bond emphasis +
  decay bands) with zero new numeric disclosure.
- Any surface claiming "connected" is substantiated by the graph; legacy seeded matches without
  trust edges no longer produce phantom badges.

### Negative / trade-offs

- Cached `auth.social_distances` rows written before the fix can serve a stale exchange-path
  claim for up to their 7-day TTL (the demo's live cache held only fallback community paths, so
  nothing user-visible regresses there).
- Pairs whose bond decayed to `swept` lose their badge even though a match once completed — this
  is the intended "alive graph" semantic, but it is a behavior change.
- One more localStorage key shape (`karmyq_onboarded:<userId>`); the legacy global key lingers
  for existing users by design.

## Alternatives considered

- **Manufacture a trust edge at invitation acceptance** — rejected: trust is earned through
  exchanges (ADR-070/077/083); an invited stranger would instantly look like a trusted bond.
- **Expose `formed_at` (or an age band) outward** — rejected: ADR-082 allows qualitative state
  only; a timestamp is triangulatable.
- **A parallel `lifecycle` enum replacing `decayTier`** — rejected: the fading half already
  ships and is pinned by regression; supplementing is strictly additive.
- **Arrival as a modal on the communities page** — rejected: a modal competes with the list it
  covers; the moment deserves an unhurried, dedicated route.
