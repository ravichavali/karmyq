-- Create Invitation Test Data for Connection Badge Testing
-- This creates a chain of invitations to test 1°, 2°, and 3° connection badges
-- Run on production: docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /path/to/this/file

-- Get existing user IDs (assuming test users exist)
DO $$
DECLARE
  user_alice UUID;
  user_bob UUID;
  user_charlie UUID;
  user_diana UUID;
  user_eve UUID;
  community_id UUID;
BEGIN
  -- Get or create test users
  SELECT id INTO user_alice FROM auth.users WHERE email = 'alice@test.com';
  SELECT id INTO user_bob FROM auth.users WHERE email = 'bob@test.com';
  SELECT id INTO user_charlie FROM auth.users WHERE email = 'charlie@test.com';
  SELECT id INTO user_diana FROM auth.users WHERE email = 'diana@test.com';
  SELECT id INTO user_eve FROM auth.users WHERE email = 'eve@test.com';

  -- Get or create a test community
  SELECT id INTO community_id FROM communities.communities LIMIT 1;

  IF user_alice IS NULL OR user_bob IS NULL OR user_charlie IS NULL THEN
    RAISE NOTICE 'Test users not found. Please run create-prod-test-users.sh first.';
    RETURN;
  END IF;

  -- Create invitation chain:
  -- Alice invites Bob (1° connection between Alice-Bob)
  -- Bob invites Charlie (2° connection between Alice-Charlie)
  -- Charlie invites Diana (3° connection between Alice-Diana)
  -- Diana invites Eve (4° connection between Alice-Eve, should NOT show badge)

  -- Alice → Bob
  INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
  VALUES (
    gen_random_uuid(),
    user_alice,
    user_bob,
    'KARMYQ-ALICE-2025-TEST1',
    community_id,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '29 days'
  )
  ON CONFLICT DO NOTHING;

  -- Update Bob's invited_by
  UPDATE auth.users SET invited_by = user_alice WHERE id = user_bob;

  -- Bob → Charlie
  INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
  VALUES (
    gen_random_uuid(),
    user_bob,
    user_charlie,
    'KARMYQ-BOB-2025-TEST2',
    community_id,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '19 days'
  )
  ON CONFLICT DO NOTHING;

  -- Update Charlie's invited_by
  UPDATE auth.users SET invited_by = user_bob WHERE id = user_charlie;

  -- Charlie → Diana
  INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
  VALUES (
    gen_random_uuid(),
    user_charlie,
    user_diana,
    'KARMYQ-CHARLIE-2025-TEST3',
    community_id,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '9 days'
  )
  ON CONFLICT DO NOTHING;

  -- Update Diana's invited_by
  UPDATE auth.users SET invited_by = user_charlie WHERE id = user_diana;

  -- Diana → Eve
  IF user_eve IS NOT NULL THEN
    INSERT INTO auth.user_invitations (id, inviter_id, invitee_id, invitation_code, community_id, invited_at, invitation_accepted_at)
    VALUES (
      gen_random_uuid(),
      user_diana,
      user_eve,
      'KARMYQ-DIANA-2025-TEST4',
      community_id,
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '4 days'
    )
    ON CONFLICT DO NOTHING;

    -- Update Eve's invited_by
    UPDATE auth.users SET invited_by = user_diana WHERE id = user_eve;
  END IF;

  -- Create help requests from each user so we can test the badges

  -- Bob's request (should show "Direct connection" to Alice)
  INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
  VALUES (
    gen_random_uuid(),
    user_bob,
    'Need help setting up laptop',
    'Looking for tech help to configure my new laptop',
    'tech',
    'open',
    NOW() - INTERVAL '2 days'
  )
  ON CONFLICT DO NOTHING;

  -- Charlie's request (should show "Connected through Bob" to Alice)
  INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
  VALUES (
    gen_random_uuid(),
    user_charlie,
    'Moving furniture this weekend',
    'Need help moving a couch',
    'household',
    'open',
    NOW() - INTERVAL '3 days'
  )
  ON CONFLICT DO NOTHING;

  -- Diana's request (should show "Connected through 2 people" to Alice)
  INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
  VALUES (
    gen_random_uuid(),
    user_diana,
    'Guitar lessons wanted',
    'Would love to learn guitar basics',
    'skills',
    'open',
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT DO NOTHING;

  -- Eve's request (should show NO badge to Alice - 4° connection)
  IF user_eve IS NOT NULL THEN
    INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at)
    VALUES (
      gen_random_uuid(),
      user_eve,
      'Help with gardening',
      'New to gardening, need advice',
      'household',
      'open',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Invitation chain created successfully!';
  RAISE NOTICE 'Alice → Bob (1°) → Charlie (2°) → Diana (3°) → Eve (4°)';
  RAISE NOTICE 'When logged in as Alice, you should see:';
  RAISE NOTICE '  - Bob''s request: "Direct connection" (green badge)';
  RAISE NOTICE '  - Charlie''s request: "Connected through Bob" (blue badge)';
  RAISE NOTICE '  - Diana''s request: "Connected through 2 people" (gray badge)';
  RAISE NOTICE '  - Eve''s request: NO badge (4+ degrees)';

END $$;

-- Verify the invitation chain
SELECT
  u1.name as inviter,
  u2.name as invitee,
  ui.invitation_accepted_at
FROM auth.user_invitations ui
JOIN auth.users u1 ON ui.inviter_id = u1.id
JOIN auth.users u2 ON ui.invitee_id = u2.id
WHERE ui.invitation_accepted_at IS NOT NULL
ORDER BY ui.invitation_accepted_at;
