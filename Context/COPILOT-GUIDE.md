# GitHub Copilot Quick Start for Karmyq

This guide shows you how to use GitHub Copilot effectively with the Karmyq codebase.

## Why Copilot Works Well with Karmyq

✅ **Clear Architecture**: Microservices with defined boundaries  
✅ **Shared Types**: API contracts in `shared/types/index.ts`  
✅ **Consistent Patterns**: Every service follows same structure  
✅ **Event-Driven**: Predictable event publishing patterns  
✅ **Well-Documented**: Each service has detailed README  

Copilot uses these to understand context and generate relevant code.

## Setup

### 1. Enable Copilot in VS Code

```bash
# Install GitHub Copilot extension
# Sign in with GitHub account
# Accept terms
```

### 2. Open the Karmyq Project

```bash
# Clone and open
git clone https://github.com/karmyq/karmyq.git
code karmyq
```

### 3. Open Context Files

Keep these open in tabs:

```
shared/types/index.ts      # Shared types & events
ARCHITECTURE.md            # System design
SERVICE-GUIDE.md           # Development patterns
services/[service]/README.md  # Service-specific docs
```

Copilot references open files for context!

## Best Copilot Prompts for Karmyq

### Pattern 1: Generate an API Endpoint

**With Context Files Open**:
```typescript
// In services/request-service/src/routes/requests.ts

// Generate endpoint to create a help request
app.post('/') →
```

**Copilot will generate** (based on shared types):
```typescript
app.post('/', async (req, res) => {
  const { communityId, title, description, category, urgency } = req.body;
  const userId = req.headers['x-user-id'];
  
  try {
    const result = await pool.query(
      'INSERT INTO requests.help_requests ...',
      [communityId, userId, title, description, category, urgency]
    );
    
    await eventQueue.add('request_created', {
      requestId: result.rows[0].id,
      requesterId: userId,
      communityId,
      category
    });
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: error.message } });
  }
});
```

### Pattern 2: Generate Event Handler

**Type this**:
```typescript
// Listen for request_completed event from request-service
eventQueue.process('request_completed', async (job) => {
```

**Copilot will suggest**:
```typescript
  const { requestId, responderId, requesterId } = job.data;
  
  try {
    // Award karma to requester
    const karmaPoints = 10;
    await pool.query(
      'INSERT INTO reputation.karma_records (user_id, community_id, points, reason) VALUES ($1, $2, $3, $4)',
      [requesterId, communityId, karmaPoints, 'request_completed']
    );
    
    // Update trust score
    await updateTrustScore(pool, requesterId, communityId);
    
    // Publish event
    await eventQueue.add('karma_awarded', {
      userId: requesterId,
      points: karmaPoints,
      reason: 'request_completed'
    });
    
    return { requestId, karmaAwarded: true };
  } catch (error) {
    console.error('Failed to process request_completed:', error);
    throw error; // Bull will retry
  }
});
```

### Pattern 3: Generate Database Query

```typescript
// Get all active requests for a community
const getActiveRequests = async (
  pool: Pool,
  communityId: string
): Promise<HelpRequest[]> =>
```

**Copilot will generate**:
```typescript
{
  const result = await pool.query(
    `SELECT * FROM requests.help_requests 
     WHERE community_id = $1 AND status IN ('open', 'matched') 
     ORDER BY created_at DESC`,
    [communityId]
  );
  return result.rows;
};
```

### Pattern 4: Generate Tests

```typescript
// In src/__tests__/request.test.ts

describe('Request Service', () => {
  it('should create a help request',
```

**Copilot will generate**:
```typescript
async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 'req-123', title: 'Help moving', status: 'open' }]
      })
    };
    
    const result = await createRequest(mockPool as any, {
      communityId: 'comm-456',
      title: 'Help moving',
      description: 'Need help moving furniture',
      category: 'household',
      requesterId: 'user-789'
    });
    
    expect(result.id).toBe('req-123');
    expect(mockPool.query).toHaveBeenCalled();
  });
});
```

## Advanced Copilot Techniques

### Technique 1: Multi-File Context

Keep multiple tabs open:
- `shared/types/index.ts` (contracts)
- Current service README (details)
- Existing service code (patterns)
- Architecture doc (system understanding)

Copilot uses ALL open files for context!

### Technique 2: Reference External Code

In comments, reference the pattern you want:

```typescript
// Similar to how request-service publishes request_created,
// publish community_norm_proposed event when norm is proposed
app.post('/norms', async (req, res) => {
```

Copilot will follow the same pattern from another file.

### Technique 3: Type-Safe Suggestions

Make sure shared types are open. Copilot will:
- Suggest correct type names
- Generate properly typed functions
- Ensure event shapes match

```typescript
// With HelpRequest type visible
const requests: HelpRequest[] = ...
// Copilot knows exact fields and types
```

### Technique 4: Testing Complex Flows

```typescript
// Test the flow: request_created → reputation_awarded → notification_sent
it('should complete full request workflow', async () => {
```

Copilot will generate test that mocks all three event emissions.

## Prompts to Avoid

❌ **Too vague**:
```
"Generate API code"
```

✅ **Specific**:
```
"Generate POST /requests endpoint that creates a HelpRequest, 
publishes request_created event, returns ApiResponse<HelpRequest>"
```

❌ **Without context**:
```
"How do I validate user input?"
```

✅ **With context**:
```
// With SERVICE-GUIDE.md open
// Following the validation pattern in community-service,
// validate that community_id exists before...
```

## Example: Building a New API Endpoint with Copilot

### Step 1: Open Context Files

Tabs open:
- `shared/types/index.ts`
- `services/request-service/README.md`
- `services/request-service/src/routes/requests.ts` (existing code)
- `SERVICE-GUIDE.md`

### Step 2: Read the Spec in README

From `README.md`, you see there should be:
```
PUT /requests/:requestId/complete
Mark a request as completed with feedback
```

### Step 3: Ask Copilot (via commenting)

```typescript
// In services/request-service/src/routes/requests.ts

// PUT /requests/:requestId/complete
// Mark request completed, triggers reputation updates
app.put('/requests/:requestId/complete', async (req, res) => {
```

### Step 4: Copilot Generates

Copilot suggests:
```typescript
  const { requestId } = req.params;
  const { responderId, feedbackSummary } = req.body;
  const userId = req.headers['x-user-id'];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get request to verify it exists
    const requestResult = await client.query(
      'SELECT * FROM requests.help_requests WHERE id = $1',
      [requestId]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Request not found' }
      });
    }
    
    const request = requestResult.rows[0];
    
    // Update request status
    await client.query(
      'UPDATE requests.help_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['completed', requestId]
    );
    
    // Get the match to find the actual responder
    const matchResult = await client.query(
      'SELECT * FROM requests.matches WHERE request_id = $1 AND status = $2',
      [requestId, 'accepted']
    );
    
    if (matchResult.rows.length === 0) {
      throw new Error('No accepted match found');
    }
    
    const match = matchResult.rows[0];
    
    await client.query('COMMIT');
    
    // Publish event
    await eventQueue.add('request_completed', {
      requestId,
      requesterId: request.requester_id,
      responderId: match.responder_id,
      communityId: request.community_id,
      feedback: feedbackSummary
    });
    
    res.json({
      success: true,
      data: { requestId, status: 'completed' }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: { code: 'COMPLETION_ERROR', message: error.message }
    });
  } finally {
    client.release();
  }
});
```

### Step 5: Review & Refine

- ✅ Check event shape matches `shared/types`
- ✅ Verify database queries use service schema
- ✅ Ensure error handling follows patterns
- ✅ Add any missing validation
- ✅ Run tests

### Step 6: Generate Tests

```typescript
// In src/__tests__/requests.test.ts

describe('Complete Request', () => {
  it('should mark request as completed and publish event', async () => {
```

Copilot generates test covering happy path and error cases.

## Pro Tips

### Tip 1: Use Copilot for Boilerplate

```typescript
// New service file
import express from 'express';
import { Pool } from 'pg';
import Queue from 'bull';
```

Copilot will complete typical setup (imports, middleware, etc.)

### Tip 2: Generate Comments for Complex Logic

Let Copilot explain:
```typescript
// Explain this function in detail
```

Select code → Copilot → Explain generates documentation.

### Tip 3: Ask for Patterns, Not Complete Solutions

```
"Show me the pattern for consuming an event and publishing a follow-up event"
```

Better than:
```
"Write the whole notification service"
```

### Tip 4: Use Copilot for Refactoring

Select messy code → Copilot → Fix can suggest improvements.

### Tip 5: Reference Doc Examples

In SERVICE-GUIDE.md, there are examples:

```typescript
// Following the pattern from SERVICE-GUIDE.md section "Pattern: Publish After Database Write"
// implement the pattern here:
```

Copilot will adapt the pattern to your specific code.

## When Copilot Gets it Wrong

**Copilot sometimes**:
- ❌ Uses wrong table names (check schema)
- ❌ Doesn't match event shape (verify in `shared/types`)
- ❌ Forgets error handling (add manually)
- ❌ Generates generic code (provide specific context)

**Fix by**:
- ✅ Always verify against `shared/types`
- ✅ Review `SERVICE-GUIDE.md` patterns
- ✅ Check existing service code
- ✅ Write more specific prompts/comments

## GitHub Copilot Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Accept suggestion | Tab |
| Reject suggestion | Esc |
| Show next suggestion | Alt+] |
| Show previous suggestion | Alt+[ |
| Trigger inline suggestion | Ctrl+Alt+\ |
| Open Copilot side chat | Ctrl+Shift+Alt+V |

## Resources

- 📖 [VS Code Copilot Docs](https://docs.github.com/en/copilot/using-github-copilot/getting-started-with-github-copilot)
- 🏗️ [Architecture Guide](./ARCHITECTURE.md)
- 🛠️ [Service Guide](./SERVICE-GUIDE.md)
- 📝 [Contributing Guide](./CONTRIBUTING.md)

## Example Workflow: Building Request Matching

**Goal**: Add endpoint to match requests with responders

### Open Files (for context)

1. `shared/types/index.ts` - See HelpRequest, RequestMatch types
2. `services/request-service/src/routes/requests.ts` - Existing endpoints
3. `services/request-service/src/services/requestService.ts` - Business logic
4. `SERVICE-GUIDE.md` - Event publishing pattern

### Step 1: Design the Endpoint

```typescript
// POST /requests/:requestId/match
// Request body: { responderId, offerId? }
// Creates a match between request and responder
// Publishes request_matched event
app.post('/:requestId/match', async (req, res) => {
```

Copilot generates matching logic.

### Step 2: Publish Event

```typescript
// After successful match, publish event
await eventQueue.add('request_matched', {
```

Copilot generates event with correct shape.

### Step 3: Add Error Handling

Copilot suggests edge cases (request not found, already matched, etc.).

### Step 4: Generate Test

```typescript
it('should match request with responder',
```

Copilot generates comprehensive test.

### Result

You've built a complete, tested feature with Copilot assistance, following Karmyq patterns!

---

## Final Tips

✅ **Keep reference files open** - Open tabs = context  
✅ **Be specific in comments** - "POST endpoint that..." vs "Generate code"  
✅ **Verify output** - Always check against types and patterns  
✅ **Use existing code as template** - Reference before asking  
✅ **Start with structure** - Generate scaffolding, then add logic  

Happy coding with Copilot! 🚀

Questions? Join us in [GitHub Discussions](https://github.com/karmyq/karmyq/discussions)
