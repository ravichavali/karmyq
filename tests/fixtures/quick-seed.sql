-- Quick Seed Data for Karmyq v8.0
-- Creates test personas and basic data to get started

-- Clean existing data
TRUNCATE TABLE messaging.messages CASCADE;
TRUNCATE TABLE requests.matches CASCADE;
TRUNCATE TABLE requests.help_offers CASCADE;
TRUNCATE TABLE requests.request_communities CASCADE;
TRUNCATE TABLE requests.help_requests CASCADE;
TRUNCATE TABLE reputation.karma_records CASCADE;
TRUNCATE TABLE reputation.milestone_events CASCADE;
TRUNCATE TABLE communities.members CASCADE;
TRUNCATE TABLE communities.communities CASCADE;
TRUNCATE TABLE auth.users CASCADE;

-- Insert test persona users
INSERT INTO auth.users (id, email, name, password_hash, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'new.user@test.com', 'New User', '$2b$10$examplehash', NOW() - INTERVAL '1 day'),
  ('22222222-2222-2222-2222-222222222222', 'power.helper@test.com', 'Power Helper', '$2b$10$examplehash', NOW() - INTERVAL '90 days'),
  ('33333333-3333-3333-3333-333333333333', 'frequent.requester@test.com', 'Frequent Requester', '$2b$10$examplehash', NOW() - INTERVAL '60 days'),
  ('44444444-4444-4444-4444-444444444444', 'community.moderator@test.com', 'Community Moderator', '$2b$10$examplehash', NOW() - INTERVAL '120 days'),
  ('55555555-5555-5555-5555-555555555555', 'balanced.user@test.com', 'Balanced User', '$2b$10$examplehash', NOW() - INTERVAL '45 days'),
  ('66666666-6666-6666-6666-666666666666', 'occasional.user@test.com', 'Occasional User', '$2b$10$examplehash', NOW() - INTERVAL '150 days'),
  ('77777777-7777-7777-7777-777777777777', 'multi.community@test.com', 'Multi Community Member', '$2b$10$examplehash', NOW() - INTERVAL '75 days');

-- Insert test communities
INSERT INTO communities.communities (id, name, description, creator_id, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Helpers Network', 'A community for tech enthusiasts helping each other', '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '100 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Neighborhood Aid', 'Local neighbors helping with everyday tasks', '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '80 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Skill Share', 'Share skills and learn together', '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '60 days');

-- Add community members
INSERT INTO communities.members (id, community_id, user_id, role, joined_at) VALUES
  -- Tech Helpers Network
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'member', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member', NOW() - INTERVAL '90 days'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'moderator', NOW() - INTERVAL '100 days'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member', NOW() - INTERVAL '45 days'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member', NOW() - INTERVAL '75 days'),

  -- Neighborhood Aid
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'member', NOW() - INTERVAL '80 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'member', NOW() - INTERVAL '50 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'moderator', NOW() - INTERVAL '80 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'member', NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'member', NOW() - INTERVAL '70 days'),

  -- Skill Share
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member', NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', 'member', NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', 'member', NOW() - INTERVAL '60 days');

-- Insert help requests with correct schema
INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at) VALUES
  ('req-0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Need help setting up laptop', 'Looking for someone to help me install software and configure my new laptop', 'tech', 'open', NOW() - INTERVAL '2 days'),
  ('req-0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Moving furniture', 'Need help moving a couch this weekend', 'household', 'matched', NOW() - INTERVAL '10 days'),
  ('req-0003-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'Guitar lessons', 'Would love to learn guitar basics', 'skills', 'open', NOW() - INTERVAL '5 days'),
  ('req-0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Help with gardening', 'New to gardening, need advice on starting a vegetable garden', 'household', 'open', NOW() - INTERVAL '1 day');

-- Link requests to communities
INSERT INTO requests.request_communities (id, request_id, community_id) VALUES
  (gen_random_uuid(), 'req-0001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  (gen_random_uuid(), 'req-0002-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  (gen_random_uuid(), 'req-0003-0000-0000-0000-000000000003', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  (gen_random_uuid(), 'req-0004-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Insert help offers
INSERT INTO requests.help_offers (id, request_id, helper_id, message, status, created_at) VALUES
  (gen_random_uuid(), 'req-0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Happy to help! I''m a software engineer.', 'pending', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'req-0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'I have a truck and can help move furniture', 'accepted', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), 'req-0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'I''ve been playing for 10 years, would love to teach!', 'pending', NOW() - INTERVAL '4 days');

-- Insert matches
INSERT INTO requests.matches (id, request_id, requester_id, responder_id, status, matched_at, completed_at) VALUES
  ('match-001-0000-0000-0000-000000000001', 'req-0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'completed', NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days');

-- Insert messages
INSERT INTO messaging.messages (id, match_id, sender_id, content, created_at) VALUES
  (gen_random_uuid(), 'match-001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Thanks for offering to help!', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), 'match-001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'No problem! When works for you?', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), 'match-001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'How about Saturday at 2pm?', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), 'match-001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Perfect, see you then!', NOW() - INTERVAL '8 days');

-- Insert karma records for completed help
INSERT INTO reputation.karma_records (id, user_id, community_id, event_type, points_awarded, match_id, description, created_at) VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'help_given', 10, 'match-001-0000-0000-0000-000000000001', 'Helped with moving furniture', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'help_received', 5, 'match-001-0000-0000-0000-000000000001', 'Received help with moving', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'help_given', 10, NULL, 'Multiple past helps', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'help_given', 10, NULL, 'Multiple past helps', NOW() - INTERVAL '45 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'help_given', 10, NULL, 'Multiple past helps', NOW() - INTERVAL '60 days');

-- Insert milestone events
INSERT INTO reputation.milestone_events (id, community_id, milestone_type, milestone_value, description, achieved_at, is_featured) VALUES
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'matches_10', 10, '10 successful exchanges completed!', NOW() - INTERVAL '20 days', true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'participants_10', 10, '10 unique members have participated!', NOW() - INTERVAL '30 days', false),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'matches_25', 25, '25 successful exchanges completed!', NOW() - INTERVAL '15 days', true);

-- Summary
SELECT
  (SELECT COUNT(*) FROM auth.users) as users,
  (SELECT COUNT(*) FROM communities.communities) as communities,
  (SELECT COUNT(*) FROM communities.members) as members,
  (SELECT COUNT(*) FROM requests.help_requests) as requests,
  (SELECT COUNT(*) FROM requests.help_offers) as offers,
  (SELECT COUNT(*) FROM requests.matches) as matches,
  (SELECT COUNT(*) FROM messaging.messages) as messages,
  (SELECT COUNT(*) FROM reputation.karma_records) as karma,
  (SELECT COUNT(*) FROM reputation.milestone_events) as milestones;
