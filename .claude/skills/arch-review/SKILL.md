---
name: arch-review
description: Run a structured architecture review of the Karmyq platform
disable-model-invocation: true
argument-hint: "[focus-area]"
allowed-tools: [Read, Grep, Glob, Bash]
---

Run a structured architecture review of the Karmyq platform. If $ARGUMENTS is provided, focus on that area; otherwise run the full review.

## How to Run

1. Read `docs/ARCHITECTURE_REVIEW.md` for the full checklist
2. Read `services/registry.json` for current service inventory
3. Run `npm run analyze:services` to get fresh dependency data
4. Work through each section of the checklist below, checking the current codebase state against the documented intent
5. After completing all sections, produce a summary with:
   - **Green**: areas looking healthy
   - **Yellow**: areas with mild drift or tech debt accumulating
   - **Red**: areas needing an ADR or immediate attention
6. Ask the user: "Should I create an ADR for any of these findings?"
7. Update the Review Log table in `docs/ARCHITECTURE_REVIEW.md` with today's date and key findings

## Review Sections

### 1. Service Boundaries
- Run `npm run analyze:services` and check for circular dependencies
- Scan `services/registry.json` — any service whose `provides` list has grown beyond its stated purpose?
- Check if any service is being called synchronously by another when it should be event-driven

### 2. Data Model
- Check `infrastructure/postgres/migrations/` — any recent migrations that altered existing tables in unexpected ways?
- Scan service CONTEXT.md files for "Known Issues" entries related to schema
- Verify `infrastructure/postgres/init.sql` matches the latest migrations

### 3. Trust & Karma Model
- Read `docs/adr/ADR-019-referral-chain-trust.md` and `docs/adr/ADR-034-multi-layer-trust-computation.md`
- Check `services/reputation-service/src/` — does the implementation match the ADR intent?
- Are trust weights still community-level only (pre-ADR-035)?
- Is karma split logic consistent with the participation-ledger philosophy?

### 4. Feed & Ranking
- Check `services/feed-service/src/` — is scoring logic contained here or leaking into frontend/other services?
- Verify `apps/frontend/src/pages/dashboard.tsx` isn't reimplementing ranking logic

### 5. API Surface
- Grep for routes in all services, compare against `services/registry.json` "apis.provides"
- Check `infrastructure/nginx/nginx.conf` — any service endpoints missing nginx routing?
- Spot-check 3 recent routes for: auth middleware, rate limiting, input validation

### 6. Event Bus
- Grep for `queue.add(` across services — compare against `services/registry.json` "events"
- Any Bull events being published that aren't subscribed to anywhere?
- Check `services/notification-service/src/events/subscriber.ts` for unhandled event types

### 7. Frontend Architecture
- Scan `apps/frontend/src/pages/` for direct `fetch()` or `axios` calls (should go through `lib/api.ts`)
- Identify any component files over 400 lines
- Check `apps/frontend/src/lib/api.ts` — is the surface area growing coherently?

### 8. Test Coverage Health
- Run `npm test` and report pass/fail counts
- Check `apps/frontend/tests/tdd/` — any test files that are consistently skipped?
- Compare test count to feature count added since last review

### 9. Security Posture
- Check if any `.env` files are tracked in git: `git ls-files | grep '.env'`
- Scan recent routes for missing `authenticateToken` middleware
- Check for any hardcoded credentials or URLs (grep for `localhost:3000`, `password`, API keys)

### 10. Technical Debt Register
- Grep for `TODO`, `FIXME`, `HACK` across `services/` and `apps/frontend/src/`
- Scan all service CONTEXT.md "Known Issues" sections
- List any ADRs in "Proposed" status that have been sitting more than 2 sprints
