--
-- Social Karma v2.0 Test Data Seeding Script
-- Creates realistic data for milestones, featured stories, and community health
--

-- Use the first community from the database (Portland Mutual Aid)
DO $$
DECLARE
  v_community_id UUID;
  v_user1_id UUID;
  v_user2_id UUID;
  v_user3_id UUID;
  v_user4_id UUID;
  v_user5_id UUID;
  v_request_id UUID;
  v_match_id UUID;
  v_counter INTEGER;
BEGIN
  -- Get first community
  SELECT id INTO v_community_id FROM communities.communities ORDER BY created_at LIMIT 1;

  IF v_community_id IS NULL THEN
    RAISE NOTICE 'No community found. Please run E2E seed data first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding Social Karma v2.0 data for community: %', v_community_id;

  -- Get 5 users from the community
  SELECT id INTO v_user1_id FROM auth.users WHERE email LIKE '%@example.com' ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO v_user2_id FROM auth.users WHERE email LIKE '%@example.com' ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO v_user3_id FROM auth.users WHERE email LIKE '%@example.com' ORDER BY created_at LIMIT 1 OFFSET 2;
  SELECT id INTO v_user4_id FROM auth.users WHERE email LIKE '%@example.com' ORDER BY created_at LIMIT 1 OFFSET 3;
  SELECT id INTO v_user5_id FROM auth.users WHERE email LIKE '%@example.com' ORDER BY created_at LIMIT 1 OFFSET 4;

  -- Ensure all users are members of the community
  INSERT INTO communities.members (community_id, user_id, role, joined_at)
  VALUES
    (v_community_id, v_user1_id, 'member', NOW() - INTERVAL '90 days'),
    (v_community_id, v_user2_id, 'member', NOW() - INTERVAL '80 days'),
    (v_community_id, v_user3_id, 'member', NOW() - INTERVAL '70 days'),
    (v_community_id, v_user4_id, 'member', NOW() - INTERVAL '60 days'),
    (v_community_id, v_user5_id, 'member', NOW() - INTERVAL '50 days')
  ON CONFLICT (community_id, user_id) DO NOTHING;

  -- Create 60 completed matches over the past 90 days (to trigger milestones)
  FOR v_counter IN 1..60 LOOP
    -- Create a request
    INSERT INTO requests.help_requests (
      id,
      requester_id,
      title,
      description,
      category,
      status,
      is_public,
      requester_visibility_consent,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      CASE (v_counter % 5)
        WHEN 0 THEN v_user1_id
        WHEN 1 THEN v_user2_id
        WHEN 2 THEN v_user3_id
        WHEN 3 THEN v_user4_id
        ELSE v_user5_id
      END,
      'Help Request #' || v_counter,
      'Description for help request ' || v_counter,
      CASE (v_counter % 5)
        WHEN 0 THEN 'Moving & Transportation'
        WHEN 1 THEN 'Food & Groceries'
        WHEN 2 THEN 'Home Repair'
        WHEN 3 THEN 'Childcare'
        ELSE 'Other'
      END,
      'completed',
      (v_counter % 3 = 0), -- 1/3 are public
      (v_counter % 2 = 0), -- 1/2 consent to visibility
      NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL,
      NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '2 hours'
    ) RETURNING id INTO v_request_id;

    INSERT INTO requests.request_communities (request_id, community_id)
    VALUES (v_request_id, v_community_id);

    -- Create a completed match
    INSERT INTO requests.matches (
      id,
      request_id,
      responder_id,
      status,
      requester_visible,
      responder_visible,
      interaction_category,
      created_at,
      updated_at,
      completed_at
    ) VALUES (
      gen_random_uuid(),
      v_request_id,
      CASE ((v_counter + 2) % 5)
        WHEN 0 THEN v_user1_id
        WHEN 1 THEN v_user2_id
        WHEN 2 THEN v_user3_id
        WHEN 3 THEN v_user4_id
        ELSE v_user5_id
      END,
      'completed',
      (v_counter % 2 = 0), -- Requester visible
      (v_counter % 3 = 0), -- Responder visible
      CASE (v_counter % 5)
        WHEN 0 THEN 'Moving & Transportation'
        WHEN 1 THEN 'Food & Groceries'
        WHEN 2 THEN 'Home Repair'
        WHEN 3 THEN 'Childcare'
        ELSE 'Other'
      END,
      NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '1 hour',
      NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '3 hours',
      NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '3 hours'
    ) RETURNING id INTO v_match_id;

    -- Create anonymous fixture stories independently of retired feedback.
    IF v_counter % 6 = 0 THEN -- ~17% of matches become featured stories
      INSERT INTO feed.featured_stories (
        community_id, story_type, title, description, match_id, category, is_public, created_at
      ) SELECT v_community_id, 'exchange', 'Neighbours helping neighbours',
        'A successful help exchange in the community.', v_match_id, 'General', TRUE, NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '6 hours'
      WHERE NOT EXISTS (SELECT 1 FROM feed.featured_stories WHERE match_id = v_match_id);

    END IF;
  END LOOP;

  RAISE NOTICE '✅ Created 60 completed matches';

  -- Manually insert milestones (simulating detection)
  INSERT INTO reputation.milestone_events (
    community_id,
    milestone_type,
    milestone_value,
    description,
    achieved_at
  ) SELECT v_community_id, fixture.kind, fixture.value, fixture.description, fixture.achieved_at
    FROM (VALUES
      ('10_matches', 10, 'Reached 10 successful help exchanges!', NOW() - INTERVAL '75 days'),
      ('10_participants', 10, '10 unique members have participated', NOW() - INTERVAL '70 days'),
      ('50_matches', 50, 'Reached 50 successful help exchanges!', NOW() - INTERVAL '30 days'),
      ('25_participants', 25, '25 unique members have participated', NOW() - INTERVAL '15 days')
    ) AS fixture(kind, value, description, achieved_at)
    WHERE NOT EXISTS (SELECT 1 FROM reputation.milestone_events e
      WHERE e.community_id = v_community_id AND e.milestone_type = fixture.kind);

  RAISE NOTICE '✅ Created 4 milestone events';

  -- Calculate community health metrics (simulating daily cron job)
  INSERT INTO reputation.community_health_metrics (
    community_id,
    snapshot_date,
    total_matches_completed,
    total_active_requesters,
    total_active_helpers,
    unique_participant_count,
    network_density,
    growth_rate_matches,
    growth_rate_participants
  ) VALUES
    (v_community_id, CURRENT_DATE - INTERVAL '7 days', 50, 15, 18, 25, 0.68, 8.5, 12.0),
    (v_community_id, CURRENT_DATE, 60, 18, 22, 30, 0.72, 12.5, 15.0)
  ON CONFLICT (community_id, snapshot_date) DO UPDATE
    SET total_matches_completed = EXCLUDED.total_matches_completed,
        total_active_requesters = EXCLUDED.total_active_requesters,
        total_active_helpers = EXCLUDED.total_active_helpers,
        unique_participant_count = EXCLUDED.unique_participant_count,
        network_density = EXCLUDED.network_density,
        growth_rate_matches = EXCLUDED.growth_rate_matches,
        growth_rate_participants = EXCLUDED.growth_rate_participants;

  RAISE NOTICE '✅ Created health metrics snapshots';

  -- Cache the same default-zero-quality score used by reputation health.
  INSERT INTO communities.health_summary
    (community_id, total_exchanges, active_members, network_strength, trend_direction, trend_percentage)
  VALUES (v_community_id, 60, 30, 30.4, 'growing', 12.5)
  ON CONFLICT (community_id) DO UPDATE SET
    total_exchanges = EXCLUDED.total_exchanges, active_members = EXCLUDED.active_members,
    network_strength = EXCLUDED.network_strength, trend_direction = EXCLUDED.trend_direction,
    trend_percentage = EXCLUDED.trend_percentage, last_calculated = NOW();

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Social Karma v2.0 test data seeded successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '- 60 completed matches';
  RAISE NOTICE '- 10 featured stories';
  RAISE NOTICE '- 4 milestones achieved';
  RAISE NOTICE '- 2 health metrics snapshots';
  RAISE NOTICE '- Network strength: 30.4/100 (Developing)';
  RAISE NOTICE '- Growth: +12.5%% (7-day)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test the endpoints:';
  RAISE NOTICE 'GET /requests/feed/community-health?community_id=%', v_community_id;
END $$;
