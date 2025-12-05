# Karmyq v6.0 Migration Guide

**From**: v5.1.0
**To**: v6.0.0
**Date**: 2025-12-05

---

## Overview

Version 6.0 is a **documentation and organization release** with no breaking API changes. All services remain functionally identical to v5.1.0.

### What Changed

✅ **Documentation** - Consolidated, reorganized, and standardized
✅ **Architecture Docs** - Single comprehensive architecture document
✅ **Service Docs** - All services have complete CONTEXT.md
✅ **Code Clarity** - Matching-service status clarified
✅ **File Organization** - Historical docs archived

❌ **No API Changes** - All endpoints remain the same
❌ **No Database Changes** - Schema unchanged
❌ **No Breaking Changes** - 100% backward compatible

---

## For Users (No Action Required)

**Frontend users**: No changes needed. The web app and mobile app work identically.

**API consumers**: All endpoints, request/response formats unchanged. No client updates required.

---

## For Developers

### Quick Migration (5 minutes)

```bash
# 1. Pull latest code
git pull origin master

# 2. No dependency changes - skip npm install unless you want to

# 3. Services work identically
docker-compose up -d

# 4. Read new docs (optional but recommended)
cat docs/README.md
cat docs/architecture/ARCHITECTURE.md
```

**That's it!** v6.0 is a drop-in replacement.

---

## Documentation Changes

### What Moved

#### Archived Documentation

Historical docs moved to `docs/archive/`:

```
docs/archive/
├── session-summaries/
│   ├── SESSION_SUMMARY_V5.2.md
│   ├── SESSION_SUMMARY_V5.3.md
│   └── SESSION_SUMMARY_V5_4.md
├── releases/
│   ├── FIXES_V5.3.1.md
│   ├── TEST_FIXES_DETAILED.md
│   ├── TEST_RESULTS_BASELINE.md
│   └── TESTING_CHECKLIST_V5.3.md
└── planning/
    ├── DASHBOARD_REDESIGN_V5.3.md
    ├── INLINE_MESSAGING_PLAN.md
    ├── MOBILE_APP_*.md
    └── REFACTOR_REQUEST_ARCHITECTURE_V5.4.md
```

**Why archived?**
- Historical development notes (superseded by current docs)
- Version-specific fixes (no longer relevant)
- Completed feature planning (now documented in requirements)

**Can I still access them?**
Yes! All files preserved in `docs/archive/` and git history.

#### Renamed Documentation

- `PHASE3_EPHEMERAL_DATA_DECAY.md` → `guides/EPHEMERAL_DATA_GUIDE.md`
  - Reason: "Phase 3" is internal, users don't care about phases

### What's New

#### Architecture Documentation

**Old** (3 separate, outdated files):
- `docs/architecture/overview.md`
- `docs/architecture/review.md`
- `docs/architecture/proposed-structure.md`

**New** (1 comprehensive, current file):
- `docs/architecture/ARCHITECTURE.md` (500+ lines, everything you need)
- `docs/architecture/SERVICE_DEPENDENCIES.md` (dependency graph, failure modes)

#### Service Documentation

**New**:
- `services/cleanup-service/README.md` (was missing)
- `services/matching-service/README.md` (clarified as placeholder)

**Updated**:
- All CONTEXT.md files verified and consistent

#### New Guides

- `docs/V6_ARCHITECTURAL_REVIEW.md` - Architectural review that led to v6.0
- `docs/V6_MIGRATION_GUIDE.md` - This document

---

## Code Changes

### Clarifications (Not Breaking Changes)

#### Matching Service

**What changed:**
- `services/matching-service/README.md` now clearly states it's a placeholder for future ML-powered matching (v7.0+)

**Current implementation:**
- Matching functionality is in **request-service** (hasn't moved, just documented)
- Routes: `POST /requests/:id/offers`, `POST /offers/:id/accept`, `PUT /matches/:id/complete`

**Action required:**
- None - matching still works the same way

**Future:**
- v7.0+ will introduce dedicated matching service with AI recommendations

### Service Status

All 8 services confirmed production-ready:

| Service | v5.1.0 Status | v6.0 Status | Action |
|---------|---------------|-------------|--------|
| auth-service | ✅ Production | ✅ Production | None |
| community-service | ✅ Production | ✅ Production | None |
| request-service | ✅ Production | ✅ Production | None |
| reputation-service | ✅ Production | ✅ Production | None |
| notification-service | ✅ Production | ✅ Production | None |
| messaging-service | ✅ Production | ✅ Production | None |
| feed-service | ✅ Production | ✅ Production | None |
| cleanup-service | ✅ Production | ✅ Production | None |
| matching-service | ⚠️ Status unclear | 🚧 Future (v7.0+) | None - placeholder |

---

## Testing

### Verify Your Migration

```bash
# 1. Start all services
docker-compose up -d

# 2. Check all services are healthy
curl http://localhost:3001/health  # auth-service
curl http://localhost:3002/health  # community-service
curl http://localhost:3003/health  # request-service
curl http://localhost:3004/health  # reputation-service
curl http://localhost:3005/health  # notification-service
curl http://localhost:3006/health  # messaging-service
curl http://localhost:3007/health  # feed-service
curl http://localhost:3008/health  # cleanup-service

# 3. Run test suite (optional)
cd tests && npm test

# 4. Access frontend
open http://localhost:3000
```

**Expected result:**
- All 8 services return `{"status":"healthy"}`
- Frontend works identically to v5.1.0
- All tests pass

---

## Breaking Changes

**None!** v6.0 is 100% backward compatible with v5.1.0.

---

## New Features

**None.** v6.0 is a documentation and organization release. All features from v5.1.0 remain unchanged.

For new features, see the roadmap in [PROJECT_STATUS.md](PROJECT_STATUS.md).

---

## API Compatibility

### Endpoints (Unchanged)

All endpoints work identically:

```bash
# Auth
POST /register
POST /login
GET /verify
GET /users/:id
PUT /users/:id

# Community
GET /communities
POST /communities
GET /communities/:id
PUT /communities/:id
POST /communities/:id/join
POST /communities/:id/leave
GET /communities/:id/members
POST /communities/:id/norms
GET /communities/:id/stats

# Request
GET /requests
POST /requests
GET /requests/:id
PUT /requests/:id
DELETE /requests/:id
POST /requests/:id/offers
POST /offers/:id/accept
PUT /matches/:id/complete

# Reputation
GET /karma
GET /karma/history
GET /trust-score
GET /leaderboard

# Notification
GET /notifications
GET /notifications/stream/:userId  # SSE
PUT /notifications/:id/read
DELETE /notifications/:id
PUT /notifications/preferences

# Messaging
GET /conversations
POST /conversations
GET /conversations/:id/messages
POST /conversations/:id/messages

# Feed
GET /feed

# Cleanup (manual triggers)
POST /jobs/mark-expired
POST /jobs/hard-delete
POST /jobs/update-decay
GET /jobs/decay-report
```

### Response Formats (Unchanged)

All responses use the same format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Errors:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Database Schema

### Schema Version: Unchanged

v6.0 uses the **same database schema** as v5.1.0.

**No migrations needed.**

### Schemas (7)

1. `auth` - Users
2. `community` - Communities, memberships, norms
3. `requests` - Help requests, offers, matches
4. `reputation` - Karma, trust scores
5. `notifications` - Notifications, preferences
6. `messaging` - Conversations, messages
7. `feed` - Activity feed

---

## Environment Variables

### No Changes

All environment variables remain the same:

```bash
# Server
PORT=3001  # (varies per service)
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d

# Logging
LOG_LEVEL=info
```

---

## Docker Compose

### No Changes

`docker-compose.yml` unchanged. All services use same configuration.

```bash
# Start all services (same command)
docker-compose up -d

# View logs (same command)
docker-compose logs -f

# Stop all services (same command)
docker-compose down
```

---

## Known Issues

### Carried Over from v5.1.0

These issues exist in both v5.1.0 and v6.0:

1. **SSE No Authentication** - Notification SSE endpoint has no auth (userId in URL only)
2. **No Refresh Tokens** - JWT expires but no rotation mechanism
3. **Stats Tab Refetch** - Stats don't persist after navigation (minor UX issue)

See [INITIAL_BACKLOG_ISSUES.md](INITIAL_BACKLOG_ISSUES.md) for planned fixes.

### New in v6.0

**None.** v6.0 introduces no new issues.

---

## Rollback Instructions

### If You Need to Revert to v5.1.0

```bash
# 1. Find v5.1.0 commit
git log --oneline | grep "5.1.0"

# 2. Checkout v5.1.0
git checkout <v5.1.0-commit-hash>

# 3. Restart services
docker-compose down
docker-compose up -d
```

**Note**: Since v6.0 has no database changes, rollback is instant with no data loss.

---

## Recommended Actions

### For All Developers

1. ✅ **Read** [docs/README.md](README.md) - Updated documentation index
2. ✅ **Bookmark** [docs/architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - Complete architecture reference
3. ✅ **Review** [docs/architecture/SERVICE_DEPENDENCIES.md](architecture/SERVICE_DEPENDENCIES.md) - Understand service relationships

### For New Developers

1. Start with [GETTING_STARTED.md](GETTING_STARTED.md)
2. Read [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
3. Explore service CONTEXT.md files in `services/{service-name}/CONTEXT.md`

### For Operations/DevOps

1. Review [V6_ARCHITECTURAL_REVIEW.md](V6_ARCHITECTURAL_REVIEW.md) - Understand v6.0 changes
2. No deployment changes needed - same infrastructure

---

## Upgrade Checklist

- [ ] Pull latest code: `git pull origin master`
- [ ] Verify all 8 services start: `docker-compose up -d`
- [ ] Check health endpoints (see Testing section)
- [ ] (Optional) Run test suite: `cd tests && npm test`
- [ ] Read new docs: `docs/README.md`, `docs/architecture/ARCHITECTURE.md`
- [ ] Update your bookmarks to new documentation structure

---

## Questions?

### Where did X document go?

Check `docs/archive/README.md` for full list of archived docs and reasons.

### Why was this just a documentation release?

v6.0 focused on **developer experience**:
- Easier onboarding for new developers
- Clearer service boundaries
- Better architecture understanding
- Foundation for future features

Next release (v6.1+) will include new features.

### When will matching-service be implemented?

Planned for v7.0. See [FR-004: Matching System](requirements/functional/FR-004-matching.md) for details.

### Can I skip v6.0 and stay on v5.1.0?

Yes! v6.0 is purely documentation improvements. However, v6.0 documentation is much better for understanding the codebase.

---

## What's Next?

### v6.1 (Planned)

- Admin UI for community settings
- TTL configuration UI
- Decay configuration UI
- Activity tracking configuration

### v7.0 (Planned)

- Intelligent matching service (ML-powered)
- Automatic helper suggestions
- Match success prediction

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for complete roadmap.

---

## Support

- **Documentation Issues**: Open issue on GitHub
- **Migration Questions**: Check this guide first, then open issue
- **Bugs**: Include version (v6.0) and steps to reproduce

---

**Version**: 6.0.0
**Release Date**: 2025-12-05
**Backward Compatible**: ✅ Yes (100%)
**Database Migration**: ❌ Not required
**API Changes**: ❌ None
**Breaking Changes**: ❌ None
