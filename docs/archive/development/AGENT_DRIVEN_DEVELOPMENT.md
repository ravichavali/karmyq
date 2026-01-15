# Agent-Driven Development Guide

**Purpose:** Best practices for developing Karmyq with AI agents (Claude Code, Claude Agent SDK)

---

## 1. Documentation-First Development

### The Golden Rule
**Every component must have complete, self-contained documentation BEFORE implementation.**

### Why?
- Enables Claude to work autonomously without constant context switching
- Allows parallel development across multiple agents
- Ensures consistent patterns across the codebase
- Facilitates onboarding new developers (human or AI)

---

## 2. Documentation Hierarchy

### Level 1: Project-Level (CLAUDE.md)
**Audience:** Any agent working on any part of Karmyq
**Contents:**
- Architecture overview
- Service inventory with ports
- Key patterns (auth, RLS, events)
- Development commands
- Testing requirements

**Update Frequency:** Major releases (v7.0, v8.0, etc.)

### Level 2: Feature-Level (docs/gemini-architecture-review/)
**Audience:** Agents implementing major features
**Contents:**
- roadmap.md - Vision and phases
- foundation_snippets.md - SQL/Zod code to start
- gateway_design.md - API Gateway architecture
- events_architecture.md - Event Bus design

**Update Frequency:** Per major feature/epic

### Level 3: Service-Level (services/*/CONTEXT.md)
**Audience:** Agents modifying specific services
**Contents:** (See SERVICE_CONTEXT_TEMPLATE.md)
- Quick start
- API reference
- Event contracts
- Key patterns
- Testing guide

**Update Frequency:** Every service modification

### Level 4: Module-Level (inline comments)
**Audience:** Agents debugging or extending complex logic
**Contents:**
- Algorithm explanations
- Business rule rationale
- Edge case handling

**Update Frequency:** Every code change

---

## 3. Agent-Friendly Patterns

### ✅ DO: Use Structured Code Blocks
```typescript
// GOOD: Clear context, language specified
export const createRequest = async (data: CreateRequestInput) => {
  // Validate using Zod
  const validated = CreateRequestSchema.parse(data);

  // Insert with RLS
  const result = await db.query(
    'INSERT INTO requests.help_requests ...',
    [validated.title, req.community.id]
  );

  // Emit event
  await publisher.publish('request.created', { id: result.id });

  return result;
};
```

### ❌ DON'T: Write Ambiguous Code
```typescript
// BAD: No context, unclear intent
const cr = async (d) => {
  const v = s.parse(d);
  const r = await db.q('INSERT...', [v.t, c]);
  p.pub('rc', { i: r.i });
  return r;
};
```

### ✅ DO: Document Event Contracts
```typescript
// packages/shared/src/events/types.ts
export interface EventMap {
  'request.created': {
    request_id: string;
    request_type: 'generic' | 'ride' | 'borrow';
    user_id: string;
    community_id: string;
  };
}
```

### ✅ DO: Use Discriminated Unions
```typescript
// Enables type-safe polymorphism
export type HelpRequest =
  | { type: 'generic'; payload: GenericPayload }
  | { type: 'ride'; payload: RidePayload }
  | { type: 'borrow'; payload: BorrowPayload };
```

---

## 4. Testing Strategy for Agents

### Test-Driven Documentation (TDD)
1. **Write the test scenario** in CONTEXT.md
2. **Implement the test** using the scenario
3. **Let Claude implement** the feature to pass the test

### Example:
```markdown
## 7. Testing

### 7.4 Key Test Scenarios
- [ ] Create generic request successfully
- [ ] Create ride request with valid coordinates
- [ ] Reject ride request with invalid coordinates
- [ ] Emit 'request.created' event after creation
```

Then:
```typescript
// tests/integration/request-service.test.ts
describe('Request Service - Ride Requests', () => {
  it('should create ride request with valid coordinates', async () => {
    const response = await request(app)
      .post('/requests')
      .send({
        type: 'ride',
        payload: {
          origin: { lat: 37.77, lng: -122.41, address: 'SF' },
          destination: { lat: 37.42, lng: -122.08, address: 'MV' }
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.data.request_type).toBe('ride');
  });
});
```

---

## 5. Parallel Agent Development

### Use Case: Multiple agents working on different verticals

**Scenario:** Agent A implements "Rides", Agent B implements "Borrow"

**How to enable:**
1. **Shared Foundation First**
   - SQL migration (polymorphic columns)
   - Zod schemas (discriminated unions)
   - Event infrastructure

2. **Isolated Service Extensions**
   - Agent A: `services/request-service/src/handlers/ride.ts`
   - Agent B: `services/request-service/src/handlers/borrow.ts`

3. **Shared Contracts**
   - Both use `CreateRequestSchema` from `@karmyq/shared`
   - Both emit `request.created` with same structure

4. **Integration**
   - Router dispatches by `request_type`:
     ```typescript
     if (validated.type === 'ride') return handleRide(validated);
     if (validated.type === 'borrow') return handleBorrow(validated);
     ```

---

## 6. Context Management Best Practices

### Minimize Context Switching
**Problem:** Loading entire codebase context is expensive

**Solution:** Modular documentation
```
Agent working on Auth Service → Only needs:
  - CLAUDE.md (project overview)
  - services/auth/CONTEXT.md (service details)
  - packages/shared/middleware/auth.ts (if modifying middleware)
```

### Self-Contained Services
**Pattern:** Each service CONTEXT.md includes:
- Dependencies (what it calls)
- Consumers (what calls it)
- Event contracts (publish/subscribe)

**Benefit:** Agent can work on one service without reading all others

### Version Tags in Documentation
```markdown
# Auth Service CONTEXT

> **Last Updated:** 2025-12-24
> **Version:** v8.0.0
> **Status:** Production
```

**Benefit:** Agents know if documentation is stale

---

## 7. Incremental Complexity Management

### Phase-Based Development
**Instead of:** "Implement full Everything App in one go"

**Do:**
- Phase 1: Foundation (SQL + Zod)
- Phase 2: Generic + Ride verticals
- Phase 3: API Gateway
- Phase 4: Borrow + Services verticals

### Feature Flags
```typescript
// Enable new features gradually
const ENABLE_RIDE_REQUESTS = process.env.ENABLE_RIDE === 'true';

if (request.type === 'ride' && !ENABLE_RIDE_REQUESTS) {
  throw new Error('Ride requests not yet enabled');
}
```

### Backward Compatibility
```typescript
// Old clients send: { title, description }
// New clients send: { type: 'generic', title, description, payload: {} }

// Support both:
const requestType = body.type || 'generic';
const payload = body.payload || {};
```

---

## 8. Agent Collaboration Patterns

### Pattern 1: Sequential Handoff
```
Agent A (Architect) → Creates roadmap.md, gateway_design.md
Agent B (Implementer) → Reads designs, implements Phase 1
Agent C (Tester) → Reads CONTEXT.md, writes comprehensive tests
```

### Pattern 2: Parallel Specialization
```
Agent A → Works on Request Service (rides)
Agent B → Works on Matching Service (proximity matching)
Agent C → Works on Frontend (dynamic forms)

Shared: packages/shared/schemas (Zod types)
```

### Pattern 3: Review & Refine
```
Agent A → Implements feature, updates CONTEXT.md
Agent B (Reviewer) → Reads CONTEXT.md, verifies implementation matches
Agent A → Refines based on feedback
```

---

## 9. Documentation Maintenance

### After Every PR
- [ ] Update relevant CONTEXT.md files
- [ ] Update CLAUDE.md if architecture changed
- [ ] Update API examples if endpoints changed
- [ ] Update test scenarios

### Monthly
- [ ] Review all CONTEXT.md for accuracy
- [ ] Archive outdated documentation
- [ ] Update "Last Updated" timestamps

### Per Major Release
- [ ] Tag documentation with release version
- [ ] Create migration guide (v7 → v8)
- [ ] Update PROJECT_STATUS.md

---

## 10. Tools for Agent Development

### Recommended Extensions (VSCode)
- **Markdown Preview Enhanced** - Preview docs with diagrams
- **Code Spell Checker** - Catch typos in docs
- **Better Comments** - Highlight TODO, FIXME

### Validation Tools
```bash
# Validate Zod schemas
npm run validate:schemas

# Check CONTEXT.md completeness
npm run docs:validate

# Ensure all services have CONTEXT.md
find services -name CONTEXT.md | wc -l  # Should equal number of services
```

---

## 11. Anti-Patterns to Avoid

### ❌ Undocumented Magic
```typescript
// BAD: No explanation of complex logic
const score = (k * 0.7) + (t * 0.3) - (d * 0.1);
```

```typescript
// GOOD: Algorithm explained
// Trust Score Formula:
// - 70% weight on karma (k)
// - 30% weight on tenure (t)
// - 10% penalty for decay (d)
const score = (karma * 0.7) + (tenure * 0.3) - (decay * 0.1);
```

### ❌ Tribal Knowledge
"You need to restart Redis after changing event schemas" → Should be in CONTEXT.md

### ❌ Stale Documentation
```markdown
> Last Updated: 2023-01-01  ← RED FLAG
```

---

## 12. Success Metrics

### Documentation Quality
- **Coverage:** Every service has CONTEXT.md
- **Accuracy:** Last updated within 30 days of latest commit
- **Completeness:** All sections from template filled

### Agent Efficiency
- **First-time success rate:** Agent completes task without errors
- **Context switches:** Agent loads <3 files to complete task
- **Test pass rate:** >95% on first implementation

### Developer Experience
- **Onboarding time:** New developer (human or AI) productive in <1 hour
- **Bug fix time:** Can locate and fix bug in <30 minutes
- **Feature velocity:** Can implement new vertical in <1 week

---

## Example: "Everything App" Development Flow

### Step 1: Architect Agent Creates Design Docs
```
docs/gemini-architecture-review/
├── roadmap.md
├── foundation_snippets.md
├── gateway_design.md
└── events_architecture.md
```

### Step 2: Foundation Agent Applies Migration
Reads: `foundation_snippets.md`
Creates: `infrastructure/postgres/migrations/009_polymorphic_requests.sql`
Updates: `services/request-service/CONTEXT.md` (database schema section)

### Step 3: Schema Agent Creates Zod Types
Reads: `foundation_snippets.md`
Creates: `packages/shared/src/schemas/requests/`
Updates: `packages/shared/CONTEXT.md` (if it exists)

### Step 4: Service Agent Updates Request Service
Reads: `services/request-service/CONTEXT.md`, `foundation_snippets.md`
Modifies: Request endpoints to support polymorphic requests
Updates: `services/request-service/CONTEXT.md` (API section)

### Step 5: Test Agent Validates
Reads: `services/request-service/CONTEXT.md` (Test Scenarios section)
Creates: Integration tests
Reports: Results

### Step 6: Release Agent Tags Version
Reads: All CONTEXT.md files
Creates: Release notes
Tags: `v9.0.0-everything-app-foundation`

---

## Conclusion

**Agent-driven development is DOCUMENTATION-driven development.**

The better your documentation, the more autonomous AI agents can be, and the faster you can scale complexity without losing coherence.

**Golden Rule:** If an AI agent needs to ask a human for clarification, the documentation is incomplete.
