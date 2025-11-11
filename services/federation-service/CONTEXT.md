# Federation Service Context

> **Quick Start**: `cd services/federation-service && npm run dev`
> **Port**: 3008 | **Health**: http://localhost:3008/health

## Purpose

Implements the KarmyQ Federation Protocol enabling distributed mutual aid instances to communicate while maintaining local sovereignty. Handles instance discovery, activity exchange, and cryptographic verification.

## Database Schema

### Tables Owned by This Service

All tables in `federation` schema (created in init.sql):

```sql
-- federation.instances
CREATE TABLE federation.instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    public_key TEXT NOT NULL,
    private_key TEXT,                        -- Only for local instance
    is_local BOOLEAN DEFAULT false,
    inbox_url VARCHAR(500),
    outbox_url VARCHAR(500),
    software_version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'discovered', -- discovered, accepted, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- federation.inbox
CREATE TABLE federation.inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    actor VARCHAR(500) NOT NULL,
    object_data JSONB,
    raw_activity JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- federation.outbox
CREATE TABLE federation.outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    target_domain VARCHAR(255),
    object_data JSONB,
    raw_activity JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- federation.federated_users
-- federation.federated_requests
-- federation.federated_communities
-- (See init.sql for complete schema)
```

## API Endpoints

### Instance Discovery

**GET /.well-known/karmyq**
Discover this instance's public information.

**Response:**
```json
{
  "domain": "localhost:3000",
  "name": "KarmyQ Instance",
  "version": "4.0.0",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "inbox": "http://localhost:3000/federation/inbox",
  "outbox": "http://localhost:3000/federation/outbox",
  "protocol": "karmyq-federation/0.1",
  "features": ["communities", "requests", "reputation"]
}
```

**Implementation:** `src/routes/wellKnown.ts:12`

**GET /.well-known/webfinger?resource=acct:user@domain**
WebFinger protocol for user discovery.

**Implementation:** `src/routes/wellKnown.ts:38`

### Federation Management

**GET /federation/instances**
List all federated instances.

**Query Parameters:**
- `status` - Filter by status (discovered, accepted, blocked)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "domain": "seattle.karmyq.org",
      "name": "Seattle KarmyQ",
      "status": "accepted",
      "public_key": "-----BEGIN PUBLIC KEY-----...",
      "created_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/federation.ts:12`

**POST /federation/instances/discover**
Discover a new instance by domain.

**Request:**
```json
{
  "domain": "seattle.karmyq.org"
}
```

**Implementation:** `src/routes/federation.ts:31`

**Process:**
1. Fetches `https://seattle.karmyq.org/.well-known/karmyq`
2. Stores instance info with status='discovered'
3. Returns instance information

**PUT /federation/instances/:domain/status**
Accept or block an instance.

**Request:**
```json
{
  "status": "accepted"  // or "blocked"
}
```

**Implementation:** `src/routes/federation.ts:60`

### Activity Processing

**POST /federation/inbox**
Receive activities from other instances.

**Request:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "actor": "https://seattle.karmyq.org/federation/users/alice",
  "object": {
    "type": "Request",
    "id": "https://seattle.karmyq.org/requests/123",
    "title": "Need help moving",
    "category": "moving"
  },
  "signature": "base64-encoded-signature"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Activity accepted for processing"
}
```

**Implementation:** `src/routes/federation.ts:87`

**Process:**
1. Verifies cryptographic signature
2. Stores in inbox table
3. Processes based on activity type (Create, Update, Delete, Follow, Accept)
4. Returns 202 Accepted

**GET /federation/outbox**
Get activities sent from this instance.

**Query Parameters:**
- `limit` - Max results (default: 20)
- `offset` - Pagination offset (default: 0)

**Implementation:** `src/routes/federation.ts:111`

**GET /federation/users/:userId**
Get federated user profile (ActivityPub format).

**Implementation:** `src/routes/federation.ts:134`

## Federation Protocol

### Activity Types

| Type | Description | Handler |
|------|-------------|---------|
| Create | New object (request, community) | `handleCreateActivity` |
| Update | Update existing object | `handleUpdateActivity` |
| Delete | Delete object | `handleDeleteActivity` |
| Follow | Federation request | `handleFollowActivity` |
| Accept | Accept federation | `handleAcceptActivity` |

### Object Types

| Type | Description | Storage |
|------|-------------|---------|
| Request | Help request | `federation.federated_requests` |
| Community | Community | `federation.federated_communities` |
| User | User profile | `federation.federated_users` |

### Cryptographic Signatures

**Signing Process:**
1. Canonicalize activity (sort keys alphabetically)
2. Sign with instance private key (RSA SHA256)
3. Attach base64-encoded signature to activity

**Verification Process:**
1. Extract actor domain from activity
2. Look up instance public key
3. Canonicalize activity (remove signature)
4. Verify signature with public key

**Implementation:**
- Signing: `src/utils/crypto.ts:26`
- Verification: `src/utils/crypto.ts:37`
- Canonicalization: `src/utils/crypto.ts:58`

## Key Files

### Entry Point
- `src/index.ts` - Express app, instance initialization

### Routes
- `src/routes/wellKnown.ts` - Instance discovery endpoints
- `src/routes/federation.ts` - Federation management and activities

### Services
- `src/services/instanceService.ts` - Instance identity and discovery
- `src/services/activityService.ts` - Inbox/outbox processing

### Utilities
- `src/utils/crypto.ts` - RSA key generation and signature verification

### Database
- `src/database/db.ts` - PostgreSQL connection pool

## Environment Variables

```bash
# Server
PORT=3008
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# Instance Identity
INSTANCE_DOMAIN=localhost:3000      # Your instance domain
INSTANCE_NAME=Local Dev Instance    # Display name
INSTANCE_DESCRIPTION=Development    # Description

# Federation Settings
FEDERATION_ENABLED=true              # Enable/disable federation
AUTO_ACCEPT_INSTANCES=false          # Auto-accept federation requests
REQUIRE_HTTPS=false                  # Require HTTPS (true in production)

# Logging
LOG_LEVEL=info
```

## Common Development Tasks

### Add New Activity Type

1. **Update activity handler:**
```typescript
// src/services/activityService.ts
export async function processInboxActivity(activity: Activity) {
  // ... existing code ...

  switch (activity.type) {
    // ... existing cases ...
    case 'Announce':  // New activity type
      await handleAnnounceActivity(activity);
      break;
  }
}

async function handleAnnounceActivity(activity: Activity) {
  // Process announcement
  console.log('Handling Announce activity');
}
```

### Add New Object Type

1. **Create table (if needed):**
```sql
-- infrastructure/postgres/migrations/00X_add_federated_offers.sql
CREATE TABLE federation.federated_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  federated_id VARCHAR(500) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  home_instance_domain VARCHAR(255) NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. **Add handler:**
```typescript
// src/services/activityService.ts
async function handleCreateActivity(activity: Activity) {
  const objectType = activity.object.type;

  switch (objectType) {
    // ... existing cases ...
    case 'Offer':
      await handleFederatedOffer(activity.object, activity.actor);
      break;
  }
}

async function handleFederatedOffer(offerObject: any, actor: string) {
  await query(
    `INSERT INTO federation.federated_offers
     (federated_id, title, home_instance_domain, raw_data)
     VALUES ($1, $2, $3, $4)`,
    [offerObject.id, offerObject.title, new URL(actor).host, JSON.stringify(offerObject)]
  );
}
```

### Test Federation Locally

**Setup two instances:**
```bash
# Terminal 1 - Instance A
PORT=3008 INSTANCE_DOMAIN=localhost:3000 npm run dev

# Terminal 2 - Instance B
PORT=3018 INSTANCE_DOMAIN=localhost:4000 npm run dev
```

**Discover instance B from A:**
```bash
curl -X POST http://localhost:3008/federation/instances/discover \
  -H "Content-Type: application/json" \
  -d '{"domain":"localhost:4000"}'
```

**Accept instance B:**
```bash
curl -X PUT http://localhost:3008/federation/instances/localhost:4000/status \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
```

**Send test activity:**
```bash
curl -X POST http://localhost:3008/federation/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Create",
    "actor": "http://localhost:4000/federation/users/test",
    "object": {
      "type": "Request",
      "id": "http://localhost:4000/requests/test-1",
      "title": "Test Request"
    }
  }'
```

### Enable Federation in Production

1. **Set environment variables:**
```bash
FEDERATION_ENABLED=true
REQUIRE_HTTPS=true
INSTANCE_DOMAIN=your-domain.com
```

2. **Generate instance keys:**
Instance identity with RSA keypair is auto-generated on first startup.

3. **Configure reverse proxy:**
Ensure `/.well-known/karmyq` is accessible and served by federation service.

4. **Test discovery:**
```bash
curl https://your-domain.com/.well-known/karmyq
```

## Security Considerations

### RSA Key Management
- 2048-bit RSA keys generated automatically
- Private key stored in database (only for local instance)
- Private key never shared or exposed via API
- Public key shared via `.well-known/karmyq` endpoint

### Signature Verification
- All incoming activities must be signed
- Signature verified against instance public key
- Activities with invalid signatures rejected
- Prevents spoofing and tampering

### Instance Trust
- Manual approval required for federation (AUTO_ACCEPT_INSTANCES=false recommended)
- Instances can be blocked at any time
- Status: discovered → accepted/blocked
- Blocked instances cannot send activities

### HTTPS in Production
- REQUIRE_HTTPS=true enforces HTTPS for all federation
- Prevents man-in-the-middle attacks
- SSL/TLS certificates required

## Debugging Common Issues

### Instance discovery fails
1. Check target instance is running: `curl http://target-domain/.well-known/karmyq`
2. Verify REQUIRE_HTTPS setting matches (false for local dev, true for prod)
3. Check DNS resolution: `nslookup target-domain`
4. Check firewall allows outbound HTTP/HTTPS

### Signature verification fails
1. Check clocks are synchronized (NTP)
2. Verify public key matches: `SELECT public_key FROM federation.instances WHERE domain = '...'`
3. Check canonicalization: Log canonical string before signing/verifying
4. Test with simple activity first

### Activities not appearing in inbox
1. Check inbox table: `SELECT * FROM federation.inbox ORDER BY created_at DESC LIMIT 5`
2. Verify instance status: `SELECT status FROM federation.instances WHERE domain = '...'`
3. Check logs for processing errors
4. Verify signature is valid

### Outbox activities not sending
1. Check target instance inbox_url: `SELECT inbox_url FROM federation.instances WHERE domain = '...'`
2. Test inbox URL manually: `curl -X POST ...`
3. Check network connectivity
4. Verify instance status is 'accepted'

## Performance Considerations

- Instance discovery is lazy (only when explicitly requested)
- Federated data cached locally (no repeated fetches)
- Signature verification is CPU-intensive (consider rate limiting)
- Inbox/outbox processing is async (returns 202 Accepted)
- Connection pooling for PostgreSQL (max 20 connections)

## Future Enhancements

- [ ] Event subscribers for automatic activity publishing
- [ ] User migration between instances
- [ ] Community cross-instance membership
- [ ] Reputation score portability
- [ ] Automatic instance discovery (DNS SRV records)
- [ ] Activity deduplication
- [ ] Retry logic for failed deliveries
- [ ] Federation statistics dashboard
- [ ] Rate limiting per instance
- [ ] Webhook notifications for new activities

## Related Documentation

- Federation Protocol: `/docs/FEDERATION_PROTOCOL.md`
- Federation Implementation: `/docs/FEDERATION_IMPLEMENTATION.md`
- Self-Hosting Guide: `/docs/SELF_HOSTING_GUIDE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 318-374)

## Related Services

- **All Services** - Any service can publish activities to federated instances
- **Auth Service** - User identity for federated users
- **Community Service** - Communities that can be federated
- **Request Service** - Requests shared across instances
- **Reputation Service** - Reputation that follows users

---

**Status**: Implemented, Not Tested
**Protocol Version**: karmyq-federation/0.1
**Next Steps**: Add event subscribers, test with multiple instances
