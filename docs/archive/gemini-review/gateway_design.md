# API Gateway Design: The "Everything App" Aggregator

**Current State:** Nginx reverse proxy routing directly to services.
**Problem:**
1.  **Fragmented Auth:** Every service re-implements JWT check.
2.  **No Schema Aggregation:** Frontend needs to query 5 services to get UI hints.
3.  **Rigid Routing:** Adding a new vertical (e.g., "Food") requires Nginx restart/config.

## Proposed Architecture: `gateway-service`

We will introduce a **Node.js (Fastify)** service as the single entry point for application logic, sitting behind Nginx (which handles SSL/DDoS).

### 1. Responsibilities

#### A. Centralized Authentication
- Validates JWT **once**.
- Injects user context (`X-User-Id`, `X-Roles`) downstream.
- Services can trust the headers (since they only accept traffic from Gateway).

#### B. Dynamic Schema Registry (`/api/meta`)
- Aggregates "UI Schemas" from all specialized services.
- **Frontend Call:** `GET /api/meta/schemas`
- **Gateway Action:**
    1.  Checks `request-service` for `Ride` and `Borrow` schemas.
    2.  Checks `food-service` for `Menu` schemas.
    3.  Returns merged JSON.

#### C. Rate Limiting & Analytics
- Track usage per vertical ("How many Ride requests vs Borrow requests?").

### 2. Implementation Specs

#### Tech Stack
- **Framework:** Fastify (High performance).
- **Proxy:** `@fastify/http-proxy`.
- **Validation:** Zod.

#### Routing Table (Dynamic)
Instead of hardcoding, the Gateway can load routes from a config or Redis.

```typescript
// gateway/src/routes.ts
export const routes = [
  { prefix: '/auth', target: 'http://auth-service:4001' },
  { prefix: '/communities', target: 'http://community-service:4002' },
  { prefix: '/requests', target: 'http://request-service:4003' },
  // "Everything App" magic:
  { prefix: '/rides', target: 'http://request-service:4003/rides' }, // Rewrite
];
```

### 3. Transition Plan
1.  **Step 1:** Create `apps/gateway`.
2.  **Step 2:** Point Nginx to `gateway:3000` instead of individual backends.
3.  **Step 3:** Move JWT verification from individual services to Gateway.
