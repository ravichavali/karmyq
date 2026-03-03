# Sprint 10: Service Provider End-to-End

## Handoff Document for New Conversation

**Date**: 2026-03-01
**Current Version**: v9.1.0
**Status**: Sprint 10 Workstreams A + C deployed. Workstream B (simulation) is next — was interrupted mid-session, nothing committed yet.

---

## What Was Completed This Sprint

### Sprint 10 Workstream A (commit 0a196fa, fixed in e41151f)
- Migration 023: provider_collectives, provider_collective_members, collective_community_links
  - KEY: collective_community_links.community_id is plain UUID (no FK to community.communities)
  - Cross-service DB FKs fail on demo server — migration runner does not guarantee community schema in scope
- request-service: 9 collective endpoints at /collectives
- community-service: provider config fields (provider_services_enabled, provider_min_personal_trust_score, provider_services_list)
- Frontend: 7 provider components, 5 provider pages, "Service Providers" nav link, Providers admin tab

### Sprint 10 Workstream C (same commit)
- docs/guides/using-service-providers-guide.md — source guide (markdown)
- scripts/generate-docs.ts — added to GUIDE_ORDER/LABELS/SLUGS
- services/request-service/CONTEXT.md — 14 endpoint headings added

### Claude Code Automations (commit 8e6cfd4)
- Auto-format hook (Prettier on every Edit/Write) in .claude/settings.json
- /capture skill -> .claude/IDEAS.md
- migration-validator agent in .claude/agents/
- context7 MCP installed

---

## Sprint 10 Workstream B — NEXT TASK (simulation)

### Step 1: Add provider methods to api-client.ts

File: services/simulation-service/src/api-client.ts

Add before the closing brace of the ApiClient class:

  Provider API methods: listProviders, createProvider, getProvider
  Collective API methods: listCollectives, createCollective, joinCollective
  Review API methods: submitProviderReview, getProviderTrust

All follow the same pattern as existing methods. Paths:
  GET /requests/providers
  POST /requests/providers
  GET /requests/providers/:id
  GET /requests/collectives
  POST /requests/collectives
  POST /requests/collectives/:id/members
  POST /reputation/provider-reviews
  GET /reputation/provider-trust/:id

### Step 2: Add seed data to realistic-data.ts

File: services/simulation-service/src/data/realistic-data.ts

Add exports: PROVIDER_PROFILES, COLLECTIVE_PROFILES, PROVIDER_REVIEWS

Sample PROVIDER_PROFILES entries:
  { service_type: 'ride', display_name: 'Auto Rickshaw Service', bio: 'Reliable rides across the neighborhood.', pricing_notes: '~50/trip, negotiable', location_notes: 'East and central neighborhoods' }
  { service_type: 'tradesperson', display_name: 'Home Repair & Plumbing', bio: 'Certified plumber, 5 years experience.', pricing_notes: '~500/hr', location_notes: 'All neighborhoods within 10km' }
  { service_type: 'tutor', display_name: 'Math & Science Tutoring', bio: 'B.Ed graduate, 7 years tutoring grades 6-12.', pricing_notes: '~300/hr', location_notes: 'Home visits or online' }
  { service_type: 'other', display_name: 'Catering & Home Cooking', bio: 'Home-cooked meals for events.', pricing_notes: 'Depends on menu and headcount', location_notes: 'Delivery within 5km' }

Sample COLLECTIVE_PROFILES entries:
  { name: 'Neighborhood Rickshaw Stand', description: 'Local auto drivers, fair rates.', service_types: ['ride'], location_notes: 'Main market stand, 3km radius' }
  { name: 'Home Repair Cooperative', description: 'Plumbers, electricians, carpenters.', service_types: ['tradesperson'], location_notes: 'All residential areas' }

Sample PROVIDER_REVIEWS entries:
  { stars: 5, review_text: 'Excellent service, very punctual.' }
  { stars: 4, review_text: 'Good experience overall. Would use again.' }
  { stars: 3, review_text: 'Decent but slow to respond initially.' }

### Step 3: Create provider-workflow.ts

File: services/simulation-service/src/workflows/provider-workflow.ts

Copy structure from request-workflow.ts. Logic:
1. Try to create a provider profile (pick random from PROVIDER_PROFILES, handle 409 if already exists)
2. If created, check for existing collectives (GET /requests/collectives)
3. If collectives exist: join one randomly (80%) or create a new one (20%)
4. If no collectives exist: create one from COLLECTIVE_PROFILES
5. Browse existing providers and submit a review on a random one (pick from PROVIDER_REVIEWS)

### Step 4: Register workflow

File: services/simulation-service/src/workflows/index.ts
  Add: export { providerWorkflow } from './provider-workflow';

File: services/simulation-service/src/simulator.ts
  Add import: providerWorkflow from './workflows'
  Add to workflows array with weight 0.08 (8% chance, low-weight background activity)

### Step 5: Seed data (optional, lower priority)

File: scripts/seed-test-data.sh
  Add provider profile creation for 3-5 seed users
  Add 1-2 collectives

---

## Key Patterns to Know

- All simulation API calls: base URL already includes /api, so paths are /requests/providers not /api/requests/providers
- executeWithRetry wrapper used on every API call (import from ../utils)
- Workflow signature: export const myWorkflow: Workflow = async (context) => { const { session, sessionManager } = context; ... }
- sessionManager.getClient(session) returns the ApiClient instance
- sessionManager.executeAction(session, 'actionName', () => client.method()) wraps calls with logging
- pickRandom(array) and delay({ min, max, unit }) available from ../utils

## Quick Start for Next Session

  1. cat services/simulation-service/.claude/README.md
  2. Edit api-client.ts (add 8 new methods)
  3. Edit realistic-data.ts (add PROVIDER_PROFILES, COLLECTIVE_PROFILES, PROVIDER_REVIEWS)
  4. Create provider-workflow.ts
  5. Edit workflows/index.ts (export)
  6. Edit simulator.ts (import + register weight 0.08)
  7. cd services/simulation-service && npm run build
  8. npm test
  9. git push origin master

---

## Open Design Questions

1. Provider completion_rate always 0 until match completion events wired (Phase 2)
2. Community trust visibility: public or admin-only? (ADR-040 open)
3. Collective trust score: avg of member scores now; own formula in Phase 2
4. Landing page framing: platform-overview.json absolutist anti-transactional language (dedicated session)
5. "remembers" -> "ephemeral acts, lasting impact" reframe across trust/karma docs (see .claude/IDEAS.md)

---

## Test Status
- 27/27 tests passing
- Deployed: karmyq.com (commit e41151f) green
