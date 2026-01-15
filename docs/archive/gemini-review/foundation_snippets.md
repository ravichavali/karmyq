# Foundation Snippets for "Everything App"

Use these snippets to kickstart the implementation with Claude.

## 1. Database Migration (SQL)
Run this against your `postgres` database to enable specialized requests.

```sql
-- 1. Create the Enum type for request discrimination
CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'borrow', 'service', 'event');

-- 2. Alter the table to add specialization columns
ALTER TABLE requests.help_requests
ADD COLUMN request_type request_type_enum NOT NULL DEFAULT 'generic',
ADD COLUMN payload JSONB DEFAULT '{}'::jsonb,
ADD COLUMN requirements JSONB DEFAULT '{}'::jsonb;

-- 3. Create a GIN index for fast searching within the JSON payload
CREATE INDEX idx_requests_payload ON requests.help_requests USING GIN (payload);
CREATE INDEX idx_requests_type ON requests.help_requests(request_type);
```

## 2. Zod Schemas (TypeScript)
Add this to `packages/shared/src/schemas/requests.ts`.

```typescript
import { z } from 'zod';

// --- Base Schema ---
export const BaseRequestSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

// --- Specialized Payloads ---

// 1. Ride Request
export const RidePayloadSchema = z.object({
  origin: z.object({
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  seats_needed: z.number().min(1).max(10),
  departure_time: z.string().datetime(), // ISO string
  preferences: z.object({
    women_only: z.boolean().optional(),
    pet_friendly: z.boolean().optional(),
  }).optional(),
});

// 2. Borrow Request
export const BorrowPayloadSchema = z.object({
  item_category: z.enum(['tools', 'electronics', 'kitchen', 'books', 'other']),
  duration_days: z.number().min(1).max(30),
  condition_min: z.enum(['fair', 'good', 'like_new', 'new']).optional(),
  images: z.array(z.string().url()).optional(),
});

// --- Discriminated Union ---

export const CreateRequestSchema = z.discriminatedUnion('request_type', [
  // Generic
  BaseRequestSchema.extend({
    request_type: z.literal('generic'),
    payload: z.object({}).optional(),
  }),
  // Ride
  BaseRequestSchema.extend({
    request_type: z.literal('ride'),
    payload: RidePayloadSchema,
  }),
  // Borrow
  BaseRequestSchema.extend({
    request_type: z.literal('borrow'),
    payload: BorrowPayloadSchema,
  }),
]);

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;
export type RidePayload = z.infer<typeof RidePayloadSchema>;
```

## 3. Frontend Usage Example (React Hook Form)
How to use the discriminated union in a form.

```typescript
// verify-form.ts
import { CreateRequestSchema } from '@karmyq/shared';

const validateForm = (data: any) => {
  const result = CreateRequestSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation failed", result.error.format());
    return false;
  }
  return true;
};
```
