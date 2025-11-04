# Karmyq Service Development Guide

This guide will help you create and contribute to Karmyq services. Whether you're building a new service from scratch or enhancing an existing one, follow these patterns to maintain consistency and loose coupling.

## Table of Contents

1. [Service Structure](#service-structure)
2. [Creating a New Service](#creating-a-new-service)
3. [Event Publishing](#event-publishing)
4. [Event Subscribing](#event-subscribing)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Testing](#testing)
8. [Documentation](#documentation)

---

## Service Structure

Every service follows this standard structure for consistency and discoverability:

```
services/example-service/
├── Dockerfile                  # Container definition
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── jest.config.js             # Testing config
├── .env.example               # Example environment variables
├── README.md                  # Service documentation
│
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # Express server setup
│   ├── config.ts             # Configuration loading
│   │
│   ├── routes/
│   │   ├── index.ts          # Route exports
│   │   ├── example.ts        # Example routes
│   │   └── health.ts         # Health check endpoint
│   │
│   ├── controllers/
│   │   └── exampleController.ts
│   │
│   ├── services/
│   │   ├── database.ts       # DB connection
│   │   └── exampleService.ts # Business logic
│   │
│   ├── middleware/
│   │   ├── auth.ts           # Auth middleware
│   │   ├── errorHandler.ts   # Error handling
│   │   └── logging.ts        # Request logging
│   │
│   ├── events/
│   │   ├── publisher.ts      # Publishes events
│   │   ├── subscriber.ts     # Subscribes to events
│   │   └── eventHandlers/    # Individual event handlers
│   │       ├── onUserCreated.ts
│   │       └── onRequestCompleted.ts
│   │
│   ├── database/
│   │   ├── schema.sql        # SQL schema for this service
│   │   └── migrations/       # Schema migrations
│   │
│   └── types.ts              # Service-specific types
│
└── tests/
    ├── routes.test.ts
    ├── services.test.ts
    └── events.test.ts
```

### Key Files Explained

**src/index.ts** - Entry point
```typescript
import app from './server';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Example service listening on port ${PORT}`);
});
```

**src/server.ts** - Express setup
```typescript
import express from 'express';
import routes from './routes';
import { errorHandler, logger } from './middleware';

const app = express();

app.use(express.json());
app.use(logger);
app.use('/api/example', routes);
app.use(errorHandler);

export default app;
```

**src/config.ts** - Load environment
```typescript
export const config = {
  port: process.env.PORT || 3001,
  dbUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
};
```

---

## Creating a New Service

### Step 1: Generate from Template

```bash
cd services/
cp -r request-service my-new-service
cd my-new-service

# Update package.json name
# Update README.md description
# Delete src/routes/example.ts (or rename)
```

### Step 2: Define Your API Contract

Add types to `shared/types/` for what your service exposes.

**Example**: If creating a `feedback-service`

`shared/types/feedback.ts`:
```typescript
export interface Feedback {
  id: string;
  fromUserId: string;
  toUserId: string;
  communityId: string;
  rating: number; // 1-5
  comment: string;
  type: 'positive' | 'constructive' | 'neutral';
  createdAt: Date;
}

export interface CreateFeedbackRequest {
  toUserId: string;
  communityId: string;
  rating: number;
  comment: string;
  type: 'positive' | 'constructive' | 'neutral';
}

export interface FeedbackStats {
  userId: string;
  communityId: string;
  averageRating: number;
  feedbackCount: number;
  recentFeedback: Feedback[];
}
```

Update `shared/types/index.ts`:
```typescript
export * from './feedback';
// Export in namespace
export namespace Karmyq {
  export type FeedbackType = Feedback;
}
```

### Step 3: Define Your Database Schema

Create `src/database/schema.sql`:

```sql
-- Feedback service schema
-- Run automatically when service initializes

CREATE SCHEMA IF NOT EXISTS feedback;

CREATE TABLE feedback.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  community_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES community.communities(id)
);

CREATE INDEX idx_feedback_to_user_id ON feedback.feedback(to_user_id);
CREATE INDEX idx_feedback_community_id ON feedback.feedback(community_id);
CREATE INDEX idx_feedback_created_at ON feedback.feedback(created_at);
```

### Step 4: Create Your Routes

`src/routes/feedback.ts`:
```typescript
import express from 'express';
import { auth } from '../middleware/auth';
import * as controller from '../controllers/feedbackController';

const router = express.Router();

// Protected routes (all require authentication)
router.use(auth);

// Create feedback
router.post(
  '/',
  controller.createFeedback
);

// Get feedback for a user
router.get(
  '/user/:userId/community/:communityId',
  controller.getFeedback
);

// Get feedback stats
router.get(
  '/stats/:userId/community/:communityId',
  controller.getFeedbackStats
);

export default router;
```

### Step 5: Implement Your Business Logic

`src/services/feedbackService.ts`:
```typescript
import { Pool } from 'pg';
import { Feedback, CreateFeedbackRequest, FeedbackStats } from '@karmyq/shared';

export class FeedbackService {
  constructor(private db: Pool) {}

  async createFeedback(
    communityId: string,
    request: CreateFeedbackRequest
  ): Promise<Feedback> {
    const result = await this.db.query(
      `INSERT INTO feedback.feedback 
       (from_user_id, to_user_id, community_id, rating, comment, type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.fromUserId,
        request.toUserId,
        communityId,
        request.rating,
        request.comment,
        request.type,
      ]
    );
    
    return result.rows[0];
  }

  async getFeedback(
    userId: string,
    communityId: string
  ): Promise<Feedback[]> {
    const result = await this.db.query(
      `SELECT * FROM feedback.feedback
       WHERE to_user_id = $1 AND community_id = $2
       ORDER BY created_at DESC`,
      [userId, communityId]
    );
    
    return result.rows;
  }

  async getFeedbackStats(
    userId: string,
    communityId: string
  ): Promise<FeedbackStats> {
    const result = await this.db.query(
      `SELECT 
         AVG(rating) as average_rating,
         COUNT(*) as feedback_count
       FROM feedback.feedback
       WHERE to_user_id = $1 AND community_id = $2`,
      [userId, communityId]
    );

    const feedback = await this.getFeedback(userId, communityId);

    return {
      userId,
      communityId,
      averageRating: result.rows[0].average_rating || 0,
      feedbackCount: parseInt(result.rows[0].feedback_count) || 0,
      recentFeedback: feedback.slice(0, 5),
    };
  }
}
```

### Step 6: Set Up Event Publishing

`src/events/publisher.ts`:
```typescript
import Queue from 'bull';
import { QueueEvent } from '@karmyq/shared';

export class EventPublisher {
  private queue: Queue.Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue('events', redisUrl);
  }

  async publish<T>(event: QueueEvent<T>): Promise<void> {
    await this.queue.add(
      event.type,
      event,
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  // Convenience methods for common events
  async publishFeedbackCreated(
    feedbackId: string,
    toUserId: string,
    communityId: string,
    rating: number
  ): Promise<void> {
    await this.publish({
      id: `feedback-${feedbackId}`,
      type: 'feedback_received',
      timestamp: new Date(),
      source: 'feedback-service',
      data: {
        feedbackId,
        toUserId,
        communityId,
        rating,
      },
    });
  }
}
```

### Step 7: Set Up Event Subscriptions

`src/events/subscriber.ts`:
```typescript
import Queue from 'bull';
import { onUserCreated } from './eventHandlers/onUserCreated';
import { onKarmaAwarded } from './eventHandlers/onKarmaAwarded';

export class EventSubscriber {
  private queue: Queue.Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue('events', redisUrl);
  }

  async subscribe(): Promise<void> {
    // Listen for specific event types
    this.queue.process('user_created', onUserCreated);
    this.queue.process('karma_awarded', onKarmaAwarded);

    // Error handling
    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    this.queue.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });
  }

  async stop(): Promise<void> {
    await this.queue.close();
  }
}
```

`src/events/eventHandlers/onUserCreated.ts`:
```typescript
import { Job } from 'bull';
import { QueueEvent } from '@karmyq/shared';

export async function onUserCreated(job: Job<QueueEvent>): Promise<void> {
  const { data } = job.data;
  const { userId } = data;

  // Initialize feedback profile for new user if needed
  console.log(`User created: ${userId}`);
  // Could initialize settings, create templates, etc.
}
```

### Step 8: Connect Everything

`src/index.ts`:
```typescript
import app from './server';
import { config } from './config';
import { FeedbackService } from './services/feedbackService';
import { EventPublisher } from './events/publisher';
import { EventSubscriber } from './events/subscriber';
import { Pool } from 'pg';

// Initialize database
const db = new Pool({
  connectionString: config.dbUrl,
});

// Initialize services
const feedbackService = new FeedbackService(db);
const eventPublisher = new EventPublisher(config.redisUrl);
const eventSubscriber = new EventSubscriber(config.redisUrl);

// Start subscription
eventSubscriber.subscribe().catch(console.error);

// Make services available to routes (attach to app)
app.locals.feedbackService = feedbackService;
app.locals.eventPublisher = eventPublisher;

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Feedback service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await eventSubscriber.stop();
  await db.end();
  process.exit(0);
});
```

### Step 9: Update docker-compose.yml

Add your service to `docker-compose.yml`:

```yaml
feedback-service:
  build:
    context: ./services/feedback-service
    dockerfile: Dockerfile
  container_name: karmyq-feedback-service
  environment:
    NODE_ENV: development
    PORT: 3008
    DATABASE_URL: postgresql://karmyq_user:karmyq_password_dev@postgres:5432/karmyq_db
    REDIS_URL: redis://redis:6379
    BULL_QUEUE_URL: redis://redis:6379
  ports:
    - "3008:3008"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  volumes:
    - ./services/feedback-service/src:/app/src
  networks:
    - karmyq-network
  command: npm run dev
```

### Step 10: Update nginx api-gateway.conf

Add to `infrastructure/nginx/api-gateway.conf`:

```nginx
location /api/feedback/ {
  proxy_pass http://feedback-service:3008/api/feedback/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Step 11: Write Tests

`tests/services.test.ts`:
```typescript
import { FeedbackService } from '../src/services/feedbackService';
import { Pool } from 'pg';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let db: Pool;

  beforeAll(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    service = new FeedbackService(db);
  });

  afterAll(async () => {
    await db.end();
  });

  it('should create feedback', async () => {
    const feedback = await service.createFeedback('community-123', {
      fromUserId: 'user-1',
      toUserId: 'user-2',
      communityId: 'community-123',
      rating: 5,
      comment: 'Great help!',
      type: 'positive',
    });

    expect(feedback).toHaveProperty('id');
    expect(feedback.rating).toBe(5);
  });
});
```

### Step 12: Write README

`README.md`:

```markdown
# Feedback Service

Manages feedback and ratings between community members.

## Responsibilities

- Store feedback from one user to another
- Calculate feedback statistics and ratings
- Emit events when feedback is received
- Maintain feedback history

## API Endpoints

### POST /api/feedback
Create feedback for a user.

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user-123",
    "communityId": "community-456",
    "rating": 5,
    "comment": "Excellent help!",
    "type": "positive"
  }'
```

### GET /api/feedback/user/:userId/community/:communityId
Get feedback for a user in a community.

## Events

### Published
- `feedback_received` - When feedback is created

### Subscribed
- `user_created` - Initialize user feedback profile
- `karma_awarded` - Update feedback weight

## Database

Uses `feedback` schema with these tables:
- `feedback.feedback` - Stores feedback records

## Development

```bash
docker-compose up feedback-service
npm run dev
npm run test
```
```

### Step 13: Test Locally

```bash
# Start everything
docker-compose up -d

# Check if service is running
curl http://localhost:3000/api/feedback/health

# Watch logs
docker-compose logs -f feedback-service

# Restart to pick up changes
docker-compose restart feedback-service
```

---

## Event Publishing

When your service needs to notify other services about something, publish an event.

### Publishing Events

```typescript
// In your service
const eventPublisher = app.locals.eventPublisher;

// After creating feedback
await eventPublisher.publishFeedbackCreated(
  feedbackId,
  toUserId,
  communityId,
  rating
);
```

### Event Types

Define in `shared/types/events.ts`. Examples:

```typescript
export type EventType =
  // Auth Events
  | 'user_created'
  | 'user_deleted'
  
  // Feedback Events (new)
  | 'feedback_received'
  | 'feedback_removed'
  
  // ... existing events ...
```

### Publishing Best Practices

✅ **DO**
- Publish after data is saved (avoid race conditions)
- Include IDs, not full objects (privacy, performance)
- Use consistent event names
- Document what events your service publishes

❌ **DON'T**
- Publish before saving (could fail)
- Include sensitive data (passwords, emails)
- Wait for event processing (it's async)
- Expect immediate consistency

---

## Event Subscribing

When you need to react to events from other services, subscribe.

### Subscribing to Events

```typescript
// In src/events/subscriber.ts
this.queue.process('user_created', onUserCreated);
this.queue.process('karma_awarded', onKarmaAwarded);
```

### Event Handler Pattern

```typescript
// src/events/eventHandlers/onUserCreated.ts
import { Job } from 'bull';
import { QueueEvent } from '@karmyq/shared';

export async function onUserCreated(
  job: Job<QueueEvent>
): Promise<void> {
  const { data } = job.data;
  const { userId } = data;

  // Do work asynchronously
  // This won't block the publisher
  
  // If it fails, Bull will retry automatically
  // Check job.attemptsMade for retry count
}
```

### Subscribing Best Practices

✅ **DO**
- Subscribe to events you need
- Process events idempotently (handle duplicates)
- Log what you're doing
- Handle errors gracefully
- Publish new events if needed

❌ **DON'T**
- Call other services' APIs from event handlers (use their published data)
- Assume event ordering (it's not guaranteed)
- Do long-running work synchronously
- Fail silently

---

## API Endpoints

### Endpoint Pattern

All endpoints follow RESTful conventions:

```
GET    /api/service/resource           → List resources
POST   /api/service/resource           → Create resource
GET    /api/service/resource/:id       → Get resource
PUT    /api/service/resource/:id       → Update resource
DELETE /api/service/resource/:id       → Delete resource
```

### Response Format

All responses use this format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}
```

### Error Handling

```typescript
// In middleware/errorHandler.ts
export function errorHandler(
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      timestamp: new Date(),
    },
  });
}
```

---

## Database Schema

### Schema Organization

Each service owns a PostgreSQL schema within the single `karmyq_db` database:

```
karmyq_db
├── auth schema       (auth-service tables)
├── community schema  (community-service tables)
├── feedback schema   (feedback-service tables)
├── requests schema   (request-service tables)
└── ... etc
```

### Schema Definition

```sql
-- services/your-service/src/database/schema.sql

CREATE SCHEMA IF NOT EXISTS your_service;

-- Your tables here
CREATE TABLE your_service.your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... columns ...
);

-- Create indices
CREATE INDEX idx_your_table_field ON your_service.your_table(field);
```

### Initialization

Services automatically initialize their schema on startup:

```typescript
// In services/your-service/src/services/database.ts
export async function initializeSchema(db: Pool): Promise<void> {
  const schema = fs.readFileSync(
    path.join(__dirname, '../database/schema.sql'),
    'utf-8'
  );
  
  await db.query(schema);
  console.log('Schema initialized');
}
```

### Cross-Service Queries

Query another service's data via:

1. **REST API** (recommended - respects boundaries)
   ```typescript
   const response = await fetch('http://auth-service:3001/api/users/123');
   ```

2. **Direct Database** (for read-only queries only)
   ```typescript
   // Only read, never write to other schemas
   const result = await db.query(
     'SELECT * FROM community.community_members WHERE user_id = $1',
     [userId]
   );
   ```

---

## Testing

### Test Structure

```
tests/
├── services.test.ts        # Service logic tests
├── routes.test.ts          # API endpoint tests
├── events.test.ts          # Event publishing/subscribing
└── fixtures/
    └── testData.ts         # Shared test data
```

### Example: Service Tests

```typescript
import { FeedbackService } from '../src/services/feedbackService';
import { Pool } from 'pg';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let db: Pool;

  beforeAll(async () => {
    db = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    service = new FeedbackService(db);
  });

  beforeEach(async () => {
    // Clear test data
    await db.query('DELETE FROM feedback.feedback');
  });

  afterAll(async () => {
    await db.end();
  });

  describe('createFeedback', () => {
    it('should create feedback with valid data', async () => {
      const feedback = await service.createFeedback('community-123', {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        communityId: 'community-123',
        rating: 5,
        comment: 'Excellent!',
        type: 'positive',
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.rating).toBe(5);
    });

    it('should reject invalid ratings', async () => {
      expect(async () => {
        await service.createFeedback('community-123', {
          fromUserId: 'user-1',
          toUserId: 'user-2',
          communityId: 'community-123',
          rating: 10, // Invalid
          comment: 'Test',
          type: 'positive',
        });
      }).rejects.toThrow();
    });
  });

  describe('getFeedback', () => {
    it('should retrieve feedback for a user', async () => {
      // Create test feedback
      await service.createFeedback('community-123', {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        communityId: 'community-123',
        rating: 5,
        comment: 'Great!',
        type: 'positive',
      });

      const feedback = await service.getFeedback('user-2', 'community-123');
      expect(feedback).toHaveLength(1);
      expect(feedback[0].rating).toBe(5);
    });
  });
});
```

### Example: API Tests

```typescript
import request from 'supertest';
import app from '../src/server';

describe('Feedback API', () => {
  const token = 'valid-jwt-token'; // Mock token

  describe('POST /api/feedback', () => {
    it('should create feedback with valid data', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({
          toUserId: 'user-2',
          communityId: 'community-123',
          rating: 5,
          comment: 'Excellent help!',
          type: 'positive',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          toUserId: 'user-2',
          communityId: 'community-123',
          rating: 5,
          comment: 'Test',
          type: 'positive',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/feedback/user/:userId/community/:communityId', () => {
    it('should retrieve feedback for a user', async () => {
      const response = await request(app)
        .get('/api/feedback/user/user-2/community/community-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- services.test.ts

# Run with coverage
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

---

## Documentation

### README Template

Every service should have a README.md:

```markdown
# Service Name

One-line description of what this service does.

## Purpose

More detailed explanation of the service's role in Karmyq.

## Responsibilities

- Responsibility 1
- Responsibility 2
- Responsibility 3

## API Endpoints

### POST /api/endpoint
Description of what this does.

**Request**:
```json
{
  "field": "value"
}
```

**Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

### GET /api/endpoint/:id
Get a specific resource.

## Events

### Published Events
- `event_name` - Description
- `another_event` - Description

### Subscribed Events
- `event_from_other_service` - How we use it

## Database

Schema: `service_name`

Tables:
- `service_name.table_1` - Description
- `service_name.table_2` - Description

## Development

```bash
# Start just this service
docker-compose up feedback-service

# Run tests
npm run test

# Watch mode
npm run dev
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a PR

## Troubleshooting

**Issue**: Service won't start
**Solution**: Check environment variables, ensure database is ready

## License

MIT
```

### Code Comments

```typescript
/**
 * Creates feedback from one user to another.
 * 
 * This method:
 * 1. Validates the input
 * 2. Stores in database
 * 3. Publishes feedback_received event
 * 4. Returns the created feedback
 * 
 * @param communityId - The community where feedback is given
 * @param request - The feedback request data
 * @returns The created feedback record
 * @throws ValidationError if input is invalid
 * @throws DatabaseError if store fails
 */
async createFeedback(
  communityId: string,
  request: CreateFeedbackRequest
): Promise<Feedback> {
  // Validate community exists
  // Validate users exist
  // Validate rating is 1-5
  
  // Store feedback
  // Publish event
  // Return feedback
}
```

---

## Checklist: Creating a New Service

- [ ] Created service directory in `services/`
- [ ] Defined API contract in `shared/types/`
- [ ] Created database schema in `src/database/schema.sql`
- [ ] Implemented routes and controllers
- [ ] Implemented business logic in services
- [ ] Set up event publishing
- [ ] Set up event subscribing (if needed)
- [ ] Added to docker-compose.yml
- [ ] Added to nginx api-gateway.conf
- [ ] Wrote tests (>80% coverage target)
- [ ] Wrote comprehensive README.md
- [ ] Tested locally with `docker-compose up`
- [ ] Created PR with clear description

---

## Questions?

Refer to:
- **ARCHITECTURE.md** - How everything fits together
- **Existing services** - Real examples to copy patterns from
- **shared/types/** - API contracts used across services
- **Infrastructure docs** - Database, Redis, nginx setup

Good luck! We can't wait to see what you build! 🚀
