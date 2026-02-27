# Sprint 9: Neighborhood Service Providers + Docs Restructure — In Progress

## Handoff Document for New Conversation

**Date**: 2026-02-27
**Current Version**: v9.1.0
**Status**: Workstream A (Provider Profiles) complete and deployed. Workstream B (landing page restructure) not yet started.

---

## ✅ Already Implemented (Sprint 8 + Sprint 9 Workstream A)

### Sprint 8
1. Trust page updated with ADR-037 formula (Volume/Quality/Depth/Breadth/Bonus)
2. Feed composite default (removed auto-set to first community)
3. Overall trust score (`getOverallTrustScore()`, `GET /reputation/trust/:userId`)
4. ADR-040: Community Trust Score (bonding/bridging model, daily cron, `GET /reputation/community-trust/:communityId`)
5. All deployed to karmyq.com — 81/81 TDD, 27/27 full suite passing

### Sprint 9 Workstream A — Provider Profiles (commit `89d2cbe`, deployed 2026-02-27)

**The concept**: Two-layer model for Karmyq:
- Layer 1 — Mutual Aid (existing): karma-based, gift economy, community-scoped
- Layer 2 — Professional Services (new): paid coordination, no karma, star ratings, publicly visible

**What was built**:
- `infrastructure/postgres/migrations/022-provider-profiles.sql` — 4 new tables + community config columns
- `packages/shared/src/schemas/providers/index.ts` — TypeScript types for ProviderProfile, ProviderReview, ProviderTrustScore
- `packages/shared/CONTEXT.md` — created (was missing; needed by feedback:check hook)
- `services/request-service/src/routes/providers.ts` — 5 CRUD endpoints (GET /providers, GET /providers/:id, POST, PUT, DELETE)
- `services/reputation-service/src/routes/providerReviews.ts` — POST /reputation/provider-reviews, GET /reputation/provider-trust/:id, GET /reputation/provider-reviews/:id
- `docs/adr/ADR-041-two-layer-mutual-aid-services.md` + `ADR-042-provider-trust-score.md`
- Landing page JSON for both ADRs + nav.json updated
- TDD tests: `providers-api.test.ts` (8 tests), `providerTrustScore.test.ts` (8 tests)

**Key design decisions (already resolved, don't re-debate)**:
- No karma for paid services
- Provider profiles publicly visible (not community-gated)
- Trust formula (ADR-042): 60% avg_stars + 30% completion_rate + 10% response_rate
- `provider_profiles` is generic base; `provider_ride_details` is Phase 1 extension
- Advisory pricing only (`pricing_notes` free text) — Karmyq never processes payment
- Self-registration — any authenticated user can create a provider profile

---

## ❌ Sprint 9 Remaining — Workstream B: Landing Page Documentation Restructure

**The problem**: Technical and non-technical content mixed with no audience separation. ADRs sit next to user guides. 50KB service docs appear alongside philosophy pages.

**Goal**: Two clearly separated nav sections.

### Proposed Nav Structure
```
Non-Technical
├── Why Karmyq
│   ├── What is Mutual Aid?            (expand existing platform-overview)
│   ├── The Village Model              (NEW)
│   └── The Neighborhood Service Layer (NEW — rickshaw stand concept, ties to ADR-041)
├── How It Works
│   ├── How Trust Works                (rewrite trust-score — philosophy not formula)
│   ├── Why Karma Isn't Currency       (expand what-is-karma)
│   ├── How Connections Build Trust    (rewrite trust-paths — currently too algorithmic)
│   ├── Why Reputation Fades           (keep reputation-decay — already good)
│   └── Why Ratings Are Private        (NEW — anti-gaming, consent)
└── User Guides (all 6, expanded depth)
    └── Running a Community            (expand — what to think about when setting up)

Technical
├── Architecture Decisions (ADRs — curated by theme)
│   ├── Group: Foundation | Trust & Reputation | Requests & Matching | Infrastructure
│   ├── Mark superseded: ADR-011 (→ ADR-037), ADR-035 (→ ADR-037)
│   └── Note ADR-025/026 as intentionally skipped/reserved
├── API Reference (existing)
└── Services (existing — relabeled as developer reference)
```

### Files to Create/Modify
| File | Change |
|------|--------|
| `apps/landing/src/data/docs/nav.json` | Full restructure into Non-Technical / Technical |
| `apps/landing/src/data/docs/concepts/trust-paths.json` | Rewrite — plain language (currently algorithm-heavy) |
| `apps/landing/src/data/docs/concepts/community-design.json` | Expand admin setup depth |
| `apps/landing/src/data/docs/concepts/the-village-model.json` | NEW |
| `apps/landing/src/data/docs/concepts/neighborhood-service-layer.json` | NEW |
| `apps/landing/src/data/docs/concepts/why-ratings-are-private.json` | NEW |

### Current landing doc inventory (from previous exploration)
- 6 concept pages (some good, `trust-paths` needs plain-language rewrite)
- 6 user guides (workflows exist, community-admin needs more depth)
- 31 ADRs in nav (ADR-041/042 just added; some superseded, some skipped — need curation)
- 10 service docs (very technical — move to Technical section)

---

## Quick Start for Next Session (Workstream B)

```bash
# Read the current nav to understand current structure
cat apps/landing/src/data/docs/nav.json

# Read trust-paths (needs plain-language rewrite)
cat apps/landing/src/data/docs/concepts/trust-paths.json

# Then: restructure nav.json into Non-Technical / Technical split
# Then: rewrite trust-paths.json in plain language
# Then: write the three new concept pages (village-model, neighborhood-service-layer, why-ratings-are-private)
```

**Critical git note**: `apps/landing/src/data/docs/` is in `.gitignore`. New files need `git add -f` to track them — this is consistent with how all existing concept/guide JSON files are tracked. Modified existing files stage normally.

---

## Open Design Questions (deferred)
1. Community trust visibility — public to non-members or admin-only?
2. Minimum activity floor — exclude communities with < N active members from trust scores?
3. Community trust in discovery — surface in community search?
4. Trust decay for communities — should inactive communities see scores decay?
5. ADR-039 minimum weight floor — `0.1` in `getWeightedAvgFeedback()` should be tunable config
6. Provider Phase 2 — `provider_tradesperson_details`, `provider_tutor_details` extension tables
7. Provider `completion_rate` tracking — currently defaults to 0; needs match completion event wiring in Phase 2

---

## Provider Frontend (not yet built — future sprint)

Backend for providers is deployed. Frontend pages not yet built:
- `/providers` — provider directory (public, browse by service type)
- `/providers/[id]` — provider profile page
- `/settings/provider-profile` — manage my provider profiles
- Post-match review prompt (after match marked complete)

---

## Test Status
- 27/27 full suite: `npm test`
- Deployment: `git push origin master` triggers GitHub Actions → karmyq.com
