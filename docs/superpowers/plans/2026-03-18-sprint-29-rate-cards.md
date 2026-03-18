# Sprint 29: Rate Cards / Pricing Transparency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate cards to provider profiles so providers can publish their pricing and requestors can browse it — and optionally pre-select a provider when filing a typed request.

**Architecture:** New `requests.provider_rate_cards` table linked to `provider_profiles`; all CRUD in `request-service/src/routes/providers.ts`; `preferred_provider_id` column added to `help_requests`; new Bull event `preferred_provider_selected` handled by `notification-service`; frontend additions to Profile (edit), Provider Detail (read), Collective (read), and Request Filing (pre-select) pages.

**Tech Stack:** PostgreSQL, Node.js/Express/TypeScript, Bull queue, Next.js 14, Jest (tdd/)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `infrastructure/postgres/migrations/20260318-rate-cards.sql` | Create | DB migration — new table + new column |
| `infrastructure/postgres/init.sql` | Modify | Keep in sync with migration |
| `services/request-service/src/routes/providers.ts` | Modify | Rate card CRUD; append `rate_cards` to GET single provider |
| `services/request-service/src/routes/requests.ts` | Modify | Accept `preferred_provider_id`, validate, store, publish event |
| `services/notification-service/src/templates/notificationTemplates.ts` | Modify | Add `preferred_provider_selected` type + template |
| `services/notification-service/src/events/subscriber.ts` | Modify | Handle `preferred_provider_selected` event |
| `apps/frontend/src/app/profile/page.tsx` | Modify | Rate card UI in Provider tab |
| `apps/frontend/src/app/providers/[id]/page.tsx` | Modify | Read-only rate cards section |
| `apps/frontend/src/app/communities/[id]/page.tsx` (collective detail) | Modify | Member pricing section |
| `apps/frontend/src/app/requests/new/page.tsx` (or equivalent request form) | Modify | Pre-select provider step |
| `tests/tdd/rateCards.test.ts` | Create | API contract tests for rate card CRUD |
| `tests/tdd/preSelectProvider.test.ts` | Create | API tests for pre-select on POST /requests |
| `tests/tdd/preferredProviderNotification.test.ts` | Create | Notification subscriber + template tests |
| `services/request-service/CONTEXT.md` | Modify | Document new endpoints |
| `services/notification-service/CONTEXT.md` | Modify | Document new event type |
| `services/registry.json` | Modify | Add `preferred_provider_selected` event |
| `apps/landing/src/data/docs/services/request-service.json` | Modify | New endpoints |
| `apps/landing/src/data/docs/concepts/rate-cards.json` | Create | Rate cards concept page |
| `apps/landing/src/data/docs/nav.json` | Modify | Nav entry for rate cards concept |

---

## Task 1: Database Migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260318-rate-cards.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Step 1.1: Write the migration file**

```sql
-- 20260318-rate-cards.sql
-- Sprint 29: Add rate cards table and preferred_provider_id to help_requests

CREATE TABLE requests.provider_rate_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  label          VARCHAR(100) NOT NULL,
  service_type   TEXT,
  pricing_model  TEXT NOT NULL DEFAULT 'standard',
  rate_amount    NUMERIC(10,2),
  rate_unit      TEXT,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_pricing_model CHECK (pricing_model IN ('standard', 'free', 'negotiable')),
  CONSTRAINT chk_standard_rate CHECK (
    pricing_model != 'standard' OR (rate_amount IS NOT NULL AND rate_unit IS NOT NULL)
  ),
  CONSTRAINT chk_nonstandard_rate CHECK (
    pricing_model = 'standard' OR (rate_amount IS NULL AND rate_unit IS NULL)
  ),
  CONSTRAINT chk_rate_unit CHECK (
    rate_unit IS NULL OR rate_unit IN ('per_hour', 'per_session', 'per_trip', 'flat_rate')
  ),
  CONSTRAINT chk_rate_amount CHECK (rate_amount IS NULL OR rate_amount >= 0)
);

CREATE INDEX ON requests.provider_rate_cards(provider_id);
CREATE INDEX ON requests.provider_rate_cards(service_type);

ALTER TABLE requests.help_requests
  ADD COLUMN preferred_provider_id UUID
    REFERENCES requests.provider_profiles(id)
    ON DELETE SET NULL;
```

- [ ] **Step 1.2: Add the same SQL to `init.sql`**

Find the `provider_profiles` table block in `infrastructure/postgres/init.sql`. After it (and after any `provider_ride_details` / `provider_reviews` tables), insert the `provider_rate_cards` CREATE TABLE block above.

For `help_requests`, find its CREATE TABLE and add `preferred_provider_id UUID REFERENCES requests.provider_profiles(id) ON DELETE SET NULL` as a column (or as a separate ALTER TABLE after the table definition — keep style consistent with the file).

- [ ] **Step 1.3: Apply migration locally (if DB is running)**

```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /dev/stdin \
  < infrastructure/postgres/migrations/20260318-rate-cards.sql
```

Expected: No errors. Verify:
```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db \
  -c "\d requests.provider_rate_cards"
```

- [ ] **Step 1.4: Commit**

```bash
git add infrastructure/postgres/migrations/20260318-rate-cards.sql infrastructure/postgres/init.sql
git commit -m "feat(db): add provider_rate_cards table and preferred_provider_id column"
```

---

## Task 2: Rate Card API — TDD Tests First

**Files:**
- Create: `tests/tdd/rateCards.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `tests/tdd/rateCards.test.ts`:

```typescript
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';

// Helpers — re-use the same auth pattern used in other tdd tests
async function loginAs(email: string) {
  const res = await axios.post(`http://localhost:3001/auth/login`, {
    email,
    password: 'password123',
  });
  return res.data.data.token;
}

describe('Rate Cards API', () => {
  let ownerToken: string;
  let otherToken: string;
  let providerId: string;
  let cardId: string;

  beforeAll(async () => {
    ownerToken = await loginAs('provider1@test.karmyq.com');
    otherToken = await loginAs('user2@test.karmyq.com');

    // Look up the provider's own provider profile
    const res = await axios.get(`${BASE_URL}/requests/providers/my`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    providerId = res.data.data[0]?.id;
    if (!providerId) throw new Error('No provider profile found for test user — run simulation first');
  });

  it('creates a rate card as owner → 201', async () => {
    const res = await axios.post(
      `${BASE_URL}/requests/providers/${providerId}/rate-cards`,
      {
        label: 'Tutoring — Math',
        service_type: 'tutor',
        pricing_model: 'standard',
        rate_amount: 30,
        rate_unit: 'per_hour',
        notes: 'First session free',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.label).toBe('Tutoring — Math');
    expect(res.data.data.rate_amount).toBe('30.00');
    cardId = res.data.data.id;
  });

  it('returns 403 when non-owner tries to create a card', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests/providers/${providerId}/rate-cards`,
        { label: 'X', pricing_model: 'free' },
        { headers: { Authorization: `Bearer ${otherToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('returns 400 when standard pricing_model missing rate_amount', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'standard', rate_unit: 'per_hour' },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('returns 400 when free pricing_model has rate_amount set', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'free', rate_amount: 10 },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('returns 400 when service_type is invalid', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'free', service_type: 'wizard' },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('GET /providers/:id/rate-cards returns only active cards (public)', async () => {
    const res = await axios.get(
      `${BASE_URL}/requests/providers/${providerId}/rate-cards`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
    res.data.data.forEach((c: any) => expect(c.is_active).toBe(true));
  });

  it('updates a rate card as owner → 200', async () => {
    const res = await axios.put(
      `${BASE_URL}/requests/providers/${providerId}/rate-cards/${cardId}`,
      { label: 'Tutoring — Math & Science', rate_amount: 35 },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.data.label).toBe('Tutoring — Math & Science');
  });

  it('soft-deletes a rate card → card set inactive', async () => {
    const res = await axios.delete(
      `${BASE_URL}/requests/providers/${providerId}/rate-cards/${cardId}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(200);

    // Card should no longer appear in public list
    const list = await axios.get(
      `${BASE_URL}/requests/providers/${providerId}/rate-cards`
    );
    const found = list.data.data.find((c: any) => c.id === cardId);
    expect(found).toBeUndefined();
  });

  it('GET /providers/:id includes rate_cards array', async () => {
    const res = await axios.get(`${BASE_URL}/requests/providers/${providerId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data.rate_cards)).toBe(true);
  });
});
```

- [ ] **Step 2.2: Run tests to confirm they fail (endpoints don't exist yet)**

```bash
cd tests && npx jest tdd/rateCards --no-coverage 2>&1 | tail -20
```

Expected: failures like `404 Not Found` or connection refused.

- [ ] **Step 2.3: Commit the tests**

```bash
git add tests/tdd/rateCards.test.ts
git commit -m "test(tdd): rate card API contract tests — RED"
```

---

## Task 3: Rate Card API — Implementation

**Files:**
- Modify: `services/request-service/src/routes/providers.ts`

- [ ] **Step 3.1: Add rate card routes to `providers.ts`**

Add the following block **before** the `router.get('/:providerId', ...)` route (line ~77), to avoid Express route-ordering conflicts. Add it after the `/my` route.

```typescript
// ── Rate Card helpers ──────────────────────────────────────────────────────

const VALID_SERVICE_TYPES = ['ride', 'tradesperson', 'tutor', 'other'];
const VALID_RATE_UNITS = ['per_hour', 'per_session', 'per_trip', 'flat_rate'];
const VALID_PRICING_MODELS = ['standard', 'free', 'negotiable'];

function validateRateCardInput(body: any): string | null {
  const { label, pricing_model, rate_amount, rate_unit, service_type, currency } = body;
  if (!label || typeof label !== 'string' || label.length > 100) {
    return 'label is required and must be ≤ 100 characters';
  }
  if (!pricing_model || !VALID_PRICING_MODELS.includes(pricing_model)) {
    return 'pricing_model must be standard, free, or negotiable';
  }
  if (pricing_model === 'standard') {
    if (rate_amount == null || Number(rate_amount) < 0) return 'rate_amount is required and must be non-negative for standard pricing';
    if (!rate_unit || !VALID_RATE_UNITS.includes(rate_unit)) return 'rate_unit must be per_hour, per_session, per_trip, or flat_rate for standard pricing';
  } else {
    if (rate_amount != null) return 'rate_amount must be absent for non-standard pricing_model';
    if (rate_unit != null) return 'rate_unit must be absent for non-standard pricing_model';
  }
  if (service_type && !VALID_SERVICE_TYPES.includes(service_type)) {
    return `service_type must be one of: ${VALID_SERVICE_TYPES.join(', ')}`;
  }
  if (currency && currency.length !== 3) return 'currency must be a 3-character code';
  return null;
}

// GET /requests/providers/:providerId/rate-cards (public; owner gets all including inactive via ?include_inactive=true)
router.get('/:providerId/rate-cards', async (req: any, res: Response) => {
  try {
    const { providerId } = req.params;
    const { include_inactive } = req.query;

    // Only the owner may request inactive cards
    let includeInactive = false;
    if (include_inactive === 'true') {
      // Verify caller is the owner (optional auth — skip if no token)
      const authHeader = req.headers?.authorization;
      if (authHeader) {
        try {
          const { verifyToken } = await import('@karmyq/shared/middleware/auth');
          const user = verifyToken(authHeader.replace('Bearer ', ''));
          const ownerCheck = await query(
            'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
            [providerId]
          );
          if (ownerCheck.rows.length > 0 && ownerCheck.rows[0].user_id === user.userId) {
            includeInactive = true;
          }
        } catch (_) { /* invalid token — fall back to active-only */ }
      }
    }

    const result = await query(
      `SELECT * FROM requests.provider_rate_cards
       WHERE provider_id = $1 ${includeInactive ? '' : 'AND is_active = TRUE '}
       ORDER BY created_at ASC`,
      [providerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch rate cards', error: error.message });
  }
});

// POST /requests/providers/:providerId/rate-cards (owner only)
router.post('/:providerId/rate-cards', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId } = req.params;

    // Verify ownership
    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const validationError = validateRateCardInput(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const { label, service_type, pricing_model, rate_amount, rate_unit, currency, notes } = req.body;
    const result = await query(
      `INSERT INTO requests.provider_rate_cards
         (provider_id, label, service_type, pricing_model, rate_amount, rate_unit, currency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        providerId,
        label,
        service_type ?? null,
        pricing_model,
        pricing_model === 'standard' ? rate_amount : null,
        pricing_model === 'standard' ? rate_unit : null,
        currency ?? 'USD',
        notes ?? null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create rate card', error: error.message });
  }
});

// PUT /requests/providers/:providerId/rate-cards/:cardId (owner only)
router.put('/:providerId/rate-cards/:cardId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId, cardId } = req.params;

    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Fetch existing card to merge updates
    const existing = await query(
      'SELECT * FROM requests.provider_rate_cards WHERE id = $1 AND provider_id = $2',
      [cardId, providerId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Rate card not found' });

    const merged = { ...existing.rows[0], ...req.body };
    const validationError = validateRateCardInput(merged);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const { label, service_type, pricing_model, rate_amount, rate_unit, currency, notes, is_active } = merged;
    const result = await query(
      `UPDATE requests.provider_rate_cards
       SET label=$1, service_type=$2, pricing_model=$3, rate_amount=$4, rate_unit=$5,
           currency=$6, notes=$7, is_active=$8, updated_at=CURRENT_TIMESTAMP
       WHERE id=$9 AND provider_id=$10
       RETURNING *`,
      [
        label,
        service_type ?? null,
        pricing_model,
        pricing_model === 'standard' ? rate_amount : null,
        pricing_model === 'standard' ? rate_unit : null,
        currency ?? 'USD',
        notes ?? null,
        is_active ?? true,
        cardId,
        providerId,
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update rate card', error: error.message });
  }
});

// DELETE /requests/providers/:providerId/rate-cards/:cardId (owner only — soft delete)
router.delete('/:providerId/rate-cards/:cardId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { providerId, cardId } = req.params;

    const ownerCheck = await query(
      'SELECT user_id FROM requests.provider_profiles WHERE id = $1',
      [providerId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Provider not found' });
    if (ownerCheck.rows[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });

    const result = await query(
      `UPDATE requests.provider_rate_cards
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND provider_id = $2
       RETURNING id`,
      [cardId, providerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Rate card not found' });
    res.json({ success: true, data: { id: cardId }, message: 'Rate card deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to deactivate rate card', error: error.message });
  }
});
```

- [ ] **Step 3.2: Modify `GET /:providerId` to include `rate_cards`**

After the existing provider query (line ~95, `res.json({ success: true, data: result.rows[0] });`), fetch rate cards and append them:

```typescript
// Append rate_cards to GET /:providerId response
// (replace the res.json line with:)
const provider = result.rows[0];
const cardsResult = await query(
  'SELECT * FROM requests.provider_rate_cards WHERE provider_id = $1 AND is_active = TRUE ORDER BY created_at ASC',
  [providerId]
);
provider.rate_cards = cardsResult.rows;
res.json({ success: true, data: provider });
```

- [ ] **Step 3.3: Build the service to check for TypeScript errors**

```bash
cd services/request-service && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3.4: Run the rate card tests — they should now pass**

```bash
cd tests && npx jest tdd/rateCards --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add services/request-service/src/routes/providers.ts
git commit -m "feat(request-service): rate card CRUD endpoints + rate_cards in GET /providers/:id"
```

---

## Task 4: Pre-Select Provider — TDD Tests First

**Files:**
- Create: `tests/tdd/preSelectProvider.test.ts`

- [ ] **Step 4.1: Write failing tests**

```typescript
// tests/tdd/preSelectProvider.test.ts
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';
const AUTH_URL = 'http://localhost:3001';

async function loginAs(email: string) {
  const res = await axios.post(`${AUTH_URL}/auth/login`, { email, password: 'password123' });
  return res.data.data.token;
}

describe('Pre-select provider on POST /requests', () => {
  let requesterToken: string;
  let communityId: string;
  let activeProviderId: string;
  let inactiveProviderId: string;

  beforeAll(async () => {
    requesterToken = await loginAs('user1@test.karmyq.com');

    // Get a community the user belongs to
    const commRes = await axios.get(`http://localhost:3002/community/my`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
    });
    communityId = commRes.data.data[0]?.id;

    // Get an active provider
    const provRes = await axios.get(`${BASE_URL}/requests/providers?service_type=tutor&limit=1`);
    activeProviderId = provRes.data.data[0]?.id;
  });

  it('files request with valid preferred_provider_id → stores it on row', async () => {
    if (!activeProviderId) return pending('No tutor provider in DB — run simulation first');
    const res = await axios.post(
      `${BASE_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'service',
        title: 'Need a math tutor',
        description: 'Help with calculus',
        urgency: 'medium',
        preferred_provider_id: activeProviderId,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.preferred_provider_id).toBe(activeProviderId);
  });

  it('returns 400 PROVIDER_NOT_FOUND for non-existent provider', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests`,
        {
          community_id: communityId,
          request_type: 'generic',
          title: 'Test',
          description: 'Test',
          urgency: 'low',
          preferred_provider_id: '00000000-0000-0000-0000-000000000000',
        },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: 'PROVIDER_NOT_FOUND' } },
    });
  });

  it('returns 400 PROVIDER_INACTIVE for inactive provider', async () => {
    // This test requires a seeded inactive provider — skip if not available
    if (!inactiveProviderId) return;
    await expect(
      axios.post(
        `${BASE_URL}/requests`,
        {
          community_id: communityId,
          request_type: 'generic',
          title: 'Test',
          description: 'Test',
          urgency: 'low',
          preferred_provider_id: inactiveProviderId,
        },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: 'PROVIDER_INACTIVE' } },
    });
  });

  it('returns 400 PROVIDER_TYPE_MISMATCH when provider service_type does not match request_type', async () => {
    // Find a provider of a different type than 'ride' to test mismatch
    // e.g. use a tutor provider but file a ride request
    const tutorProvRes = await axios.get(`${BASE_URL}/requests/providers?service_type=tutor&limit=1`);
    const tutorProviderId = tutorProvRes.data.data[0]?.id;
    if (!tutorProviderId) return; // skip if no tutor providers exist yet
    await expect(
      axios.post(
        `${BASE_URL}/requests`,
        {
          community_id: communityId,
          request_type: 'ride',
          title: 'Need a ride',
          description: 'To the airport',
          urgency: 'medium',
          preferred_provider_id: tutorProviderId, // tutor provider on a ride request → mismatch
        },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: 'PROVIDER_TYPE_MISMATCH' } },
    });
  });

  it('files request without preferred_provider_id → unchanged behavior', async () => {
    const res = await axios.post(
      `${BASE_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Regular request',
        description: 'No provider pre-selected',
        urgency: 'low',
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.preferred_provider_id).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run tests — expect failures**

```bash
cd tests && npx jest tdd/preSelectProvider --no-coverage 2>&1 | tail -20
```

Expected: failures (column doesn't exist yet / no validation logic).

- [ ] **Step 4.3: Commit the tests**

```bash
git add tests/tdd/preSelectProvider.test.ts
git commit -m "test(tdd): pre-select provider contract tests — RED"
```

---

## Task 5: Pre-Select Provider — Implementation

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Step 5.1: Add `preferred_provider_id` handling to `POST /requests`**

In `requests.ts` at line ~713, add `preferred_provider_id` to the destructured body:

```typescript
const { community_id, post_to_all_communities, request_type, title, description, urgency, payload, requirements, visibility_scope, visibility_max_degrees, preferred_provider_id } = req.body;
```

After the requester_id check (line ~723) and before the Zod validation block, add provider validation:

```typescript
// Validate preferred_provider_id if provided
let resolvedProviderUserId: string | null = null;
if (preferred_provider_id) {
  const providerCheck = await query(
    'SELECT id, user_id, service_type, is_active FROM requests.provider_profiles WHERE id = $1',
    [preferred_provider_id]
  );
  if (providerCheck.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Provider not found', error: 'PROVIDER_NOT_FOUND' });
  }
  const provider = providerCheck.rows[0];
  if (!provider.is_active) {
    return res.status(400).json({ success: false, message: 'Provider is inactive', error: 'PROVIDER_INACTIVE' });
  }
  // For typed requests, provider service_type must match request_type
  const resolvedRequestType = request_type || 'generic';
  if (resolvedRequestType !== 'generic' && provider.service_type !== resolvedRequestType) {
    return res.status(400).json({ success: false, message: 'Provider service type does not match request type', error: 'PROVIDER_TYPE_MISMATCH' });
  }
  resolvedProviderUserId = provider.user_id;
}
```

- [ ] **Step 5.2: Add `preferred_provider_id` to the INSERT**

Find the INSERT at line ~816. Change the INSERT column list and VALUES to include `preferred_provider_id`:

```typescript
// Change INSERT columns (add preferred_provider_id after visibility_max_degrees):
`INSERT INTO requests.help_requests
  (requester_id, title, description, category, urgency, status, request_type, payload, requirements, expires_at, visibility_scope, visibility_max_degrees, preferred_provider_id)
VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11, $12)
RETURNING *`

// Add to params array (as the 12th param):
preferred_provider_id ?? null,
```

- [ ] **Step 5.3: Publish `preferred_provider_selected` event after successful insert**

After the existing `publishEvent('request_created', ...)` block (~line 846), add:

```typescript
// Publish preferred_provider_selected event if a provider was pre-selected
if (preferred_provider_id && resolvedProviderUserId) {
  // Look up requester name for notification body
  let requesterName = 'A user';
  try {
    const nameResult = await query('SELECT name FROM auth.users WHERE id = $1', [requester_id]);
    if (nameResult.rows.length > 0) requesterName = nameResult.rows[0].name;
  } catch (_) { /* non-blocking */ }

  await publishEvent('preferred_provider_selected', {
    request_id: request.id,
    requester_id,
    requester_name: requesterName,
    provider_id: preferred_provider_id,
    provider_user_id: resolvedProviderUserId,
    request_title: validatedData.title,
    request_type: validatedData.request_type,
  });
}
```

Note: `publishEvent` is already imported at the top of `requests.ts`. The event only fires once (not once per community), so place it after the community loop.

- [ ] **Step 5.4: TypeScript check**

```bash
cd services/request-service && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5.5: Run pre-select tests**

```bash
cd tests && npx jest tdd/preSelectProvider --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (except `PROVIDER_INACTIVE` if no inactive provider in DB — that's fine).

- [ ] **Step 5.6: Commit**

```bash
git add services/request-service/src/routes/requests.ts
git commit -m "feat(request-service): preferred_provider_id on POST /requests + preferred_provider_selected event"
```

---

## Task 6: Notification — TDD Tests First

**Files:**
- Create: `tests/tdd/preferredProviderNotification.test.ts`

- [ ] **Step 6.1: Write tests**

```typescript
// tests/tdd/preferredProviderNotification.test.ts
import { notificationTemplates } from '../../../services/notification-service/src/templates/notificationTemplates';

describe('preferred_provider_selected notification template', () => {
  const template = notificationTemplates['preferred_provider_selected'];

  it('template exists', () => {
    expect(template).toBeDefined();
  });

  it('title is correct', () => {
    expect(template.title({})).toBe('You were pre-selected');
  });

  it('body interpolates correctly', () => {
    const body = template.body({
      requester_name: 'Alice',
      request_type: 'tutor',
      request_title: 'Math Help',
    });
    expect(body).toContain('Alice');
    expect(body).toContain('Math Help');
  });

  it('actionUrl resolves to /requests/:id', () => {
    expect(template.actionUrl({ request_id: 'abc-123' })).toBe('/requests/abc-123');
  });

  it('channels: in_app true, push false, email false', () => {
    expect(template.channels).toEqual({ in_app: true, push: false, email: false });
  });
});
```

- [ ] **Step 6.2: Run tests — expect failure (type not defined yet)**

```bash
cd tests && npx jest tdd/preferredProviderNotification --no-coverage 2>&1 | tail -10
```

- [ ] **Step 6.3: Commit tests**

```bash
git add tests/tdd/preferredProviderNotification.test.ts
git commit -m "test(tdd): preferred_provider_selected notification tests — RED"
```

---

## Task 7: Notification — Implementation

**Files:**
- Modify: `services/notification-service/src/templates/notificationTemplates.ts`
- Modify: `services/notification-service/src/events/subscriber.ts`

- [ ] **Step 7.1: Add `preferred_provider_selected` to `notificationTemplates.ts`**

Add to the `NotificationType` union (line ~17, after `'match_reminder'`):
```typescript
| 'preferred_provider_selected'
```

Add to the `notificationTemplates` record (anywhere after the last entry):
```typescript
preferred_provider_selected: {
  type: 'preferred_provider_selected',
  priority: 'high',
  title: (_data: any) => 'You were pre-selected',
  body: (data: any) =>
    `${data.requester_name} pre-selected you for a ${data.request_type} request: "${data.request_title}".`,
  icon: 'star',
  ctaLabel: 'View Request',
  actionUrl: (data: any) => `/requests/${data.request_id}`,
  channels: { in_app: true, push: false, email: false },
},
```

- [ ] **Step 7.2: Add subscriber handler in `subscriber.ts`**

Inside `initEventSubscriber()`, after the last `eventQueue.process(...)` block but **before the closing brace of `initEventSubscriber()`**, add:

```typescript
// Handle preferred_provider_selected event
eventQueue.process('preferred_provider_selected', async (job) => {
  console.log('Processing preferred_provider_selected event:', job.data);
  const { payload } = job.data;
  const { provider_user_id, request_id, requester_name, request_type, request_title } = payload;

  if (!provider_user_id) {
    console.warn('⚠️  preferred_provider_selected: missing provider_user_id, skipping notification');
    return;
  }

  try {
    await createNotification({
      user_id: provider_user_id,
      type: 'preferred_provider_selected',
      data: { request_id, requester_name, request_type, request_title },
    });
    console.log('✅ preferred_provider_selected notification sent');
  } catch (error) {
    console.error('❌ Failed to process preferred_provider_selected event:', error);
    throw error;
  }
});
```

- [ ] **Step 7.3: TypeScript check**

```bash
cd services/notification-service && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 7.4: Run notification tests**

```bash
cd tests && npx jest tdd/preferredProviderNotification --no-coverage 2>&1 | tail -10
```

Expected: all 5 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add services/notification-service/src/templates/notificationTemplates.ts \
        services/notification-service/src/events/subscriber.ts
git commit -m "feat(notification-service): preferred_provider_selected notification type + subscriber"
```

---

## Task 8: Frontend — Profile Page Rate Card UI

**Files:**
- Modify: `apps/frontend/src/app/profile/page.tsx`

- [ ] **Step 8.1: Read the current Provider tab in `profile/page.tsx`**

Search for `ProviderProfileTab` or `Provider` in the file to find where the provider section is rendered.

```bash
grep -n "ProviderProfile\|rate.card\|pricing_notes\|provider.*tab" apps/frontend/src/app/profile/page.tsx -i | head -20
```

- [ ] **Step 8.2: Add rate card state and fetch logic**

Inside the provider profile section, for each provider profile card, add:
- State: `const [rateCards, setRateCards] = useState<Record<string, RateCard[]>>({})` (keyed by providerId)
- Fetch on tab mount: `GET /api/providers/:providerId/rate-cards` for each profile

Type definition (add near the top of the file or in a types section):
```typescript
interface RateCard {
  id: string;
  provider_id: string;
  label: string;
  service_type: string | null;
  pricing_model: 'standard' | 'free' | 'negotiable';
  rate_amount: string | null; // NUMERIC comes back as string from pg
  rate_unit: string | null;
  currency: string;
  notes: string | null;
  is_active: boolean;
}
```

- [ ] **Step 8.3: Add "Rate Cards" section UI within each provider card**

Below the existing bio/pricing_notes fields for each provider profile, add:

```tsx
{/* Rate Cards section */}
<div className="mt-4 border-t pt-4">
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-sm font-semibold text-gray-700">Rate Cards</h4>
    <button
      onClick={() => setShowAddRateCard(providerId)}
      className="text-xs text-blue-600 hover:underline"
    >
      + Add rate card
    </button>
  </div>

  {(rateCards[profile.id] ?? []).length === 0 ? (
    <p className="text-xs text-gray-400 italic">No rate cards yet.</p>
  ) : (
    <ul className="space-y-2">
      {(rateCards[profile.id] ?? []).map((card) => (
        <li key={card.id} className={`text-sm flex justify-between items-start ${!card.is_active ? 'opacity-40' : ''}`}>
          <div>
            <span className="font-medium">{card.label}</span>
            {card.pricing_model === 'standard' && card.rate_amount && (
              <span className="text-gray-500 ml-2">
                ${parseFloat(card.rate_amount).toFixed(0)} / {card.rate_unit?.replace('per_', '')}
              </span>
            )}
            {card.pricing_model === 'free' && <span className="text-green-600 ml-2">Free</span>}
            {card.pricing_model === 'negotiable' && <span className="text-amber-600 ml-2">Negotiable</span>}
            {card.notes && <p className="text-xs text-gray-400">{card.notes}</p>}
            {!card.is_active && <span className="text-xs text-gray-400 ml-1">(inactive)</span>}
          </div>
          <div className="flex gap-2 ml-2 shrink-0">
            <button onClick={() => setEditingCard(card)} className="text-xs text-blue-500">Edit</button>
            <button onClick={() => handleDeactivateCard(profile.id, card.id)} className="text-xs text-red-400">Remove</button>
          </div>
        </li>
      ))}
    </ul>
  )}
</div>
```

- [ ] **Step 8.4: Add rate card form modal**

Add a simple modal for "Add / Edit rate card" with fields matching the API. When submitted, call `POST` (add) or `PUT` (edit). On success, refresh the rate cards list for that provider.

The form fields:
- `label` (text input, required)
- `pricing_model` (radio: Standard / Free / Negotiable)
- `rate_amount` (number input, only shown when Standard)
- `rate_unit` (select: Per hour / Per session / Per trip / Flat rate, only shown when Standard)
- `service_type` (select: Ride / Tradesperson / Tutor / Other / None, optional)
- `notes` (textarea, optional)

API calls use `/api/providers/:providerId/rate-cards` (note: the Next.js frontend proxies `/api/providers` → `request-service /requests/providers` — confirm the proxy config first via `apps/frontend/next.config.js` or `next.config.ts`).

- [ ] **Step 8.5: Verify no TypeScript errors**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8.6: Commit**

```bash
git add apps/frontend/src/app/profile/page.tsx
git commit -m "feat(frontend): rate card management UI in profile Provider tab"
```

---

## Task 9: Frontend — Provider Detail Page

**Files:**
- Modify: `apps/frontend/src/app/providers/[id]/page.tsx`

- [ ] **Step 9.1: Read the provider detail page**

```bash
grep -n "rate_card\|pricing\|trust_score\|provider" apps/frontend/src/app/providers/[id]/page.tsx | head -20
```

- [ ] **Step 9.2: Consume `rate_cards` from the existing GET response**

The `GET /providers/:id` response now includes `rate_cards: RateCard[]`. Update the TypeScript type/interface for the provider response to include `rate_cards: RateCard[]`.

- [ ] **Step 9.3: Add read-only Rate Cards section**

Below the existing service details section, add:

```tsx
{provider.rate_cards && provider.rate_cards.length > 0 && (
  <section className="mt-6">
    <h3 className="text-base font-semibold text-gray-800 mb-3">Rate Cards</h3>
    <ul className="space-y-2">
      {provider.rate_cards.map((card: RateCard) => (
        <li key={card.id} className="text-sm border rounded-lg p-3">
          <div className="flex justify-between">
            <span className="font-medium">{card.label}</span>
            <span className="text-gray-500">
              {card.pricing_model === 'standard' && card.rate_amount
                ? `$${parseFloat(card.rate_amount).toFixed(0)} / ${card.rate_unit?.replace('per_', '')}`
                : card.pricing_model === 'free' ? 'Free' : 'Negotiable'}
            </span>
          </div>
          {card.notes && <p className="text-xs text-gray-400 mt-1">{card.notes}</p>}
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 9.4: TypeScript check and commit**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
git add apps/frontend/src/app/providers/[id]/page.tsx
git commit -m "feat(frontend): read-only rate cards on provider detail page"
```

---

## Task 10: Frontend — Collective Detail Page (Member Pricing)

**Files:**
- Modify: collective detail page (find the file)

- [ ] **Step 10.1: Find the collective detail page**

```bash
find apps/frontend/src/app -name "*.tsx" | xargs grep -l "collective\|Collective" 2>/dev/null | head -5
```

- [ ] **Step 10.2: Fetch member provider profiles with rate_cards**

In the collective detail page, after loading collective members:
- For each member, check if they have a provider profile: `GET /api/providers?user_id=<memberId>&limit=5`
- The response doesn't yet include rate_cards (that's the list endpoint). For collective display, fetch individual provider detail: `GET /api/providers/:providerId` to get `rate_cards`.
- Only render providers who have at least one active rate card.

**Performance note**: This is N+1 by design (deferred per spec). Fetch sequentially or use `Promise.all` for the member set.

- [ ] **Step 10.3: Add "Member Pricing" section**

```tsx
{membersWithRateCards.length > 0 && (
  <section className="mt-6">
    <h3 className="text-base font-semibold text-gray-800 mb-3">Member Pricing</h3>
    {membersWithRateCards.map(({ member, providerProfile, rateCards }) => (
      <div key={member.id} className="mb-4">
        <p className="text-sm font-medium text-gray-700">{providerProfile.display_name}</p>
        <ul className="mt-1 space-y-1">
          {rateCards.map((card: RateCard) => (
            <li key={card.id} className="text-sm text-gray-600 flex justify-between">
              <span>{card.label}</span>
              <span>
                {card.pricing_model === 'standard' && card.rate_amount
                  ? `$${parseFloat(card.rate_amount).toFixed(0)}/${card.rate_unit?.replace('per_', '')}`
                  : card.pricing_model === 'free' ? 'Free' : 'Negotiable'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </section>
)}
{membersWithRateCards.length === 0 && (
  <p className="mt-4 text-sm text-gray-400 italic">No pricing published yet.</p>
)}
```

- [ ] **Step 10.4: TypeScript check and commit**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
git add apps/frontend/src/app/
git commit -m "feat(frontend): member pricing section on collective detail page"
```

---

## Task 11: Frontend — Request Filing Pre-Select Provider

**Files:**
- Modify: request filing form (find the file)

- [ ] **Step 11.1: Find the request filing form**

```bash
find apps/frontend/src/app -name "*.tsx" | xargs grep -l "POST.*requests\|file.*request\|new.*request\|GenericRequest" 2>/dev/null | head -5
```

- [ ] **Step 11.2: Add pre-select UI (typed requests only)**

After the `request_type` field (but only when `request_type !== 'generic'`), add a "Pre-select a provider (optional)" section:

```tsx
{requestType !== 'generic' && (
  <div className="mt-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Pre-select a provider (optional)
    </label>
    {selectedProvider ? (
      <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2">
        <span>{selectedProvider.display_name}</span>
        <button onClick={() => setSelectedProvider(null)} className="text-gray-400 hover:text-gray-600">×</button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setShowProviderPicker(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        Browse providers →
      </button>
    )}
  </div>
)}
```

When "Browse providers" is clicked, open a panel/modal:
- Fetch `GET /api/providers?service_type=<requestType>`
- Filter client-side to providers with `rate_cards.length > 0` (the list endpoint doesn't include rate_cards — for the picker, fetch each provider individually via `GET /api/providers/:id` to get rate_cards, or use the rate-cards endpoint)
- Simpler approach: fetch `GET /api/providers?service_type=<requestType>`, then for each displayed provider show their rate cards fetched from `GET /api/providers/:id`
- Display: provider name, trust score badge, matching rate cards
- "Pre-select" button sets `selectedProvider` and closes picker

- [ ] **Step 11.3: Pass `preferred_provider_id` in form submit**

When submitting the request, include `preferred_provider_id: selectedProvider?.id` in the POST body.

- [ ] **Step 11.4: TypeScript check and commit**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
git add apps/frontend/src/app/
git commit -m "feat(frontend): pre-select provider step in request filing form"
```

---

## Task 12: Run All Tests

- [ ] **Step 12.1: Run unit + regression tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 12.2: Run TDD tests**

```bash
npm run test:tdd 2>&1 | tail -30
```

Expected: all new tests pass.

- [ ] **Step 12.3: Run feedback check**

```bash
npm run feedback:check 2>&1 | tail -20
```

Fix any failures before proceeding.

---

## Task 13: Documentation

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/notification-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/services/request-service.json`
- Create: `apps/landing/src/data/docs/concepts/rate-cards.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] **Step 13.1: Update `services/request-service/CONTEXT.md`**

In the "API Endpoints" section add:
```
GET  /requests/providers/:providerId/rate-cards  — List active rate cards for a provider (public)
POST /requests/providers/:providerId/rate-cards  — Create rate card (owner only)
PUT  /requests/providers/:providerId/rate-cards/:cardId — Update rate card (owner only)
DELETE /requests/providers/:providerId/rate-cards/:cardId — Soft-delete rate card (owner only)
```

Note the change to `POST /requests`: now accepts optional `preferred_provider_id`.

Note schema change: `requests.provider_rate_cards` table, `requests.help_requests.preferred_provider_id` column.

- [ ] **Step 13.2: Update `services/notification-service/CONTEXT.md`**

Add `preferred_provider_selected` to the list of handled event types.

- [ ] **Step 13.3: Update `services/registry.json`**

Add to the request-service `events.publishes` array:
```json
{ "type": "preferred_provider_selected", "description": "Fired when a requestor pre-selects a provider when filing a typed request" }
```

Add to notification-service `events.subscribes` array:
```json
{ "type": "preferred_provider_selected" }
```

- [ ] **Step 13.4: Update `apps/landing/src/data/docs/services/request-service.json`**

Add the 4 new rate card endpoints to the `endpoints` array using the standard format:
```json
{ "method": "GET",    "path": "/requests/providers/:providerId/rate-cards",          "description": "List active rate cards for a provider (public)." },
{ "method": "POST",   "path": "/requests/providers/:providerId/rate-cards",          "description": "Create a new rate card for a provider (owner only)." },
{ "method": "PUT",    "path": "/requests/providers/:providerId/rate-cards/:cardId",  "description": "Update an existing rate card (owner only)." },
{ "method": "DELETE", "path": "/requests/providers/:providerId/rate-cards/:cardId",  "description": "Soft-delete a rate card — sets is_active=false (owner only)." }
```

- [ ] **Step 13.5: Create `apps/landing/src/data/docs/concepts/rate-cards.json`**

```json
{
  "slug": "rate-cards",
  "title": "Rate Cards",
  "description": "Structured pricing entries that providers can publish so requestors see costs before contacting them.",
  "content": "# Rate Cards\n\nRate cards give service providers a way to publish structured pricing on their provider profile. Each card describes a specific service with a label, pricing model (standard, free, or negotiable), and optional notes.\n\n## Pricing Models\n\n- **Standard**: A numeric rate with a unit (per hour, per session, per trip, or flat rate).\n- **Free**: The provider offers this service at no charge.\n- **Negotiable**: Price is discussed directly between provider and requestor.\n\n## Where Rate Cards Appear\n\nRate cards are visible on:\n- The provider's detail page (`/providers/:id`) — accessible to unauthenticated users.\n- The collective detail page — under the Member Pricing section.\n- The request filing form — when requestors browse providers to pre-select.\n\n## Provider Pre-Selection\n\nWhen filing a typed request (ride, service, tutor, etc.), requestors can browse providers with matching rate cards and pre-select one. The pre-selected provider receives an in-app notification with a deep link to the request, and can accept by proposing to help.\n\n## Soft-Delete\n\nRate cards are never hard-deleted. Deactivating a card sets `is_active = false` — the card remains in the database for historical reference but stops appearing publicly.\n"
}
```

- [ ] **Step 13.6: Add rate cards to `nav.json`**

In the Concepts section, add:
```json
{ "slug": "rate-cards", "title": "Rate Cards" }
```

- [ ] **Step 13.7: Run feedback check**

```bash
npm run feedback:check 2>&1
```

Expected: passes.

- [ ] **Step 13.8: Commit all docs**

```bash
git add services/request-service/CONTEXT.md \
        services/notification-service/CONTEXT.md \
        services/registry.json \
        apps/landing/src/data/docs/services/request-service.json \
        apps/landing/src/data/docs/concepts/rate-cards.json \
        apps/landing/src/data/docs/nav.json
git commit -m "docs: Sprint 29 rate cards — update CONTEXT.md, registry, landing docs"
```

---

## Task 14: Final Verification

- [ ] **Step 14.1: Run full test suite**

```bash
npm test && npm run test:tdd && npm run feedback:check
```

Expected: all pass.

- [ ] **Step 14.2: Update handoff**

Run `/update-handoff` to mark Sprint 29 complete and prepare the handoff for the next session.

- [ ] **Step 14.3: Final commit if anything changed**

```bash
git status
# Stage and commit any remaining changes
```

---

## Stop Criteria Checklist

- [ ] Providers can create, edit, and soft-delete rate cards from `/profile` → Provider tab
- [ ] Rate cards visible on `/providers/[id]` (unauthenticated access works)
- [ ] Collective page shows "Member Pricing" section with member provider rate cards
- [ ] Requestors can browse rate cards and pre-select a provider when filing a typed request
- [ ] Pre-selected provider receives in-app notification with deep-link to `/requests/:id`
- [ ] Provider accepts via "propose to help" → `proposed` match created (existing flow, no code changes needed)
- [ ] All TDD tests pass: `npm run test:tdd`
- [ ] No regressions: `npm test`
- [ ] `npm run feedback:check` passes
