# Karmyq Service Development Guide

This guide explains how to develop services within Karmyq's microservices architecture.

## Quick Start

### 1. Understand Your Service

Every service in Karmyq should have:

```
services/[service-name]/
├── README.md           # What this service does
├── API.md             # API endpoints reference
├── Dockerfile         # Container setup
├── package.json       # Dependencies
├── .env.example       # Environment template
└── src/
    ├── index.ts       # Entry point
    ├── routes/        # API endpoints
    ├── services/      # Business logic
    ├── handlers/      # Event handlers
    └── models/        # Database queries
```

### 2. Environment Setup

**Clone repository**:
```bash
git clone https://github.com/karmyq/karmyq.git
cd karmyq
```

**Copy environment file**:
```bash
cp .env.example .env
```

**Start infrastructure**:
```bash
docker-compose up
```

**Verify services are running**:
```bash
curl http://localhost:3000/health  # API Gateway
http://localhost:8081              # Redis Commander
```

---

## Service Template

Here's a typical service structure (Node.js/Express):

### `services/[service-name]/src/index.ts`

```typescript
import express, { Express } from 'express';
import Queue from 'bull';
import { Pool } from 'pg';
import redis from 'redis';

// Types from shared folder
import { DomainEvent, ApiResponse } from '../../../shared/types';

const app: Express = express();
const PORT = process.env.PORT || 4001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Redis connection for event queue
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

const eventQueue = new Queue('events', {
  redis: redisClient,
});

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '[service-name]' });
});

// Example: Get data endpoint
app.get('/resource/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM [schema].[table] WHERE id = $1',
      [req.params.id]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
    } as ApiResponse<any>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    });
  }
});

// Example: Create resource and publish event
app.post('/resource', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Insert into database
    const result = await pool.query(
      'INSERT INTO [schema].[table] (name, description) VALUES ($1, $2) RETURNING id',
      [name, description]
    );
    
    const resourceId = result.rows[0].id;
    
    // Publish event to queue
    await eventQueue.add('resource_created', {
      resourceId,
      name,
      description,
    });
    
    res.status(201).json({
      success: true,
      data: { id: resourceId, name, description },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: error.message },
    });
  }
});

// Event handlers - listen for events from other services
eventQueue.process('other_service_event', async (job) => {
  console.log('Received event:', job.data);
  
  // React to event - maybe update local data, publish new event, etc.
  const { someData } = job.data;
  
  // Do something...
  
  return { processed: true };
});

// Error handler for event processing
eventQueue.on('failed', (job, error) => {
  console.error('Job failed:', job.id, error.message);
  // Events retry automatically with Bull
});

// Start server
app.listen(PORT, () => {
  console.log(`[Service Name] running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});
```

---

## Publishing Events

When your service does something important, publish an event so other services can react.

### Pattern: Publish After Database Write

```typescript
// ✅ GOOD - Publish after successful write
app.post('/create-something', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Write to database
    const result = await client.query(
      'INSERT INTO resources (name) VALUES ($1) RETURNING id',
      [req.body.name]
    );
    
    const resourceId = result.rows[0].id;
    
    await client.query('COMMIT');
    
    // AFTER successful commit, publish event
    await eventQueue.add('resource_created', {
      resourceId,
      name: req.body.name,
      timestamp: new Date(),
    });
    
    res.json({ success: true, id: resourceId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});
```

### Pattern: Publish Multiple Events

```typescript
app.post('/complete-request', async (req, res) => {
  const { requestId, responderId } = req.body;
  
  try {
    // Update database
    await pool.query(
      'UPDATE requests SET status = $1 WHERE id = $2',
      ['completed', requestId]
    );
    
    // Publish event series
    await eventQueue.add('request_completed', {
      requestId,
      responderId,
      completedAt: new Date(),
    });
    
    // Other services will handle:
    // - Reputation service: Award karma
    // - Notification service: Send thank you email
    // - Governance service: Update community metrics
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Consuming Events

Listen for events from other services and react.

### Pattern: Simple Event Consumption

```typescript
// Listen for user creation events from auth-service
eventQueue.process('user_created', async (job) => {
  const { userId, email } = job.data;
  console.log(`Processing: New user ${email}`);
  
  // Example: Create initial reputation record for this user
  await pool.query(
    `INSERT INTO reputation.trust_scores 
     (user_id, score) VALUES ($1, $2)`,
    [userId, 50] // Start at 50/100
  );
  
  // If this service publishes follow-up events
  await eventQueue.add('reputation_initialized', {
    userId,
    initialScore: 50,
  });
  
  return { userId, status: 'processed' };
});
```

### Pattern: Event-Triggered Action

```typescript
// Listen for request_matched event
eventQueue.process('request_matched', async (job) => {
  const { matchId, requestId, requesterId, responderId } = job.data;
  
  console.log(`Processing: Request matched ${matchId}`);
  
  // Create conversation for the matched parties
  const conversationResult = await pool.query(
    `INSERT INTO messaging.conversations 
     (request_match_id) VALUES ($1) RETURNING id`,
    [matchId]
  );
  
  const conversationId = conversationResult.rows[0].id;
  
  // Add both users to conversation
  await pool.query(
    `INSERT INTO messaging.conversation_participants 
     (conversation_id, participant_id) VALUES ($1, $2), ($1, $3)`,
    [conversationId, requesterId, responderId]
  );
  
  // Publish event that conversation was created
  await eventQueue.add('conversation_created', {
    conversationId,
    matchId,
    participants: [requesterId, responderId],
  });
  
  return { conversationId, status: 'created' };
});
```

### Pattern: Error Handling

```typescript
eventQueue.process('complex_event', async (job) => {
  const maxRetries = 3;
  
  try {
    // Attempt to process
    const result = await processEvent(job.data);
    return { success: true, ...result };
  } catch (error) {
    console.error(`Event processing failed: ${error.message}`);
    
    if (job.attemptsMade < maxRetries) {
      // Re-queue with exponential backoff
      throw error; // Bull will retry automatically
    } else {
      // Log to dead letter queue
      await pool.query(
        `INSERT INTO events.dead_letter (event_data, error) 
         VALUES ($1, $2)`,
        [JSON.stringify(job.data), error.message]
      );
      return { failed: true, deadLettered: true };
    }
  }
});
```

---

## API Endpoint Patterns

### GET - Retrieve Resource

```typescript
// GET /communities/:id
app.get('/communities/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM communities.communities WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    });
  }
});
```

### POST - Create Resource

```typescript
// POST /communities
app.post('/communities', async (req, res) => {
  const { name, description, maxMembers } = req.body;
  const userId = req.headers['x-user-id']; // From auth middleware
  
  // Validation
  if (!name || name.length < 3) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name must be at least 3 chars' },
    });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO communities.communities 
       (name, description, max_members, creator_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, maxMembers || 150, userId]
    );
    
    const community = result.rows[0];
    
    // Publish event
    await eventQueue.add('community_created', {
      communityId: community.id,
      name: community.name,
      creatorId: userId,
    });
    
    res.status(201).json({
      success: true,
      data: community,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: error.message },
    });
  }
});
```

### PUT - Update Resource

```typescript
// PUT /communities/:id
app.put('/communities/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = req.headers['x-user-id'];
  
  try {
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT creator_id FROM communities.communities WHERE id = $1',
      [id]
    );
    
    if (ownerCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
    }
    
    // Update
    const result = await pool.query(
      `UPDATE communities.communities 
       SET name = $1, description = $2, updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [name, description, id]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: error.message },
    });
  }
});
```

### DELETE - Remove Resource

```typescript
// DELETE /communities/:id
app.delete('/communities/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'];
  
  try {
    // Verify ownership and delete
    const result = await pool.query(
      `DELETE FROM communities.communities 
       WHERE id = $1 AND creator_id = $2 
       RETURNING id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete' },
      });
    }
    
    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: error.message },
    });
  }
});
```

---

## Testing Your Service

### Unit Tests

```typescript
// src/services/__tests__/community.test.ts
import { Pool } from 'pg';
import { createCommunity } from '../communityService';

describe('Community Service', () => {
  let pool: Pool;
  
  beforeAll(() => {
    pool = new Pool({ /* test DB */ });
  });
  
  afterAll(() => pool.end());
  
  it('should create a community', async () => {
    const result = await createCommunity(pool, {
      name: 'Test Community',
      creatorId: 'user-123',
    });
    
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Community');
  });
});
```

### Integration Tests

```bash
# Start services
docker-compose up

# Run integration tests
npm run test:integration

# Test actual endpoints
curl -X POST http://localhost:3000/api/communities \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"name":"Test Comm","description":"Test"}'
```

### Manual Testing with redis-commander

```bash
# Check event queue status
http://localhost:8081

# Look for queued jobs
# Inspect failed jobs
# Replay failed events
```

---

## Common Patterns

### Database Transaction

```typescript
const client = await pool.connect();

try {
  await client.query('BEGIN');
  
  // Multiple operations
  const result1 = await client.query('INSERT INTO table1...');
  const result2 = await client.query('UPDATE table2...');
  
  await client.query('COMMIT');
  
  // Publish events AFTER commit
  await eventQueue.add('operation_completed', { data });
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Call Another Service's API

```typescript
import axios from 'axios';

const reputationServiceUrl = process.env.REPUTATION_SERVICE_URL || 
  'http://reputation-service:4004';

// Get user's karma score
const karmaResponse = await axios.get(
  `${reputationServiceUrl}/users/${userId}/karma/${communityId}`
);

const karma = karmaResponse.data.data;
```

### Query with Pagination

```typescript
app.get('/communities', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  
  const countResult = await pool.query(
    'SELECT COUNT(*) as count FROM communities.communities'
  );
  const total = parseInt(countResult.rows[0].count);
  
  const dataResult = await pool.query(
    `SELECT * FROM communities.communities 
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  
  res.json({
    success: true,
    data: dataResult.rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});
```

---

## Debugging

### View Service Logs

```bash
docker logs karmyq-[service-name] -f
```

### Check Event Queue

```bash
http://localhost:8081  # redis-commander UI
```

### Database Query Debugging

```typescript
// Log all queries
pool.on('query', (query) => {
  console.log('SQL:', query.text, query.values);
});
```

### HTTP Request Debugging

```bash
# Test endpoint directly
curl -v http://localhost:3000/api/communities \
  -H "X-User-Id: test-user"

# Or use VS Code REST Client
GET http://localhost:3000/api/communities
X-User-Id: test-user
```

---

## Contributing to Karmyq

1. **Pick a service** based on what interests you
2. **Read the service README** to understand its role
3. **Check open issues** tagged with the service
4. **Fork and create feature branch**: `git checkout -b feature/[service]/[description]`
5. **Make changes** following patterns above
6. **Test locally**: `docker-compose up && npm test`
7. **Submit PR** with clear description

---

## Need Help?

- Check ARCHITECTURE.md for system overview
- Look at existing services for examples
- Ask in community discussions
- Review API.md for endpoint contracts

Happy coding! 🚀
