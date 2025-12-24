# Database Migrations

## How to Apply Migrations

```bash
# Apply a specific migration
cat infrastructure/postgres/migrations/XXX_migration_name.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Apply all migrations (in order)
for file in infrastructure/postgres/migrations/*.sql; do
  echo "Applying $file..."
  cat "$file" | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
done
```

## Migration History

| # | Name | Date | Description | Status |
|---|------|------|-------------|--------|
| 009 | polymorphic_requests | 2024-12-24 | Add request_type, payload, requirements for Everything App | ⏳ Pending |

## Migration 009: Polymorphic Requests

**Purpose:** Enable "Everything App" transformation by adding polymorphic data model to help_requests table.

**Changes:**
- Add `request_type` enum column (generic, ride, borrow, service, event)
- Add `payload` JSONB column for type-specific data
- Add `requirements` JSONB column for type-specific requirements
- Add GIN index on `payload` for fast JSON queries
- Add B-tree index on `request_type` for filtering

**Backward Compatibility:** ✅ All existing requests default to 'generic' type with empty payload

**To Apply:**
```bash
cat infrastructure/postgres/migrations/009_polymorphic_requests.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

**To Verify:**
```sql
-- Check column exists
\d requests.help_requests

-- Check all requests are generic
SELECT request_type, COUNT(*) FROM requests.help_requests GROUP BY request_type;

-- Check indexes
\di requests.*
```
