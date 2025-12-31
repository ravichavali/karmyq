# Rollback Guide

## Automated Rollback
The fastest way to rollback is using the provided script.

```bash
# Rollback production to the previous commit
./infrastructure/scripts/rollback.sh production

# Rollback to a specific commit hash
./infrastructure/scripts/rollback.sh production a1b2c3d
```

## Manual Rollback Procedure

If the script fails, follow these steps:

### 1. Revert Code
```bash
git reset --hard HEAD^  # Or specific commit
```

### 2. Rebuild Containers
```bash
docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --build --force-recreate
```

### 3. Database Rollback
If a database migration caused the issue:
1.  Identify the migration ID to rollback to.
2.  Use the service's migration tool (if available) or restore from backup.

**Restoring from Backup**:
```bash
# Stop services
docker compose down

# Restore (WARNING: Overwrites current DB)
zcat backups/karmyq_db_20251230_120000.sql.gz | docker exec -i karmyq-postgres psql -U karmyq_user karmyq_db

# Start services
docker compose up -d
```
