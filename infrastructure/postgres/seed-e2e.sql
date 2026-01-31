-- E2E Test Data Seed Script
-- This script creates test users and communities for E2E testing
-- Run this before E2E tests to ensure consistent test data

-- =============================================================================
-- 0. Clean Up Existing Test Data
-- =============================================================================

-- Get test user IDs
DO $$
DECLARE
  test_user_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO test_user_ids
  FROM auth.users
  WHERE email IN ('isabella.thomas0@example.com', 'helper.user@example.com');

  -- Delete help requests created by or offered by test users
  DELETE FROM requests.help_requests
  WHERE requester_id = ANY(test_user_ids);

  DELETE FROM requests.help_offers
  WHERE offerer_id = ANY(test_user_ids);

  -- Delete communities created by test users (cascades to members, norms, etc.)
  DELETE FROM communities.communities
  WHERE creator_id = ANY(test_user_ids);

  -- Delete test users (cascades to remaining related data)
  DELETE FROM auth.users
  WHERE id = ANY(test_user_ids);
END $$;

-- =============================================================================
-- 1. Create Test Users
-- =============================================================================

-- Test user: isabella.thomas0@example.com
-- Password: password123 (bcrypt hash)
INSERT INTO auth.users (id, email, password_hash, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'isabella.thomas0@example.com',
  '$2b$10$JCXNzjVi/RUOu8PtWAUSWeEi5MfS0wzvAEgsFI11vB19mLFvhsJa2', -- password123
  'Isabella Thomas',
  NOW(),
  NOW()
);

-- Additional test user for matching/offers
INSERT INTO auth.users (id, email, password_hash, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'helper.user@example.com',
  '$2b$10$JCXNzjVi/RUOu8PtWAUSWeEi5MfS0wzvAEgsFI11vB19mLFvhsJa2', -- password123
  'Helper User',
  NOW(),
  NOW()
);

-- Third test user for helper2
INSERT INTO auth.users (id, email, password_hash, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'helper2.user@example.com',
  '$2b$10$JCXNzjVi/RUOu8PtWAUSWeEi5MfS0wzvAEgsFI11vB19mLFvhsJa2', -- password123
  'Helper User 2',
  NOW(),
  NOW()
);

-- =============================================================================
-- 2. Create Test Communities
-- =============================================================================

-- E2E Test Community (public, open access)
INSERT INTO communities.communities (
  id,
  name,
  description,
  location,
  creator_id,
  access_type,
  max_members,
  current_members,
  status,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'E2E Test Community',
  'Test community for E2E testing',
  'Test City',
  '00000000-0000-0000-0000-000000000001',
  'public',
  1000,
  2,
  'active',
  NOW(),
  NOW()
)
;

-- Private Test Community
INSERT INTO communities.communities (
  id,
  name,
  description,
  location,
  creator_id,
  access_type,
  max_members,
  current_members,
  status,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  'Private Test Community',
  'Private community for testing access controls',
  'Private City',
  '00000000-0000-0000-0000-000000000001',
  'private',
  50,
  1,
  'active',
  NOW(),
  NOW()
)
;

-- =============================================================================
-- 3. Create Community Memberships
-- =============================================================================

-- Isabella is admin of E2E Test Community
INSERT INTO communities.members (
  id,
  community_id,
  user_id,
  role,
  status,
  joined_at
)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'active',
  NOW()
)
;

-- Helper user is a member of E2E Test Community
INSERT INTO communities.members (
  id,
  community_id,
  user_id,
  role,
  status,
  joined_at
)
VALUES (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000002',
  'member',
  'active',
  NOW()
)
;

-- Isabella is admin of Private Test Community
INSERT INTO communities.members (
  id,
  community_id,
  user_id,
  role,
  status,
  joined_at
)
VALUES (
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'active',
  NOW()
)
;

-- =============================================================================
-- 4. Initialize Reputation Records
-- =============================================================================

-- Initialize karma for test users
INSERT INTO reputation.karma_records (
  id,
  user_id,
  community_id,
  points,
  reason,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  0,
  'Initial karma for E2E testing',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reputation.karma_records (
  id,
  user_id,
  community_id,
  points,
  reason,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  0,
  'Initial karma for E2E testing',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Summary
-- =============================================================================

-- Users created:
-- - isabella.thomas0@example.com (password: password123)
-- - helper.user@example.com (password: password123)
--
-- Communities created:
-- - E2E Test Community (public, ID: 00000000-0000-0000-0000-000000000101)
-- - Private Test Community (private, ID: 00000000-0000-0000-0000-000000000102)
--
-- Memberships:
-- - Isabella: admin in both communities
-- - Helper: member in E2E Test Community

SELECT 'E2E test data seeded successfully!' as status;
