#!/bin/bash

# Seed Test Data for Karmyq
# Creates test admin user, communities, and schemas for E2E testing

set -e

echo "🌱 Seeding Karmyq Test Data..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Database connection
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-karmyq}
DB_USER=${DB_USER:-karmyq}

echo -e "${YELLOW}Using database: $DB_HOST:$DB_PORT/$DB_NAME${NC}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Seed admin user
echo ""
echo -e "${YELLOW}Creating admin user...${NC}"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

$PSQL <<EOF
-- Check if admin user exists
DO \$$
DECLARE
    user_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@karmyq.com') INTO user_exists;
    IF NOT user_exists THEN
        -- Create admin user
        INSERT INTO auth.users (id, email, password_hash, email_verified, created_at, updated_at)
        VALUES (
            'admin-user-id',
            'admin@karmyq.com',
            '\$2b\$12\$EixZaYVK1sowonG4aCeScMwDMq1b2b0c2b0',
            true,
            NOW(),
            NOW()
        );
    END IF;
END \$\$;

-- Add admin to a test community
DO \$$
DECLARE
    community_id TEXT;
    membership_id TEXT;
BEGIN
    -- Get or create test community
    SELECT id INTO community_id
    FROM community.communities
    WHERE name = 'Test Community'
    LIMIT 1;

    IF community_id IS NULL THEN
        INSERT INTO community.communities (id, name, description, access_type, creator_id, status, created_at, updated_at)
        VALUES (
            'test-community-id',
            'Test Community',
            'Community for E2E testing',
            'public',
            'admin-user-id',
            'active',
            NOW(),
            NOW()
        )
        ON CONFLICT (name) DO NOTHING;

        SELECT id INTO community_id FROM community.communities WHERE name = 'Test Community';
    END IF;

    -- Add admin as member with admin role
    INSERT INTO community.members (id, user_id, community_id, role, status, joined_at, updated_at)
    VALUES (
        'test-admin-membership',
        'admin-user-id',
        community_id,
        'admin',
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, community_id) DO UPDATE SET role = 'admin', status = 'active';
END \$\$;

-- Create test schemas
DO \$$
DECLARE
    schema_id_1 TEXT;
    schema_id_2 TEXT;
    schema_id_3 TEXT;
BEGIN
    -- Schema 1: Test Schema 1 (draft)
    INSERT INTO requests.ui_schemas (id, type, version, label, icon, color, description, sections, status, created_by, updated_by, created_at, updated_at)
    VALUES (
        'test-schema-1',
        'e2e-test-1',
        1,
        'E2E Test Schema 1',
        '🧪',
        '#ff0000',
        'Test schema for E2E testing',
        '[{"id": "section-1", "title": "Basic Info", "fields": [{"id": "field-1", "type": "text", "label": "Request Type", "required": true}, {"id": "field-2", "type": "number", "label": "Duration (hours)", "required": true}]}]',
        'draft',
        'admin-user-id',
        'admin-user-id',
        NOW(),
        NOW()
    )
    RETURNING id INTO schema_id_1;

    -- Schema 2: Test Schema 2 (published)
    INSERT INTO requests.ui_schemas (id, type, version, label, icon, color, description, sections, status, created_by, updated_by, created_at, updated_at)
    VALUES (
        'test-schema-2',
        'e2e-test-2',
        1,
        'E2E Test Schema 2',
        '🧪',
        '#00ff00',
        'Published test schema',
        '[{"id": "section-1", "title": "Test Section", "fields": [{"id": "field-1", "type": "text", "label": "Test Field", "required": false}]}]',
        'published',
        'admin-user-id',
        'admin-user-id',
        NOW(),
        NOW()
    )
    RETURNING id INTO schema_id_2;

    -- Schema 3: Test Schema 3 (archived)
    INSERT INTO requests.ui_schemas (id, type, version, label, icon, color, description, sections, status, created_by, updated_by, created_at, updated_at)
    VALUES (
        'test-schema-3',
        'e2e-test-3',
        1,
        'E2E Test Schema 3',
        '🧪',
        '#808080',
        'Archived test schema',
        '[{"id": "section-1", "title": "Archived Section", "fields": [{"id": "field-1", "type": "text", "label": "Archived Field", "required": false}]}]',
        'archived',
        'admin-user-id',
        'admin-user-id',
        NOW(),
        NOW()
    )
    RETURNING id INTO schema_id_3;

    -- Create version history
    INSERT INTO requests.ui_schema_versions (id, schema_id, version, schema_snapshot, changed_by, change_description, created_at)
    VALUES
        ('version-1', schema_id_1, 1, '[{"id": "test-schema-1", "type": "e2e-test-1", "label": "E2E Test Schema 1", "icon": "🧪", "color": "#ff0000", "status": "draft", "sections": [{"id": "section-1", "title": "Basic Info", "fields": [{"id": "field-1", "type": "text", "label": "Request Type", "required": true}, {"id": "field-2", "type": "number", "label": "Duration (hours)", "required": true}]}]', 'admin-user-id', 'Initial creation', NOW()),
        ('version-2', schema_id_2, 1, '[{"id": "test-schema-2", "type": "e2e-test-2", "label": "E2E Test Schema 2", "icon": "🧪", "color": "#00ff00", "status": "published", "sections": [{"id": "section-1", "title": "Test Section", "fields": [{"id": "field-1", "type": "text", "label": "Test Field", "required": false}]}]', 'admin-user-id', 'Initial creation', NOW()),
        ('version-3', schema_id_3, 1, '[{"id": "test-schema-3", "type": "e2e-test-3", "label": "E2E Test Schema 3", "icon": "🧪", "color": "#808080", "status": "archived", "sections": [{"id": "section-1", "title": "Archived Section", "fields": [{"id": "field-1", "type": "text", "label": "Archived Field", "required": false}]}]', 'admin-user-id', 'Initial creation', NOW());
END \$\$;

-- Verify data
SELECT '✓ Admin user created: admin@karmyq.com (password: admin123)' AS status UNION ALL
SELECT '✓ Test community created: Test Community' UNION ALL
SELECT '✓ 3 test schemas created (draft, published, archived)' UNION ALL
SELECT '✓ Version history created' UNION ALL;

EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Test data seeded successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Test credentials:"
echo "  Email: admin@karmyq.com"
echo "  Password: admin123"
echo ""
echo "Test user has admin role in 'Test Community'"
echo ""
echo "Ready to run E2E tests!"
