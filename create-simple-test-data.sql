-- Create a test community
INSERT INTO communities.communities (id, name, description, creator_id, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Test Community',
  'A test community for trying out Karmyq',
  '4612369f-a9bf-4352-aee4-4ab872368161'::uuid,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add new.user@test.com as a member
INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '4612369f-a9bf-4352-aee4-4ab872368161'::uuid,
  'admin',
  'active',
  NOW()
) ON CONFLICT DO NOTHING;

-- Add other test users to the community
INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
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
  '22222222-2222-2222-2222-222222222222'::uuid,
  '4612369f-a9bf-4352-aee4-4ab872368161'::uuid,
  'Need help moving furniture',
  'Looking for someone with a truck to help move a couch this weekend',
  'moving',
  'medium',
  'open',
  'generic',
  NOW() - INTERVAL '2 hours'
),
(
  '33333333-3333-3333-3333-333333333333'::uuid,
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
  '44444444-4444-4444-4444-444444444444'::uuid,
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
('22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid),
('33333333-3333-3333-3333-333333333333'::uuid, '11111111-1111-1111-1111-111111111111'::uuid),
('44444444-4444-4444-4444-444444444444'::uuid, '11111111-1111-1111-1111-111111111111'::uuid)
ON CONFLICT DO NOTHING;

-- Create a test offer
INSERT INTO requests.help_offers (id, community_id, offerer_id, title, description, category, status, created_at)
VALUES
(
  '55555555-5555-5555-5555-555555555555'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM auth.users WHERE email = 'community.moderator@test.com' LIMIT 1),
  'Can provide tech support',
  'Happy to help with computer problems, software issues, or tech questions',
  'tech_support',
  'active',
  NOW() - INTERVAL '5 hours'
)
ON CONFLICT (id) DO NOTHING;
