# Database Migration Strategy

**Last Updated**: 2026-01-09

## Overview

Database schema changes are managed through:
1. **Migration files** - For existing environments (dev, staging, prod)
2. **init.sql updates** - For fresh installs

## Applying Migrations

### Development (Local)
```bash
# Apply single migration
cat infrastructure/postgres/migrations/010_user_privacy_settings.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Verify
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db -c "\d auth.user_privacy_settings"
```

### Staging
```bash
# SSH to staging server
ssh karmyq@staging.karmyq.com

# Navigate to project
cd /home/karmyq/karmyq

# Apply migration
cat infrastructure/postgres/migrations/010_user_privacy_settings.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_staging
```

### Production
```bash
# SSH to production server
ssh ubuntu@karmyq.com

# Navigate to project
cd /home/ubuntu/karmyq

# Apply migration
cat infrastructure/postgres/migrations/010_user_privacy_settings.sql | docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod
```

## Migration Checklist

Before creating a migration:
- [ ] Is this backward compatible?
- [ ] Does init.sql need updating? (for fresh installs)
- [ ] Are there default values for new columns?
- [ ] Do indexes need to be added?
- [ ] Is there a rollback strategy?

After creating migration:
- [ ] Test on local dev environment
- [ ] Update migration history in migrations/README.md
- [ ] Document any application code changes needed
- [ ] Add to deployment checklist if needed

## Current Migrations

| # | Name | Date | Description | Applied |
|---|------|------|-------------|---------|
| 001 | federation_schema | 2024-11 | Federation support | ❓ |
| 001 | ephemeral_data_and_decay | 2026-01-02 | TTL and reputation decay | ❓ |
| 009 | polymorphic_requests | 2024-12-24 | Everything App data model | ❓ |
| 009 | social_graph | 2024-12-30 | Trust paths and invitations | ❓ |
| 010 | user_privacy_settings | 2026-01-09 | Privacy settings (karma display) | ⏳ Pending |

## Migration 010: User Privacy Settings

**Purpose**: Add privacy controls for minimal karma measurement (Fractal Karma & Trust philosophy)

**Changes**:
- Create `auth.user_privacy_settings` table
- Add `show_my_karma_to_me` boolean column (default FALSE)
- Add index on user_id

**Backward Compatibility**: ✅ New table, no breaking changes

**Application Changes Needed**:
- Auth service: Add GET/PATCH `/users/me/settings` endpoints
- Frontend: Add privacy settings page
- Frontend: Conditionally display karma on profile

**To Apply**:
```bash
cat infrastructure/postgres/migrations/010_user_privacy_settings.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

**To Verify**:
```sql
-- Check table exists
\d auth.user_privacy_settings

-- Check no rows yet (new table)
SELECT COUNT(*) FROM auth.user_privacy_settings;

-- Test inserting a setting
INSERT INTO auth.user_privacy_settings (user_id, show_my_karma_to_me)
SELECT id, TRUE FROM auth.users LIMIT 1;
```

**To Rollback** (if needed):
```sql
DROP TABLE IF EXISTS auth.user_privacy_settings;
```
