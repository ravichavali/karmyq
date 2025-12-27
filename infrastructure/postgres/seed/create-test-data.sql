-- Create a test community
INSERT INTO communities.communities (id, name, description, creator_id, invite_code, settings, created_at)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'Test Community',
  'A test community for trying out Karmyq',
  '4612369f-a9bf-4352-aee4-4ab872368161',
  'TEST123',
  '{"request_ttl_days": 60, "offer_ttl_days": 90, "default_request_visibility": "community"}',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add new.user@test.com as a member
INSERT INTO communities.memberships (id, community_id, user_id, role, status, joined_at)
VALUES (
  'm1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '4612369f-a9bf-4352-aee4-4ab872368161',
  'admin',
  'active',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add a few other test users to the community
INSERT INTO communities.memberships (community_id, user_id, role, status, joined_at)
SELECT
  'c1111111-1111-1111-1111-111111111111',
  id,
  'member',
  'active',
  NOW()
FROM auth.users
WHERE email IN ('power.helper@test.com', 'frequent.requester@test.com', 'community.moderator@test.com')
ON CONFLICT DO NOTHING;

-- Create some test requests
INSERT INTO requests.help_requests (id, requester_id, title, description, category, urgency, status, request_type, created_at)
VALUES
(
  'r1111111-1111-1111-1111-111111111111',
  '4612369f-a9bf-4352-aee4-4ab872368161',
  'Need help moving furniture',
  'Looking for someone with a truck to help move a couch this weekend',
  'moving',
  'medium',
  'open',
  'generic',
  NOW() - INTERVAL '2 hours'
),
(
  'r2222222-2222-2222-2222-222222222222',
  (SELECT id FROM auth.users WHERE email = 'power.helper@test.com' LIMIT 1),
  'Seeking math tutor',
  'Need help with calculus homework, preferably someone patient with explanations',
  'tutoring',
  'low',
  'open',
  'generic',
  NOW() - INTERVAL '1 day'
),
(
  'r3333333-3333-3333-3333-333333333333',
  (SELECT id FROM auth.users WHERE email = 'frequent.requester@test.com' LIMIT 1),
  'Borrow a ladder',
  'Need a ladder for weekend home repairs, just for one day',
  'tools',
  'low',
  'open',
  'generic',
  NOW() - INTERVAL '3 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Link requests to community
INSERT INTO requests.request_communities (request_id, community_id)
VALUES
('r1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'),
('r2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111'),
('r3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Create a test offer
INSERT INTO requests.help_offers (id, community_id, offerer_id, title, description, category, status, created_at)
VALUES
(
  'o1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  (SELECT id FROM auth.users WHERE email = 'community.moderator@test.com' LIMIT 1),
  'Can provide tech support',
  'Happy to help with computer problems, software issues, or tech questions',
  'tech_support',
  'active',
  NOW() - INTERVAL '5 hours'
)
ON CONFLICT (id) DO NOTHING;
