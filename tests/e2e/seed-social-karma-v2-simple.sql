--
-- Social Karma v2.0 Simple Test Data Seeding
-- Adds featured stories and milestones to existing E2E data
--

DO $$
DECLARE
  v_community_id UUID;
  v_match RECORD;
  v_match_count INTEGER := 0;
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

  -- Create featured stories from existing completed matches
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
    v_match_count := v_match_count + 1;

    -- Create an anonymous fixture story independently of retired feedback.
    IF v_match_count % 6 = 0 THEN
      INSERT INTO feed.featured_stories (
        community_id, story_type, title, description, match_id, category, is_public, created_at
      ) SELECT v_community_id, 'exchange', 'Neighbours helping neighbours',
        'A successful help exchange in the community.', v_match.match_id, 'General', TRUE, v_match.completed_at + INTERVAL '3 hours'
      WHERE NOT EXISTS (SELECT 1 FROM feed.featured_stories WHERE match_id = v_match.match_id);

      v_story_count := v_story_count + 1;
    END IF;
  END LOOP;

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
    (v_community_id, 'participants_25', 25, '25 unique members have participated', NOW() - INTERVAL '1 day');

  RAISE NOTICE '✅ Created 4 milestone events';

  -- Calculate metrics snapshots
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
  )
  SELECT
    v_community_id,
    CURRENT_DATE - INTERVAL '7 days',
    40,
    12,
    15,
    20,
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
  RAISE NOTICE '  GET /requests/feed/community-health?community_id=<id>';
END $$;
