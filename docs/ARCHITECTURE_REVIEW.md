# Architecture Review Process

Regular architecture reviews keep the system honest — catching drift, validating decisions, and surfacing concerns before they compound.

**Cadence**: Every 4–6 sprints, or after any major feature cluster lands.
**Format**: Structured checklist + open discussion. Produces an ADR if a decision changes.

---

## How to Run a Review

Start a new Claude Code chat and say:

> `/arch-review`

This loads the review skill, which walks through each section below against the current codebase state.

---

## Review Checklist

### 1. Service Boundaries
- Are service responsibilities still clear and non-overlapping?
- Any service doing work that belongs in another?
- Any two services that have grown tightly coupled?
- Check: `npm run analyze:services` — any new circular deps?

### 2. Data Model Integrity
- Schema drifting from intent? (e.g. columns added ad-hoc without migration)
- Any tables that have grown beyond their original scope?
- Soft deletes, audit trails — consistent across services?
- Review: `infrastructure/postgres/init.sql` and recent migrations

### 3. Trust & Karma Model
- Does the current implementation match the documented philosophy?
- Are trust weights still community-level only? (ADR-035 will change this)
- Karma split defaults — still reflecting participation-ledger intent?
- Any new exchange types that aren't covered by the trust model?

### 4. Feed & Ranking
- Is feed scoring logic still in one place (request-service feed ranker) or leaking into frontend?
- Are curated feed parameters (`feed_weight_trust_distance`, multipliers) documented?
- Any ranking signals added without being reflected in ADRs?

### 5. API Surface
- Endpoints added without registry updates (`services/registry.json`)?
- Any endpoints that should be internal but are publicly routed via nginx?
- Auth middleware consistent across all new routes?

### 6. Event Bus
- New Bull queue events documented in registry?
- Any synchronous calls between services that should be events?
- Dead-letter handling in place for critical events?

### 7. Frontend Architecture
- Any state that should be server-side leaking into client?
- Components that have grown too large (>300 lines, multiple concerns)?
- API calls made directly in pages rather than through `lib/api.ts`?

### 8. Test Coverage Health
- Unit + regression test count trend — growing with features?
- Any TDD tests that have been sitting in `tdd/` for more than 2 sprints?
- Integration tests still covering the critical paths?

### 9. Security Posture
- New endpoints — rate limiting, auth, input validation in place?
- Any new env vars that should be secrets but aren't?
- CodeQL findings — any new HIGH/CRITICAL since last review?

### 10. Technical Debt Register
- What debt was incurred this sprint (shortcuts, TODOs, known issues)?
- Any CONTEXT.md "Known Issues" entries older than 2 sprints?
- Anything that needs an ADR but doesn't have one yet?

---

## Review Output

After each review, record findings in `docs/adr/` if a decision changed, or append to this file's **Review Log** below.

---

## Review Log

| Date | Sprint | Reviewer | Key Findings | ADRs Produced |
|------|--------|----------|--------------|---------------|
| 2026-02-24 | Post-v9.1.0 | — | First review scheduled | — |
