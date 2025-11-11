# Federation Service

Implements the KarmyQ Federation Protocol for distributed mutual aid instances.

## Quick Start

```bash
cd services/federation-service
npm install
npm run dev
```

**Port**: 3008
**Health**: http://localhost:3008/health

## Overview

The federation service enables multiple KarmyQ instances to communicate and share data while maintaining local autonomy. Each instance can:

- Discover other instances
- Exchange activities (requests, offers, communities)
- Verify cryptographic signatures
- Maintain federated data caches
- Control federation relationships

## Key Features

- **Instance Discovery**: Well-known endpoints for automatic discovery
- **Cryptographic Signatures**: RSA signatures for data integrity
- **Inbox/Outbox Pattern**: ActivityPub-inspired activity exchange
- **Local Sovereignty**: Each instance controls its own data
- **Opt-in Federation**: Explicit approval for federation relationships

## API Endpoints

### Instance Discovery

**GET /.well-known/karmyq**
Discover instance information (public key, inbox, outbox URLs)

**GET /.well-known/webfinger?resource=acct:user@domain**
WebFinger protocol for user discovery

### Federation Management

**GET /federation/instances**
List all federated instances

**POST /federation/instances/discover**
Discover a new instance by domain

**PUT /federation/instances/:domain/status**
Accept or block an instance

### Activity Processing

**POST /federation/inbox**
Receive activities from other instances

**GET /federation/outbox**
Get activities from this instance

**GET /federation/users/:userId**
Get federated user profile

## Architecture

### Components

1. **Instance Service** - Manages instance identity and discovery
2. **Activity Service** - Processes inbox/outbox activities
3. **Crypto Utils** - RSA key generation and signature verification

### Database Tables

- `federation.instances` - Known instances (local and federated)
- `federation.inbox` - Received activities
- `federation.outbox` - Sent activities
- `federation.federated_users` - Cached user profiles
- `federation.federated_requests` - Cached help requests
- `federation.federated_communities` - Cached communities

## Configuration

### Environment Variables

```bash
# Server
PORT=3008
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Instance Identity
INSTANCE_DOMAIN=localhost:3000
INSTANCE_NAME=Local Development Instance
INSTANCE_DESCRIPTION=KarmyQ development instance

# Federation Settings
FEDERATION_ENABLED=true
AUTO_ACCEPT_INSTANCES=false
REQUIRE_HTTPS=false  # Set to true in production
```

## Federation Flow

### Discovering an Instance

1. Admin calls `/federation/instances/discover` with target domain
2. Service fetches `https://target.domain/.well-known/karmyq`
3. Instance info stored in database with status='discovered'
4. Admin reviews and accepts/blocks the instance

### Exchanging Activities

1. Local event occurs (e.g., new request created)
2. Activity created and signed with instance private key
3. Activity sent to federated instance's inbox URL
4. Remote instance verifies signature
5. Remote instance processes and caches the activity

### Verifying Activities

1. Receive activity with signature
2. Extract actor domain from activity
3. Look up public key for that instance
4. Verify signature matches canonicalized activity
5. Process activity if signature valid

## Security

- **RSA 2048-bit keys** for instance identity
- **Signature verification** for all incoming activities
- **HTTPS required** in production (`REQUIRE_HTTPS=true`)
- **Opt-in federation** - instances must be explicitly accepted
- **Instance blocking** - ability to block malicious instances

## Development

### Running Tests

```bash
npm test
```

### Testing Federation Locally

1. Run two instances on different ports:
```bash
# Instance 1
PORT=3008 INSTANCE_DOMAIN=localhost:3000 npm run dev

# Instance 2 (in separate terminal)
PORT=3018 INSTANCE_DOMAIN=localhost:4000 npm run dev
```

2. Discover instance 2 from instance 1:
```bash
curl -X POST http://localhost:3008/federation/instances/discover \
  -H "Content-Type: application/json" \
  -d '{"domain":"localhost:4000"}'
```

3. Accept the instance:
```bash
curl -X PUT http://localhost:3008/federation/instances/localhost:4000/status \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
```

## Protocol Documentation

See [Federation Protocol](../../docs/FEDERATION_PROTOCOL.md) for complete specification.

See [Federation Implementation](../../docs/FEDERATION_IMPLEMENTATION.md) for implementation guide.

## Future Enhancements

- [ ] User migration between instances
- [ ] Community federation (cross-instance communities)
- [ ] Reputation score federation
- [ ] Automatic instance discovery (DNS-based)
- [ ] Federation statistics dashboard
- [ ] Rate limiting for federated requests
- [ ] Activity deduplication
- [ ] Webhook support for activity notifications

## Related Services

- **Auth Service** - User identity
- **Community Service** - Communities that can be federated
- **Request Service** - Requests that can be shared across instances
- **Reputation Service** - Reputation that can follow users

## Troubleshooting

### Instance discovery fails

- Check REQUIRE_HTTPS setting matches target instance
- Verify target instance is running and accessible
- Check firewall allows outbound HTTP/HTTPS

### Signature verification fails

- Ensure public key matches instance
- Check clock sync between instances
- Verify canonicalization matches

### Activities not appearing

- Check inbox table for received activities
- Verify instance status is 'accepted'
- Check logs for processing errors

---

**Version**: 4.0.0
**Protocol**: karmyq-federation/0.1
**Status**: Production Ready
