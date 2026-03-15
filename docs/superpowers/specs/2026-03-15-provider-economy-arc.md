# Provider/Service Economy Arc — Sprint 27–29

**Date**: 2026-03-15
**Status**: Active
**Sprints**: 27 (Profile Unification) → 28 (Provider Trust Wiring) → 29 (Rate Cards)

---

## Arc Goal

Build a coherent provider experience that earns user trust:
1. **Sprint 27** — Give providers a unified identity surface (profile + network graph)
2. **Sprint 28** — Make trust scores reflect real behavior, not a static placeholder
3. **Sprint 29** — Let providers publish what they charge so requestors can make informed decisions

Each sprint ships independently to production. The next sprint begins only after the current one is verified on karmyq.com.

---

## Sprint 27: Profile Unification

**Detailed spec**: [2026-03-15-sprint-27-profile-unification-design.md](./2026-03-15-sprint-27-profile-unification-design.md)

### What ships
- `social_graph.connections` materialized table + migration + backfill
- `match_completed` event handler keeps connections table current
- `GET /network` endpoint (reads from connections, not raw match data)
- Two-tab profile page: Community tab (unchanged) + Provider tab (conditional)
- `ProviderProfileTab` component — service profiles + collectives with links
- `NetworkGraph` component — force-directed, lazy-loaded on scroll
- Trust path badge + owner link on `/providers/[id]`

### Stop criteria (all must pass before Sprint 28 begins)
- [ ] `social_graph.connections` table exists on karmyq.com with backfilled data
- [ ] New completed matches upsert a connection row (verified via psql or sim run)
- [ ] Provider users see two tabs on `/profile`; non-provider users unaffected
- [ ] Provider tab lists all service profiles and collectives with correct links
- [ ] Network graph loads on scroll, renders exchange + community edges
- [ ] Provider detail page shows real trust path badge to viewer
- [ ] All TDD tests pass: `npm run test:tdd`
- [ ] No regressions: `npm test`
- [ ] `GET /network` documented in landing page service docs

---

## Sprint 28: Provider Trust Score Wiring

**Detailed spec**: to be written at the start of Sprint 28

### Problem
All provider trust scores are a static `30` — a seed default that never changes. The trust score badge shown on provider cards, collective stats, and (after Sprint 27) the provider detail page is misleading. It suggests a signal that doesn't exist.

### What ships
- Investigate and document where the `30` comes from (schema + seed data)
- Wire trust score recalculation to `match_completed` events
  - When a provider completes a match, their trust score updates based on: number of completed exchanges, average review rating, and karma exchanged
  - Formula to be designed at sprint start (informed by existing ADR-011 and ADR-040 patterns)
- One-time recalculation job for existing providers (backfill from match + review history)
- Trust score now reflects real provider behavior across the platform

### Stop criteria (all must pass before Sprint 29 begins)
- [ ] Trust score changes after a new completed exchange (verified via sim run + DB check)
- [ ] Existing providers have recalculated scores (not all 30)
- [ ] Score shown on provider cards, collective stats, and provider detail page matches DB value
- [ ] Formula documented in updated ADR (ADR-040 or new ADR-044)
- [ ] All TDD tests pass
- [ ] No regressions

### Dependencies
- Sprint 27 must be complete (provider detail page + collective stats are the visible surfaces)

---

## Sprint 29: Rate Cards / Pricing Transparency

**Detailed spec**: to be written at the start of Sprint 29

### Problem
Providers have no way to publish what they charge. Requestors have no way to see pricing before filing a request or contacting a provider. This creates friction at the moment of engagement — especially for paid services where expectations need to be set upfront.

### What ships
- New `rate_cards` table in `requests` schema (linked to `provider_profiles`)
  - Fields: `service_type`, `label` (e.g. "Tutoring — Math"), `rate` (e.g. "$30/hr"), `notes`, `active`
- Provider UI (in the Provider tab of `/profile`, added in Sprint 27) to create/edit/delete rate cards
- Rate card display on `/providers/[id]` — visible to all users, even unauthenticated
- Rate card display on collective detail page for collective members who have cards
- When filing a typed request: requestors can browse matching provider rate cards and optionally pre-select a provider as their preferred responder

### Stop criteria (all must pass before arc is considered complete)
- [ ] Providers can create, edit, and delete rate cards from their profile
- [ ] Rate cards visible on provider detail page (unauthenticated access works)
- [ ] Collective page shows rate cards for member providers
- [ ] Requestors can browse rate cards and pre-select a provider when filing a request
- [ ] Pre-selected provider receives the request as a direct match proposal (design TBD at sprint start)
- [ ] All TDD tests pass
- [ ] No regressions

### Dependencies
- Sprint 27 must be complete (Provider tab on profile is where rate cards are managed)
- Sprint 28 should be complete (trust scores make rate cards more meaningful — requestors see price + trust together)

---

## Carry-Forward After Arc Completes

These ideas are related but intentionally deferred beyond the arc:

| Idea | Why deferred |
|---|---|
| Public `/users/[id]` profile pages | Not needed for provider economy; separate community experience feature |
| Liquid democracy / governance | Unrelated to provider economy |
| Community trust model evolution proposals | Admin UX sprint, not provider sprint |
| Simulation fixes (duplicate offers, no completions) | Data integrity sprint (post-arc) |

---

## Sprint Sequence Summary

```
Sprint 27                Sprint 28                Sprint 29
─────────────────────    ─────────────────────    ─────────────────────
Profile Unification   →  Trust Score Wiring    →  Rate Cards
                         (depends on S27)          (depends on S27+S28)

Stop: connections        Stop: scores are         Stop: providers can
table live, profile      real, not static 30,     publish prices,
tabs working,            formula documented       requestors can pre-
network graph loads                               select a provider
─────────────────────    ─────────────────────    ─────────────────────
```
