# Simulation Service Deployment Guide

**Last Updated**: 2026-03-10
**Status**: Sprint 21 — Organic growth engine active

---

## Overview

The simulation service creates a living demo environment by simulating realistic user activity. Users are registered organically (10-15/day by default) — no bulk seeding scripts required.

**How it works**:
1. On startup, 5 named founders are registered if they don't exist yet
2. Ongoing: new users join at a configurable rate via the real `/auth/register` API
3. All sim user emails use `@test.karmyq.com` domain
4. Simulation picks random sim users and runs sessions (browse, request, offer, complete, etc.)

---

## Prerequisites

- Node.js 18+
- Access to Karmyq production API (`API_BASE_URL`)
- Direct DB access (`DATABASE_URL`) for JWT token generation
- PM2 for process management

---

## Environment Variables

Create `.env` (or set in pm2 ecosystem config):

```bash
# Required
API_BASE_URL=https://karmyq.com/api
DATABASE_URL=postgresql://karmyq_prod:password@localhost:5432/karmyq_prod
JWT_SECRET=your-jwt-secret
SIMULATION_ENABLED=true

# Growth control (optional — defaults shown)
GROWTH_USERS_PER_DAY=12       # New registrations per day
GROWTH_MAX_USERS=500          # Stop growing after this many sim users
GROWTH_EMAIL_DOMAIN=test.karmyq.com
GROWTH_USER_PASSWORD=password123

# Concurrency (optional)
MIN_CONCURRENT_SESSIONS=5
MAX_CONCURRENT_SESSIONS=20
```

**To slow down growth** (after initial ramp-up):
```bash
GROWTH_USERS_PER_DAY=3   # ~3 new users/day
GROWTH_MAX_USERS=200     # Cap the pool
```

---

## First-Time Setup

No scripts to run. Just start the simulation — it bootstraps itself:

```bash
pm2 start ecosystem.config.js
pm2 logs karmyq-simulation
```

On first start you'll see:
```
🌱 Checking founder accounts...
🌱 Created founder: Maria Reyes <maria.reyes@test.karmyq.com>
...
🌱 Founders ready. Total sim users: 5
🚀 Starting synthetic user simulation...
```

---

## Wiping and Reseeding

To wipe all sim data and start fresh:

```bash
# 1. Delete sim users (cascades to their requests, matches, communities)
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod << 'EOF'
DELETE FROM requests.matches
  WHERE requester_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com')
     OR responder_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM requests.help_requests
  WHERE requester_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM community.members
  WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM community.communities
  WHERE created_by IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com';
EOF

# 2. Restart — founders will be recreated automatically
pm2 restart karmyq-simulation --update-env
```

---

## Monitoring

```bash
pm2 logs karmyq-simulation --lines 100
pm2 monit
```

Key log lines to watch:
- `[growth] Registered new user: ...` — organic growth working
- `[maria.reyes@...] Running Community Builder session` — sim users active
- `[growth] Day registrations: 8/12` — daily growth counter

---

## Stopping Growth (Maintenance Mode)

```bash
# Set env var and restart
pm2 stop karmyq-simulation
# Edit ecosystem.config.js: GROWTH_USERS_PER_DAY=0
pm2 start ecosystem.config.js
```
