-- Seed Exchange Network for Trust Path Demo
-- Creates completed matches between existing community members so trust path badges
-- appear on feed tiles. Strategy: admin users act as natural hubs (having exchanges
-- with multiple members), creating 2° paths between members who haven't exchanged directly.
--
-- This is idempotent: uses ON CONFLICT DO NOTHING throughout.

DO $$
DECLARE
  v_community_id   UUID;
  v_admin_id       UUID;
  v_member_ids     UUID[];
  v_member_id      UUID;
  v_request_id     UUID;
  v_i              INTEGER;
BEGIN
  -- Work with the first community that has members
  SELECT c.id INTO v_community_id
  FROM communities.communities c
  JOIN communities.members m ON m.community_id = c.id
  GROUP BY c.id
  HAVING COUNT(m.user_id) >= 3
  ORDER BY c.created_at
  LIMIT 1;

  IF v_community_id IS NULL THEN
    RAISE NOTICE 'No community with 3+ members found. Skipping exchange network seed.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding exchange network for community: %', v_community_id;

  -- Pick an admin as the hub user
  SELECT m.user_id INTO v_admin_id
  FROM communities.members m
  WHERE m.community_id = v_community_id AND m.role = 'admin'
  ORDER BY m.joined_at
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    -- Fall back to the earliest member
    SELECT m.user_id INTO v_admin_id
    FROM communities.members m
    WHERE m.community_id = v_community_id
    ORDER BY m.joined_at
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Hub user (admin): %', v_admin_id;

  -- Collect up to 10 non-admin members to create exchange edges with admin
  SELECT ARRAY(
    SELECT m.user_id
    FROM communities.members m
    WHERE m.community_id = v_community_id
      AND m.user_id != v_admin_id
    ORDER BY m.joined_at
    LIMIT 10
  ) INTO v_member_ids;

  IF array_length(v_member_ids, 1) IS NULL OR array_length(v_member_ids, 1) < 2 THEN
    RAISE NOTICE 'Not enough members to build an exchange network. Skipping.';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating exchange edges between admin and % members', array_length(v_member_ids, 1);

  -- Create completed matches: each member ↔ admin (member requests, admin helps)
  FOR v_i IN 1..array_length(v_member_ids, 1) LOOP
    v_member_id := v_member_ids[v_i];

    -- Skip if a completed match already exists between this pair
    IF EXISTS (
      SELECT 1
      FROM requests.matches m
      JOIN requests.help_requests hr ON hr.id = m.request_id
      WHERE m.status = 'completed'
        AND ((hr.requester_id = v_member_id AND m.responder_id = v_admin_id)
          OR (hr.requester_id = v_admin_id AND m.responder_id = v_member_id))
    ) THEN
      RAISE NOTICE 'Exchange already exists between % and %, skipping', v_member_id, v_admin_id;
      CONTINUE;
    END IF;

    -- Create help request from member (no community_id column — linked via junction table)
    INSERT INTO requests.help_requests (
      id,
      requester_id,
      title,
      description,
      category,
      status,
      request_type,
      is_public,
      requester_visibility_consent,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_member_id,
      'Community Help Request #' || v_i,
      'Help request created to seed trust path network.',
      'Other',
      'completed',
      'generic',
      TRUE,
      TRUE,
      NOW() - ((array_length(v_member_ids, 1) - v_i + 1) || ' days')::INTERVAL,
      NOW() - ((array_length(v_member_ids, 1) - v_i + 1) || ' days')::INTERVAL + INTERVAL '4 hours'
    ) RETURNING id INTO v_request_id;

    -- Create completed match: admin responds
    INSERT INTO requests.matches (
      id,
      request_id,
      responder_id,
      status,
      requester_visible,
      responder_visible,
      created_at,
      updated_at,
      completed_at
    ) VALUES (
      gen_random_uuid(),
      v_request_id,
      v_admin_id,
      'completed',
      TRUE,
      TRUE,
      NOW() - ((array_length(v_member_ids, 1) - v_i + 1) || ' days')::INTERVAL + INTERVAL '1 hour',
      NOW() - ((array_length(v_member_ids, 1) - v_i + 1) || ' days')::INTERVAL + INTERVAL '4 hours',
      NOW() - ((array_length(v_member_ids, 1) - v_i + 1) || ' days')::INTERVAL + INTERVAL '4 hours'
    );

    RAISE NOTICE 'Created exchange: member % → admin %', v_member_id, v_admin_id;
  END LOOP;

  -- Also create a few direct member-to-member exchanges (1° connections)
  -- member[1] helps member[2], member[3] helps member[4] (if they exist)
  IF array_length(v_member_ids, 1) >= 2 THEN
    -- member[2] requests, member[1] responds (direct exchange)
    IF NOT EXISTS (
      SELECT 1
      FROM requests.matches m
      JOIN requests.help_requests hr ON hr.id = m.request_id
      WHERE m.status = 'completed'
        AND ((hr.requester_id = v_member_ids[2] AND m.responder_id = v_member_ids[1])
          OR (hr.requester_id = v_member_ids[1] AND m.responder_id = v_member_ids[2]))
    ) THEN
      INSERT INTO requests.help_requests (
        id, requester_id, title, description, category, status,
        request_type, is_public, requester_visibility_consent, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_member_ids[2],
        'Direct Exchange Request', 'Direct exchange to seed trust path.',
        'Other', 'completed', 'generic', TRUE, TRUE,
        NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '3 hours'
      ) RETURNING id INTO v_request_id;

      INSERT INTO requests.matches (
        id, request_id, responder_id, status, requester_visible, responder_visible,
        created_at, updated_at, completed_at
      ) VALUES (
        gen_random_uuid(), v_request_id, v_member_ids[1], 'completed', TRUE, TRUE,
        NOW() - INTERVAL '5 days' + INTERVAL '1 hour',
        NOW() - INTERVAL '5 days' + INTERVAL '3 hours',
        NOW() - INTERVAL '5 days' + INTERVAL '3 hours'
      );

      RAISE NOTICE 'Created direct exchange between members % and %', v_member_ids[1], v_member_ids[2];
    END IF;
  END IF;

  RAISE NOTICE '✅ Exchange network seeded successfully for community %', v_community_id;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Exchange network seed failed: %', SQLERRM;
END;
$$;
