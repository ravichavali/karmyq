--
-- Social Karma v2.0 Simple Test Data Seeding
-- Adds feedback and milestones to existing E2E data
--

DO $$
DECLARE
  v_community_id UUID;
  v_match RECORD;
  v_feedback_count INTEGER := 0;
  v_story_count INTEGER := 0;
BEGIN
  -- Get first community
  SELECT id INTO v_community_id
  FROM communities.communities
  ORDER BY created_at
  LIMIT 1;

  IF v_community_id IS NULL THEN
    RAISE NOTICE 'No community found. Please run E2E seed data first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding Social Karma v2.0 data for community: %', v_community_id;

  -- Add feedback to existing completed matches
  FOR v_match IN
    SELECT m.id as match_id,
           m.responder_id,
           r.requester_id,
           m.completed_at,
           m.created_at
    FROM requests.matches m
    JOIN requests.help_requests r ON m.request_id = r.id
    JOIN requests.request_communities rc ON r.id = rc.request_id
    WHERE rc.community_id = v_community_id
      AND m.status = 'completed'
    LIMIT 50
  LOOP
    -- Requester rates helper (if not already exists)
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
      v_match.match_id,
      v_match.requester_id,
      v_match.responder_id,
      4 + (RANDOM())::INTEGER, -- 4-5 stars
      4 + (RANDOM())::INTEGER,
      4 + (RANDOM())::INTEGER,
      CASE (v_feedback_count % 4)
        WHEN 0 THEN 'Super helpful and responsive!'
        WHEN 1 THEN 'Great communication, made it easy.'
        WHEN 2 THEN 'Quick and efficient help!'
        ELSE 'Very clear instructions, thank you!'
      END,
      (v_feedback_count % 3 = 0), -- 1/3 allow featuring
      v_match.completed_at + INTERVAL '1 hour'
    )
    ON CONFLICT (match_id, from_user_id) DO NOTHING;

    v_feedback_count := v_feedback_count + 1;

    -- Helper rates requester (50% reciprocal)
    IF v_feedback_count % 2 = 0 THEN
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
        v_match.match_id,
        v_match.responder_id,
        v_match.requester_id,
        4 + (RANDOM())::INTEGER,
        4 + (RANDOM())::INTEGER,
        4 + (RANDOM())::INTEGER,
        CASE (v_feedback_count % 3)
          WHEN 0 THEN 'Very clear about what was needed!'
          WHEN 1 THEN 'Easy to coordinate with.'
          ELSE 'Well organized, thank you!'
        END,
        (v_feedback_count % 3 = 0),
        v_match.completed_at + INTERVAL '2 hours'
      )
      ON CONFLICT (match_id, from_user_id) DO NOTHING;
    END IF;

    -- Create featured story if both allow featuring
    IF v_feedback_count % 6 = 0 THEN
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
        v_match.match_id,
        v_match.requester_id,
        v_match.responder_id,
        TRUE,
        TRUE,
        'General',
        v_community_id,
        v_match.completed_at + INTERVAL '3 hours'
      )
      ON CONFLICT (match_id) DO NOTHING;

      v_story_count := v_story_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Added % interaction feedbacks', v_feedback_count;
  RAISE NOTICE '✅ Created % featured stories', v_story_count;

  -- Insert milestones (delete existing first to avoid duplicates)
  DELETE FROM reputation.milestone_events WHERE community_id = v_community_id;

  INSERT INTO reputation.milestone_events (
    community_id,
    milestone_type,
    milestone_value,
    description,
    achieved_at
  ) VALUES
    (v_community_id, 'matches_10', 10, 'Reached 10 successful help exchanges!', NOW() - INTERVAL '30 days'),
    (v_community_id, 'participants_10', 10, '10 unique members have participated', NOW() - INTERVAL '25 days'),
    (v_community_id, 'matches_50', 50, 'Reached 50 successful help exchanges!', NOW() - INTERVAL '7 days'),
    (v_community_id, 'quality_40', 40, 'Community average quality rating reached 4.0!', NOW() - INTERVAL '3 days'),
    (v_community_id, 'participants_25', 25, '25 unique members have participated', NOW() - INTERVAL '1 day');

  RAISE NOTICE '✅ Created 5 milestone events';

  -- Calculate metrics snapshots
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
  )
  SELECT
    v_community_id,
    CURRENT_DATE - INTERVAL '7 days',
    40,
    12,
    15,
    20,
    4.4,
    4.5,
    4.3,
    0.65,
    8.0,
    10.0
  WHERE NOT EXISTS (
    SELECT 1 FROM reputation.community_health_metrics
    WHERE community_id = v_community_id
    AND snapshot_date = CURRENT_DATE - INTERVAL '7 days'
  );

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
  )
  SELECT
    v_community_id,
    CURRENT_DATE,
    50,
    15,
    18,
    25,
    4.6,
    4.7,
    4.5,
    0.70,
    12.5,
    15.0
  WHERE NOT EXISTS (
    SELECT 1 FROM reputation.community_health_metrics
    WHERE community_id = v_community_id
    AND snapshot_date = CURRENT_DATE
  );

  RAISE NOTICE '✅ Created health metrics snapshots';

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Social Karma v2.0 test data seeded!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test endpoints with community_id: %', v_community_id;
  RAISE NOTICE '  GET /feed/milestones?community_id=<id>';
  RAISE NOTICE '  GET /feed/featured-stories?community_id=<id>';
  RAISE NOTICE '  GET /feed/community-health?community_id=<id>';
  RAISE NOTICE '  GET /feed/mixed?community_id=<id>';
END $$;
