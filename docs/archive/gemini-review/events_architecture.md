# Event-Driven Architecture: Decoupling the Monolith

**Goal:** Allow services to react to changes without direct coupling (e.g., "Request Created" -> "Update Reputation").

## 1. The Stack: Redis Streams + BullMQ
Why **BullMQ**?
- Reliable (at-least-once delivery).
- Supports retries and delayed jobs (critical for "Remind me in 24h").
- Redis is already in the stack (implied by typical session management).

## 2. Topic Taxonomy (Domain Events)

We will use a `Subject.Verb` pattern.

| Topic / Queue | Event Name | Payload | Consumer Examples |
| :--- | :--- | :--- | :--- |
| `request.lifecycle` | `request.created` | `{ request_id, type, user_id }` | **Matching Service** (find matches)<br>**Notification Service** (alert community) |
| `request.lifecycle` | `request.completed` | `{ match_id, feedback_score }` | **Reputation Service** (adjust score)<br>**Billing Service** (process fee) |
| `identity` | `user.verified` | `{ user_id, tier }` | **Request Service** (unlock restricted types) |

## 3. Implementation: `packages/shared/events`

To ensure typesafety, we will not use raw strings.

### 3.1 The Publisher Interface
```typescript
// packages/shared/src/events/publisher.ts
import { Queue } from 'bullmq';

export class DomainEventPublisher {
  private queue: Queue;

  constructor(queueName: string) {
    this.queue = new Queue(queueName, { connection: redisConfig });
  }

  async publish<T extends keyof EventMap>(event: T, data: EventMap[T]) {
    await this.queue.add(event, data);
  }
}
```

### 3.2 The Consumer Interface
```typescript
// services/reputation/src/events/consumer.ts
import { Worker } from 'bullmq';

export const startWorker = () => {
  new Worker('request.lifecycle', async (job) => {
    if (job.name === 'request.completed') {
      await updateReputation(job.data);
    }
  });
};
```

## 4. Migration Strategy
1.  **Immediate:** Install `bullmq` in `packages/shared`.
2.  **Phase 1:** Identify "Side Effects" currently done via HTTP (or missing).
3.  **Phase 2:** Refactor `Request Service` to emit `request.created` instead of calling other services directly.
