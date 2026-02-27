# Sprint 9: Complete — No Active Workstreams

## Handoff Document for New Conversation

**Date**: 2026-02-27
**Current Version**: v9.1.0
**Status**: Sprint 9 fully complete and deployed. No active workstreams. Start Sprint 10 planning.

---

## ✅ Already Implemented (Sprint 8 + Sprint 9)

### Sprint 8
1. Trust page updated with ADR-037 formula (Volume/Quality/Depth/Breadth/Bonus)
2. Feed composite default (removed auto-set to first community)
3. Overall trust score (`getOverallTrustScore()`, `GET /reputation/trust/:userId`)
4. ADR-040: Community Trust Score (bonding/bridging model, daily cron, `GET /reputation/community-trust/:communityId`)

### Sprint 9 — Both Workstreams Deployed

#### Workstream A: Provider Profiles (commit `89d2cbe`)
- Migration 022: `requests.provider_profiles`, `provider_ride_details`, `reputation.provider_reviews`, `reputation.provider_trust_scores`
- request-service: 5 CRUD endpoints at `/providers`
- reputation-service: `POST /reputation/provider-reviews`, `GET /reputation/provider-trust/:id`, `GET /reputation/provider-reviews/:id`
- Provider trust formula (ADR-042): 60% avg_stars + 30% completion_rate + 10% response_rate
- ADR-041 + ADR-042 docs + landing page JSON
- 16 TDD tests

#### Workstream B: Landing Page Docs Restructure (commit `565a4db`)
- **Nav restructured** into audience-separated sections:
  - Non-Technical: Why Karmyq (3) → How It Works (5) → User Guides (6)
  - Technical: Architecture Decisions (grouped by theme, superseded noted) → API → Services
- **3 new concept pages**: the-village-model, neighborhood-service-layer, why-ratings-are-private
- **trust-paths.json** rewritten in plain language (removed BFS/algorithm detail)
- **community-design.json** expanded into full admin setup guide

---

## Open Design Questions (for Sprint 10 planning)
1. **Provider frontend** — backend deployed, no UI yet:
   - `/providers` — provider directory
   - `/providers/[id]` — profile page
   - `/settings/provider-profile` — manage profiles
   - Post-match review prompt
2. Community trust visibility — public to non-members or admin-only?
3. Provider `completion_rate` — currently 0; needs match completion event wiring (Phase 2)
4. Provider Phase 2 extensions — `provider_tradesperson_details`, `provider_tutor_details`
5. Minimum activity floor — exclude communities with < N active members from trust scores?
6. ADR-039 minimum weight floor — `0.1` in `getWeightedAvgFeedback()` should be tunable config

---

## Test Status
- 27/27 full suite passing
- Deployment: `git push origin master` triggers GitHub Actions → karmyq.com

---

## Quick Start for Sprint 10

No active task — start by reviewing the open design questions above and deciding what to prioritize. The most user-visible gap is the **provider frontend** (the backend is deployed but there's no UI to use it yet).
