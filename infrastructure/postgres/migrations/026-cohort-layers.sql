-- Migration 026: Cohort Layer Calculation (Sprint 16 - ADR-017 Phase 2)
-- Adds calculate_community_layer() function. No new tables needed.
-- Layers are computed from interaction frequency over the last 6 months:
--   inner_circle      >= 4 interactions/month
--   active_community  >= 1 interaction/month
--   extended_network  < 1 interaction/month

BEGIN;

CREATE OR REPLACE FUNCTION calculate_community_layer(
    p_user_id UUID,
    p_community_id UUID
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_interactions_per_month DECIMAL;
BEGIN
    SELECT COUNT(*) / 6.0 INTO v_interactions_per_month
    FROM (
        -- Requests created (global — help_requests has no community_id column)
        SELECT created_at FROM requests.help_requests
        WHERE requester_id = p_user_id
          AND created_at > NOW() - INTERVAL '6 months'

        UNION ALL

        -- Offers made (community-scoped)
        SELECT created_at FROM requests.help_offers
        WHERE offerer_id = p_user_id
          AND community_id = p_community_id
          AND created_at > NOW() - INTERVAL '6 months'

        UNION ALL

        -- Messages sent (global — messages has no community_id)
        SELECT created_at FROM messaging.messages
        WHERE sender_id = p_user_id
          AND created_at > NOW() - INTERVAL '6 months'
    ) interactions;

    IF v_interactions_per_month >= 4 THEN
        RETURN 'inner_circle';
    ELSIF v_interactions_per_month >= 1 THEN
        RETURN 'active_community';
    ELSE
        RETURN 'extended_network';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
