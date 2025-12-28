# Social Graph Test Data

This document describes the test data setup for testing the social graph and trust path features.

## Overview

The test data creates a realistic invitation network with known degrees of separation, allowing you to verify:
- Path computation algorithms (BFS)
- Trust path visualization
- Invitation tracking
- Social proximity calculations
- Cache behavior

## Loading Test Data

### Windows
```bash
scripts\seed-test-data.bat
```

### Mac/Linux
```bash
chmod +x scripts/seed-test-data.sh
./scripts/seed-test-data.sh
```

## Test Community

**Community ID**: `11111111-1111-1111-1111-111111111111`
**Name**: Test Community
**Admin**: Alice Admin

## Test Users

| User | ID | Email | Role | Karma |
|------|-----|-------|------|-------|
| Alice Admin | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | alice@test.karmyq | Admin | 100 |
| Bob Builder | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | bob@test.karmyq | Member | 85 |
| Charlie Chen | `cccccccc-cccc-cccc-cccc-cccccccccccc` | charlie@test.karmyq | Member | 70 |
| Dave Davis | `dddddddd-dddd-dddd-dddd-dddddddddddd` | dave@test.karmyq | Member | 60 |
| Eve Evans | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | eve@test.karmyq | Member | 50 |
| Frank Foster | `ffffffff-ffff-ffff-ffff-ffffffffffff` | frank@test.karmyq | Member | 90 |
| Grace Garcia | `99999999-9999-9999-9999-999999999999` | grace@test.karmyq | Member | 75 |
| Henry Harris | `hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh` | henry@test.karmyq | Member | 80 |

## Invitation Network

```
Alice (Admin)
├─ Bob (1°)
│  └─ Charlie (2° from Alice)
│     └─ Dave (3° from Alice)
│        └─ Eve (4° from Alice)
├─ Frank (1°)
│  └─ Grace (2° from Alice)
└─ Henry (1°)
```

### Invitation Codes

| Code | Inviter | Invitee | Status |
|------|---------|---------|--------|
| KARMYQ-ALICE-2024-0001 | Alice | Bob | Accepted |
| KARMYQ-BOB-2024-0001 | Bob | Charlie | Accepted |
| KARMYQ-CHARLIE-2024-0001 | Charlie | Dave | Accepted |
| KARMYQ-DAVE-2024-0001 | Dave | Eve | Accepted |
| KARMYQ-ALICE-2024-0002 | Alice | Frank | Accepted |
| KARMYQ-FRANK-2024-0001 | Frank | Grace | Accepted |
| KARMYQ-ALICE-2024-0003 | Alice | Henry | Accepted |

## Expected Path Calculations

### From Alice's Perspective

| Target | Degrees | Path |
|--------|---------|------|
| Bob | 1° | Alice → Bob |
| Frank | 1° | Alice → Frank |
| Henry | 1° | Alice → Henry |
| Charlie | 2° | Alice → Bob → Charlie |
| Grace | 2° | Alice → Frank → Grace |
| Dave | 3° | Alice → Bob → Charlie → Dave |
| Eve | 4° | Alice → Bob → Charlie → Dave → Eve |

### From Bob's Perspective

| Target | Degrees | Path |
|--------|---------|------|
| Alice | 1° | Bob → Alice |
| Charlie | 1° | Bob → Charlie |
| Frank | 2° | Bob → Alice → Frank |
| Henry | 2° | Bob → Alice → Henry |
| Dave | 2° | Bob → Charlie → Dave |
| Grace | 3° | Bob → Alice → Frank → Grace |
| Eve | 3° | Bob → Charlie → Dave → Eve |

### Edge Cases

- **Eve to Henry**: Should return null (beyond 4 degrees)
- **Self-paths**: e.g., Alice to Alice should return error 400
- **Unconnected users**: Create a new user not in the invitation chain

## Testing Scenarios

### 1. Path Computation

```bash
# Test 1-degree connection (Alice to Bob)
curl http://localhost:3010/paths/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "X-Community-ID: 11111111-1111-1111-1111-111111111111"

# Expected: degrees_of_separation: 1
```

### 2. Path Caching

```bash
# First request (uncached)
# cached: false

# Second request (cached)
# cached: true
```

### 3. Batch Path Computation

```bash
curl http://localhost:3010/paths/batch \
  -X POST \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "X-Community-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
    "target_user_ids": [
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "dddddddd-dddd-dddd-dddd-dddddddddddd"
    ]
  }'

# Expected: Array with 1°, 2°, 3° respectively
```

### 4. Invitation History

```bash
curl http://localhost:3010/invitations \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "X-Community-ID: 11111111-1111-1111-1111-111111111111"

# Expected:
# - sent: [Bob, Frank, Henry]
# - received: null (Alice is root)
```

### 5. Inviter Statistics

```bash
curl http://localhost:3010/invitations/stats \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "X-Community-ID: 11111111-1111-1111-1111-111111111111"

# Expected:
# - total_invitations_sent: 3
# - total_invitations_accepted: 3
# - acceptance_rate: 1.0
```

## Generating Test JWT Tokens

```javascript
// Alice (Admin)
const jwt = require('jsonwebtoken');
const aliceToken = jwt.sign(
  {
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    communityMemberships: [{
      communityId: '11111111-1111-1111-1111-111111111111',
      role: 'admin'
    }]
  },
  'dev_jwt_secret_change_in_production'
);
console.log('Alice Token:', aliceToken);

// Bob (Member)
const bobToken = jwt.sign(
  {
    userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    communityMemberships: [{
      communityId: '11111111-1111-1111-1111-111111111111',
      role: 'member'
    }]
  },
  'dev_jwt_secret_change_in_production'
);
console.log('Bob Token:', bobToken);
```

## Cleanup

To remove test data:

```sql
DELETE FROM auth.social_distances WHERE community_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM auth.user_invitations WHERE community_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM auth.inviter_stats WHERE community_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM communities.members WHERE community_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM communities.communities WHERE id = '11111111-1111-1111-1111-111111111111';
DELETE FROM auth.users WHERE email LIKE '%@test.karmyq';
```

## Frontend Testing

1. **Login as Alice**: Use Alice's JWT token in localStorage
2. **Navigate to `/invitations`**: Should see 3 sent invitations (Bob, Frank, Henry)
3. **Generate new code**: Click "Generate Code" button
4. **View trust paths**: Navigate to feed, should see trust path badges on requests from other users
5. **Check invitation history**: Should display invitation chain with karma scores

## Integration Test Usage

The integration test suite (`tests/integration/social-graph.test.ts`) automatically creates and cleans up its own test data. However, you can use this seed data for manual testing and debugging.

## Notes

- All test users have the same password hash for simplicity
- Karma values are assigned to create meaningful trust scores
- Invitation dates are staggered to simulate realistic timeline
- The network structure allows testing all degree levels (1-4)
- Cache expiration is set to 7 days by default

## Troubleshooting

### "Duplicate key value violates unique constraint"

The seed script uses `ON CONFLICT DO NOTHING` to allow re-running. If you see this error, the data may already exist. Run cleanup SQL first.

### "relation does not exist"

Ensure migrations have been run:
```bash
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db < infrastructure/postgres/init.sql
```

### JWT token not working

Ensure JWT_SECRET matches between:
- Your JWT generation code
- The auth service environment variable
- The social-graph-service environment variable
