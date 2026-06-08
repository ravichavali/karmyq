--
-- Social Karma v2.0 Test Data Seeding Script
-- Creates realistic data for milestones, feedback, and community health
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
      community_id,
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
      v_community_id,
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

    -- Add interaction feedback (80% of matches have feedback)
    IF v_counter % 5 != 0 THEN
      -- Requester rates helper
      INSERT INTO requests.interaction_feedback (
        match_id,
        from_user_id,
        to_user_id,
        helpfulness,
        responsiveness,
        clarity,
        comment,
        allow_featuring,
        created_at
      ) VALUES (
        v_match_id,
        CASE (v_counter % 5)
          WHEN 0 THEN v_user1_id
          WHEN 1 THEN v_user2_id
          WHEN 2 THEN v_user3_id
          WHEN 3 THEN v_user4_id
          ELSE v_user5_id
        END,
        CASE ((v_counter + 2) % 5)
          WHEN 0 THEN v_user1_id
          WHEN 1 THEN v_user2_id
          WHEN 2 THEN v_user3_id
          WHEN 3 THEN v_user4_id
          ELSE v_user5_id
        END,
        4 + (RANDOM() * 1)::INTEGER, -- 4-5 stars
        4 + (RANDOM() * 1)::INTEGER,
        4 + (RANDOM() * 1)::INTEGER,
        CASE (v_counter % 4)
          WHEN 0 THEN 'Super helpful and responsive!'
          WHEN 1 THEN 'Great communication, made it easy.'
          WHEN 2 THEN 'Quick and efficient help!'
          ELSE 'Very clear instructions, thank you!'
        END,
        (v_counter % 3 = 0), -- 1/3 allow featuring
        NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '4 hours'
      );

      -- Helper rates requester (50% reciprocal feedback)
      IF v_counter % 2 = 0 THEN
        INSERT INTO requests.interaction_feedback (
          match_id,
          from_user_id,
          to_user_id,
          helpfulness,
          responsiveness,
          clarity,
          comment,
          allow_featuring,
          created_at
        ) VALUES (
          v_match_id,
          CASE ((v_counter + 2) % 5)
            WHEN 0 THEN v_user1_id
            WHEN 1 THEN v_user2_id
            WHEN 2 THEN v_user3_id
            WHEN 3 THEN v_user4_id
            ELSE v_user5_id
          END,
          CASE (v_counter % 5)
            WHEN 0 THEN v_user1_id
            WHEN 1 THEN v_user2_id
            WHEN 2 THEN v_user3_id
            WHEN 3 THEN v_user4_id
            ELSE v_user5_id
          END,
          4 + (RANDOM() * 1)::INTEGER,
          4 + (RANDOM() * 1)::INTEGER,
          4 + (RANDOM() * 1)::INTEGER,
          CASE (v_counter % 3)
            WHEN 0 THEN 'Very clear about what was needed!'
            WHEN 1 THEN 'Easy to coordinate with.'
            ELSE 'Well organized, thank you!'
          END,
          (v_counter % 3 = 0),
          NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '5 hours'
        );
      END IF;
    END IF;

    -- Create featured story if both parties consent and allow featuring
    IF v_counter % 6 = 0 THEN -- ~17% of matches become featured stories
      INSERT INTO feed.featured_stories (
        match_id,
        requester_id,
        responder_id,
        requester_visible,
        responder_visible,
        interaction_category,
        community_id,
        created_at
      ) VALUES (
        v_match_id,
        CASE (v_counter % 5)
          WHEN 0 THEN v_user1_id
          WHEN 1 THEN v_user2_id
          WHEN 2 THEN v_user3_id
          WHEN 3 THEN v_user4_id
          ELSE v_user5_id
        END,
        CASE ((v_counter + 2) % 5)
          WHEN 0 THEN v_user1_id
          WHEN 1 THEN v_user2_id
          WHEN 2 THEN v_user3_id
          WHEN 3 THEN v_user4_id
          ELSE v_user5_id
        END,
        TRUE, -- Both visible
        TRUE,
        CASE (v_counter % 5)
          WHEN 0 THEN 'Moving & Transportation'
          WHEN 1 THEN 'Food & Groceries'
          WHEN 2 THEN 'Home Repair'
          WHEN 3 THEN 'Childcare'
          ELSE 'Other'
        END,
        v_community_id,
        NOW() - INTERVAL '90 days' + (v_counter || ' days')::INTERVAL + INTERVAL '6 hours'
      );
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Created 60 completed matches with feedback';

  -- Manually insert milestones (simulating detection)
  INSERT INTO reputation.milestone_events (
    community_id,
    milestone_type,
    description,
    achieved_at
  ) VALUES
    (v_community_id, 'matches_10', 'Reached 10 successful help exchanges!', NOW() - INTERVAL '75 days'),
    (v_community_id, 'participants_10', '10 unique members have participated', NOW() - INTERVAL '70 days'),
    (v_community_id, 'matches_50', 'Reached 50 successful help exchanges!', NOW() - INTERVAL '30 days'),
    (v_community_id, 'quality_4.0', 'Community average quality rating reached 4.0!', NOW() - INTERVAL '20 days'),
    (v_community_id, 'participants_25', '25 unique members have participated', NOW() - INTERVAL '15 days')
  ON CONFLICT (community_id, milestone_type) DO NOTHING;

  RAISE NOTICE '✅ Created 5 milestone events';

  -- Calculate community health metrics (simulating daily cron job)
  INSERT INTO reputation.community_health_metrics (
    community_id,
    snapshot_date,
    total_matches_completed,
    total_active_requesters,
    total_active_helpers,
    unique_participant_count,
    avg_helpfulness,
    avg_responsiveness,
    avg_clarity,
    network_density,
    growth_rate_matches,
    growth_rate_participants
  ) VALUES
    (v_community_id, CURRENT_DATE - INTERVAL '7 days', 50, 15, 18, 25, 4.4, 4.5, 4.3, 0.68, 8.5, 12.0),
    (v_community_id, CURRENT_DATE, 60, 18, 22, 30, 4.6, 4.7, 4.5, 0.72, 12.5, 15.0)
  ON CONFLICT (community_id, snapshot_date) DO UPDATE
    SET total_matches_completed = EXCLUDED.total_matches_completed,
        total_active_requesters = EXCLUDED.total_active_requesters,
        total_active_helpers = EXCLUDED.total_active_helpers,
        unique_participant_count = EXCLUDED.unique_participant_count,
        avg_helpfulness = EXCLUDED.avg_helpfulness,
        avg_responsiveness = EXCLUDED.avg_responsiveness,
        avg_clarity = EXCLUDED.avg_clarity,
        network_density = EXCLUDED.network_density,
        growth_rate_matches = EXCLUDED.growth_rate_matches,
        growth_rate_participants = EXCLUDED.growth_rate_participants;

  RAISE NOTICE '✅ Created health metrics snapshots';

  -- Update community health summary (cached)
  UPDATE communities.communities
  SET health_summary = jsonb_build_object(
    'network_strength', 78.5,
    'total_matches', 60,
    'active_helpers', 22,
    'unique_participants', 30,
    'avg_quality', 4.6,
    'growth_7d', 12.5,
    'growth_30d', 45.2,
    'last_calculated', NOW()
  )
  WHERE id = v_community_id;

  RAISE NOTICE '✅ Updated community health summary';

  -- Update trust scores for all 5 users
  UPDATE reputation.trust_scores
  SET
    avg_helpfulness = 4.6,
    avg_responsiveness = 4.7,
    avg_clarity = 4.5,
    total_feedback_received = 12,
    updated_at = NOW()
  WHERE community_id = v_community_id
    AND user_id IN (v_user1_id, v_user2_id, v_user3_id, v_user4_id, v_user5_id);

  RAISE NOTICE '✅ Updated trust scores';

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Social Karma v2.0 test data seeded successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '- 60 completed matches';
  RAISE NOTICE '- 48 interaction feedbacks (80%% coverage)';
  RAISE NOTICE '- 10 featured stories';
  RAISE NOTICE '- 5 milestones achieved';
  RAISE NOTICE '- 2 health metrics snapshots';
  RAISE NOTICE '- Network strength: 78.5/100 (Strong)';
  RAISE NOTICE '- Growth: +12.5%% (7-day)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test the endpoints:';
  RAISE NOTICE 'GET /requests/feed/community-health?community_id=%', v_community_id;
END $$;
