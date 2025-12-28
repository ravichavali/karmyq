-- Seed Test Data for Social Graph Testing
-- This script creates a clean test dataset with invitation chains for testing trust paths

-- Clean up existing test data
DELETE FROM auth.social_distances WHERE community_id IN (SELECT id FROM communities.communities WHERE name LIKE 'Test%');
DELETE FROM auth.user_invitations WHERE community_id IN (SELECT id FROM communities.communities WHERE name LIKE 'Test%');
DELETE FROM auth.inviter_stats WHERE community_id IN (SELECT id FROM communities.communities WHERE name LIKE 'Test%');
DELETE FROM communities.members WHERE community_id IN (SELECT id FROM communities.communities WHERE name LIKE 'Test%');
DELETE FROM communities.communities WHERE name LIKE 'Test%';
DELETE FROM auth.users WHERE email LIKE '%@test.karmyq%';

-- Create test community
INSERT INTO communities.communities (id, name, description, admin_id, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Community', 'Test community for social graph testing', '00000000-0000-0000-0000-000000000000', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test users with invitation chain:
-- Alice (admin) -> Bob -> Charlie -> Dave -> Eve
-- Alice (admin) -> Frank -> Grace
-- Alice (admin) -> Henry
--
-- This creates:
-- - 1-degree: Alice -> Bob, Alice -> Frank, Alice -> Henry
-- - 2-degree: Alice -> Charlie, Alice -> Grace
-- - 3-degree: Alice -> Dave
-- - 4-degree: Alice -> Eve
-- - No connection: Eve -> Henry (beyond 4 degrees)

-- User 1: Alice (Admin - Root of invitation tree)
INSERT INTO auth.users (id, name, email, password_hash, created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Admin', 'alice@test.karmyq', '$2b$10$hash', NOW())
ON CONFLICT (id) DO NOTHING;

-- User 2: Bob (Invited by Alice)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Builder', 'bob@test.karmyq', '$2b$10$hash', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 3: Charlie (Invited by Bob)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Charlie Chen', 'charlie@test.karmyq', '$2b$10$hash', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 4: Dave (Invited by Charlie)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Dave Davis', 'dave@test.karmyq', '$2b$10$hash', 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 5: Eve (Invited by Dave - 4 degrees from Alice)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Eve Evans', 'eve@test.karmyq', '$2b$10$hash', 'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 6: Frank (Invited by Alice)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Frank Foster', 'frank@test.karmyq', '$2b$10$hash', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 7: Grace (Invited by Frank)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('99999999-9999-9999-9999-999999999999', 'Grace Garcia', 'grace@test.karmyq', '$2b$10$hash', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User 8: Henry (Invited by Alice)
INSERT INTO auth.users (id, name, email, password_hash, invited_by, invitation_accepted_at, created_at)
VALUES
  ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'Henry Harris', 'henry@test.karmyq', '$2b$10$hash', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add all users to the test community
INSERT INTO communities.members (community_id, user_id, role, joined_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'member', NOW()),
  ('11111111-1111-1111-1111-111111111111', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'member', NOW())
ON CONFLICT (community_id, user_id) DO NOTHING;

-- Create invitation records
INSERT INTO auth.user_invitations (inviter_id, invitee_id, community_id, invitation_code, invited_at, invitation_accepted_at, invitation_method)
VALUES
  -- Alice -> Bob
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'KARMYQ-ALICE-2024-0001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 'link'),

  -- Bob -> Charlie
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'KARMYQ-BOB-2024-0001', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', 'link'),

  -- Charlie -> Dave
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'KARMYQ-CHARLIE-2024-0001', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', 'link'),

  -- Dave -> Eve
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'KARMYQ-DAVE-2024-0001', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 'link'),

  -- Alice -> Frank
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'KARMYQ-ALICE-2024-0002', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', 'link'),

  -- Frank -> Grace
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'KARMYQ-FRANK-2024-0001', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'link'),

  -- Alice -> Henry
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', '11111111-1111-1111-1111-111111111111', 'KARMYQ-ALICE-2024-0003', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 'link')
ON CONFLICT (invitation_code) DO NOTHING;

-- Add some karma to users for trust score calculation
INSERT INTO reputation.karma_records (user_id, community_id, current_karma, total_karma_earned, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 100, 100, NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 85, 85, NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 70, 70, NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 60, 60, NOW(), NOW()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 50, 50, NOW(), NOW()),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 90, 90, NOW(), NOW()),
  ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 75, 75, NOW(), NOW()),
  ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', '11111111-1111-1111-1111-111111111111', 80, 80, NOW(), NOW())
ON CONFLICT (user_id, community_id) DO NOTHING;

-- Print summary
DO $$
BEGIN
  RAISE NOTICE '✅ Test data seeded successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Community ID: 11111111-1111-1111-1111-111111111111';
  RAISE NOTICE '';
  RAISE NOTICE 'Users:';
  RAISE NOTICE '  Alice (Admin):  aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (alice@test.karmyq)';
  RAISE NOTICE '  Bob:            bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb (bob@test.karmyq)';
  RAISE NOTICE '  Charlie:        cccccccc-cccc-cccc-cccc-cccccccccccc (charlie@test.karmyq)';
  RAISE NOTICE '  Dave:           dddddddd-dddd-dddd-dddd-dddddddddddd (dave@test.karmyq)';
  RAISE NOTICE '  Eve:            eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee (eve@test.karmyq)';
  RAISE NOTICE '  Frank:          ffffffff-ffff-ffff-ffff-ffffffffffff (frank@test.karmyq)';
  RAISE NOTICE '  Grace:          99999999-9999-9999-9999-999999999999 (grace@test.karmyq)';
  RAISE NOTICE '  Henry:          hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh (henry@test.karmyq)';
  RAISE NOTICE '';
  RAISE NOTICE 'Invitation Chain:';
  RAISE NOTICE '  Alice -> Bob -> Charlie -> Dave -> Eve';
  RAISE NOTICE '  Alice -> Frank -> Grace';
  RAISE NOTICE '  Alice -> Henry';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Degrees of Separation (from Alice):';
  RAISE NOTICE '  Bob:     1°';
  RAISE NOTICE '  Frank:   1°';
  RAISE NOTICE '  Henry:   1°';
  RAISE NOTICE '  Charlie: 2°';
  RAISE NOTICE '  Grace:   2°';
  RAISE NOTICE '  Dave:    3°';
  RAISE NOTICE '  Eve:     4°';
  RAISE NOTICE '';
  RAISE NOTICE 'Password for all users: Use JWT token with userId for API testing';
END $$;
