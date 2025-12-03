# Test Utility Scripts

Utility scripts for managing test data and test infrastructure.

## cleanup-test-data.ts

Cleans up orphaned test data from the database. Test users are identified by the `@test.karmyq.com` email domain.

### When to Use

Run this script when:
- Tests fail or are interrupted before cleanup runs
- You see bad/duplicate test data in the database
- You want to start with a clean database for testing

### Usage

```bash
cd tests

# Interactive mode (asks for confirmation)
npm run cleanup-test-data

# Preview mode (shows what would be deleted without deleting)
npm run cleanup-test-data:dry-run

# Force mode (skips confirmation, useful for CI/CD)
npm run cleanup-test-data:force
```

### What It Does

1. **Scans** - Finds all users with `@test.karmyq.com` emails
2. **Analyzes** - Counts associated data across all tables
3. **Reports** - Shows preview of what will be deleted
4. **Confirms** - Asks for confirmation (unless --force)
5. **Deletes** - Removes data in correct order (respects FK constraints)
6. **Reports** - Shows summary of deleted records

### Data Deletion Order

The script deletes in this order to respect foreign key constraints:

1. messaging.messages
2. notifications.notifications
3. reputation.karma_records
4. reputation.trust_scores
5. requests.matches
6. requests.help_requests
7. communities.norms
8. communities.members
9. communities.communities
10. auth.users

### Safety Features

- ✅ Transactional (ROLLBACK on error)
- ✅ Confirmation prompt (unless --force)
- ✅ Dry-run mode for testing
- ✅ Detailed logging at each step
- ✅ Only targets @test.karmyq.com emails

### Example Output

```
🔍 Scanning for test data...

Found 31 test users:

Recent test users:
  - Alice MultiCommunity (alice-multi-1764730524518-1@test.karmyq.com)
    Created: Wed Dec 03 2025 02:55:25 GMT-0800 (Pacific Standard Time)
  - Bob Helper (bob-multi-1764709330845-2@test.karmyq.com)
    Created: Tue Dec 02 2025 21:02:10 GMT-0800 (Pacific Standard Time)
  ... and 29 more

Associated data to be deleted:
  - 0 communities
  - 0 memberships
  - 47 help requests
  - 6 matches
  - 0 karma records
  - 8 notifications
  - 0 messages

⚠️  Are you sure you want to delete all this test data? (y/N):
```

### Configuration

The script uses these environment variables (with sensible defaults):

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: karmyq_db)
- `DB_USER` - Database user (default: karmyq_user)
- `DB_PASSWORD` - Database password (default: karmyq_password_dev)

### Troubleshooting

**Error: "password authentication failed"**
- Check that PostgreSQL is running: `docker-compose ps`
- Verify DB_PASSWORD matches docker-compose.yml

**Error: "column does not exist"**
- Database schema may have changed
- Update the queries in cleanup-test-data.ts

**Nothing to delete**
- Great! Your database is clean
- Tests are properly cleaning up after themselves

## Best Practices

1. **Run cleanup after failed test runs** - Prevents test data accumulation
2. **Use dry-run first** - Preview what will be deleted before committing
3. **Schedule regular cleanup** - Consider adding to CI/CD pipeline
4. **Check the output** - Verify expected data is being cleaned

## Future Scripts

Potential additions to this directory:
- `seed-test-data.ts` - Create consistent test fixtures
- `verify-rls.ts` - Validate Row-Level Security policies
- `benchmark-queries.ts` - Performance testing for database queries
