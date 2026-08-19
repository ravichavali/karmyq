# ADR-041: Two-Layer Mutual Aid + Professional Services

**Status**: Accepted
**Date**: 2026-02-27
**Supersedes**: —
**Related**: ADR-042 (Provider Trust Score), ADR-095 (Authenticated Provider Directory and Reach-Gated Standing)

> **Note (Sprint 125, 2026-08-17) — narrowed by [ADR-095](ADR-095-authenticated-provider-directory-and-reach-gated-standing.md), NOT superseded.**
> Two clauses below have moved:
> - **"Publicly visible" is now "visible to any authenticated user."** The directory routes require
>   auth. It is still global, not community-gated — cross-community discovery is the point.
> - **Self-registration is unchanged.** Community standing gates a provider's *reach* into a
>   community, never their ability to register or appear in the global directory.
>
> Everything else in this ADR — the two-layer separation of karma and paid services — stands as written.

---

## Context

Karmyq is a mutual aid platform built on a gift economy: karma, reciprocity, community scoping. But real neighborhoods also contain people who *do* provide services for pay — rickshaw operators, handypeople, tutors. These providers benefit from the same coordination infrastructure (matching, messaging, community context) without fitting the karma model.

The two systems don't conflict if kept clearly separate. Mixing them would corrupt both: karma would lose its gift-economy meaning, and paid providers would be awkwardly constrained by community access rules.

---

## Decision

Karmyq adopts a **two-layer model**:

### Layer 1 — Mutual Aid (existing)
- Karma-based, gift economy
- Community-scoped (village model)
- Trust via ADR-037 personal trust score
- Request/match/feedback loop

### Layer 2 — Professional Services (new)
- No karma earned or spent
- Publicly visible (not community-gated) — a rickshaw stand serves the neighborhood, not one community
- Trust via star ratings + completion record (ADR-042), separate from Layer 1 trust
- Advisory pricing only: `pricing_notes` free text; Karmyq never processes payment
- Self-registration: any user can create a provider profile
- Planned coordination, not instant dispatch

---

## Key Design Decisions

### Public visibility
Provider profiles are publicly visible without community membership. A neighborhood service provider shouldn't require someone to join a community to discover them.

### No karma
Karmyq is coordination infrastructure for Layer 2, not a marketplace. Awarding karma for paid work would conflate gift giving with commercial exchange.

### Advisory pricing
`pricing_notes` is free text ("~500/hr negotiable"). Karmyq never processes or validates pricing, never takes a cut.

### Generic base + typed extensions
`provider_profiles` stores generic fields (display_name, bio, service_type, pricing_notes). `provider_ride_details` is the Phase 1 extension for ride providers. Tradespeople and tutors get their own extension tables in Phase 2.

### Self-registration
Any authenticated user can create a provider profile. Communities can gate visibility with `provider_services_enabled` and `provider_min_personal_trust_score`.

---

## Database Tables

```sql
requests.provider_profiles         -- Generic base (all service types)
requests.provider_ride_details     -- Ride-specific extension (Phase 1)
reputation.provider_reviews        -- Stars + text, tied to match_id
reputation.provider_trust_scores   -- Computed cache (ADR-042 formula)
```

---

## API Endpoints

| Service | Method | Path | Auth |
|---------|--------|------|------|
| request-service | GET | `/requests/providers` | Public |
| request-service | GET | `/requests/providers/:id` | Public |
| request-service | POST | `/requests/providers` | Required |
| request-service | PUT | `/requests/providers/:id` | Owner only |
| request-service | DELETE | `/requests/providers/:id` | Owner only |
| reputation-service | POST | `/reputation/provider-reviews` | Required |
| reputation-service | GET | `/reputation/provider-trust/:id` | Public |
| reputation-service | GET | `/reputation/provider-reviews/:id` | Public |

---

## Consequences

**Positive**
- Clear separation prevents karma inflation from commercial activity
- Public profiles serve the neighborhood without community join friction
- Generic + extension table pattern scales to new service types without schema migration

**Negative / Risks**
- Two trust systems (ADR-037 personal trust vs ADR-042 provider trust) require clear UI differentiation
- No payment processing means Karmyq can't arbitrate disputes about pricing

---

## Phase 2 Notes

- `provider_tradesperson_details` (tools, licenses, service area)
- `provider_tutor_details` (subjects, level, format)
- Community-level provider discovery (surface in community search)
