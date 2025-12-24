# Karmyq: The "Everything App" Roadmap

**Goal:** Evolve Karmyq from a generic help exchange platform into a specialized multi-vertical "Super App" where every request type (Ride, Item Borrow, Professional Service) has its own optimized workflow, data model, and governance.

---

## 1. Core Architecture: Polymorphic Data Model

The current `requests.help_requests` table is generic. To support "rides", "borrowing", and "services" without creating 50 new tables, we will use a **Discriminator + JSONB Payload** pattern.

### 1.1 Database Changes
- **New Column:** `request_type` (enum: `generic`, `ride`, `borrow`, `service`, `event`).
- **New Column:** `payload` (JSONB). Stores type-specific data.
- **New Column:** `constraints` (JSONB). Stores requirements (e.g., "Must have verified ID").

#### Example: "Ride" Payload
```json
{
  "from": { "lat": 37.77, "lng": -122.41, "address": "123 Market St" },
  "to": { "lat": 37.42, "lng": -122.08, "address": "Googleplex" },
  "seats_needed": 3,
  "departure_time": "2025-12-25T09:00:00Z"
}
```

### 1.2 TypeScript Discrimination
We will use Zod Discriminated Unions to ensure type safety extends to the frontend.

```typescript
type BaseRequest = { id: string; title: string; ... };

type RideRequest = BaseRequest & {
  type: 'ride';
  payload: { from: Location; to: Location; seats: number };
};

type BorrowRequest = BaseRequest & {
  type: 'borrow';
  payload: { item_condition: 'new' | 'used'; duration_days: number };
};

export type HelpRequest = RideRequest | BorrowRequest | ...;
```

---

## 2. Server-Driven UI (Dynamic Forms)

To prevent the frontend from becoming a massive switch statement, the backend will define the "schema" for each request type, and the frontend will render it dynamically.

### 2.1 Schema Registry
The backend serves a JSON Schema (or a custom UI Schema) for each `request_type`.

**Endpoint:** `GET /api/meta/schemas/ride`
```json
{
  "ui:layout": "vertical",
  "fields": [
    { "key": "payload.from", "component": "LocationPicker", "label": "Pick Up" },
    { "key": "payload.to", "component": "LocationPicker", "label": "Drop Off" },
    { "key": "payload.seats", "component": "NumberStepper", "min": 1, "max": 6 }
  ]
}
```

**Impact:** You can launch a new vertical (e.g., "Dog Walking") by adding a schema on the backend, without a full App Store update.

---

## 3. Intelligent Matching (Vector Search)

Standard SQL queries (`WHERE category='ride'`) are insufficient for complex matching (e.g., matching a ride going *near* a location).

### 3.1 Pgvector Integration
- **Concept:** Generate embeddings for requests and offers description + metadata.
- **Geo-aware Matching:** For rides, use PostGIS for efficient "corridor matching" (finding a driver whose route passes near the passenger).

---

## 4. Pluggable Trust & Governance

Different verticals require different levels of trust.

### 4.1 Verification Levels (Tiered)
- **Level 1 (Basic):** Email Verified. (Good for: Borrowing a book).
- **Level 2 (Identity):** ID Document Scan (Stripe Identity). (Good for: Hosting an event).
- **Level 3 (Professional):** License/Certification Check. (Good for: Medical advice, Taxi).

### 4.2 Rules Engine
Each community or request type defines its minimum requirement.
`Ride Request` -> `Requires: ['driver_license_verified', 'positive_reputation > 50']`.

---

## 5. Implementation Stages

### Phase 1: Foundation (Weeks 1-2)
- [ ] Add `request_type` and `payload` to `help_requests` table.
- [ ] Implement Zod schemas for `Ride` and `Generic`.
- [ ] Update API to validate `payload` against schema on create.

### Phase 2: Dynamic UI (Weeks 3-4)
- [ ] Create `SchemaController` on backend.
- [ ] Build `<DynamicForm />` component in React Native/Next.js.

### Phase 3: The First Vertical - "Karmyq Rides" (Weeks 5-6)
- [ ] Enable `Ride` type.
- [ ] Implement PostGIS for distance calculation.
- [ ] specialized "Ride Details" view in the app.

### Phase 4: Expansion (Week 7+)
- [ ] Add "Borrow" and "Services".
- [ ] Implement Pluggable Trust modules.
