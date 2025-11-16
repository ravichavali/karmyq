# Federation Implementation Guide

This guide covers implementing the KarmyQ Federation Protocol (KFP) in the existing codebase.

## Overview

The federation system consists of:

1. **Federation Service** - New microservice handling federated operations
2. **Database Schema** - Tables for federated content (see `001_federation_schema.sql`)
3. **Cryptographic Identity** - Public/private keypair for instance
4. **API Endpoints** - REST APIs for federation management
5. **Activity Processing** - Background workers for inbox/outbox

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                 │
│  - Federated user profiles                          │
│  - Cross-instance help requests                     │
│  - Federation settings UI                           │
└─────────────────────────────────────────────────────┘
                        │
                        │ HTTP/REST
                        ▼
┌─────────────────────────────────────────────────────┐
│              Federation Service (Port 3008)         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Instance   │  │   Activity   │  │  Crypto   │ │
│  │  Management  │  │  Processing  │  │  Utils    │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
                        │
                        │ PostgreSQL
                        ▼
┌─────────────────────────────────────────────────────┐
│                  Database                           │
│  - federation.instances                             │
│  - federation.inbox / outbox                        │
│  - federation.federated_users                       │
│  - federation.federated_requests                    │
└─────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Federation Service

```bash
cd services
mkdir federation-service
cd federation-service
npm init -y
npm install express cors dotenv pg jsonwebtoken node-rsa
npm install -D typescript @types/node @types/express ts-node nodemon
```

### Step 2: Directory Structure

```
services/federation-service/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── config/
│   │   └── crypto.ts               # Keypair management
│   ├── database/
│   │   └── db.ts                   # Database connection
│   ├── routes/
│   │   ├── instance.ts             # Instance management
│   │   ├── federation.ts           # Federation requests
│   │   ├── inbox.ts                # Incoming activities
│   │   └── outbox.ts               # Outgoing activities
│   ├── services/
│   │   ├── activityProcessor.ts    # Process federated activities
│   │   ├── signatureVerifier.ts    # Verify signatures
│   │   ├── federationManager.ts    # Manage federation links
│   │   └── reputationAttestation.ts
│   ├── workers/
│   │   ├── inboxWorker.ts          # Process inbox queue
│   │   └── outboxWorker.ts         # Deliver outbox activities
│   └── types/
│       └── index.ts                # TypeScript types
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Step 3: Keypair Generation

```typescript
// src/config/crypto.ts
import NodeRSA from 'node-rsa';
import { query } from '../database/db';

export async function ensureInstanceKeypair(domain: string): Promise<void> {
  const existing = await query(
    'SELECT * FROM federation.local_instance WHERE domain = $1',
    [domain]
  );

  if (existing.rows.length > 0) {
    console.log('Instance keypair already exists');
    return;
  }

  // Generate 2048-bit RSA keypair
  const key = new NodeRSA({ b: 2048 });
  const publicKey = key.exportKey('public');
  const privateKey = key.exportKey('private');

  await query(`
    INSERT INTO federation.local_instance (
      domain, name, description, public_key, private_key, federation_enabled
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    domain,
    process.env.INSTANCE_NAME || 'KarmyQ Instance',
    process.env.INSTANCE_DESCRIPTION || 'A mutual aid coordination platform',
    publicKey,
    privateKey,  // TODO: Encrypt before storing
    false  // Disabled by default
  ]);

  console.log('Instance keypair generated');
}

export async function getInstanceKeypair() {
  const result = await query('SELECT * FROM federation.local_instance LIMIT 1');
  if (result.rows.length === 0) {
    throw new Error('Instance not initialized. Run setup first.');
  }
  return result.rows[0];
}

export async function signPayload(payload: any): Promise<string> {
  const instance = await getInstanceKeypair();
  const key = new NodeRSA(instance.private_key);
  const signature = key.sign(JSON.stringify(payload), 'base64');
  return signature;
}

export async function verifySignature(
  payload: any,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const key = new NodeRSA(publicKey);
    return key.verify(JSON.stringify(payload), signature, 'utf8', 'base64');
  } catch (error) {
    return false;
  }
}
```

### Step 4: Instance Discovery

```typescript
// src/routes/instance.ts
import { Router } from 'express';
import { query } from '../database/db';

const router = Router();

// Well-known endpoint for instance discovery
router.get('/.well-known/karmyq', async (req, res) => {
  const instance = await query('SELECT * FROM federation.local_instance LIMIT 1');

  if (instance.rows.length === 0) {
    return res.status(404).json({ error: 'Instance not configured' });
  }

  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM auth.users) as users_count,
      (SELECT COUNT(*) FROM communities.communities) as communities_count,
      (SELECT COUNT(*) FROM requests.help_requests WHERE status = 'open') as active_requests_count
  `);

  res.json({
    instance_id: instance.rows[0].id,
    domain: instance.rows[0].domain,
    name: instance.rows[0].name,
    description: instance.rows[0].description,
    location: instance.rows[0].location,
    admin_contact: instance.rows[0].admin_contact,
    public_key: instance.rows[0].public_key,
    created_at: instance.rows[0].created_at,
    version: '1.0.0',
    software: 'KarmyQ',
    federation_policy: instance.rows[0].federation_policy,
    statistics: stats.rows[0]
  });
});

export default router;
```

### Step 5: Federation Request Flow

```typescript
// src/routes/federation.ts
import { Router } from 'express';
import { query } from '../database/db';
import { signPayload, verifySignature } from '../config/crypto';
import axios from 'axios';

const router = Router();

// Request federation with another instance
router.post('/request', async (req, res) => {
  const { target_domain, reason } = req.body;

  try {
    // Fetch target instance info
    const targetInfo = await axios.get(`https://${target_domain}/.well-known/karmyq`);

    // Store instance info
    const instance = await query(`
      INSERT INTO federation.instances (
        domain, name, description, public_key, software, version, federation_policy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (domain) DO UPDATE
      SET public_key = EXCLUDED.public_key, last_seen_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      target_domain,
      targetInfo.data.name,
      targetInfo.data.description,
      targetInfo.data.public_key,
      targetInfo.data.software,
      targetInfo.data.version,
      targetInfo.data.federation_policy
    ]);

    // Create federation link
    await query(`
      INSERT INTO federation.federation_links (
        instance_id, status, initiated_by, requested_at, notes
      ) VALUES ($1, 'pending', 'local', CURRENT_TIMESTAMP, $2)
    `, [instance.rows[0].id, reason]);

    // Send federation request to target
    const localInstance = await query('SELECT * FROM federation.local_instance LIMIT 1');
    const payload = {
      requesting_instance: localInstance.rows[0].domain,
      public_key: localInstance.rows[0].public_key,
      reason: reason,
      contact_email: localInstance.rows[0].admin_contact,
      policies: localInstance.rows[0].federation_policy
    };

    const signature = await signPayload(payload);

    await axios.post(`https://${target_domain}/api/v1/federation/incoming-request`, payload, {
      headers: {
        'X-Signature': signature,
        'X-Instance-Domain': localInstance.rows[0].domain
      }
    });

    res.json({
      success: true,
      message: 'Federation request sent',
      instance: instance.rows[0]
    });
  } catch (error) {
    console.error('Federation request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request federation'
    });
  }
});

// Accept incoming federation request
router.post('/incoming-request', async (req, res) => {
  const { requesting_instance, public_key, reason, policies } = req.body;
  const signature = req.headers['x-signature'] as string;

  // Verify signature
  const isValid = await verifySignature(req.body, signature, public_key);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Store instance info
  const instance = await query(`
    INSERT INTO federation.instances (
      domain, public_key, federation_policy
    ) VALUES ($1, $2, $3)
    ON CONFLICT (domain) DO UPDATE
    SET public_key = EXCLUDED.public_key, last_seen_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [requesting_instance, public_key, policies]);

  // Create pending federation link
  await query(`
    INSERT INTO federation.federation_links (
      instance_id, status, initiated_by, requested_at, notes
    ) VALUES ($1, 'pending', 'remote', CURRENT_TIMESTAMP, $2)
  `, [instance.rows[0].id, reason]);

  res.json({
    success: true,
    message: 'Federation request received and pending approval'
  });
});

// Accept federation (admin action)
router.post('/accept/:instance_id', async (req, res) => {
  const { instance_id } = req.params;

  await query(`
    UPDATE federation.federation_links
    SET status = 'active', accepted_at = CURRENT_TIMESTAMP
    WHERE instance_id = $1
  `, [instance_id]);

  // Notify the requesting instance
  // ... implementation

  res.json({ success: true });
});

// List federated instances
router.get('/list', async (req, res) => {
  const result = await query(`
    SELECT i.*, fl.status, fl.accepted_at
    FROM federation.instances i
    LEFT JOIN federation.federation_links fl ON fl.instance_id = i.id
    ORDER BY fl.accepted_at DESC NULLS LAST
  `);

  res.json({
    success: true,
    instances: result.rows
  });
});

export default router;
```

### Step 6: Activity Processing

```typescript
// src/services/activityProcessor.ts
import { query } from '../database/db';

export async function processInboxActivity(activity: any) {
  switch (activity.type) {
    case 'Create':
      return await handleCreate(activity);
    case 'Update':
      return await handleUpdate(activity);
    case 'Delete':
      return await handleDelete(activity);
    case 'Offer':
      return await handleOffer(activity);
    case 'Accept':
      return await handleAccept(activity);
    default:
      console.log(`Unknown activity type: ${activity.type}`);
  }
}

async function handleCreate(activity: any) {
  if (activity.object.type === 'HelpRequest') {
    // Store federated help request
    await query(`
      INSERT INTO federation.federated_requests (
        federated_id, origin_instance_id, requester_federated_id,
        title, description, category, urgency, location, signature, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (federated_id) DO NOTHING
    `, [
      activity.object.id,
      activity.origin_instance_id,
      activity.actor,
      activity.object.title,
      activity.object.description,
      activity.object.category,
      activity.object.urgency,
      activity.object.location,
      activity.signature,
      activity.object
    ]);
  }
}

async function handleOffer(activity: any) {
  // Handle federated help offer
  // Notify local user that someone from another instance offered help
}

// ... other handlers
```

### Step 7: Docker Configuration

```dockerfile
# services/federation-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3008

CMD ["npm", "start"]
```

Update `docker-compose.yml`:

```yaml
  federation-service:
    build:
      context: ../../services/federation-service
      dockerfile: Dockerfile
    container_name: karmyq-federation-service
    environment:
      NODE_ENV: development
      PORT: 3008
      DATABASE_URL: postgresql://karmyq_user:karmyq_password_dev@postgres:5432/karmyq_db
      INSTANCE_DOMAIN: localhost
      INSTANCE_NAME: KarmyQ Development Instance
    ports:
      - "3008:3008"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ../../services/federation-service/src:/app/src
      - ../../packages/shared:/app/shared
    networks:
      - karmyq-network
    command: npm run dev
```

## Testing Federation

### Local Testing with Two Instances

1. **Set up Instance A (Port 3000)**
```bash
INSTANCE_DOMAIN=instance-a.localhost docker-compose up
```

2. **Set up Instance B (Port 4000)**
```bash
INSTANCE_DOMAIN=instance-b.localhost PORT_OFFSET=1000 docker-compose -f docker-compose.instance-b.yml up
```

3. **Request Federation**
```bash
curl -X POST http://localhost:3008/api/v1/federation/request \
  -H "Content-Type: application/json" \
  -d '{
    "target_domain": "instance-b.localhost",
    "reason": "Testing federation between local instances"
  }'
```

## Next Steps

1. Implement inbox/outbox workers
2. Add WebSocket support for real-time federated updates
3. Build admin UI for federation management
4. Add rate limiting and spam prevention
5. Implement reputation attestation verification
6. Create end-to-end tests

## Security Considerations

- **Encrypt private keys** at rest in the database
- **Rate limit** federation requests to prevent DoS
- **Validate all signatures** before processing activities
- **Sanitize federated content** to prevent XSS
- **Implement backpressure** for inbox processing
- **Monitor federation bandwidth** and storage

## Resources

- [ActivityPub Specification](https://www.w3.org/TR/activitypub/)
- [HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [Mastodon Federation Guide](https://docs.joinmastodon.org/spec/activitypub/)
