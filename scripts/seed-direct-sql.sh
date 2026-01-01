#!/bin/bash
# Seed production using direct SQL (bypasses rate limits)

echo "========================================"
echo "Production Seeding (Direct SQL)"
echo "========================================"
echo ""
echo "Method: Direct database INSERT (bypasses API rate limits)"
echo "Target: 2000 users, 200 communities"
echo "Duration: ~2-3 minutes"
echo ""

cd tests

# Generate SQL file
echo "Generating realistic test data SQL..."
npm run generate-test-data

if [ ! -f "fixtures/realistic-test-data.sql" ]; then
    echo "ERROR: SQL file not generated"
    exit 1
fi

echo "✓ SQL generated: fixtures/realistic-test-data.sql"
echo ""

# Get file size
FILE_SIZE=$(wc -l < fixtures/realistic-test-data.sql)
echo "SQL file: $FILE_SIZE lines"
echo ""

echo "Loading data into database..."
cat fixtures/realistic-test-data.sql | docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Data loaded successfully!"
    echo ""
    echo "Verification:"
    echo ""

    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod <<EOF
SELECT 'Communities:' as metric, COUNT(*)::text as count FROM communities.communities
UNION ALL
SELECT 'Users:', COUNT(*)::text FROM auth.users
UNION ALL
SELECT 'Requests:', COUNT(*)::text FROM requests.help_requests
UNION ALL
SELECT 'Matches:', COUNT(*)::text FROM requests.matches
UNION ALL
SELECT 'Messages:', COUNT(*)::text FROM messaging.messages
UNION ALL
SELECT 'Karma records:', COUNT(*)::text FROM reputation.karma_records;
EOF

    echo ""
    echo "Test any user:"
    echo "  Emails: user{1-2000}@example.com"
    echo "  Password: (check generate-realistic-data.ts for default)"
else
    echo "❌ Data load failed"
    exit 1
fi
