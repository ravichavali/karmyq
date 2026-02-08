-- Create Test Users for Connection Badge Testing
-- Password for all users: password123
-- Hash generated with: bcrypt.hashSync('password123', 10)

-- Insert test users
INSERT INTO auth.users (id, email, name, password_hash, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@test.com', 'Alice Test', '$2a$10$mEMsTo4Pq.BYWTklOHdZnOezQzQ3xNy0vdARCxBfqyFiPw.dfxWKS', NOW() - INTERVAL '60 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@test.com', 'Bob Test', '$2a$10$mEMsTo4Pq.BYWTklOHdZnOezQzQ3xNy0vdARCxBfqyFiPw.dfxWKS', NOW() - INTERVAL '45 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'charlie@test.com', 'Charlie Test', '$2a$10$mEMsTo4Pq.BYWTklOHdZnOezQzQ3xNy0vdARCxBfqyFiPw.dfxWKS', NOW() - INTERVAL '30 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'diana@test.com', 'Diana Test', '$2a$10$mEMsTo4Pq.BYWTklOHdZnOezQzQ3xNy0vdARCxBfqyFiPw.dfxWKS', NOW() - INTERVAL '15 days'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'eve@test.com', 'Eve Test', '$2a$10$mEMsTo4Pq.BYWTklOHdZnOezQzQ3xNy0vdARCxBfqyFiPw.dfxWKS', NOW() - INTERVAL '7 days')
ON CONFLICT (email) DO NOTHING;

-- Get or create a test community
INSERT INTO communities.communities (id, name, description, creator_id, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Community', 'Community for testing connection badges', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW() - INTERVAL '60 days')
ON CONFLICT DO NOTHING;

-- Add all test users to the community
INSERT INTO communities.members (id, community_id, user_id, role, joined_at) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', NOW() - INTERVAL '45 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'member', NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Create invitation chain: Alice → Bob → Charlie → Diana → Eve

-- Alice → Bob (1° connection for Alice-Bob)
INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
VALUES (
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'KARMYQ-ALICETEST-2025-AA01',
  '11111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '45 days',
  NOW() - INTERVAL '45 days'
)
ON CONFLICT DO NOTHING;

UPDATE auth.users SET invited_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Bob → Charlie (2° connection for Alice-Charlie)
INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'KARMYQ-BOBTEST-2025-BB02',
  '11111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT DO NOTHING;

UPDATE auth.users SET invited_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Charlie → Diana (3° connection for Alice-Diana)
INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
VALUES (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'KARMYQ-CHARLIETEST-2025-CC03',
  '11111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '15 days',
  NOW() - INTERVAL '15 days'
)
ON CONFLICT DO NOTHING;

UPDATE auth.users SET invited_by = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- Diana → Eve (4° connection for Alice-Eve, should NOT show badge)
INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
VALUES (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'KARMYQ-DIANATEST-2025-DD04',
  '11111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
)
ON CONFLICT DO NOTHING;

UPDATE auth.users SET invited_by = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

-- Create help requests from each user

-- Bob's request (should show "Direct connection" green badge to Alice)
INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Need help setting up laptop',
  'Looking for tech help to configure my new laptop',
  'tech',
  'open',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT DO NOTHING;

-- Charlie's request (should show "Connected through Bob Test" blue badge to Alice)
INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
VALUES (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Moving furniture this weekend',
  'Need help moving a couch',
  'household',
  'open',
  NOW() - INTERVAL '3 days'
)
ON CONFLICT DO NOTHING;

-- Diana's request (should show "Connected through 2 people" gray badge to Alice)
INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
VALUES (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'Guitar lessons wanted',
  'Would love to learn guitar basics',
  'skills',
  'open',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT DO NOTHING;

-- Eve's request (should show NO badge to Alice - 4° connection)
INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
VALUES (
  gen_random_uuid(),
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'Help with gardening',
  'New to gardening, need advice',
  'household',
  'open',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT DO NOTHING;

-- Link requests to the community
INSERT INTO requests.request_communities (id, request_id, community_id)
SELECT gen_random_uuid(), hr.id, '11111111-1111-1111-1111-111111111111'
FROM requests.help_requests hr
WHERE hr.requester_id IN (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
)
ON CONFLICT DO NOTHING;

-- Summary
SELECT 'Test users created!' as status;
SELECT 'Invitation chain: Alice → Bob → Charlie → Diana → Eve' as chain;
SELECT 'Login with any user: alice@test.com, bob@test.com, charlie@test.com, diana@test.com, eve@test.com' as login;
SELECT 'Password: password123' as password;
