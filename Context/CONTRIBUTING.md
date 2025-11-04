# Contributing to Karmyq

Thank you for interest in contributing to Karmyq! We're building something important together, and your contributions matter.

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive community for all contributors. We pledge to:

- **Treat all people with respect** regardless of background, identity, or beliefs
- **Assume good intent** while addressing impact
- **Center the marginalized** in community decisions
- **Value diverse perspectives** and lived experiences
- **Foster psychological safety** for honest collaboration

### Unacceptable Behavior

We don't tolerate:
- Harassment of any kind
- Discrimination based on protected characteristics
- Abuse of community trust
- Deliberate misinformation
- Doxxing or privacy violations

### Enforcement

Violations will be addressed by community moderators. Serious violations may result in removal from the project.

---

## How to Contribute

### 1. Start Small

First time contributing? Great! Consider:

**Documentation**:
- Fix typos in README or docs
- Clarify confusing sections
- Add examples to API documentation
- Write blog posts about Karmyq

**Code**:
- Look for issues labeled `good-first-issue`
- Fix bugs in existing services
- Write tests for existing code
- Improve error messages

### 2. Pick a Task

#### Option A: Work on an Issue
1. Browse [GitHub Issues](https://github.com/karmyq/karmyq/issues)
2. Find something that interests you
3. Comment: "I'd like to work on this"
4. Wait for maintainer confirmation
5. Create a branch and start coding

#### Option B: Report a Bug
```markdown
**Bug**: [Brief description]
**Environment**: Docker-Compose / Node version / etc
**Steps to Reproduce**:
1. ...
2. ...

**Expected Behavior**: 
**Actual Behavior**:
**Logs/Error Messages**:
```

#### Option C: Suggest a Feature
```markdown
**Problem**: What's missing? What's broken?
**Proposed Solution**: How would this help?
**Alternatives Considered**: Other approaches?
**Example Use Case**: When would someone use this?
```

#### Option D: Improve a Service
1. Read the service README: `services/[service]/README.md`
2. Look for TODOs in the code
3. Check the service's GitHub issues
4. Submit improvements

### 3. Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_FORK/karmyq.git
cd karmyq

# Create feature branch
git checkout -b feature/[service]/[description]

# Example: feature/reputation/add-badge-logic
# Example: fix/messaging/fix-message-ordering

# Start infrastructure
docker-compose up

# In another terminal, develop your service
cd services/[service-name]
npm run dev
```

### 4. Make Your Changes

#### Code Style

**TypeScript**:
```typescript
// ✅ DO: Use descriptive names, clear intent
export async function calculateTrustScore(
  userId: string,
  communityId: string
): Promise<number> {
  // Clear implementation
}

// ❌ DON'T: Abbreviated, unclear
export async function calcTS(u: string, c: string): Promise<number> {
  // Unclear
}
```

**Error Handling**:
```typescript
// ✅ DO: Provide context
throw new Error(
  `Failed to create community: ${error.message}. Verify name length and permissions.`
);

// ❌ DON'T: Generic errors
throw new Error('Error');
```

**Comments**:
```typescript
// ✅ DO: Explain WHY, not WHAT
// We limit communities to 150 members based on Dunbar's number,
// which represents the cognitive limit for stable relationships
const MAX_MEMBERS = 150;

// ❌ DON'T: Obvious comments
// Set max members to 150
const MAX_MEMBERS = 150;
```

#### File Organization

```
services/[service]/src/
├── index.ts              # Entry point
├── routes/
│   ├── communities.ts    # /communities endpoints
│   ├── members.ts        # /members endpoints
│   └── index.ts          # Route aggregation
├── services/
│   ├── communityService.ts    # Business logic
│   ├── memberService.ts
│   └── index.ts               # Export all
├── handlers/
│   ├── eventHandlers.ts  # Event processing
│   └── index.ts
├── models/
│   ├── community.ts      # Database queries
│   ├── member.ts
│   └── index.ts
├── types.ts              # Local types (use shared/types first)
├── constants.ts          # Hardcoded values
└── __tests__/
    ├── community.test.ts
    ├── member.test.ts
    └── integration.test.ts
```

### 5. Testing

Write tests for your changes:

```typescript
// services/community-service/src/__tests__/community.test.ts
import { createCommunity } from '../services/communityService';

describe('Community Service', () => {
  it('should create a community with valid data', async () => {
    const result = await createCommunity(mockPool, {
      name: 'Test Community',
      creatorId: 'user-123',
      maxMembers: 150,
    });
    
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Community');
    expect(result.maxMembers).toBe(150);
  });
  
  it('should reject community with short name', async () => {
    expect(() =>
      createCommunity(mockPool, {
        name: 'ab', // Too short
        creatorId: 'user-123',
      })
    ).toThrow('Name must be at least 3 characters');
  });
});
```

**Run tests**:
```bash
npm test
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### 6. Commit and Push

**Commit messages** should be clear and descriptive:

```bash
# ✅ Good
git commit -m "feat(reputation): add badge earning system

- Award badges for milestones (5, 10, 25 requests)
- Add badge icons to user profiles
- Publish badge_earned event for notifications

Closes #123"

# ❌ Bad
git commit -m "fixed stuff"
git commit -m "wip"
```

**Commit format**: `type(scope): subject`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting, missing semicolons)
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Build, deps, tooling

Scopes:
- Service name: `auth`, `community`, `request`, etc.
- Cross-cutting: `docs`, `ci`, `deps`

**Push to your fork**:
```bash
git push origin feature/[service]/[description]
```

### 7. Submit Pull Request

Visit your fork on GitHub and click "Create Pull Request"

**PR Template**:
```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Breaking change

## Related Issues
Closes #123

## How to Test
Steps to verify the change:
1. ...
2. ...

## Screenshots (if UI change)
[Add screenshots or GIFs]

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Self-reviewed code

## Reviewer Notes
Any guidance for reviewers?
```

### 8. Code Review

Maintainers will:
- ✅ Review your code
- ✅ Request changes if needed
- ✅ Provide constructive feedback
- ✅ Merge when approved

**Be responsive** to feedback:
- Respond within 48 hours if possible
- Ask for clarification on feedback
- Update code based on suggestions
- Re-request review after changes

---

## Development Guidelines

### Architecture Principles

**Loosely Coupled**: Services shouldn't depend on each other's internals
```typescript
// ✅ DO: Call via REST API or event queue
const userReputation = await axios.get(
  `${REPUTATION_SERVICE}/users/${userId}`
);

// ❌ DON'T: Direct database access to other service
const result = await pool.query('SELECT * FROM reputation.trust_scores...');
```

**Event-Driven**: Publish events for important state changes
```typescript
// ✅ DO: Publish after database commit
await pool.query('COMMIT');
await eventQueue.add('request_completed', { requestId });

// ❌ DON'T: Publish, then commit (data might be lost)
await eventQueue.add('request_completed', { requestId });
await pool.query('COMMIT');
```

**Defensive but Not Suspicious**: Trust chain, but verify
```typescript
// ✅ DO: Verify ownership/permissions
const owner = await getResourceOwner(resourceId);
if (owner !== currentUser) {
  throw new ForbiddenError('Not authorized');
}

// ❌ DON'T: Assume from user ID
// ❌ DON'T: Complex permission rules that assume bad faith
```

### API Design

**RESTful Endpoints**:
```
GET    /communities              List communities
GET    /communities/:id          Get community
POST   /communities              Create community
PUT    /communities/:id          Update community
DELETE /communities/:id          Delete community
GET    /communities/:id/members  List members
POST   /communities/:id/members  Add member
```

**Request/Response Format**:
```typescript
// Request
{
  "name": "Oakland Community",
  "description": "Help network for Oakland",
  "maxMembers": 150
}

// Success Response (201 Created)
{
  "success": true,
  "data": {
    "id": "community-123",
    "name": "Oakland Community",
    // ...
  }
}

// Error Response (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Name must be at least 3 characters"
  }
}
```

### Database

**Naming Conventions**:
```sql
-- Tables: snake_case, plural
CREATE TABLE communities.help_requests (...)

-- Columns: snake_case
CREATE TABLE users (
  user_id UUID,
  created_at TIMESTAMP
)

-- Indexes: idx_[table]_[columns]
CREATE INDEX idx_help_requests_community_id ON requests.help_requests(community_id)
```

**Queries**:
```typescript
// ✅ DO: Use parameterized queries
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1 AND community_id = $2',
  [userId, communityId]
);

// ❌ DON'T: String concatenation (SQL injection!)
const result = await pool.query(
  `SELECT * FROM users WHERE id = '${userId}'`
);
```

---

## Common Contributions

### Adding a New API Endpoint

**1. Update API contract** (`shared/types/index.ts`):
```typescript
export interface NewRequest {
  name: string;
  description: string;
}
```

**2. Create route handler** (`services/[service]/src/routes/`):
```typescript
app.post('/new-resource', async (req, res) => {
  const { name, description } = req.body;
  // Implement
});
```

**3. Add to service** (`SERVICE-GUIDE.md`):
- Document endpoint
- Show example usage
- Note any events published

**4. Test it**:
```bash
npm test
curl -X POST http://localhost:3000/api/...
```

### Publishing a New Event

**1. Add to types** (`shared/types/index.ts`):
```typescript
export interface NewThingCreatedEvent extends BaseEvent {
  type: 'new_thing_created';
  thingId: string;
  // ... other fields
}

export type DomainEvent = ... | NewThingCreatedEvent;
```

**2. Publish in service**:
```typescript
await eventQueue.add('new_thing_created', {
  thingId: result.id,
  // ... other data
});
```

**3. Document in `ARCHITECTURE.md`**:
- Add to event flow diagram
- Document what services listen
- Show what reactions happen

### Adding to Governance Service

Governance service has stubs for:
- **Community Voting**: Add `governance/proposals` with voting logic
- **Conflict Resolution**: Add `governance/conflicts` with mediation workflow
- **Norms Enforcement**: Connect proposals to norm management

Example PR: Add proposal voting implementation
```typescript
// Add vote counting
app.post('/proposals/:id/votes', async (req, res) => {
  // Count votes, update proposal status
  // Publish vote_submitted event
});
```

---

## Getting Help

### Questions?

- 📖 Read documentation in `/docs`
- 💬 Ask in GitHub Discussions
- 🆘 @ mention maintainers in issues
- 📧 Email hello@karmyq.com

### Stuck on Code?

- Look at similar endpoints for patterns
- Check tests for usage examples
- Ask in Discord/Discussions with:
  - What you're trying to do
  - Code you've written
  - Error messages
  - What you've tried

### Maintainer Availability

- **Response time**: 24-48 hours for issues/PRs
- **Review time**: 3-7 days for PRs
- **During**: Regular business hours, timezone varies

---

## Becoming a Maintainer

Once you've made several contributions:

1. **Track record**: 5+ merged PRs, consistent quality
2. **Engagement**: Active in discussions, helpful to new contributors
3. **Ownership**: Demonstrated care for a service
4. **Nomination**: Existing maintainers nominate you
5. **Consensus**: Community agrees (via proposal)

Maintainers get:
- ✅ Merge permissions
- ✅ Label/project management
- ✅ Release authority
- ✅ Respect of community

---

## Release Process

### Version Numbering

Karmyq uses Semantic Versioning: `MAJOR.MINOR.PATCH`

- `PATCH`: Bug fixes (1.0.1)
- `MINOR`: New features, backward compatible (1.1.0)
- `MAJOR`: Breaking changes (2.0.0)

### Release Checklist

1. Update `CHANGELOG.md`
2. Update version in `package.json`
3. Tag commit: `git tag v1.0.0`
4. Push tags: `git push origin --tags`
5. Create GitHub Release with notes
6. Deploy to production

---

## License

By contributing to Karmyq, you agree that your contributions will be licensed under the AGPL-3.0 license. This ensures the project remains open source.

---

## Thank You

Every contribution—whether code, documentation, design, or community—helps rebuild trust in our world.

**Let's build something beautiful together.** 🌱

---

Questions? Join us in [GitHub Discussions](https://github.com/karmyq/karmyq/discussions)!
