# ADR-073: Provider↔Community Link-Up

**Status:** Accepted
**Date:** 2026-06-10
**Sprint:** 93

## Context

Members reported the community / service-provider relationship "seems confusing" (IDEAS
2026-06-08). A Sprint 93 audit-first investigation (Playwright walkthrough of the live demo +
code review — `docs/design/sprint-93-provider-linkup/AUDIT.md`) confirmed a structural seam:

- `requests.provider_profiles` has **no community link** (schema comment: "generic base table …
  publicly visible, not community-gated"). `GET /requests/providers` is platform-global and
  public — it filters only `is_active` / `service_type`, with no community join and no auth.
- Yet every trust-bearing flow — dibs candidate pools, matching, trust scores — treats the
  **community as the trust boundary**. The dashboard mutual-aid feed presents every person
  through community + trust path ("From Sofia · PDX Rides Collective", "Direct connection",
  "via Maria Elena Reyes").

So the same platform tells two opposite stories about who a provider is relative to your
community: the mutual-aid surface is community-scoped and trust-aware; the provider directory is a
flat, context-free global list. The audit ranked three findings (H1 no community–provider tie;
H2 scattered dual-identity surfaces; H3 onboarding never explains the community relationship). The
maintainer ratified the **full** fix list (F1 + F2 + F3) at the mid-sprint checkpoint.

A key enabling observation: the platform **already** knows a provider's communities implicitly —
the availability endpoint derives `communityIds` from the provider's own JWT memberships to fire
`provider_went_on_duty`. A provider serves the communities they belong to; the directory just
wasn't using that link.

## Decision

**The community is the trust boundary, and every provider surface must say so — via the *implicit*
link (a provider's own community memberships), with no new schema.**

### F1 — Community-scoped provider discovery (no schema change)

`GET /requests/providers` stays public and unauthenticated-compatible, but when called **with a
token** it annotates each provider with `shared_communities` — the communities the provider and
the viewer both belong to — computed by joining `communities.members` on the viewer's JWT
community IDs ∩ the provider's memberships. The directory UI groups "In your communities" ahead of
"Other providers" and badges each in-community card. Unauthenticated responses are unchanged (the
directory stays publicly browsable). We deliberately did **not** add an explicit
`provider_communities` table — the implicit "serves my own communities" link covers the dissonance
without a migration.

### F2 — Onboarding explains the community relationship

`/providers/new` now frames the profile as visible to *your communities* (the same circles you
help through mutual aid), instead of a generic "neighborhood service directory."

### F3 — A coherent provider home (bounded; see Consequences)

The "My Provider Presence" panel on `/providers` becomes the provider's home: identity (profiles +
collectives) + on/off-duty status + the community framing in one place, instead of surfaces
scattered across the nav toggle, the panel, and collectives.

## Consequences

- Provider discovery is presented through the same community trust lens as dibs/matching, with zero
  schema change and the public directory intact. One extra (indexed) `communities.members` query
  runs only for authenticated browses.
- The provider response contract gains an additive `shared_communities` field (existing consumers
  ignore it).
- **F3 is delivered as a bounded coherence increment, not the full "facets, not modes" nav
  redesign** the maintainer's IDEAS note ([2026-05-06]) ultimately wants (provider and community as
  two facets of one identity, signalled by colour rather than a mode toggle). That deeper
  restructure is a design-led follow-up logged in `docs/IDEAS.md`; this sprint ships the
  community-framed provider home + duty status, removing the worst of the "scattered" confusion
  without an unbounded redesign.

## Alternatives Considered

- **Explicit `provider_communities` table** — a provider explicitly lists which communities they
  serve (including ones they're not a member of). More flexible, but adds a migration, an
  onboarding multi-select, and write paths — not needed to fix the core dissonance. Deferred.
- **Hard community filter** (show only providers who share a community) — rejected: it would break
  the publicly-browsable directory and hide legitimately discoverable providers; grouping + badging
  keeps discovery broad while adding the community lens.

## Related

- ADR-041: Two-Layer Mutual-Aid + Services (the two-facet model)
- ADR-072: Dibs Scope — extended this sprint with the `community_connection` reason
- `docs/design/sprint-93-provider-linkup/AUDIT.md` — the screenshot-backed audit + ratified scope
