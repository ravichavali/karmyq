-- =============================================================================
-- GENERATED SCHEMA — DO NOT EDIT BY HAND
-- Source: scripts/regenerate-init-sql.sh + infrastructure/postgres/migrations/*.sql
-- =============================================================================

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;

--
-- Name: communities; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA communities;

--
-- Name: events; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA events;

--
-- Name: federation; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA federation;

--
-- Name: feed; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA feed;

--
-- Name: feedback; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA feedback;

--
-- Name: governance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA governance;

--
-- Name: messaging; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA messaging;

--
-- Name: notifications; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA notifications;

--
-- Name: provider; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA provider;

--
-- Name: reputation; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA reputation;

--
-- Name: requests; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA requests;

--
-- Name: social_graph; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA social_graph;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

--
-- Name: request_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_type_enum AS ENUM (
    'generic',
    'ride',
    'borrow',
    'service',
    'event'
);

--
-- Name: visibility_scope_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibility_scope_enum AS ENUM (
    'community',
    'trust_network',
    'platform'
);

--
-- Name: cleanup_expired_social_distances(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.cleanup_expired_social_distances() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM auth.social_distances
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$;

--
-- Name: compute_inviter_tier(numeric, integer, numeric); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.compute_inviter_tier(p_avg_karma numeric, p_total_accepted integer, p_acceptance_rate numeric) RETURNS character varying
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    -- Platinum: 10+ accepted invitations, 80+ avg karma, 70%+ acceptance rate
    IF p_total_accepted >= 10 AND p_avg_karma >= 80 AND p_acceptance_rate >= 70 THEN
        RETURN 'platinum';

    -- Gold: 5+ accepted, 70+ avg karma, 60%+ acceptance
    ELSIF p_total_accepted >= 5 AND p_avg_karma >= 70 AND p_acceptance_rate >= 60 THEN
        RETURN 'gold';

    -- Silver: 3+ accepted, 60+ avg karma, 50%+ acceptance
    ELSIF p_total_accepted >= 3 AND p_avg_karma >= 60 AND p_acceptance_rate >= 50 THEN
        RETURN 'silver';

    -- Bronze: default
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$;

--
-- Name: generate_invitation_code(text, integer); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.generate_invitation_code(p_inviter_name text, p_year integer DEFAULT (EXTRACT(year FROM now()))::integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_code TEXT;
    v_random_suffix TEXT;
    v_exists BOOLEAN;
BEGIN
    -- Generate random 4-character alphanumeric suffix
    LOOP
        v_random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
        v_code := FORMAT('KARMYQ-%s-%s-%s',
            UPPER(REGEXP_REPLACE(p_inviter_name, '[^A-Za-z0-9]', '', 'g')),
            p_year,
            v_random_suffix
        );

        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM auth.user_invitations WHERE invitation_code = v_code) INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$;

--
-- Name: update_inviter_stats_on_acceptance(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.update_inviter_stats_on_acceptance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only run when invitation_accepted_at changes from NULL to a timestamp
    IF OLD.invitation_accepted_at IS NULL AND NEW.invitation_accepted_at IS NOT NULL THEN
        INSERT INTO auth.inviter_stats (user_id, community_id, total_invitations_accepted)
        VALUES (NEW.inviter_id, NEW.community_id, 1)
        ON CONFLICT (user_id, community_id) DO UPDATE
        SET
            total_invitations_accepted = auth.inviter_stats.total_invitations_accepted + 1,
            acceptance_rate = (
                (auth.inviter_stats.total_invitations_accepted + 1.0) /
                NULLIF(auth.inviter_stats.total_invitations_sent, 0) * 100
            ),
            last_computed = NOW();
    END IF;

    RETURN NEW;
END;
$$;

--
-- Name: calculate_expires_at(uuid, character varying, timestamp without time zone); Type: FUNCTION; Schema: communities; Owner: -
--

CREATE FUNCTION communities.calculate_expires_at(p_community_id uuid, p_entity_type character varying, p_created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP) RETURNS timestamp without time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ttl_days INTEGER;
BEGIN
    -- Get TTL for entity type from community settings
    SELECT
        CASE p_entity_type
            WHEN 'request' THEN request_ttl_days
            WHEN 'offer' THEN offer_ttl_days
            WHEN 'message' THEN message_ttl_days
            WHEN 'notification' THEN notification_ttl_days
            ELSE 60 -- Default
        END
    INTO v_ttl_days
    FROM communities.settings
    WHERE community_id = p_community_id;

    -- If no settings found, use default 60 days
    IF v_ttl_days IS NULL THEN
        v_ttl_days := 60;
    END IF;

    -- Calculate expiration timestamp
    RETURN p_created_at + (v_ttl_days || ' days')::INTERVAL;
END;
$$;

--
-- Name: FUNCTION calculate_expires_at(p_community_id uuid, p_entity_type character varying, p_created_at timestamp without time zone); Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON FUNCTION communities.calculate_expires_at(p_community_id uuid, p_entity_type character varying, p_created_at timestamp without time zone) IS 'Calculate expiration timestamp based on community TTL settings';

--
-- Name: update_community_config_timestamp(); Type: FUNCTION; Schema: communities; Owner: -
--

CREATE FUNCTION communities.update_community_config_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Name: update_community_links_updated_at(); Type: FUNCTION; Schema: communities; Owner: -
--

CREATE FUNCTION communities.update_community_links_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

--
-- Name: update_settings_timestamp(); Type: FUNCTION; Schema: communities; Owner: -
--

CREATE FUNCTION communities.update_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Name: set_message_expires_at(); Type: FUNCTION; Schema: messaging; Owner: -
--

CREATE FUNCTION messaging.set_message_expires_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- Get community_id from conversation's match via request_communities junction table
    SELECT rc.community_id INTO v_community_id
    FROM messaging.conversations conv
    JOIN requests.matches m ON conv.request_match_id = m.id
    JOIN requests.request_communities rc ON m.request_id = rc.request_id
    WHERE conv.id = NEW.conversation_id
    LIMIT 1; -- Take first community if request is in multiple

    IF v_community_id IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(v_community_id, 'message', NEW.created_at);
    ELSIF NEW.expires_at IS NULL THEN
        -- Fallback to default 60 days if no community found
        NEW.expires_at := NEW.created_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$;

--
-- Name: set_notification_expires_at(); Type: FUNCTION; Schema: notifications; Owner: -
--

CREATE FUNCTION notifications.set_notification_expires_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- Extract community_id from data JSONB if exists
    v_community_id := (NEW.data->>'community_id')::UUID;

    IF v_community_id IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(v_community_id, 'notification', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: notifications; Owner: -
--

CREATE FUNCTION notifications.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

--
-- Name: calculate_community_layer(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_community_layer(p_user_id uuid, p_community_id uuid) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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
$$;

--
-- Name: create_schema_version_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_schema_version_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only create version history when publishing
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    INSERT INTO requests.ui_schema_versions (
      schema_id,
      version,
      schema_snapshot,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.version,
      jsonb_build_object(
        'type', NEW.type,
        'version', NEW.version,
        'label', NEW.label,
        'icon', NEW.icon,
        'color', NEW.color,
        'description', NEW.description,
        'sections', NEW.sections,
        'summary', NEW.summary,
        'variant', NEW.variant
      ),
      NEW.updated_by
    );
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: update_ui_schemas_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ui_schemas_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Name: update_user_preferences_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_preferences_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Name: update_validation_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_validation_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

--
-- Name: calculate_decayed_karma(uuid, uuid); Type: FUNCTION; Schema: reputation; Owner: -
--

CREATE FUNCTION reputation.calculate_decayed_karma(p_user_id uuid, p_community_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_karma INTEGER := 0;
    v_half_life_months INTEGER;
    v_record RECORD;
    v_months_ago NUMERIC;
    v_decay_factor NUMERIC;
BEGIN
    -- Get half-life setting from community
    SELECT reputation_half_life_months INTO v_half_life_months
    FROM communities.settings
    WHERE community_id = p_community_id;

    -- Default to 6 months if not set
    IF v_half_life_months IS NULL THEN
        v_half_life_months := 6;
    END IF;

    -- Calculate decayed karma for all records
    FOR v_record IN
        SELECT points, created_at
        FROM reputation.karma_records
        WHERE user_id = p_user_id AND community_id = p_community_id
    LOOP
        -- Calculate how many months ago this karma was earned
        v_months_ago := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_record.created_at)) / (30.44 * 24 * 60 * 60);

        -- Calculate decay factor using exponential decay formula
        -- decay_factor = 0.5^(months_ago / half_life_months)
        v_decay_factor := POWER(0.5, v_months_ago / v_half_life_months);

        -- Add decayed karma to total
        v_total_karma := v_total_karma + ROUND(v_record.points * v_decay_factor);
    END LOOP;

    RETURN GREATEST(v_total_karma, 0); -- Never negative
END;
$$;

--
-- Name: FUNCTION calculate_decayed_karma(p_user_id uuid, p_community_id uuid); Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON FUNCTION reputation.calculate_decayed_karma(p_user_id uuid, p_community_id uuid) IS 'Calculate user karma with exponential time-based decay';

--
-- Name: calculate_decayed_karma(integer, timestamp with time zone, integer); Type: FUNCTION; Schema: reputation; Owner: -
--

CREATE FUNCTION reputation.calculate_decayed_karma(original_karma integer, earned_date timestamp with time zone, half_life_months integer DEFAULT 6) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    months_elapsed NUMERIC;
    decay_factor NUMERIC;
BEGIN
    -- Calculate months since karma was earned
    months_elapsed := EXTRACT(EPOCH FROM (NOW() - earned_date)) / (30.44 * 24 * 60 * 60);

    -- Calculate decay factor using exponential decay formula
    -- decay_factor = 2^(-months_elapsed / half_life_months)
    decay_factor := POWER(2, -months_elapsed / half_life_months);

    -- Return decayed karma
    RETURN decay_factor;
END;
$$;

--
-- Name: set_offer_expires_at(); Type: FUNCTION; Schema: requests; Owner: -
--

CREATE FUNCTION requests.set_offer_expires_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        -- Default to 60 days from creation (production default TTL)
        NEW.expires_at := NEW.created_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$;

--
-- Name: set_request_expires_at(); Type: FUNCTION; Schema: requests; Owner: -
--

CREATE FUNCTION requests.set_request_expires_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        -- Default to 60 days from creation (production default TTL)
        -- Community-specific TTL can be set via application logic if needed
        NEW.expires_at := NEW.created_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: device_push_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.device_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    platform character varying(10),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT device_push_tokens_platform_check CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying])::text[])))
);

--
-- Name: founding_circle_submissions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.founding_circle_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(320) NOT NULL,
    lens character varying(200),
    contribution text,
    concern text,
    source_page character varying(64) DEFAULT 'join'::character varying NOT NULL,
    status character varying(24) DEFAULT 'new'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp without time zone
);

--
-- Name: inviter_stats; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.inviter_stats (
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    total_invitations_sent integer DEFAULT 0,
    total_invitations_accepted integer DEFAULT 0,
    acceptance_rate numeric(5,2) DEFAULT 0,
    avg_invitee_karma numeric(5,2) DEFAULT 0,
    avg_invitee_trust_score numeric(5,2) DEFAULT 0,
    total_invitee_exchanges integer DEFAULT 0,
    total_network_size integer DEFAULT 0,
    bridge_score integer DEFAULT 0,
    inviter_tier character varying(20) DEFAULT 'bronze'::character varying,
    tier_updated_at timestamp without time zone,
    last_computed timestamp without time zone DEFAULT now()
);

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: social_distances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.social_distances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_a_id uuid NOT NULL,
    user_b_id uuid NOT NULL,
    community_id uuid,
    degrees_of_separation integer NOT NULL,
    shortest_path jsonb NOT NULL,
    highest_trust_path jsonb,
    path_trust_score double precision,
    connection_type character varying(50) DEFAULT 'exchange'::character varying,
    computed_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    CONSTRAINT social_distances_degrees_of_separation_check CHECK (((degrees_of_separation >= 1) AND (degrees_of_separation <= 4)))
);

--
-- Name: user_feed_preferences; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_feed_preferences (
    user_id uuid NOT NULL,
    feed_show_trust_network boolean DEFAULT true,
    feed_trust_network_max_degrees integer DEFAULT 3,
    feed_show_platform boolean DEFAULT false,
    feed_platform_categories jsonb DEFAULT '["digital", "questions"]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_feed_preferences_feed_trust_network_max_degrees_check CHECK (((feed_trust_network_max_degrees >= 1) AND (feed_trust_network_max_degrees <= 6)))
);

--
-- Name: TABLE user_feed_preferences; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.user_feed_preferences IS 'User preferences for multi-tier feed visibility (ADR-022)';

--
-- Name: COLUMN user_feed_preferences.feed_show_trust_network; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_feed_preferences.feed_show_trust_network IS 'Whether to show requests from trust network (beyond own communities)';

--
-- Name: COLUMN user_feed_preferences.feed_show_platform; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_feed_preferences.feed_show_platform IS 'Whether to show platform-wide requests (opt-in explore mode)';

--
-- Name: user_interests; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_interests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    interest_type character varying(50) NOT NULL,
    interest_value character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE user_interests; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.user_interests IS 'User interests for specific categories within request types (e.g., interested in plumbing services)';

--
-- Name: COLUMN user_interests.interest_type; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_interests.interest_type IS 'The type of interest: service_category, item_category, event_type';

--
-- Name: COLUMN user_interests.interest_value; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_interests.interest_value IS 'The specific value of the interest (e.g., plumbing, tools, volunteer)';

--
-- Name: user_invitations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_id uuid,
    invited_at timestamp without time zone DEFAULT now() NOT NULL,
    invitation_code text NOT NULL,
    invitation_accepted_at timestamp without time zone,
    community_id uuid,
    invitation_method character varying(50),
    inviter_note text,
    CONSTRAINT invitation_code_format CHECK ((invitation_code ~ '^KARMYQ-[A-Z0-9]+-[0-9]{4}-[A-Z0-9]{4}$'::text)),
    CONSTRAINT no_self_invitation CHECK (((invitee_id IS NULL) OR (inviter_id <> invitee_id)))
);

--
-- Name: user_privacy_settings; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_privacy_settings (
    user_id uuid NOT NULL,
    show_my_karma_to_me boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE user_privacy_settings; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.user_privacy_settings IS 'Privacy settings for users - controls karma display visibility (opt-in), future: profile visibility, message preferences, etc.';

--
-- Name: COLUMN user_privacy_settings.show_my_karma_to_me; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_privacy_settings.show_my_karma_to_me IS 'If TRUE, user sees their own karma score on their profile (private display only, never public)';

--
-- Name: user_request_preferences; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_request_preferences (
    user_id uuid NOT NULL,
    request_type public.request_type_enum NOT NULL,
    subscribed boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE user_request_preferences; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.user_request_preferences IS 'User preferences for which request types to see in their feed';

--
-- Name: COLUMN user_request_preferences.subscribed; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_request_preferences.subscribed IS 'Whether user wants to see this request type in their feed';

--
-- Name: user_skills; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_skills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    skill character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: user_tags; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tag_type character varying(20) NOT NULL,
    tag_value character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_tags_tag_type_check CHECK (((tag_type)::text = ANY ((ARRAY['skill'::character varying, 'interest'::character varying, 'need'::character varying])::text[])))
);

--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    bio text,
    avatar_url character varying(255),
    invited_by uuid,
    invitation_accepted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    federated_id character varying(255),
    allow_federation boolean DEFAULT true,
    federation_privacy jsonb DEFAULT '{"profile_visibility": "federated", "activity_visibility": "federated", "reputation_visibility": "federated"}'::jsonb,
    show_connection_path boolean DEFAULT true,
    show_who_invited_me boolean DEFAULT true,
    show_who_i_invited boolean DEFAULT false
);

--
-- Name: activities; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    activity_type character varying(100) DEFAULT 'other'::character varying NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer,
    location text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    max_participants integer,
    current_participants integer DEFAULT 0,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_activity_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT chk_activity_type CHECK (((activity_type)::text = ANY ((ARRAY['pickup_game'::character varying, 'group_run'::character varying, 'workout'::character varying, 'social'::character varying, 'other'::character varying])::text[])))
);

--
-- Name: activity_participants; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.activity_participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: communities; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.communities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location character varying(255),
    category character varying(100),
    max_members integer DEFAULT 150,
    current_members integer DEFAULT 0,
    creator_id uuid NOT NULL,
    access_type character varying(50) DEFAULT 'public'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    default_request_scope public.visibility_scope_enum DEFAULT 'community'::public.visibility_scope_enum,
    latitude numeric(10,7),
    longitude numeric(10,7),
    tags text[] DEFAULT '{}'::text[],
    community_type character varying(50) DEFAULT 'mutual_aid'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    federation_mode character varying(50) DEFAULT 'local_only'::character varying,
    accepts_federated_members boolean DEFAULT false,
    federated_id character varying(255),
    governance_settings jsonb DEFAULT '{"template": "small-collective", "quorum_size": 3, "eligibility_threshold": 50}'::jsonb NOT NULL,
    CONSTRAINT chk_community_type CHECK (((community_type)::text = ANY ((ARRAY['mutual_aid'::character varying, 'group'::character varying])::text[])))
);

--
-- Name: COLUMN communities.access_type; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.communities.access_type IS 'public: anyone can join, private: requires approval';

--
-- Name: COLUMN communities.default_request_scope; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.communities.default_request_scope IS 'Default visibility scope for new requests created in this community';

--
-- Name: community_configs; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.community_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    member_cap integer DEFAULT 150,
    visibility_mode character varying(50) DEFAULT 'public'::character varying,
    outsider_response_allowed boolean DEFAULT false,
    enabled_request_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    karma_split_helper integer DEFAULT 60,
    karma_split_requestor integer DEFAULT 40,
    base_karma_pool_per_request integer DEFAULT 100,
    karma_decay_half_life_days integer DEFAULT 0,
    trust_depth_weight numeric(3,2) DEFAULT 0.60,
    trust_breadth_weight numeric(3,2) DEFAULT 0.40,
    trust_decay_half_life_days integer DEFAULT 90,
    trust_path_max_hops integer DEFAULT 3,
    min_interactions_for_trust integer DEFAULT 1,
    request_approval_required boolean DEFAULT false,
    new_member_karma_lockout_days integer DEFAULT 0,
    join_approval_required boolean DEFAULT true,
    joining_counts_as_interaction boolean DEFAULT true,
    feed_weight_skill_match numeric(3,2) DEFAULT 0.25,
    feed_weight_trust_distance numeric(3,2) DEFAULT 0.20,
    feed_weight_community_relevance numeric(3,2) DEFAULT 0.15,
    feed_weight_urgency numeric(3,2) DEFAULT 0.10,
    feed_weight_requester_trust numeric(3,2) DEFAULT 0.15 NOT NULL,
    feed_weight_prior_interaction numeric(3,2) DEFAULT 0.10 NOT NULL,
    feed_weight_recency numeric(3,2) DEFAULT 0.05 NOT NULL,
    community_evolution_enabled boolean DEFAULT true,
    cross_community_prior numeric(3,2) DEFAULT 0.50 NOT NULL,
    template_source character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    trust_feedback_threshold numeric(3,1) DEFAULT 3.0,
    trust_negative_allowed boolean DEFAULT false,
    trust_carry_enabled boolean DEFAULT true,
    trust_carry_factor numeric(3,2) DEFAULT 0.40,
    trust_carry_cap integer DEFAULT 59,
    community_trust_bonding_weight numeric(3,2) DEFAULT 0.60,
    community_trust_bridging_weight numeric(3,2) DEFAULT 0.40,
    provider_services_enabled boolean DEFAULT false,
    provider_min_personal_trust_score integer DEFAULT 0,
    provider_services_list text[] DEFAULT '{}'::text[],
    CONSTRAINT chk_community_cross_community_prior CHECK (((cross_community_prior >= 0.05) AND (cross_community_prior <= 0.95))),
    CONSTRAINT community_configs_base_karma_pool_per_request_check CHECK (((base_karma_pool_per_request >= 10) AND (base_karma_pool_per_request <= 1000))),
    CONSTRAINT community_configs_community_trust_bonding_weight_check CHECK (((community_trust_bonding_weight >= 0.0) AND (community_trust_bonding_weight <= 1.0))),
    CONSTRAINT community_configs_community_trust_bridging_weight_check CHECK (((community_trust_bridging_weight >= 0.0) AND (community_trust_bridging_weight <= 1.0))),
    CONSTRAINT community_configs_feed_weight_community_relevance_check CHECK (((feed_weight_community_relevance >= 0.0) AND (feed_weight_community_relevance <= 1.0))),
    CONSTRAINT community_configs_feed_weight_skill_match_check CHECK (((feed_weight_skill_match >= 0.0) AND (feed_weight_skill_match <= 1.0))),
    CONSTRAINT community_configs_feed_weight_trust_distance_check CHECK (((feed_weight_trust_distance >= 0.0) AND (feed_weight_trust_distance <= 1.0))),
    CONSTRAINT community_configs_feed_weight_urgency_check CHECK (((feed_weight_urgency >= 0.0) AND (feed_weight_urgency <= 1.0))),
    CONSTRAINT community_configs_karma_decay_half_life_days_check CHECK (((karma_decay_half_life_days >= 0) AND (karma_decay_half_life_days <= 365))),
    CONSTRAINT community_configs_karma_split_helper_check CHECK (((karma_split_helper >= 0) AND (karma_split_helper <= 100))),
    CONSTRAINT community_configs_karma_split_requestor_check CHECK (((karma_split_requestor >= '-50'::integer) AND (karma_split_requestor <= 100))),
    CONSTRAINT community_configs_member_cap_check CHECK (((member_cap >= 10) AND (member_cap <= 150))),
    CONSTRAINT community_configs_min_interactions_for_trust_check CHECK (((min_interactions_for_trust >= 1) AND (min_interactions_for_trust <= 10))),
    CONSTRAINT community_configs_new_member_karma_lockout_days_check CHECK (((new_member_karma_lockout_days >= 0) AND (new_member_karma_lockout_days <= 30))),
    CONSTRAINT community_configs_trust_breadth_weight_check CHECK (((trust_breadth_weight >= 0.0) AND (trust_breadth_weight <= 1.0))),
    CONSTRAINT community_configs_trust_carry_cap_check CHECK (((trust_carry_cap >= 0) AND (trust_carry_cap <= 100))),
    CONSTRAINT community_configs_trust_carry_factor_check CHECK (((trust_carry_factor >= 0.0) AND (trust_carry_factor <= 1.0))),
    CONSTRAINT community_configs_trust_decay_half_life_days_check CHECK (((trust_decay_half_life_days >= 30) AND (trust_decay_half_life_days <= 365))),
    CONSTRAINT community_configs_trust_depth_weight_check CHECK (((trust_depth_weight >= 0.0) AND (trust_depth_weight <= 1.0))),
    CONSTRAINT community_configs_trust_feedback_threshold_check CHECK (((trust_feedback_threshold >= 1.0) AND (trust_feedback_threshold <= 4.9))),
    CONSTRAINT community_configs_trust_path_max_hops_check CHECK (((trust_path_max_hops >= 1) AND (trust_path_max_hops <= 5))),
    CONSTRAINT community_configs_visibility_mode_check CHECK (((visibility_mode)::text = ANY ((ARRAY['public'::character varying, 'members_only'::character varying, 'hybrid'::character varying])::text[])))
);

--
-- Name: TABLE community_configs; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON TABLE communities.community_configs IS 'Comprehensive configuration for community trust, karma, and coordination mechanics';

--
-- Name: COLUMN community_configs.visibility_mode; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.visibility_mode IS 'public: anyone can see requests, members_only: only members, hybrid: public listings with member-only details';

--
-- Name: COLUMN community_configs.enabled_request_types; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.enabled_request_types IS 'Community-defined request types with karma multipliers (JSONB array)';

--
-- Name: COLUMN community_configs.karma_split_helper; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.karma_split_helper IS 'Percentage of karma pool awarded to helper (0-100)';

--
-- Name: COLUMN community_configs.karma_split_requestor; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.karma_split_requestor IS 'Percentage awarded to requestor (-50 to 100, can be negative)';

--
-- Name: COLUMN community_configs.karma_decay_half_life_days; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.karma_decay_half_life_days IS '0 = no decay (bankable), >0 = decay with this half-life';

--
-- Name: COLUMN community_configs.trust_depth_weight; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.trust_depth_weight IS 'Weight given to repeated interactions with same people (0.0-1.0)';

--
-- Name: COLUMN community_configs.trust_breadth_weight; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.trust_breadth_weight IS 'Weight given to network diversity (0.0-1.0, must sum to 1.0 with depth)';

--
-- Name: COLUMN community_configs.feed_weight_skill_match; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.feed_weight_skill_match IS 'Weight for skill-based matching in feed scoring (0.0-1.0)';

--
-- Name: COLUMN community_configs.feed_weight_trust_distance; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.feed_weight_trust_distance IS 'Weight for trust distance in feed scoring (0.0-1.0)';

--
-- Name: COLUMN community_configs.feed_weight_community_relevance; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.feed_weight_community_relevance IS 'Weight for community type relevance in feed scoring (0.0-1.0)';

--
-- Name: COLUMN community_configs.feed_weight_urgency; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.community_configs.feed_weight_urgency IS 'Weight for urgency in feed scoring (0.0-1.0)';

--
-- Name: community_links; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.community_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_a_id uuid NOT NULL,
    community_b_id uuid NOT NULL,
    link_type text NOT NULL,
    trust_carry_factor numeric(3,2) DEFAULT 0.40 NOT NULL,
    show_in_sister_feeds boolean DEFAULT false NOT NULL,
    created_by_admin_a uuid,
    created_by_admin_b uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT community_links_check CHECK ((community_a_id <> community_b_id)),
    CONSTRAINT community_links_link_type_check CHECK ((link_type = ANY (ARRAY['sister'::text, 'parent_child'::text, 'split_origin'::text, 'fusion_origin'::text]))),
    CONSTRAINT community_links_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text]))),
    CONSTRAINT community_links_trust_carry_factor_check CHECK (((trust_carry_factor >= 0.00) AND (trust_carry_factor <= 1.00)))
);

--
-- Name: config_templates; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.config_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    config_json jsonb NOT NULL,
    is_public boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE config_templates; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON TABLE communities.config_templates IS 'Configuration templates that communities can browse and copy (evolutionary discovery)';

--
-- Name: COLUMN config_templates.config_json; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.config_templates.config_json IS 'Full configuration as JSON (matches community_configs structure)';

--
-- Name: COLUMN config_templates.usage_count; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.config_templates.usage_count IS 'How many communities use this template (for sorting by popularity)';

--
-- Name: fusion_proposals; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.fusion_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_a_id uuid NOT NULL,
    community_b_id uuid NOT NULL,
    proposed_by uuid NOT NULL,
    merged_community_name text NOT NULL,
    rationale text,
    status text DEFAULT 'pending_acceptance'::text NOT NULL,
    quorum_pct integer DEFAULT 60 NOT NULL,
    approval_pct integer DEFAULT 60 NOT NULL,
    accepted_by uuid,
    voting_ends_at timestamp with time zone,
    executed_at timestamp with time zone,
    merged_community_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fusion_proposals_check CHECK ((community_a_id <> community_b_id)),
    CONSTRAINT fusion_proposals_status_check CHECK ((status = ANY (ARRAY['pending_acceptance'::text, 'discussion'::text, 'voting'::text, 'approved'::text, 'rejected'::text, 'executed'::text])))
);

--
-- Name: fusion_votes; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.fusion_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    community_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote text NOT NULL,
    prestige_weight numeric(8,2) DEFAULT 1.0 NOT NULL,
    voted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fusion_votes_vote_check CHECK ((vote = ANY (ARRAY['yes'::text, 'no'::text, 'abstain'::text])))
);

--
-- Name: governance_nominations; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.governance_nominations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    nominated_user_id uuid NOT NULL,
    nominated_for_role character varying(50) NOT NULL,
    nominator_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    required_ratifications integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT valid_nomination_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'ratified'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[])))
);

--
-- Name: governance_ratifications; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.governance_ratifications (
    nomination_id uuid NOT NULL,
    ratifier_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: health_summary; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.health_summary (
    community_id uuid NOT NULL,
    total_exchanges integer DEFAULT 0,
    active_members integer DEFAULT 0,
    network_strength numeric(5,2) DEFAULT 0,
    trend_direction character varying(20) DEFAULT 'stable'::character varying,
    trend_percentage numeric(5,2) DEFAULT 0,
    last_calculated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE health_summary; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON TABLE communities.health_summary IS 'Cached summary of community health for quick access';

--
-- Name: COLUMN health_summary.network_strength; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.health_summary.network_strength IS 'Composite score: activity + quality + density';

--
-- Name: members; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    invited_by uuid,
    status character varying(50) DEFAULT 'active'::character varying,
    join_request_message text,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: COLUMN members.status; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.members.status IS 'active: member, pending: awaiting approval, invited: has invite';

--
-- Name: COLUMN members.join_request_message; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.members.join_request_message IS 'Message included with join request';

--
-- Name: norm_approvals; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.norm_approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    norm_id uuid NOT NULL,
    approved_by uuid NOT NULL,
    approved_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: norms; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.norms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    description text NOT NULL,
    rationale text,
    created_by uuid NOT NULL,
    status character varying(50) DEFAULT 'proposed'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: settings; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    request_ttl_days integer DEFAULT 60,
    offer_ttl_days integer DEFAULT 60,
    message_ttl_days integer DEFAULT 90,
    notification_ttl_days integer DEFAULT 30,
    reputation_half_life_months integer DEFAULT 6,
    activity_types jsonb DEFAULT '["complete_request", "complete_offer"]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE settings; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON TABLE communities.settings IS 'Per-community configuration for TTL and reputation decay';

--
-- Name: COLUMN settings.request_ttl_days; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.request_ttl_days IS 'Days before help requests expire';

--
-- Name: COLUMN settings.offer_ttl_days; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.offer_ttl_days IS 'Days before help offers expire';

--
-- Name: COLUMN settings.message_ttl_days; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.message_ttl_days IS 'Days before messages expire';

--
-- Name: COLUMN settings.notification_ttl_days; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.notification_ttl_days IS 'Days before notifications expire';

--
-- Name: COLUMN settings.reputation_half_life_months; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.reputation_half_life_months IS 'Months for karma to decay to 50% of original value';

--
-- Name: COLUMN settings.activity_types; Type: COMMENT; Schema: communities; Owner: -
--

COMMENT ON COLUMN communities.settings.activity_types IS 'Activities that reset last_activity_at (JSONB array)';

--
-- Name: split_member_assignments; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.split_member_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_to text DEFAULT 'unassigned'::text NOT NULL,
    cluster_suggestion text,
    admin_overridden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT split_member_assignments_assigned_to_check CHECK ((assigned_to = ANY (ARRAY['group_a'::text, 'group_b'::text, 'unassigned'::text]))),
    CONSTRAINT split_member_assignments_cluster_suggestion_check CHECK ((cluster_suggestion = ANY (ARRAY['group_a'::text, 'group_b'::text])))
);

--
-- Name: split_proposals; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.split_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    proposed_by uuid NOT NULL,
    split_type text NOT NULL,
    rationale text,
    group_a_name text NOT NULL,
    group_b_name text NOT NULL,
    status text DEFAULT 'discussion'::text NOT NULL,
    quorum_pct integer DEFAULT 60 NOT NULL,
    approval_pct integer DEFAULT 60 NOT NULL,
    discussion_ends_at timestamp with time zone,
    voting_ends_at timestamp with time zone,
    executed_at timestamp with time zone,
    child_community_a_id uuid,
    child_community_b_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT split_proposals_split_type_check CHECK ((split_type = ANY (ARRAY['size_threshold'::text, 'admin_initiated'::text]))),
    CONSTRAINT split_proposals_status_check CHECK ((status = ANY (ARRAY['discussion'::text, 'voting'::text, 'approved'::text, 'rejected'::text, 'executed'::text])))
);

--
-- Name: split_votes; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.split_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote text NOT NULL,
    prestige_weight numeric(8,2) DEFAULT 1.0 NOT NULL,
    voted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT split_votes_vote_check CHECK ((vote = ANY (ARRAY['yes'::text, 'no'::text, 'abstain'::text])))
);

--
-- Name: trust_question_choices; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.trust_question_choices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    question_id uuid NOT NULL,
    value character varying(60) NOT NULL,
    label text NOT NULL,
    description text,
    config_delta jsonb DEFAULT '{}'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL
);

--
-- Name: trust_questions; Type: TABLE; Schema: communities; Owner: -
--

CREATE TABLE communities.trust_questions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    slug character varying(60) NOT NULL,
    question_text text NOT NULL,
    subtext text,
    display_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: event_log; Type: TABLE; Schema: events; Owner: -
--

CREATE TABLE events.event_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_type character varying(100) NOT NULL,
    source_service character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);

--
-- Name: blocked_instances; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.blocked_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_domain character varying(255) NOT NULL,
    blocked_by_instance boolean DEFAULT false,
    blocked_by_community uuid,
    reason text,
    blocked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    blocked_by_user uuid,
    expires_at timestamp without time zone
);

--
-- Name: federated_communities; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.federated_communities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    federated_id character varying(255) NOT NULL,
    local_id character varying(255),
    origin_instance_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location jsonb,
    federation_mode character varying(50),
    member_count integer DEFAULT 0,
    created_at timestamp without time zone,
    last_synced_at timestamp without time zone,
    raw_data jsonb
);

--
-- Name: federated_requests; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.federated_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    federated_id character varying(255) NOT NULL,
    local_id character varying(255),
    origin_instance_id uuid NOT NULL,
    requester_federated_id character varying(255) NOT NULL,
    requester_display_name character varying(255),
    community_federated_id character varying(255),
    community_name character varying(255),
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    urgency character varying(50),
    location jsonb,
    visibility character varying(50) DEFAULT 'federated'::character varying,
    status character varying(50) DEFAULT 'open'::character varying,
    created_at timestamp without time zone,
    expires_at timestamp without time zone,
    last_synced_at timestamp without time zone,
    signature text NOT NULL,
    raw_data jsonb
);

--
-- Name: federated_user_mappings; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.federated_user_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    federated_user_id uuid NOT NULL,
    local_user_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: federated_users; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.federated_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    federated_id character varying(255) NOT NULL,
    local_id character varying(255),
    home_instance_id uuid NOT NULL,
    display_name character varying(255),
    avatar_url text,
    bio text,
    public_profile jsonb DEFAULT '{}'::jsonb,
    federated_reputation jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: federation_links; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.federation_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    initiated_by character varying(50),
    requested_at timestamp without time zone,
    accepted_at timestamp without time zone,
    terminated_at timestamp without time zone,
    policies jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: inbox; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.inbox (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_type character varying(100) NOT NULL,
    actor character varying(255) NOT NULL,
    object jsonb NOT NULL,
    origin_instance_id uuid,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed boolean DEFAULT false,
    processed_at timestamp without time zone,
    signature text NOT NULL,
    raw_payload jsonb NOT NULL,
    processing_error text
);

--
-- Name: instances; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    domain character varying(255) NOT NULL,
    name character varying(255),
    description text,
    location jsonb,
    admin_contact character varying(255),
    public_key text NOT NULL,
    software character varying(100),
    version character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen_at timestamp without time zone,
    status character varying(50) DEFAULT 'discovered'::character varying,
    statistics jsonb DEFAULT '{}'::jsonb,
    federation_policy jsonb DEFAULT '{}'::jsonb
);

--
-- Name: local_instance; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.local_instance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    domain character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location jsonb,
    admin_contact character varying(255),
    public_key text NOT NULL,
    private_key text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    federation_enabled boolean DEFAULT false,
    federation_policy jsonb DEFAULT '{"open_registration": true, "requires_approval": true, "accepts_federated_requests": true}'::jsonb
);

--
-- Name: outbox; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.outbox (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_type character varying(100) NOT NULL,
    actor character varying(255) NOT NULL,
    object jsonb NOT NULL,
    target_instances uuid[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp without time zone,
    signature text,
    delivery_status jsonb DEFAULT '{}'::jsonb,
    retry_count integer DEFAULT 0,
    last_retry_at timestamp without time zone
);

--
-- Name: reputation_attestations; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.reputation_attestations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subject_federated_id character varying(255) NOT NULL,
    attestor_instance_id uuid NOT NULL,
    attestation jsonb NOT NULL,
    signature text NOT NULL,
    public_key text NOT NULL,
    calculated_at timestamp without time zone,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verified boolean DEFAULT false
);

--
-- Name: user_migrations; Type: TABLE; Schema: federation; Owner: -
--

CREATE TABLE federation.user_migrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    old_federated_id character varying(255),
    new_federated_id character varying(255),
    old_instance_id uuid,
    new_instance_id uuid,
    migration_package jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    notes text
);

--
-- Name: dismissed_items; Type: TABLE; Schema: feed; Owner: -
--

CREATE TABLE feed.dismissed_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    item_type character varying(50) NOT NULL,
    item_id character varying(255) NOT NULL,
    dismissed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: featured_stories; Type: TABLE; Schema: feed; Owner: -
--

CREATE TABLE feed.featured_stories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    story_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    match_id uuid,
    category character varying(100),
    is_anonymous boolean DEFAULT true,
    requester_name character varying(255),
    responder_name character varying(255),
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);

--
-- Name: TABLE featured_stories; Type: COMMENT; Schema: feed; Owner: -
--

COMMENT ON TABLE feed.featured_stories IS 'Curated stories about interactions for feed and celebration';

--
-- Name: COLUMN featured_stories.is_anonymous; Type: COMMENT; Schema: feed; Owner: -
--

COMMENT ON COLUMN feed.featured_stories.is_anonymous IS 'Whether names are shown (requires two-way consent)';

--
-- Name: preferences; Type: TABLE; Schema: feed; Owner: -
--

CREATE TABLE feed.preferences (
    user_id uuid NOT NULL,
    show_community_activity boolean DEFAULT true,
    show_open_requests boolean DEFAULT true,
    show_completed_exchanges boolean DEFAULT false,
    suggest_adjacent_requests boolean DEFAULT true,
    exploration_level character varying(20) DEFAULT 'balanced'::character varying,
    show_explanations boolean DEFAULT true,
    show_broader_stories boolean DEFAULT true,
    allow_public_featuring boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    show_community_metrics boolean DEFAULT true,
    show_milestone_celebrations boolean DEFAULT true,
    show_anonymous_stories boolean DEFAULT true,
    CONSTRAINT preferences_exploration_level_check CHECK (((exploration_level)::text = ANY ((ARRAY['conservative'::character varying, 'balanced'::character varying, 'adventurous'::character varying])::text[])))
);

--
-- Name: COLUMN preferences.show_community_metrics; Type: COMMENT; Schema: feed; Owner: -
--

COMMENT ON COLUMN feed.preferences.show_community_metrics IS 'Show community health metrics in feed';

--
-- Name: COLUMN preferences.show_milestone_celebrations; Type: COMMENT; Schema: feed; Owner: -
--

COMMENT ON COLUMN feed.preferences.show_milestone_celebrations IS 'Show community milestone achievements';

--
-- Name: COLUMN preferences.show_anonymous_stories; Type: COMMENT; Schema: feed; Owner: -
--

COMMENT ON COLUMN feed.preferences.show_anonymous_stories IS 'Show anonymous completed exchange stories';

--
-- Name: feedback; Type: TABLE; Schema: feedback; Owner: -
--

CREATE TABLE feedback.feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    request_match_id uuid NOT NULL,
    community_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: feedback_categories; Type: TABLE; Schema: feedback; Owner: -
--

CREATE TABLE feedback.feedback_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    feedback_id uuid NOT NULL,
    category character varying(100) NOT NULL
);

--
-- Name: conflict_cases; Type: TABLE; Schema: governance; Owner: -
--

CREATE TABLE governance.conflict_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    accuser_id uuid NOT NULL,
    accused_id uuid NOT NULL,
    description text NOT NULL,
    related_request_match_id uuid,
    status character varying(50) DEFAULT 'reported'::character varying,
    reported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    resolution text
);

--
-- Name: conflict_mediators; Type: TABLE; Schema: governance; Owner: -
--

CREATE TABLE governance.conflict_mediators (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conflict_case_id uuid NOT NULL,
    mediator_id uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: proposals; Type: TABLE; Schema: governance; Owner: -
--

CREATE TABLE governance.proposals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    proposed_by uuid NOT NULL,
    type character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(50) DEFAULT 'proposed'::character varying,
    proposed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    voting_starts_at timestamp without time zone,
    voting_ends_at timestamp without time zone
);

--
-- Name: votes; Type: TABLE; Schema: governance; Owner: -
--

CREATE TABLE governance.votes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    proposal_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    community_id uuid NOT NULL,
    choice character varying(50) NOT NULL,
    voted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: conversation_participants; Type: TABLE; Schema: messaging; Owner: -
--

CREATE TABLE messaging.conversation_participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    participant_id uuid NOT NULL
);

--
-- Name: conversations; Type: TABLE; Schema: messaging; Owner: -
--

CREATE TABLE messaging.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_match_id uuid,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: messages; Type: TABLE; Schema: messaging; Owner: -
--

CREATE TABLE messaging.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sender_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    content text NOT NULL,
    status character varying(50) DEFAULT 'sent'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    expired boolean DEFAULT false,
    forgotten_at timestamp with time zone
);

--
-- Name: global_preferences; Type: TABLE; Schema: notifications; Owner: -
--

CREATE TABLE notifications.global_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    in_app_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: notifications; Type: TABLE; Schema: notifications; Owner: -
--

CREATE TABLE notifications.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false,
    action_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    expires_at timestamp without time zone,
    expired boolean DEFAULT false
);

--
-- Name: preferences; Type: TABLE; Schema: notifications; Owner: -
--

CREATE TABLE notifications.preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid,
    event_type character varying(50) NOT NULL,
    in_app_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: offers; Type: TABLE; Schema: provider; Owner: -
--

CREATE TABLE provider.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    provider_user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    price numeric(10,2),
    note text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT offers_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying])::text[])))
);

--
-- Name: geocoding_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geocoding_cache (
    query text NOT NULL,
    results jsonb NOT NULL,
    cached_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '30 days'::interval),
    hit_count integer DEFAULT 1,
    last_accessed timestamp without time zone DEFAULT now(),
    source character varying(50) DEFAULT 'nominatim'::character varying
);

--
-- Name: TABLE geocoding_cache; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.geocoding_cache IS 'Shared geocoding cache - reduces external API calls by 95%+';

--
-- Name: COLUMN geocoding_cache.query; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.geocoding_cache.query IS 'Normalized search query (lowercase, trimmed)';

--
-- Name: COLUMN geocoding_cache.results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.geocoding_cache.results IS 'Array of geocoding results with display_name, address, lat, lng, type';

--
-- Name: COLUMN geocoding_cache.hit_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.geocoding_cache.hit_count IS 'Number of times this cache entry was accessed';

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    migration_name character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: activity_log; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.activity_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    activity_type character varying(100) NOT NULL,
    related_entity_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE activity_log; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON TABLE reputation.activity_log IS 'Log of user activities for reputation decay calculation';

--
-- Name: badges; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.badges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon_url character varying(255),
    earned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    badge_type text,
    community_id uuid
);

--
-- Name: community_evolution_log; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.community_evolution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    parameter character varying(50) NOT NULL,
    old_value numeric(6,2) NOT NULL,
    new_value numeric(6,2) NOT NULL,
    aggregate_delta numeric(6,2) NOT NULL,
    contributing_member_count integer NOT NULL,
    interaction_rate_snapshot numeric(6,2),
    damping_applied numeric(3,2) DEFAULT 1.00 NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: community_health_metrics; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.community_health_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    total_matches_completed integer DEFAULT 0,
    total_active_requesters integer DEFAULT 0,
    total_active_helpers integer DEFAULT 0,
    unique_participant_count integer DEFAULT 0,
    avg_helpfulness numeric(3,2) DEFAULT 0,
    avg_responsiveness numeric(3,2) DEFAULT 0,
    avg_clarity numeric(3,2) DEFAULT 0,
    network_density numeric(5,4) DEFAULT 0,
    growth_rate_matches numeric(5,2) DEFAULT 0,
    growth_rate_participants numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE community_health_metrics; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON TABLE reputation.community_health_metrics IS 'Community-level health metrics tracked daily';

--
-- Name: COLUMN community_health_metrics.network_density; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.community_health_metrics.network_density IS 'Average connections per member';

--
-- Name: COLUMN community_health_metrics.growth_rate_matches; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.community_health_metrics.growth_rate_matches IS 'Percentage growth in matches vs previous period';

--
-- Name: community_trust_scores; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.community_trust_scores (
    community_id uuid NOT NULL,
    score integer DEFAULT 0,
    member_quality_score integer DEFAULT 0,
    bonding_score integer DEFAULT 0,
    bridging_score integer DEFAULT 0,
    active_member_count integer DEFAULT 0,
    last_calculated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    previous_score integer,
    previous_calculated_at timestamp without time zone,
    network_cohesion_score integer,
    network_reciprocity numeric(4,3),
    network_density numeric(4,3),
    network_clustering numeric(4,3),
    network_avg_path_length numeric(4,2),
    CONSTRAINT community_trust_scores_score_check CHECK (((score >= 0) AND (score <= 100)))
);

--
-- Name: karma_records; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.karma_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    points integer NOT NULL,
    reason character varying(255) NOT NULL,
    related_entity_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: milestone_events; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.milestone_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    milestone_type character varying(100) NOT NULL,
    milestone_value integer NOT NULL,
    description text NOT NULL,
    is_featured boolean DEFAULT true,
    achieved_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE milestone_events; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON TABLE reputation.milestone_events IS 'Community milestone achievements for celebrating collective progress';

--
-- Name: COLUMN milestone_events.is_featured; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.milestone_events.is_featured IS 'Whether to feature this milestone in public stories';

--
-- Name: provider_reviews; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.provider_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    match_id uuid,
    stars integer NOT NULL,
    review_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT provider_reviews_stars_check CHECK (((stars >= 1) AND (stars <= 5)))
);

--
-- Name: provider_trust_scores; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.provider_trust_scores (
    provider_id uuid NOT NULL,
    avg_stars numeric(3,2) DEFAULT 0,
    total_reviews integer DEFAULT 0,
    completion_rate numeric(5,2) DEFAULT 0,
    response_rate numeric(5,2) DEFAULT 0,
    trust_score integer DEFAULT 0,
    last_calculated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT provider_trust_scores_trust_score_check CHECK (((trust_score >= 0) AND (trust_score <= 100)))
);

--
-- Name: trust_scores; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.trust_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    requests_completed integer DEFAULT 0,
    offers_accepted integer DEFAULT 0,
    average_feedback numeric(3,2) DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    avg_helpfulness numeric(3,2) DEFAULT 0,
    avg_responsiveness numeric(3,2) DEFAULT 0,
    avg_clarity numeric(3,2) DEFAULT 0,
    total_feedback_received integer DEFAULT 0
);

--
-- Name: COLUMN trust_scores.last_activity_at; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.trust_scores.last_activity_at IS 'Last time user performed a counted activity in this community';

--
-- Name: COLUMN trust_scores.avg_helpfulness; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.trust_scores.avg_helpfulness IS 'Average helpfulness rating from interactions (1-5)';

--
-- Name: COLUMN trust_scores.avg_responsiveness; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.trust_scores.avg_responsiveness IS 'Average responsiveness rating (1-5)';

--
-- Name: COLUMN trust_scores.avg_clarity; Type: COMMENT; Schema: reputation; Owner: -
--

COMMENT ON COLUMN reputation.trust_scores.avg_clarity IS 'Average clarity rating (1-5)';

--
-- Name: user_trust_configs; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.user_trust_configs (
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    depth_weight numeric(3,2) DEFAULT NULL::numeric,
    breadth_weight numeric(3,2) DEFAULT NULL::numeric,
    cross_community_prior numeric(3,2) DEFAULT 0.50 NOT NULL,
    evolution_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_utc_breadth CHECK (((breadth_weight IS NULL) OR ((breadth_weight >= 0.10) AND (breadth_weight <= 0.90)))),
    CONSTRAINT chk_utc_depth CHECK (((depth_weight IS NULL) OR ((depth_weight >= 0.10) AND (depth_weight <= 0.90)))),
    CONSTRAINT chk_utc_prior CHECK (((cross_community_prior >= 0.05) AND (cross_community_prior <= 0.95)))
);

--
-- Name: user_trust_evolution_log; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.user_trust_evolution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    community_id uuid NOT NULL,
    parameter character varying(50) NOT NULL,
    old_value numeric(3,2),
    new_value numeric(3,2) NOT NULL,
    trigger_signal character varying(100) NOT NULL,
    trigger_event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_trust_preferences; Type: TABLE; Schema: reputation; Owner: -
--

CREATE TABLE reputation.user_trust_preferences (
    user_id uuid NOT NULL,
    global_evolution_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: collective_community_links; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.collective_community_links (
    collective_id uuid NOT NULL,
    community_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    established_at timestamp with time zone DEFAULT now(),
    CONSTRAINT collective_community_links_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text])))
);

--
-- Name: dibs; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.dibs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    provider_user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dibs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))
);

--
-- Name: feed_events; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.feed_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    event_type text NOT NULL,
    feed_score numeric(5,2),
    feed_rank integer,
    source_tier text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feed_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'offer_made'::text, 'match_completed'::text])))
);

--
-- Name: help_offers; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.help_offers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    community_id uuid NOT NULL,
    offerer_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    availability_start_date timestamp without time zone,
    availability_end_date timestamp without time zone,
    status character varying(50) DEFAULT 'active'::character varying,
    expired boolean DEFAULT false,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_public boolean DEFAULT false,
    offerer_visibility_consent boolean DEFAULT false
);

--
-- Name: COLUMN help_offers.is_public; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_offers.is_public IS 'Whether this offer is publicly visible (default: false, private)';

--
-- Name: COLUMN help_offers.offerer_visibility_consent; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_offers.offerer_visibility_consent IS 'Offerer consents to having their name visible in completions';

--
-- Name: help_requests; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.help_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    requester_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    urgency character varying(50) DEFAULT 'medium'::character varying,
    preferred_start_date timestamp without time zone,
    preferred_end_date timestamp without time zone,
    status character varying(50) DEFAULT 'open'::character varying,
    expired boolean DEFAULT false,
    expires_at timestamp without time zone,
    request_type public.request_type_enum DEFAULT 'generic'::public.request_type_enum NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    requirements jsonb DEFAULT '{}'::jsonb,
    visibility_scope public.visibility_scope_enum DEFAULT 'community'::public.visibility_scope_enum NOT NULL,
    visibility_max_degrees integer DEFAULT 3,
    preferred_provider_id uuid,
    is_boosted boolean DEFAULT false,
    boosted_at timestamp without time zone,
    boosted_expires_at timestamp without time zone,
    boosted_by uuid,
    scheduled_for timestamp with time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_public boolean DEFAULT true,
    requester_visibility_consent boolean DEFAULT false,
    visibility character varying(50) DEFAULT 'community'::character varying,
    federated_id character varying(255),
    content_forgotten_at timestamp with time zone,
    CONSTRAINT chk_help_requests_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'dibs_pending'::character varying, 'matched'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_help_requests_urgency CHECK (((urgency)::text = ANY ((ARRAY['urgent'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT help_requests_visibility_max_degrees_check CHECK (((visibility_max_degrees >= 1) AND (visibility_max_degrees <= 6)))
);

--
-- Name: COLUMN help_requests.request_type; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.request_type IS 'Discriminator for polymorphic request types (generic, ride, borrow, service, event)';

--
-- Name: COLUMN help_requests.payload; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.payload IS 'Type-specific data (e.g., ride origin/destination, borrow duration)';

--
-- Name: COLUMN help_requests.requirements; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.requirements IS 'Type-specific requirements (e.g., verified driver license for rides)';

--
-- Name: COLUMN help_requests.visibility_scope; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.visibility_scope IS 'Who can see this request: community (members only), trust_network (N-degree connections), platform (all opted-in users)';

--
-- Name: COLUMN help_requests.visibility_max_degrees; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.visibility_max_degrees IS 'For trust_network scope: max degrees of separation (1-6). Ignored for community/platform scope.';

--
-- Name: COLUMN help_requests.is_public; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.is_public IS 'Whether this request is publicly visible (default: false, private)';

--
-- Name: COLUMN help_requests.requester_visibility_consent; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.help_requests.requester_visibility_consent IS 'Requester consents to having their name visible in completions';

--
-- Name: interaction_feedback; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.interaction_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    match_id uuid NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    helpfulness integer,
    responsiveness integer,
    clarity integer,
    comment text,
    allow_featuring boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interaction_feedback_clarity_check CHECK (((clarity >= 1) AND (clarity <= 5))),
    CONSTRAINT interaction_feedback_helpfulness_check CHECK (((helpfulness >= 1) AND (helpfulness <= 5))),
    CONSTRAINT interaction_feedback_responsiveness_check CHECK (((responsiveness >= 1) AND (responsiveness <= 5)))
);

--
-- Name: TABLE interaction_feedback; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON TABLE requests.interaction_feedback IS 'Feedback about the interaction/exchange quality, not the person';

--
-- Name: COLUMN interaction_feedback.helpfulness; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.interaction_feedback.helpfulness IS 'How helpful was the exchange (1-5)';

--
-- Name: COLUMN interaction_feedback.responsiveness; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.interaction_feedback.responsiveness IS 'How responsive was communication (1-5)';

--
-- Name: COLUMN interaction_feedback.clarity; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.interaction_feedback.clarity IS 'How clear was the communication (1-5)';

--
-- Name: matches; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.matches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    offer_id uuid,
    responder_id uuid NOT NULL,
    status character varying(50) DEFAULT 'proposed'::character varying,
    scheduled_at timestamp with time zone,
    travel_time_minutes integer DEFAULT 60,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    requester_visible boolean DEFAULT false,
    responder_visible boolean DEFAULT false,
    interaction_category character varying(100),
    requester_done_at timestamp without time zone,
    responder_done_at timestamp without time zone,
    admin_proposed boolean DEFAULT false NOT NULL
);

--
-- Name: COLUMN matches.scheduled_at; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.scheduled_at IS 'When the match is scheduled (e.g. ride departure_time). Set from request payload on accept.';

--
-- Name: COLUMN matches.travel_time_minutes; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.travel_time_minutes IS 'Minutes helper needs to travel to pickup/start location. Used to time departure reminder.';

--
-- Name: COLUMN matches.requester_visible; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.requester_visible IS 'Both parties consented to show requester name';

--
-- Name: COLUMN matches.responder_visible; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.responder_visible IS 'Both parties consented to show responder name';

--
-- Name: COLUMN matches.interaction_category; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.interaction_category IS 'Category copy for metrics (from help_request)';

--
-- Name: COLUMN matches.admin_proposed; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.matches.admin_proposed IS 'TRUE when the match was created by a community admin via POST /requests/:id/propose-match';

--
-- Name: provider_collective_members; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.provider_collective_members (
    collective_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT provider_collective_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'admin'::text])))
);

--
-- Name: provider_collectives; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.provider_collectives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    service_types text[] DEFAULT '{}'::text[],
    location_notes text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: provider_profiles; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.provider_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    service_type text NOT NULL,
    display_name text NOT NULL,
    bio text,
    pricing_notes text,
    is_active boolean DEFAULT true,
    location_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_available boolean DEFAULT false NOT NULL
);

--
-- Name: provider_rate_cards; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.provider_rate_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    label character varying(100) NOT NULL,
    service_type text,
    pricing_model text DEFAULT 'standard'::text NOT NULL,
    rate_amount numeric(10,2),
    rate_unit text,
    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nonstandard_rate CHECK (((pricing_model = 'standard'::text) OR ((rate_amount IS NULL) AND (rate_unit IS NULL)))),
    CONSTRAINT chk_pricing_model CHECK ((pricing_model = ANY (ARRAY['standard'::text, 'free'::text, 'negotiable'::text]))),
    CONSTRAINT chk_rate_amount CHECK (((rate_amount IS NULL) OR (rate_amount >= (0)::numeric))),
    CONSTRAINT chk_rate_unit CHECK (((rate_unit IS NULL) OR (rate_unit = ANY (ARRAY['per_hour'::text, 'per_session'::text, 'per_trip'::text, 'flat_rate'::text])))),
    CONSTRAINT chk_standard_rate CHECK (((pricing_model <> 'standard'::text) OR ((rate_amount IS NOT NULL) AND (rate_unit IS NOT NULL))))
);

--
-- Name: provider_ride_details; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.provider_ride_details (
    provider_id uuid NOT NULL,
    vehicle_type text,
    max_passengers integer DEFAULT 1,
    typical_routes text,
    advance_booking_required boolean DEFAULT false
);

--
-- Name: request_admin_notes; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.request_admin_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    community_id uuid NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    updated_by uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: request_communities; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.request_communities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    community_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: TABLE request_communities; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON TABLE requests.request_communities IS 'Junction table linking help requests to communities. Allows a single request to be posted to multiple communities without duplication.';

--
-- Name: retention_config; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.retention_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid,
    completed_request_window_days integer DEFAULT 180 NOT NULL,
    expired_request_window_days integer DEFAULT 30 NOT NULL,
    message_window_days integer DEFAULT 180 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ui_schema_versions; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.ui_schema_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    schema_id uuid NOT NULL,
    version integer NOT NULL,
    schema_snapshot jsonb NOT NULL,
    changed_by uuid,
    change_description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: TABLE ui_schema_versions; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON TABLE requests.ui_schema_versions IS 'Complete version history for UI schemas. Enables rollback to previous versions.';

--
-- Name: COLUMN ui_schema_versions.schema_snapshot; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.ui_schema_versions.schema_snapshot IS 'Complete UISchema object at this version.';

--
-- Name: ui_schemas; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.ui_schemas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(50) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    label character varying(100) NOT NULL,
    icon character varying(10) NOT NULL,
    color character varying(20) NOT NULL,
    description text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary jsonb,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    published_at timestamp without time zone,
    variant character varying(50),
    rollout_percentage integer DEFAULT 100,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_sections_is_array CHECK ((jsonb_typeof(sections) = 'array'::text)),
    CONSTRAINT valid_rollout CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);

--
-- Name: TABLE ui_schemas; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON TABLE requests.ui_schemas IS 'Server-driven UI schemas for request types. Supports both built-in (ride, service) and custom (dogwalking, tutoring) types.';

--
-- Name: COLUMN ui_schemas.type; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.ui_schemas.type IS 'Unique identifier for request type. Must match request_type_enum for built-in types.';

--
-- Name: COLUMN ui_schemas.sections; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.ui_schemas.sections IS 'JSONB array of UISection objects defining form structure.';

--
-- Name: COLUMN ui_schemas.variant; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.ui_schemas.variant IS 'A/B test variant identifier. Multiple variants can exist for same type.';

--
-- Name: COLUMN ui_schemas.rollout_percentage; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.ui_schemas.rollout_percentage IS 'Percentage of users who see this variant (0-100). Used for gradual rollouts.';

--
-- Name: validation_rules; Type: TABLE; Schema: requests; Owner: -
--

CREATE TABLE requests.validation_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(50) NOT NULL,
    validation_schema jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    example_valid_payload jsonb,
    example_invalid_payload jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_validation_schema_is_object CHECK ((jsonb_typeof(validation_schema) = 'object'::text)),
    CONSTRAINT valid_validation_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

--
-- Name: TABLE validation_rules; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON TABLE requests.validation_rules IS 'JSON Schema validation rules for custom request types. Built-in types use Zod schemas in code.';

--
-- Name: COLUMN validation_rules.validation_schema; Type: COMMENT; Schema: requests; Owner: -
--

COMMENT ON COLUMN requests.validation_rules.validation_schema IS 'JSON Schema format validation rules.';

--
-- Name: community_trust_edges; Type: TABLE; Schema: social_graph; Owner: -
--

CREATE TABLE social_graph.community_trust_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id_a uuid NOT NULL,
    community_id_b uuid NOT NULL,
    cross_interaction_count integer DEFAULT 0 NOT NULL,
    weight double precision DEFAULT 0 NOT NULL,
    last_interaction_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT community_trust_normalized CHECK (((community_id_a)::text < (community_id_b)::text))
);

--
-- Name: connections; Type: TABLE; Schema: social_graph; Owner: -
--

CREATE TABLE social_graph.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a_id uuid NOT NULL,
    user_b_id uuid NOT NULL,
    type text NOT NULL,
    first_connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_interaction_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT connections_type_check CHECK ((type = ANY (ARRAY['exchange'::text, 'community'::text])))
);

--
-- Name: interaction_weights; Type: TABLE; Schema: social_graph; Owner: -
--

CREATE TABLE social_graph.interaction_weights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid,
    interaction_type text NOT NULL,
    weight double precision DEFAULT 1.0 NOT NULL,
    CONSTRAINT interaction_weights_interaction_type_check CHECK ((interaction_type = ANY (ARRAY['match_completed'::text, 'endorsement'::text, 'karma_given'::text, 'event'::text])))
);

--
-- Name: trust_decay_config; Type: TABLE; Schema: social_graph; Owner: -
--

CREATE TABLE social_graph.trust_decay_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid,
    base_half_life_days double precision DEFAULT 30.0 NOT NULL,
    stability_growth_rate double precision DEFAULT 0.20 NOT NULL,
    disappearance_threshold double precision DEFAULT 0.5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: trust_edges; Type: TABLE; Schema: social_graph; Owner: -
--

CREATE TABLE social_graph.trust_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id_a uuid NOT NULL,
    user_id_b uuid NOT NULL,
    community_id uuid NOT NULL,
    match_completed_count integer DEFAULT 0 NOT NULL,
    endorsement_count integer DEFAULT 0 NOT NULL,
    karma_given_count integer DEFAULT 0 NOT NULL,
    event_count integer DEFAULT 0 NOT NULL,
    raw_weight double precision DEFAULT 0 NOT NULL,
    last_interaction_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stability double precision DEFAULT 1.0 NOT NULL,
    CONSTRAINT trust_edges_normalized CHECK (((user_id_a)::text < (user_id_b)::text))
);

--
-- Name: trust_edges_live; Type: VIEW; Schema: social_graph; Owner: -
--

CREATE VIEW social_graph.trust_edges_live AS
 SELECT te.id,
    te.user_id_a,
    te.user_id_b,
    te.community_id,
    te.match_completed_count,
    te.endorsement_count,
    te.karma_given_count,
    te.event_count,
    te.raw_weight,
    te.last_interaction_at,
    te.created_at,
    te.updated_at,
    te.stability,
    (te.raw_weight * exp(((((- EXTRACT(epoch FROM (now() - te.last_interaction_at))) / 86400.0))::double precision / (te.stability * COALESCE(( SELECT trust_decay_config.base_half_life_days
           FROM social_graph.trust_decay_config
          WHERE (trust_decay_config.community_id = te.community_id)
         LIMIT 1), ( SELECT trust_decay_config.base_half_life_days
           FROM social_graph.trust_decay_config
          WHERE (trust_decay_config.community_id IS NULL)
         LIMIT 1), (30.0)::double precision))))) AS current_weight
   FROM social_graph.trust_edges te;

--
-- Name: device_push_tokens device_push_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.device_push_tokens
    ADD CONSTRAINT device_push_tokens_pkey PRIMARY KEY (id);

--
-- Name: device_push_tokens device_push_tokens_user_id_expo_push_token_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.device_push_tokens
    ADD CONSTRAINT device_push_tokens_user_id_expo_push_token_key UNIQUE (user_id, expo_push_token);

--
-- Name: founding_circle_submissions founding_circle_submissions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.founding_circle_submissions
    ADD CONSTRAINT founding_circle_submissions_pkey PRIMARY KEY (id);

--
-- Name: inviter_stats inviter_stats_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.inviter_stats
    ADD CONSTRAINT inviter_stats_pkey PRIMARY KEY (user_id, community_id);

--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);

--
-- Name: social_distances social_distances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.social_distances
    ADD CONSTRAINT social_distances_pkey PRIMARY KEY (id);

--
-- Name: social_distances social_distances_user_a_id_user_b_id_community_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.social_distances
    ADD CONSTRAINT social_distances_user_a_id_user_b_id_community_id_key UNIQUE (user_a_id, user_b_id, community_id);

--
-- Name: user_feed_preferences user_feed_preferences_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_feed_preferences
    ADD CONSTRAINT user_feed_preferences_pkey PRIMARY KEY (user_id);

--
-- Name: user_interests user_interests_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_interests
    ADD CONSTRAINT user_interests_pkey PRIMARY KEY (id);

--
-- Name: user_interests user_interests_user_id_interest_type_interest_value_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_interests
    ADD CONSTRAINT user_interests_user_id_interest_type_interest_value_key UNIQUE (user_id, interest_type, interest_value);

--
-- Name: user_invitations user_invitations_invitation_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_invitations
    ADD CONSTRAINT user_invitations_invitation_code_key UNIQUE (invitation_code);

--
-- Name: user_invitations user_invitations_inviter_id_invitee_id_community_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_invitations
    ADD CONSTRAINT user_invitations_inviter_id_invitee_id_community_id_key UNIQUE (inviter_id, invitee_id, community_id);

--
-- Name: user_invitations user_invitations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_invitations
    ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id);

--
-- Name: user_privacy_settings user_privacy_settings_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_pkey PRIMARY KEY (user_id);

--
-- Name: user_request_preferences user_request_preferences_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_request_preferences
    ADD CONSTRAINT user_request_preferences_pkey PRIMARY KEY (user_id, request_type);

--
-- Name: user_skills user_skills_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_skills
    ADD CONSTRAINT user_skills_pkey PRIMARY KEY (id);

--
-- Name: user_skills user_skills_user_id_skill_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_skills
    ADD CONSTRAINT user_skills_user_id_skill_key UNIQUE (user_id, skill);

--
-- Name: user_tags user_tags_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_tags
    ADD CONSTRAINT user_tags_pkey PRIMARY KEY (id);

--
-- Name: user_tags user_tags_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_tags
    ADD CONSTRAINT user_tags_unique UNIQUE (user_id, tag_type, tag_value);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_federated_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_federated_id_key UNIQUE (federated_id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);

--
-- Name: activity_participants activity_participants_activity_id_user_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activity_participants
    ADD CONSTRAINT activity_participants_activity_id_user_id_key UNIQUE (activity_id, user_id);

--
-- Name: activity_participants activity_participants_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activity_participants
    ADD CONSTRAINT activity_participants_pkey PRIMARY KEY (id);

--
-- Name: communities communities_federated_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.communities
    ADD CONSTRAINT communities_federated_id_key UNIQUE (federated_id);

--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);

--
-- Name: community_configs community_configs_community_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_configs
    ADD CONSTRAINT community_configs_community_id_key UNIQUE (community_id);

--
-- Name: community_configs community_configs_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_configs
    ADD CONSTRAINT community_configs_pkey PRIMARY KEY (id);

--
-- Name: community_links community_links_community_a_id_community_b_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_community_a_id_community_b_id_key UNIQUE (community_a_id, community_b_id);

--
-- Name: community_links community_links_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_pkey PRIMARY KEY (id);

--
-- Name: config_templates config_templates_name_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.config_templates
    ADD CONSTRAINT config_templates_name_key UNIQUE (name);

--
-- Name: config_templates config_templates_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.config_templates
    ADD CONSTRAINT config_templates_pkey PRIMARY KEY (id);

--
-- Name: fusion_proposals fusion_proposals_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_pkey PRIMARY KEY (id);

--
-- Name: fusion_votes fusion_votes_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_votes
    ADD CONSTRAINT fusion_votes_pkey PRIMARY KEY (id);

--
-- Name: fusion_votes fusion_votes_proposal_id_user_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_votes
    ADD CONSTRAINT fusion_votes_proposal_id_user_id_key UNIQUE (proposal_id, user_id);

--
-- Name: governance_nominations governance_nominations_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_nominations
    ADD CONSTRAINT governance_nominations_pkey PRIMARY KEY (id);

--
-- Name: governance_ratifications governance_ratifications_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_ratifications
    ADD CONSTRAINT governance_ratifications_pkey PRIMARY KEY (nomination_id, ratifier_id);

--
-- Name: health_summary health_summary_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.health_summary
    ADD CONSTRAINT health_summary_pkey PRIMARY KEY (community_id);

--
-- Name: members members_community_id_user_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.members
    ADD CONSTRAINT members_community_id_user_id_key UNIQUE (community_id, user_id);

--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);

--
-- Name: norm_approvals norm_approvals_norm_id_approved_by_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norm_approvals
    ADD CONSTRAINT norm_approvals_norm_id_approved_by_key UNIQUE (norm_id, approved_by);

--
-- Name: norm_approvals norm_approvals_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norm_approvals
    ADD CONSTRAINT norm_approvals_pkey PRIMARY KEY (id);

--
-- Name: norms norms_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norms
    ADD CONSTRAINT norms_pkey PRIMARY KEY (id);

--
-- Name: settings settings_community_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.settings
    ADD CONSTRAINT settings_community_id_key UNIQUE (community_id);

--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);

--
-- Name: split_member_assignments split_member_assignments_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_member_assignments
    ADD CONSTRAINT split_member_assignments_pkey PRIMARY KEY (id);

--
-- Name: split_member_assignments split_member_assignments_proposal_id_user_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_member_assignments
    ADD CONSTRAINT split_member_assignments_proposal_id_user_id_key UNIQUE (proposal_id, user_id);

--
-- Name: split_proposals split_proposals_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_proposals
    ADD CONSTRAINT split_proposals_pkey PRIMARY KEY (id);

--
-- Name: split_votes split_votes_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_votes
    ADD CONSTRAINT split_votes_pkey PRIMARY KEY (id);

--
-- Name: split_votes split_votes_proposal_id_user_id_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_votes
    ADD CONSTRAINT split_votes_proposal_id_user_id_key UNIQUE (proposal_id, user_id);

--
-- Name: trust_question_choices trust_question_choices_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.trust_question_choices
    ADD CONSTRAINT trust_question_choices_pkey PRIMARY KEY (id);

--
-- Name: trust_question_choices trust_question_choices_question_id_value_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.trust_question_choices
    ADD CONSTRAINT trust_question_choices_question_id_value_key UNIQUE (question_id, value);

--
-- Name: trust_questions trust_questions_pkey; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.trust_questions
    ADD CONSTRAINT trust_questions_pkey PRIMARY KEY (id);

--
-- Name: trust_questions trust_questions_slug_key; Type: CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.trust_questions
    ADD CONSTRAINT trust_questions_slug_key UNIQUE (slug);

--
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: events; Owner: -
--

ALTER TABLE ONLY events.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);

--
-- Name: blocked_instances blocked_instances_instance_domain_blocked_by_community_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.blocked_instances
    ADD CONSTRAINT blocked_instances_instance_domain_blocked_by_community_key UNIQUE (instance_domain, blocked_by_community);

--
-- Name: blocked_instances blocked_instances_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.blocked_instances
    ADD CONSTRAINT blocked_instances_pkey PRIMARY KEY (id);

--
-- Name: federated_communities federated_communities_federated_id_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_communities
    ADD CONSTRAINT federated_communities_federated_id_key UNIQUE (federated_id);

--
-- Name: federated_communities federated_communities_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_communities
    ADD CONSTRAINT federated_communities_pkey PRIMARY KEY (id);

--
-- Name: federated_requests federated_requests_federated_id_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_requests
    ADD CONSTRAINT federated_requests_federated_id_key UNIQUE (federated_id);

--
-- Name: federated_requests federated_requests_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_requests
    ADD CONSTRAINT federated_requests_pkey PRIMARY KEY (id);

--
-- Name: federated_user_mappings federated_user_mappings_federated_user_id_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_user_mappings
    ADD CONSTRAINT federated_user_mappings_federated_user_id_key UNIQUE (federated_user_id);

--
-- Name: federated_user_mappings federated_user_mappings_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_user_mappings
    ADD CONSTRAINT federated_user_mappings_pkey PRIMARY KEY (id);

--
-- Name: federated_users federated_users_federated_id_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_users
    ADD CONSTRAINT federated_users_federated_id_key UNIQUE (federated_id);

--
-- Name: federated_users federated_users_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_users
    ADD CONSTRAINT federated_users_pkey PRIMARY KEY (id);

--
-- Name: federation_links federation_links_instance_id_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federation_links
    ADD CONSTRAINT federation_links_instance_id_key UNIQUE (instance_id);

--
-- Name: federation_links federation_links_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federation_links
    ADD CONSTRAINT federation_links_pkey PRIMARY KEY (id);

--
-- Name: inbox inbox_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.inbox
    ADD CONSTRAINT inbox_pkey PRIMARY KEY (id);

--
-- Name: instances instances_domain_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.instances
    ADD CONSTRAINT instances_domain_key UNIQUE (domain);

--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);

--
-- Name: local_instance local_instance_domain_key; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.local_instance
    ADD CONSTRAINT local_instance_domain_key UNIQUE (domain);

--
-- Name: local_instance local_instance_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.local_instance
    ADD CONSTRAINT local_instance_pkey PRIMARY KEY (id);

--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (id);

--
-- Name: reputation_attestations reputation_attestations_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.reputation_attestations
    ADD CONSTRAINT reputation_attestations_pkey PRIMARY KEY (id);

--
-- Name: user_migrations user_migrations_pkey; Type: CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.user_migrations
    ADD CONSTRAINT user_migrations_pkey PRIMARY KEY (id);

--
-- Name: dismissed_items dismissed_items_pkey; Type: CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.dismissed_items
    ADD CONSTRAINT dismissed_items_pkey PRIMARY KEY (id);

--
-- Name: dismissed_items dismissed_items_user_id_item_type_item_id_key; Type: CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.dismissed_items
    ADD CONSTRAINT dismissed_items_user_id_item_type_item_id_key UNIQUE (user_id, item_type, item_id);

--
-- Name: featured_stories featured_stories_pkey; Type: CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.featured_stories
    ADD CONSTRAINT featured_stories_pkey PRIMARY KEY (id);

--
-- Name: preferences preferences_pkey; Type: CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);

--
-- Name: feedback_categories feedback_categories_pkey; Type: CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback_categories
    ADD CONSTRAINT feedback_categories_pkey PRIMARY KEY (id);

--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

--
-- Name: conflict_cases conflict_cases_pkey; Type: CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_cases
    ADD CONSTRAINT conflict_cases_pkey PRIMARY KEY (id);

--
-- Name: conflict_mediators conflict_mediators_pkey; Type: CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_mediators
    ADD CONSTRAINT conflict_mediators_pkey PRIMARY KEY (id);

--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);

--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);

--
-- Name: votes votes_proposal_id_voter_id_key; Type: CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.votes
    ADD CONSTRAINT votes_proposal_id_voter_id_key UNIQUE (proposal_id, voter_id);

--
-- Name: conversation_participants conversation_participants_conversation_id_participant_id_key; Type: CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_participant_id_key UNIQUE (conversation_id, participant_id);

--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);

--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: global_preferences global_preferences_pkey; Type: CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.global_preferences
    ADD CONSTRAINT global_preferences_pkey PRIMARY KEY (id);

--
-- Name: global_preferences global_preferences_user_id_key; Type: CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.global_preferences
    ADD CONSTRAINT global_preferences_user_id_key UNIQUE (user_id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: preferences preferences_pkey; Type: CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (id);

--
-- Name: preferences preferences_user_id_community_id_event_type_key; Type: CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.preferences
    ADD CONSTRAINT preferences_user_id_community_id_event_type_key UNIQUE (user_id, community_id, event_type);

--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: provider; Owner: -
--

ALTER TABLE ONLY provider.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);

--
-- Name: geocoding_cache geocoding_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geocoding_cache
    ADD CONSTRAINT geocoding_cache_pkey PRIMARY KEY (query);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (migration_name);

--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);

--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);

--
-- Name: badges badges_user_id_badge_type_key; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.badges
    ADD CONSTRAINT badges_user_id_badge_type_key UNIQUE (user_id, badge_type);

--
-- Name: community_evolution_log community_evolution_log_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_evolution_log
    ADD CONSTRAINT community_evolution_log_pkey PRIMARY KEY (id);

--
-- Name: community_health_metrics community_health_metrics_community_id_snapshot_date_key; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_health_metrics
    ADD CONSTRAINT community_health_metrics_community_id_snapshot_date_key UNIQUE (community_id, snapshot_date);

--
-- Name: community_health_metrics community_health_metrics_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_health_metrics
    ADD CONSTRAINT community_health_metrics_pkey PRIMARY KEY (id);

--
-- Name: community_trust_scores community_trust_scores_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_trust_scores
    ADD CONSTRAINT community_trust_scores_pkey PRIMARY KEY (community_id);

--
-- Name: karma_records karma_records_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.karma_records
    ADD CONSTRAINT karma_records_pkey PRIMARY KEY (id);

--
-- Name: milestone_events milestone_events_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.milestone_events
    ADD CONSTRAINT milestone_events_pkey PRIMARY KEY (id);

--
-- Name: provider_reviews provider_reviews_match_id_reviewer_id_key; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_reviews
    ADD CONSTRAINT provider_reviews_match_id_reviewer_id_key UNIQUE (match_id, reviewer_id);

--
-- Name: provider_reviews provider_reviews_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_reviews
    ADD CONSTRAINT provider_reviews_pkey PRIMARY KEY (id);

--
-- Name: provider_trust_scores provider_trust_scores_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_trust_scores
    ADD CONSTRAINT provider_trust_scores_pkey PRIMARY KEY (provider_id);

--
-- Name: trust_scores trust_scores_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.trust_scores
    ADD CONSTRAINT trust_scores_pkey PRIMARY KEY (id);

--
-- Name: trust_scores trust_scores_user_id_community_id_key; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.trust_scores
    ADD CONSTRAINT trust_scores_user_id_community_id_key UNIQUE (user_id, community_id);

--
-- Name: user_trust_configs user_trust_configs_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_configs
    ADD CONSTRAINT user_trust_configs_pkey PRIMARY KEY (user_id, community_id);

--
-- Name: user_trust_evolution_log user_trust_evolution_log_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_evolution_log
    ADD CONSTRAINT user_trust_evolution_log_pkey PRIMARY KEY (id);

--
-- Name: user_trust_preferences user_trust_preferences_pkey; Type: CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_preferences
    ADD CONSTRAINT user_trust_preferences_pkey PRIMARY KEY (user_id);

--
-- Name: collective_community_links collective_community_links_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.collective_community_links
    ADD CONSTRAINT collective_community_links_pkey PRIMARY KEY (collective_id, community_id);

--
-- Name: dibs dibs_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.dibs
    ADD CONSTRAINT dibs_pkey PRIMARY KEY (id);

--
-- Name: feed_events feed_events_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.feed_events
    ADD CONSTRAINT feed_events_pkey PRIMARY KEY (id);

--
-- Name: help_offers help_offers_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_offers
    ADD CONSTRAINT help_offers_pkey PRIMARY KEY (id);

--
-- Name: help_requests help_requests_federated_id_key; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_requests
    ADD CONSTRAINT help_requests_federated_id_key UNIQUE (federated_id);

--
-- Name: help_requests help_requests_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_requests
    ADD CONSTRAINT help_requests_pkey PRIMARY KEY (id);

--
-- Name: interaction_feedback interaction_feedback_match_id_from_user_id_key; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.interaction_feedback
    ADD CONSTRAINT interaction_feedback_match_id_from_user_id_key UNIQUE (match_id, from_user_id);

--
-- Name: interaction_feedback interaction_feedback_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.interaction_feedback
    ADD CONSTRAINT interaction_feedback_pkey PRIMARY KEY (id);

--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);

--
-- Name: provider_collective_members provider_collective_members_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_collective_members
    ADD CONSTRAINT provider_collective_members_pkey PRIMARY KEY (collective_id, provider_id);

--
-- Name: provider_collectives provider_collectives_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_collectives
    ADD CONSTRAINT provider_collectives_pkey PRIMARY KEY (id);

--
-- Name: provider_profiles provider_profiles_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_profiles
    ADD CONSTRAINT provider_profiles_pkey PRIMARY KEY (id);

--
-- Name: provider_profiles provider_profiles_user_id_service_type_key; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_profiles
    ADD CONSTRAINT provider_profiles_user_id_service_type_key UNIQUE (user_id, service_type);

--
-- Name: provider_rate_cards provider_rate_cards_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_rate_cards
    ADD CONSTRAINT provider_rate_cards_pkey PRIMARY KEY (id);

--
-- Name: provider_ride_details provider_ride_details_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_ride_details
    ADD CONSTRAINT provider_ride_details_pkey PRIMARY KEY (provider_id);

--
-- Name: request_admin_notes request_admin_notes_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_admin_notes
    ADD CONSTRAINT request_admin_notes_pkey PRIMARY KEY (id);

--
-- Name: request_communities request_communities_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_communities
    ADD CONSTRAINT request_communities_pkey PRIMARY KEY (id);

--
-- Name: retention_config retention_config_community_id_key; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.retention_config
    ADD CONSTRAINT retention_config_community_id_key UNIQUE (community_id);

--
-- Name: retention_config retention_config_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.retention_config
    ADD CONSTRAINT retention_config_pkey PRIMARY KEY (id);

--
-- Name: ui_schema_versions ui_schema_versions_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schema_versions
    ADD CONSTRAINT ui_schema_versions_pkey PRIMARY KEY (id);

--
-- Name: ui_schemas ui_schemas_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schemas
    ADD CONSTRAINT ui_schemas_pkey PRIMARY KEY (id);

--
-- Name: ui_schemas ui_schemas_type_key; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schemas
    ADD CONSTRAINT ui_schemas_type_key UNIQUE (type);

--
-- Name: validation_rules unique_active_validation; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.validation_rules
    ADD CONSTRAINT unique_active_validation UNIQUE (type, status) DEFERRABLE INITIALLY DEFERRED;

--
-- Name: request_communities unique_request_community; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_communities
    ADD CONSTRAINT unique_request_community UNIQUE (request_id, community_id);

--
-- Name: request_admin_notes unique_request_community_note; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_admin_notes
    ADD CONSTRAINT unique_request_community_note UNIQUE (request_id, community_id);

--
-- Name: ui_schema_versions unique_schema_version; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schema_versions
    ADD CONSTRAINT unique_schema_version UNIQUE (schema_id, version);

--
-- Name: ui_schemas unique_type_variant; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schemas
    ADD CONSTRAINT unique_type_variant UNIQUE (type, variant);

--
-- Name: dibs uq_dibs_request_id; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.dibs
    ADD CONSTRAINT uq_dibs_request_id UNIQUE (request_id);

--
-- Name: validation_rules validation_rules_pkey; Type: CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.validation_rules
    ADD CONSTRAINT validation_rules_pkey PRIMARY KEY (id);

--
-- Name: community_trust_edges community_trust_edges_community_id_a_community_id_b_key; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.community_trust_edges
    ADD CONSTRAINT community_trust_edges_community_id_a_community_id_b_key UNIQUE (community_id_a, community_id_b);

--
-- Name: community_trust_edges community_trust_edges_pkey; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.community_trust_edges
    ADD CONSTRAINT community_trust_edges_pkey PRIMARY KEY (id);

--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);

--
-- Name: interaction_weights interaction_weights_community_id_interaction_type_key; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.interaction_weights
    ADD CONSTRAINT interaction_weights_community_id_interaction_type_key UNIQUE (community_id, interaction_type);

--
-- Name: interaction_weights interaction_weights_pkey; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.interaction_weights
    ADD CONSTRAINT interaction_weights_pkey PRIMARY KEY (id);

--
-- Name: trust_decay_config trust_decay_config_community_id_key; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_decay_config
    ADD CONSTRAINT trust_decay_config_community_id_key UNIQUE (community_id);

--
-- Name: trust_decay_config trust_decay_config_pkey; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_decay_config
    ADD CONSTRAINT trust_decay_config_pkey PRIMARY KEY (id);

--
-- Name: trust_edges trust_edges_pkey; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_edges
    ADD CONSTRAINT trust_edges_pkey PRIMARY KEY (id);

--
-- Name: trust_edges trust_edges_user_id_a_user_id_b_community_id_key; Type: CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_edges
    ADD CONSTRAINT trust_edges_user_id_a_user_id_b_community_id_key UNIQUE (user_id_a, user_id_b, community_id);

--
-- Name: idx_auth_sessions_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_sessions_user_id ON auth.sessions USING btree (user_id);

--
-- Name: idx_auth_user_skills_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_user_skills_user_id ON auth.user_skills USING btree (user_id);

--
-- Name: idx_auth_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_users_email ON auth.users USING btree (email);

--
-- Name: idx_device_push_tokens_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_device_push_tokens_user_id ON auth.device_push_tokens USING btree (user_id);

--
-- Name: idx_founding_circle_status_created; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_founding_circle_status_created ON auth.founding_circle_submissions USING btree (status, created_at DESC);

--
-- Name: idx_invitations_accepted; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_accepted ON auth.user_invitations USING btree (invitation_accepted_at);

--
-- Name: idx_invitations_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_code ON auth.user_invitations USING btree (invitation_code);

--
-- Name: idx_invitations_community; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_community ON auth.user_invitations USING btree (community_id);

--
-- Name: idx_invitations_graph; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_graph ON auth.user_invitations USING btree (inviter_id, invitee_id) WHERE (invitation_accepted_at IS NOT NULL);

--
-- Name: idx_invitations_invitee; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_invitee ON auth.user_invitations USING btree (invitee_id);

--
-- Name: idx_invitations_inviter; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_invitations_inviter ON auth.user_invitations USING btree (inviter_id);

--
-- Name: idx_inviter_stats_avg_karma; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_inviter_stats_avg_karma ON auth.inviter_stats USING btree (avg_invitee_karma DESC);

--
-- Name: idx_inviter_stats_community; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_inviter_stats_community ON auth.inviter_stats USING btree (community_id);

--
-- Name: idx_inviter_stats_network_size; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_inviter_stats_network_size ON auth.inviter_stats USING btree (total_network_size DESC);

--
-- Name: idx_inviter_stats_tier; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_inviter_stats_tier ON auth.inviter_stats USING btree (inviter_tier);

--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON auth.refresh_tokens USING btree (token_hash);

--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON auth.refresh_tokens USING btree (user_id);

--
-- Name: idx_social_distances_community; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_community ON auth.social_distances USING btree (community_id);

--
-- Name: idx_social_distances_degrees; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_degrees ON auth.social_distances USING btree (degrees_of_separation);

--
-- Name: idx_social_distances_expires; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_expires ON auth.social_distances USING btree (expires_at);

--
-- Name: idx_social_distances_lookup; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_lookup ON auth.social_distances USING btree (user_a_id, user_b_id, community_id);

--
-- Name: idx_social_distances_user_a; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_user_a ON auth.social_distances USING btree (user_a_id);

--
-- Name: idx_social_distances_user_b; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_social_distances_user_b ON auth.social_distances USING btree (user_b_id);

--
-- Name: idx_user_feed_prefs_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_feed_prefs_user ON auth.user_feed_preferences USING btree (user_id);

--
-- Name: idx_user_interests_type; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_interests_type ON auth.user_interests USING btree (interest_type, interest_value);

--
-- Name: idx_user_interests_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_interests_user ON auth.user_interests USING btree (user_id);

--
-- Name: idx_user_preferences_subscribed; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_preferences_subscribed ON auth.user_request_preferences USING btree (user_id, subscribed) WHERE (subscribed = true);

--
-- Name: idx_user_preferences_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_preferences_user ON auth.user_request_preferences USING btree (user_id);

--
-- Name: idx_user_privacy_settings_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_privacy_settings_user_id ON auth.user_privacy_settings USING btree (user_id);

--
-- Name: idx_user_skills_skill; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_skills_skill ON auth.user_skills USING btree (skill);

--
-- Name: idx_user_skills_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_skills_user_id ON auth.user_skills USING btree (user_id);

--
-- Name: idx_user_tags_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_tags_user_id ON auth.user_tags USING btree (user_id);

--
-- Name: idx_users_invited_by; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_invited_by ON auth.users USING btree (invited_by) WHERE (invited_by IS NOT NULL);

--
-- Name: idx_activities_community_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_activities_community_id ON communities.activities USING btree (community_id);

--
-- Name: idx_activities_scheduled_at; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_activities_scheduled_at ON communities.activities USING btree (scheduled_at);

--
-- Name: idx_activities_status; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_activities_status ON communities.activities USING btree (status);

--
-- Name: idx_activity_participants_activity_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_activity_participants_activity_id ON communities.activity_participants USING btree (activity_id);

--
-- Name: idx_activity_participants_user_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_activity_participants_user_id ON communities.activity_participants USING btree (user_id);

--
-- Name: idx_communities_category; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_category ON communities.communities USING btree (category);

--
-- Name: idx_communities_creator_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_creator_id ON communities.communities USING btree (creator_id);

--
-- Name: idx_communities_identity_active; Type: INDEX; Schema: communities; Owner: -
--

CREATE UNIQUE INDEX idx_communities_identity_active ON communities.communities USING btree (lower(TRIM(BOTH FROM name)), lower(TRIM(BOTH FROM COALESCE(location, ''::character varying)))) WHERE ((status)::text = 'active'::text);

--
-- Name: idx_communities_location; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_location ON communities.communities USING btree (location);

--
-- Name: idx_communities_location_geo; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_location_geo ON communities.communities USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));

--
-- Name: idx_communities_status; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_status ON communities.communities USING btree (status);

--
-- Name: idx_communities_tags; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_communities_tags ON communities.communities USING gin (tags);

--
-- Name: idx_community_configs_community_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_configs_community_id ON communities.community_configs USING btree (community_id);

--
-- Name: idx_community_configs_template_source; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_configs_template_source ON communities.community_configs USING btree (template_source);

--
-- Name: idx_community_links_a; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_links_a ON communities.community_links USING btree (community_a_id);

--
-- Name: idx_community_links_b; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_links_b ON communities.community_links USING btree (community_b_id);

--
-- Name: idx_community_links_status; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_links_status ON communities.community_links USING btree (status);

--
-- Name: idx_community_settings_community_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_community_settings_community_id ON communities.settings USING btree (community_id);

--
-- Name: idx_config_templates_is_public; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_config_templates_is_public ON communities.config_templates USING btree (is_public);

--
-- Name: idx_config_templates_usage; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_config_templates_usage ON communities.config_templates USING btree (usage_count DESC);

--
-- Name: idx_fusion_proposals_a; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_fusion_proposals_a ON communities.fusion_proposals USING btree (community_a_id);

--
-- Name: idx_fusion_proposals_b; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_fusion_proposals_b ON communities.fusion_proposals USING btree (community_b_id);

--
-- Name: idx_fusion_votes_community; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_fusion_votes_community ON communities.fusion_votes USING btree (proposal_id, community_id);

--
-- Name: idx_fusion_votes_proposal; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_fusion_votes_proposal ON communities.fusion_votes USING btree (proposal_id);

--
-- Name: idx_governance_nominations_community; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_governance_nominations_community ON communities.governance_nominations USING btree (community_id);

--
-- Name: idx_members_community_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_members_community_id ON communities.members USING btree (community_id);

--
-- Name: idx_members_status; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_members_status ON communities.members USING btree (status);

--
-- Name: idx_members_user_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_members_user_id ON communities.members USING btree (user_id);

--
-- Name: idx_norms_community_id; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_norms_community_id ON communities.norms USING btree (community_id);

--
-- Name: idx_split_assignments_proposal; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_split_assignments_proposal ON communities.split_member_assignments USING btree (proposal_id);

--
-- Name: idx_split_proposals_community; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_split_proposals_community ON communities.split_proposals USING btree (community_id);

--
-- Name: idx_split_votes_proposal; Type: INDEX; Schema: communities; Owner: -
--

CREATE INDEX idx_split_votes_proposal ON communities.split_votes USING btree (proposal_id);

--
-- Name: uq_split_proposals_active_per_community; Type: INDEX; Schema: communities; Owner: -
--

CREATE UNIQUE INDEX uq_split_proposals_active_per_community ON communities.split_proposals USING btree (community_id) WHERE (status <> ALL (ARRAY['executed'::text, 'rejected'::text]));

--
-- Name: idx_event_log_created_at; Type: INDEX; Schema: events; Owner: -
--

CREATE INDEX idx_event_log_created_at ON events.event_log USING btree (created_at);

--
-- Name: idx_event_log_processed; Type: INDEX; Schema: events; Owner: -
--

CREATE INDEX idx_event_log_processed ON events.event_log USING btree (processed);

--
-- Name: idx_event_log_type; Type: INDEX; Schema: events; Owner: -
--

CREATE INDEX idx_event_log_type ON events.event_log USING btree (event_type);

--
-- Name: idx_federated_requests_origin; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_federated_requests_origin ON federation.federated_requests USING btree (origin_instance_id);

--
-- Name: idx_federated_requests_status; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_federated_requests_status ON federation.federated_requests USING btree (status);

--
-- Name: idx_federated_users_federated_id; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_federated_users_federated_id ON federation.federated_users USING btree (federated_id);

--
-- Name: idx_federated_users_instance; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_federated_users_instance ON federation.federated_users USING btree (home_instance_id);

--
-- Name: idx_federation_links_status; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_federation_links_status ON federation.federation_links USING btree (status);

--
-- Name: idx_inbox_processed; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_inbox_processed ON federation.inbox USING btree (processed);

--
-- Name: idx_inbox_received; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_inbox_received ON federation.inbox USING btree (received_at);

--
-- Name: idx_instances_domain; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_instances_domain ON federation.instances USING btree (domain);

--
-- Name: idx_instances_status; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_instances_status ON federation.instances USING btree (status);

--
-- Name: idx_outbox_sent; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_outbox_sent ON federation.outbox USING btree (sent_at);

--
-- Name: idx_outbox_status; Type: INDEX; Schema: federation; Owner: -
--

CREATE INDEX idx_outbox_status ON federation.outbox USING btree (((delivery_status ->> 'status'::text)));

--
-- Name: idx_featured_stories_community; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_featured_stories_community ON feed.featured_stories USING btree (community_id);

--
-- Name: idx_featured_stories_created; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_featured_stories_created ON feed.featured_stories USING btree (created_at);

--
-- Name: idx_featured_stories_type; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_featured_stories_type ON feed.featured_stories USING btree (story_type);

--
-- Name: idx_feed_dismissed_at; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_feed_dismissed_at ON feed.dismissed_items USING btree (dismissed_at);

--
-- Name: idx_feed_dismissed_user_id; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_feed_dismissed_user_id ON feed.dismissed_items USING btree (user_id);

--
-- Name: idx_feed_preferences_user_id; Type: INDEX; Schema: feed; Owner: -
--

CREATE INDEX idx_feed_preferences_user_id ON feed.preferences USING btree (user_id);

--
-- Name: idx_feedback_from_user; Type: INDEX; Schema: feedback; Owner: -
--

CREATE INDEX idx_feedback_from_user ON feedback.feedback USING btree (from_user_id);

--
-- Name: idx_feedback_match; Type: INDEX; Schema: feedback; Owner: -
--

CREATE INDEX idx_feedback_match ON feedback.feedback USING btree (request_match_id);

--
-- Name: idx_feedback_to_user; Type: INDEX; Schema: feedback; Owner: -
--

CREATE INDEX idx_feedback_to_user ON feedback.feedback USING btree (to_user_id);

--
-- Name: idx_feedback_to_user_community; Type: INDEX; Schema: feedback; Owner: -
--

CREATE INDEX idx_feedback_to_user_community ON feedback.feedback USING btree (to_user_id, community_id);

--
-- Name: idx_conflict_cases_community_id; Type: INDEX; Schema: governance; Owner: -
--

CREATE INDEX idx_conflict_cases_community_id ON governance.conflict_cases USING btree (community_id);

--
-- Name: idx_proposals_community_id; Type: INDEX; Schema: governance; Owner: -
--

CREATE INDEX idx_proposals_community_id ON governance.proposals USING btree (community_id);

--
-- Name: idx_proposals_proposed_by; Type: INDEX; Schema: governance; Owner: -
--

CREATE INDEX idx_proposals_proposed_by ON governance.proposals USING btree (proposed_by);

--
-- Name: idx_votes_proposal_id; Type: INDEX; Schema: governance; Owner: -
--

CREATE INDEX idx_votes_proposal_id ON governance.votes USING btree (proposal_id);

--
-- Name: idx_conversations_request_match_id; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_conversations_request_match_id ON messaging.conversations USING btree (request_match_id);

--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON messaging.messages USING btree (conversation_id);

--
-- Name: idx_messages_expired; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_messages_expired ON messaging.messages USING btree (expired);

--
-- Name: idx_messages_expires_at; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_messages_expires_at ON messaging.messages USING btree (expires_at) WHERE (expired = false);

--
-- Name: idx_messages_not_forgotten; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_messages_not_forgotten ON messaging.messages USING btree (created_at) WHERE (forgotten_at IS NULL);

--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: messaging; Owner: -
--

CREATE INDEX idx_messages_sender_id ON messaging.messages USING btree (sender_id);

--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_created_at ON notifications.notifications USING btree (created_at DESC);

--
-- Name: idx_notifications_expired; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_expired ON notifications.notifications USING btree (expired);

--
-- Name: idx_notifications_expires_at; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_expires_at ON notifications.notifications USING btree (expires_at) WHERE (expired = false);

--
-- Name: idx_notifications_type; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_type ON notifications.notifications USING btree (type);

--
-- Name: idx_notifications_unread; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_unread ON notifications.notifications USING btree (user_id, read) WHERE (read = false);

--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_notifications_user_id ON notifications.notifications USING btree (user_id);

--
-- Name: idx_preferences_event_type; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_preferences_event_type ON notifications.preferences USING btree (event_type);

--
-- Name: idx_preferences_user_id; Type: INDEX; Schema: notifications; Owner: -
--

CREATE INDEX idx_preferences_user_id ON notifications.preferences USING btree (user_id);

--
-- Name: idx_provider_offers_provider_user; Type: INDEX; Schema: provider; Owner: -
--

CREATE INDEX idx_provider_offers_provider_user ON provider.offers USING btree (provider_user_id);

--
-- Name: idx_provider_offers_request; Type: INDEX; Schema: provider; Owner: -
--

CREATE INDEX idx_provider_offers_request ON provider.offers USING btree (request_id);

--
-- Name: idx_provider_offers_status; Type: INDEX; Schema: provider; Owner: -
--

CREATE INDEX idx_provider_offers_status ON provider.offers USING btree (status);

--
-- Name: uq_provider_offers_active; Type: INDEX; Schema: provider; Owner: -
--

CREATE UNIQUE INDEX uq_provider_offers_active ON provider.offers USING btree (provider_user_id, request_id) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying])::text[]));

--
-- Name: idx_geocoding_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocoding_expires ON public.geocoding_cache USING btree (expires_at);

--
-- Name: idx_geocoding_hits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocoding_hits ON public.geocoding_cache USING btree (hit_count DESC);

--
-- Name: idx_geocoding_last_accessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocoding_last_accessed ON public.geocoding_cache USING btree (last_accessed DESC);

--
-- Name: idx_activity_log_created_at; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_activity_log_created_at ON reputation.activity_log USING btree (created_at DESC);

--
-- Name: idx_activity_log_type; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_activity_log_type ON reputation.activity_log USING btree (activity_type);

--
-- Name: idx_activity_log_user_community; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_activity_log_user_community ON reputation.activity_log USING btree (user_id, community_id);

--
-- Name: idx_badges_badge_type; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_badges_badge_type ON reputation.badges USING btree (badge_type);

--
-- Name: idx_badges_user_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_badges_user_id ON reputation.badges USING btree (user_id);

--
-- Name: idx_cel_community_applied; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_cel_community_applied ON reputation.community_evolution_log USING btree (community_id, applied_at DESC);

--
-- Name: idx_health_metrics_community; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_health_metrics_community ON reputation.community_health_metrics USING btree (community_id);

--
-- Name: idx_health_metrics_date; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_health_metrics_date ON reputation.community_health_metrics USING btree (snapshot_date);

--
-- Name: idx_karma_community_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_karma_community_id ON reputation.karma_records USING btree (community_id);

--
-- Name: idx_karma_user_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_karma_user_id ON reputation.karma_records USING btree (user_id);

--
-- Name: idx_milestone_events_community; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_milestone_events_community ON reputation.milestone_events USING btree (community_id);

--
-- Name: idx_milestone_events_type; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_milestone_events_type ON reputation.milestone_events USING btree (milestone_type);

--
-- Name: idx_provider_reviews_provider_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_provider_reviews_provider_id ON reputation.provider_reviews USING btree (provider_id);

--
-- Name: idx_provider_reviews_reviewer_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_provider_reviews_reviewer_id ON reputation.provider_reviews USING btree (reviewer_id);

--
-- Name: idx_trust_scores_last_activity; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_trust_scores_last_activity ON reputation.trust_scores USING btree (last_activity_at);

--
-- Name: idx_trust_scores_user_id; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_trust_scores_user_id ON reputation.trust_scores USING btree (user_id);

--
-- Name: idx_utc_comm; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_utc_comm ON reputation.user_trust_configs USING btree (community_id);

--
-- Name: idx_utc_user; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_utc_user ON reputation.user_trust_configs USING btree (user_id);

--
-- Name: idx_utel_user_comm_param_created; Type: INDEX; Schema: reputation; Owner: -
--

CREATE INDEX idx_utel_user_comm_param_created ON reputation.user_trust_evolution_log USING btree (user_id, community_id, parameter, created_at DESC);

--
-- Name: uq_activity_match_projection; Type: INDEX; Schema: reputation; Owner: -
--

CREATE UNIQUE INDEX uq_activity_match_projection ON reputation.activity_log USING btree (user_id, community_id, activity_type, related_entity_id) WHERE (related_entity_id IS NOT NULL);

--
-- Name: uq_karma_match_projection; Type: INDEX; Schema: reputation; Owner: -
--

CREATE UNIQUE INDEX uq_karma_match_projection ON reputation.karma_records USING btree (user_id, community_id, reason, related_entity_id) WHERE (related_entity_id IS NOT NULL);

--
-- Name: idx_collective_community_links_collective; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_collective_community_links_collective ON requests.collective_community_links USING btree (collective_id);

--
-- Name: idx_collective_community_links_community; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_collective_community_links_community ON requests.collective_community_links USING btree (community_id);

--
-- Name: idx_collective_members_collective; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_collective_members_collective ON requests.provider_collective_members USING btree (collective_id);

--
-- Name: idx_collective_members_provider; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_collective_members_provider ON requests.provider_collective_members USING btree (provider_id);

--
-- Name: idx_dibs_expires; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_dibs_expires ON requests.dibs USING btree (expires_at) WHERE (status = 'pending'::text);

--
-- Name: idx_dibs_expires_at; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_dibs_expires_at ON requests.dibs USING btree (expires_at) WHERE (status = 'pending'::text);

--
-- Name: idx_dibs_provider; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_dibs_provider ON requests.dibs USING btree (provider_user_id) WHERE (status = 'pending'::text);

--
-- Name: idx_dibs_provider_pending; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_dibs_provider_pending ON requests.dibs USING btree (provider_user_id) WHERE (status = 'pending'::text);

--
-- Name: idx_feed_events_request; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_feed_events_request ON requests.feed_events USING btree (request_id, event_type);

--
-- Name: idx_feed_events_type_date; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_feed_events_type_date ON requests.feed_events USING btree (event_type, created_at DESC);

--
-- Name: idx_feed_events_user; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_feed_events_user ON requests.feed_events USING btree (user_id, created_at DESC);

--
-- Name: idx_help_offers_expired; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_offers_expired ON requests.help_offers USING btree (expired);

--
-- Name: idx_help_offers_expires_at; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_offers_expires_at ON requests.help_offers USING btree (expires_at) WHERE (expired = false);

--
-- Name: idx_help_requests_expired; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_expired ON requests.help_requests USING btree (expired);

--
-- Name: idx_help_requests_expires_at; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_expires_at ON requests.help_requests USING btree (expires_at) WHERE (expired = false);

--
-- Name: idx_help_requests_not_forgotten; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_not_forgotten ON requests.help_requests USING btree (updated_at) WHERE (content_forgotten_at IS NULL);

--
-- Name: idx_help_requests_public; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_public ON requests.help_requests USING btree (is_public);

--
-- Name: idx_help_requests_scheduled_for; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_scheduled_for ON requests.help_requests USING btree (scheduled_for) WHERE (scheduled_for IS NOT NULL);

--
-- Name: idx_help_requests_type; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_help_requests_type ON requests.help_requests USING btree (request_type);

--
-- Name: idx_interaction_feedback_match; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_interaction_feedback_match ON requests.interaction_feedback USING btree (match_id);

--
-- Name: idx_interaction_feedback_to_user; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_interaction_feedback_to_user ON requests.interaction_feedback USING btree (to_user_id);

--
-- Name: idx_matches_partial_completion; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_matches_partial_completion ON requests.matches USING btree (status, requester_done_at, responder_done_at) WHERE ((status)::text = 'matched'::text);

--
-- Name: idx_matches_request_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_matches_request_id ON requests.matches USING btree (request_id);

--
-- Name: idx_matches_responder_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_matches_responder_id ON requests.matches USING btree (responder_id);

--
-- Name: idx_matches_scheduled_at; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_matches_scheduled_at ON requests.matches USING btree (scheduled_at) WHERE ((scheduled_at IS NOT NULL) AND ((status)::text = 'matched'::text));

--
-- Name: idx_offers_community_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_offers_community_id ON requests.help_offers USING btree (community_id);

--
-- Name: idx_provider_profiles_is_active; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_profiles_is_active ON requests.provider_profiles USING btree (is_active);

--
-- Name: idx_provider_profiles_is_available; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_profiles_is_available ON requests.provider_profiles USING btree (is_available) WHERE (is_active = true);

--
-- Name: idx_provider_profiles_service_type; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_profiles_service_type ON requests.provider_profiles USING btree (service_type);

--
-- Name: idx_provider_profiles_user_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_profiles_user_id ON requests.provider_profiles USING btree (user_id);

--
-- Name: idx_provider_rate_cards_provider_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_rate_cards_provider_id ON requests.provider_rate_cards USING btree (provider_id);

--
-- Name: idx_provider_rate_cards_service_type; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_provider_rate_cards_service_type ON requests.provider_rate_cards USING btree (service_type);

--
-- Name: idx_request_admin_notes_community; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_request_admin_notes_community ON requests.request_admin_notes USING btree (community_id);

--
-- Name: idx_request_admin_notes_request; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_request_admin_notes_request ON requests.request_admin_notes USING btree (request_id);

--
-- Name: idx_request_communities_community; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_request_communities_community ON requests.request_communities USING btree (community_id);

--
-- Name: idx_request_communities_request; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_request_communities_request ON requests.request_communities USING btree (request_id);

--
-- Name: idx_requests_is_boosted; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_requests_is_boosted ON requests.help_requests USING btree (is_boosted, boosted_expires_at) WHERE (is_boosted = true);

--
-- Name: idx_requests_payload; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_requests_payload ON requests.help_requests USING gin (payload);

--
-- Name: idx_requests_requester_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_requests_requester_id ON requests.help_requests USING btree (requester_id);

--
-- Name: idx_requests_type; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_requests_type ON requests.help_requests USING btree (request_type);

--
-- Name: idx_requests_visibility; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_requests_visibility ON requests.help_requests USING btree (visibility_scope) WHERE (((status)::text = 'open'::text) AND (expired = false));

--
-- Name: idx_ui_schema_versions_created_at; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schema_versions_created_at ON requests.ui_schema_versions USING btree (created_at DESC);

--
-- Name: idx_ui_schema_versions_schema_id; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schema_versions_schema_id ON requests.ui_schema_versions USING btree (schema_id);

--
-- Name: idx_ui_schemas_published; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schemas_published ON requests.ui_schemas USING btree (type, status) WHERE ((status)::text = 'published'::text);

--
-- Name: idx_ui_schemas_sections_gin; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schemas_sections_gin ON requests.ui_schemas USING gin (sections);

--
-- Name: idx_ui_schemas_status; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schemas_status ON requests.ui_schemas USING btree (status);

--
-- Name: idx_ui_schemas_type_status; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_ui_schemas_type_status ON requests.ui_schemas USING btree (type, status);

--
-- Name: idx_validation_rules_status; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_validation_rules_status ON requests.validation_rules USING btree (status);

--
-- Name: idx_validation_rules_type; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_validation_rules_type ON requests.validation_rules USING btree (type);

--
-- Name: idx_validation_rules_type_active; Type: INDEX; Schema: requests; Owner: -
--

CREATE INDEX idx_validation_rules_type_active ON requests.validation_rules USING btree (type, status) WHERE ((status)::text = 'active'::text);

--
-- Name: uq_retention_config_global; Type: INDEX; Schema: requests; Owner: -
--

CREATE UNIQUE INDEX uq_retention_config_global ON requests.retention_config USING btree (((community_id IS NULL))) WHERE (community_id IS NULL);

--
-- Name: connections_normalized_pair; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE UNIQUE INDEX connections_normalized_pair ON social_graph.connections USING btree (LEAST((user_a_id)::text, (user_b_id)::text), GREATEST((user_a_id)::text, (user_b_id)::text));

--
-- Name: connections_user_a_idx; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX connections_user_a_idx ON social_graph.connections USING btree (user_a_id);

--
-- Name: connections_user_b_idx; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX connections_user_b_idx ON social_graph.connections USING btree (user_b_id);

--
-- Name: trust_edges_community; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX trust_edges_community ON social_graph.trust_edges USING btree (community_id);

--
-- Name: trust_edges_user_a_community; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX trust_edges_user_a_community ON social_graph.trust_edges USING btree (user_id_a, community_id);

--
-- Name: trust_edges_user_b_community; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX trust_edges_user_b_community ON social_graph.trust_edges USING btree (user_id_b, community_id);

--
-- Name: trust_edges_weight; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE INDEX trust_edges_weight ON social_graph.trust_edges USING btree (raw_weight DESC);

--
-- Name: uq_interaction_weights_global; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE UNIQUE INDEX uq_interaction_weights_global ON social_graph.interaction_weights USING btree (interaction_type) WHERE (community_id IS NULL);

--
-- Name: uq_trust_decay_config_global; Type: INDEX; Schema: social_graph; Owner: -
--

CREATE UNIQUE INDEX uq_trust_decay_config_global ON social_graph.trust_decay_config USING btree (((community_id IS NULL))) WHERE (community_id IS NULL);

--
-- Name: user_invitations trigger_update_inviter_stats_on_acceptance; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER trigger_update_inviter_stats_on_acceptance AFTER UPDATE ON auth.user_invitations FOR EACH ROW EXECUTE FUNCTION auth.update_inviter_stats_on_acceptance();

--
-- Name: user_request_preferences update_user_preferences_timestamp; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER update_user_preferences_timestamp BEFORE UPDATE ON auth.user_request_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_timestamp();

--
-- Name: community_links community_links_updated_at; Type: TRIGGER; Schema: communities; Owner: -
--

CREATE TRIGGER community_links_updated_at BEFORE UPDATE ON communities.community_links FOR EACH ROW EXECUTE FUNCTION communities.update_community_links_updated_at();

--
-- Name: settings settings_updated_at; Type: TRIGGER; Schema: communities; Owner: -
--

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON communities.settings FOR EACH ROW EXECUTE FUNCTION communities.update_settings_timestamp();

--
-- Name: community_configs update_community_config_timestamp; Type: TRIGGER; Schema: communities; Owner: -
--

CREATE TRIGGER update_community_config_timestamp BEFORE UPDATE ON communities.community_configs FOR EACH ROW EXECUTE FUNCTION communities.update_community_config_timestamp();

--
-- Name: federated_users update_federated_users_updated_at; Type: TRIGGER; Schema: federation; Owner: -
--

CREATE TRIGGER update_federated_users_updated_at BEFORE UPDATE ON federation.federated_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: federation_links update_federation_links_updated_at; Type: TRIGGER; Schema: federation; Owner: -
--

CREATE TRIGGER update_federation_links_updated_at BEFORE UPDATE ON federation.federation_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: local_instance update_local_instance_updated_at; Type: TRIGGER; Schema: federation; Owner: -
--

CREATE TRIGGER update_local_instance_updated_at BEFORE UPDATE ON federation.local_instance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: messages trigger_set_message_expires_at; Type: TRIGGER; Schema: messaging; Owner: -
--

CREATE TRIGGER trigger_set_message_expires_at BEFORE INSERT ON messaging.messages FOR EACH ROW EXECUTE FUNCTION messaging.set_message_expires_at();

--
-- Name: global_preferences global_preferences_updated_at; Type: TRIGGER; Schema: notifications; Owner: -
--

CREATE TRIGGER global_preferences_updated_at BEFORE UPDATE ON notifications.global_preferences FOR EACH ROW EXECUTE FUNCTION notifications.update_updated_at();

--
-- Name: preferences preferences_updated_at; Type: TRIGGER; Schema: notifications; Owner: -
--

CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON notifications.preferences FOR EACH ROW EXECUTE FUNCTION notifications.update_updated_at();

--
-- Name: notifications trigger_set_notification_expires_at; Type: TRIGGER; Schema: notifications; Owner: -
--

CREATE TRIGGER trigger_set_notification_expires_at BEFORE INSERT ON notifications.notifications FOR EACH ROW EXECUTE FUNCTION notifications.set_notification_expires_at();

--
-- Name: ui_schemas trigger_create_schema_version_history; Type: TRIGGER; Schema: requests; Owner: -
--

CREATE TRIGGER trigger_create_schema_version_history AFTER INSERT OR UPDATE ON requests.ui_schemas FOR EACH ROW EXECUTE FUNCTION public.create_schema_version_history();

--
-- Name: help_offers trigger_set_offer_expires_at; Type: TRIGGER; Schema: requests; Owner: -
--

CREATE TRIGGER trigger_set_offer_expires_at BEFORE INSERT ON requests.help_offers FOR EACH ROW EXECUTE FUNCTION requests.set_offer_expires_at();

--
-- Name: help_requests trigger_set_request_expires_at; Type: TRIGGER; Schema: requests; Owner: -
--

CREATE TRIGGER trigger_set_request_expires_at BEFORE INSERT ON requests.help_requests FOR EACH ROW EXECUTE FUNCTION requests.set_request_expires_at();

--
-- Name: ui_schemas trigger_ui_schemas_updated_at; Type: TRIGGER; Schema: requests; Owner: -
--

CREATE TRIGGER trigger_ui_schemas_updated_at BEFORE UPDATE ON requests.ui_schemas FOR EACH ROW EXECUTE FUNCTION public.update_ui_schemas_updated_at();

--
-- Name: validation_rules trigger_validation_rules_updated_at; Type: TRIGGER; Schema: requests; Owner: -
--

CREATE TRIGGER trigger_validation_rules_updated_at BEFORE UPDATE ON requests.validation_rules FOR EACH ROW EXECUTE FUNCTION public.update_validation_rules_updated_at();

--
-- Name: device_push_tokens device_push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.device_push_tokens
    ADD CONSTRAINT device_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: inviter_stats inviter_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.inviter_stats
    ADD CONSTRAINT inviter_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: social_distances social_distances_user_a_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.social_distances
    ADD CONSTRAINT social_distances_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: social_distances social_distances_user_b_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.social_distances
    ADD CONSTRAINT social_distances_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_feed_preferences user_feed_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_feed_preferences
    ADD CONSTRAINT user_feed_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_interests user_interests_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_interests
    ADD CONSTRAINT user_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_invitations user_invitations_invitee_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_invitations
    ADD CONSTRAINT user_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_invitations user_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_invitations
    ADD CONSTRAINT user_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_privacy_settings user_privacy_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_request_preferences user_request_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_request_preferences
    ADD CONSTRAINT user_request_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_skills user_skills_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_skills
    ADD CONSTRAINT user_skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_tags user_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_tags
    ADD CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: users users_invited_by_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);

--
-- Name: activities activities_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activities
    ADD CONSTRAINT activities_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: activities activities_created_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activities
    ADD CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

--
-- Name: activity_participants activity_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activity_participants
    ADD CONSTRAINT activity_participants_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES communities.activities(id) ON DELETE CASCADE;

--
-- Name: activity_participants activity_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.activity_participants
    ADD CONSTRAINT activity_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: communities communities_creator_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.communities
    ADD CONSTRAINT communities_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id);

--
-- Name: community_configs community_configs_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_configs
    ADD CONSTRAINT community_configs_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_links community_links_community_a_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_community_a_id_fkey FOREIGN KEY (community_a_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_links community_links_community_b_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_community_b_id_fkey FOREIGN KEY (community_b_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_links community_links_created_by_admin_a_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_created_by_admin_a_fkey FOREIGN KEY (created_by_admin_a) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: community_links community_links_created_by_admin_b_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.community_links
    ADD CONSTRAINT community_links_created_by_admin_b_fkey FOREIGN KEY (created_by_admin_b) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: fusion_proposals fusion_proposals_accepted_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id);

--
-- Name: fusion_proposals fusion_proposals_community_a_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_community_a_id_fkey FOREIGN KEY (community_a_id) REFERENCES communities.communities(id);

--
-- Name: fusion_proposals fusion_proposals_community_b_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_community_b_id_fkey FOREIGN KEY (community_b_id) REFERENCES communities.communities(id);

--
-- Name: fusion_proposals fusion_proposals_merged_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_merged_community_id_fkey FOREIGN KEY (merged_community_id) REFERENCES communities.communities(id);

--
-- Name: fusion_proposals fusion_proposals_proposed_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_proposals
    ADD CONSTRAINT fusion_proposals_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES auth.users(id);

--
-- Name: fusion_votes fusion_votes_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_votes
    ADD CONSTRAINT fusion_votes_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: fusion_votes fusion_votes_proposal_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_votes
    ADD CONSTRAINT fusion_votes_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES communities.fusion_proposals(id) ON DELETE CASCADE;

--
-- Name: fusion_votes fusion_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.fusion_votes
    ADD CONSTRAINT fusion_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: governance_nominations governance_nominations_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_nominations
    ADD CONSTRAINT governance_nominations_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: governance_nominations governance_nominations_nominated_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_nominations
    ADD CONSTRAINT governance_nominations_nominated_user_id_fkey FOREIGN KEY (nominated_user_id) REFERENCES auth.users(id);

--
-- Name: governance_nominations governance_nominations_nominator_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_nominations
    ADD CONSTRAINT governance_nominations_nominator_id_fkey FOREIGN KEY (nominator_id) REFERENCES auth.users(id);

--
-- Name: governance_ratifications governance_ratifications_nomination_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_ratifications
    ADD CONSTRAINT governance_ratifications_nomination_id_fkey FOREIGN KEY (nomination_id) REFERENCES communities.governance_nominations(id) ON DELETE CASCADE;

--
-- Name: governance_ratifications governance_ratifications_ratifier_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.governance_ratifications
    ADD CONSTRAINT governance_ratifications_ratifier_id_fkey FOREIGN KEY (ratifier_id) REFERENCES auth.users(id);

--
-- Name: health_summary health_summary_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.health_summary
    ADD CONSTRAINT health_summary_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: members members_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.members
    ADD CONSTRAINT members_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: members members_invited_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.members
    ADD CONSTRAINT members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);

--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: norm_approvals norm_approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norm_approvals
    ADD CONSTRAINT norm_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);

--
-- Name: norm_approvals norm_approvals_norm_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norm_approvals
    ADD CONSTRAINT norm_approvals_norm_id_fkey FOREIGN KEY (norm_id) REFERENCES communities.norms(id) ON DELETE CASCADE;

--
-- Name: norms norms_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norms
    ADD CONSTRAINT norms_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: norms norms_created_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.norms
    ADD CONSTRAINT norms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

--
-- Name: settings settings_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.settings
    ADD CONSTRAINT settings_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: split_member_assignments split_member_assignments_proposal_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_member_assignments
    ADD CONSTRAINT split_member_assignments_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES communities.split_proposals(id) ON DELETE CASCADE;

--
-- Name: split_member_assignments split_member_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_member_assignments
    ADD CONSTRAINT split_member_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: split_proposals split_proposals_child_community_a_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_proposals
    ADD CONSTRAINT split_proposals_child_community_a_id_fkey FOREIGN KEY (child_community_a_id) REFERENCES communities.communities(id);

--
-- Name: split_proposals split_proposals_child_community_b_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_proposals
    ADD CONSTRAINT split_proposals_child_community_b_id_fkey FOREIGN KEY (child_community_b_id) REFERENCES communities.communities(id);

--
-- Name: split_proposals split_proposals_community_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_proposals
    ADD CONSTRAINT split_proposals_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: split_proposals split_proposals_proposed_by_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_proposals
    ADD CONSTRAINT split_proposals_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES auth.users(id);

--
-- Name: split_votes split_votes_proposal_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_votes
    ADD CONSTRAINT split_votes_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES communities.split_proposals(id) ON DELETE CASCADE;

--
-- Name: split_votes split_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.split_votes
    ADD CONSTRAINT split_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: trust_question_choices trust_question_choices_question_id_fkey; Type: FK CONSTRAINT; Schema: communities; Owner: -
--

ALTER TABLE ONLY communities.trust_question_choices
    ADD CONSTRAINT trust_question_choices_question_id_fkey FOREIGN KEY (question_id) REFERENCES communities.trust_questions(id) ON DELETE CASCADE;

--
-- Name: blocked_instances blocked_instances_blocked_by_community_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.blocked_instances
    ADD CONSTRAINT blocked_instances_blocked_by_community_fkey FOREIGN KEY (blocked_by_community) REFERENCES communities.communities(id);

--
-- Name: blocked_instances blocked_instances_blocked_by_user_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.blocked_instances
    ADD CONSTRAINT blocked_instances_blocked_by_user_fkey FOREIGN KEY (blocked_by_user) REFERENCES auth.users(id);

--
-- Name: federated_communities federated_communities_origin_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_communities
    ADD CONSTRAINT federated_communities_origin_instance_id_fkey FOREIGN KEY (origin_instance_id) REFERENCES federation.instances(id);

--
-- Name: federated_requests federated_requests_origin_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_requests
    ADD CONSTRAINT federated_requests_origin_instance_id_fkey FOREIGN KEY (origin_instance_id) REFERENCES federation.instances(id);

--
-- Name: federated_user_mappings federated_user_mappings_federated_user_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_user_mappings
    ADD CONSTRAINT federated_user_mappings_federated_user_id_fkey FOREIGN KEY (federated_user_id) REFERENCES federation.federated_users(id);

--
-- Name: federated_user_mappings federated_user_mappings_local_user_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_user_mappings
    ADD CONSTRAINT federated_user_mappings_local_user_id_fkey FOREIGN KEY (local_user_id) REFERENCES auth.users(id);

--
-- Name: federated_users federated_users_home_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_users
    ADD CONSTRAINT federated_users_home_instance_id_fkey FOREIGN KEY (home_instance_id) REFERENCES federation.instances(id);

--
-- Name: federation_links federation_links_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federation_links
    ADD CONSTRAINT federation_links_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES federation.instances(id) ON DELETE CASCADE;

--
-- Name: federated_requests fk_requester; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.federated_requests
    ADD CONSTRAINT fk_requester FOREIGN KEY (requester_federated_id) REFERENCES federation.federated_users(federated_id);

--
-- Name: reputation_attestations fk_subject; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.reputation_attestations
    ADD CONSTRAINT fk_subject FOREIGN KEY (subject_federated_id) REFERENCES federation.federated_users(federated_id);

--
-- Name: inbox inbox_origin_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.inbox
    ADD CONSTRAINT inbox_origin_instance_id_fkey FOREIGN KEY (origin_instance_id) REFERENCES federation.instances(id);

--
-- Name: reputation_attestations reputation_attestations_attestor_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.reputation_attestations
    ADD CONSTRAINT reputation_attestations_attestor_instance_id_fkey FOREIGN KEY (attestor_instance_id) REFERENCES federation.instances(id);

--
-- Name: user_migrations user_migrations_new_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.user_migrations
    ADD CONSTRAINT user_migrations_new_instance_id_fkey FOREIGN KEY (new_instance_id) REFERENCES federation.instances(id);

--
-- Name: user_migrations user_migrations_old_instance_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.user_migrations
    ADD CONSTRAINT user_migrations_old_instance_id_fkey FOREIGN KEY (old_instance_id) REFERENCES federation.instances(id);

--
-- Name: user_migrations user_migrations_user_id_fkey; Type: FK CONSTRAINT; Schema: federation; Owner: -
--

ALTER TABLE ONLY federation.user_migrations
    ADD CONSTRAINT user_migrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: dismissed_items dismissed_items_user_id_fkey; Type: FK CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.dismissed_items
    ADD CONSTRAINT dismissed_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: featured_stories featured_stories_community_id_fkey; Type: FK CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.featured_stories
    ADD CONSTRAINT featured_stories_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: featured_stories featured_stories_match_id_fkey; Type: FK CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.featured_stories
    ADD CONSTRAINT featured_stories_match_id_fkey FOREIGN KEY (match_id) REFERENCES requests.matches(id) ON DELETE CASCADE;

--
-- Name: preferences preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: feed; Owner: -
--

ALTER TABLE ONLY feed.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: feedback_categories feedback_categories_feedback_id_fkey; Type: FK CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback_categories
    ADD CONSTRAINT feedback_categories_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES feedback.feedback(id) ON DELETE CASCADE;

--
-- Name: feedback feedback_community_id_fkey; Type: FK CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback
    ADD CONSTRAINT feedback_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: feedback feedback_from_user_id_fkey; Type: FK CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback
    ADD CONSTRAINT feedback_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id);

--
-- Name: feedback feedback_request_match_id_fkey; Type: FK CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback
    ADD CONSTRAINT feedback_request_match_id_fkey FOREIGN KEY (request_match_id) REFERENCES requests.matches(id);

--
-- Name: feedback feedback_to_user_id_fkey; Type: FK CONSTRAINT; Schema: feedback; Owner: -
--

ALTER TABLE ONLY feedback.feedback
    ADD CONSTRAINT feedback_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id);

--
-- Name: conflict_cases conflict_cases_accused_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_cases
    ADD CONSTRAINT conflict_cases_accused_id_fkey FOREIGN KEY (accused_id) REFERENCES auth.users(id);

--
-- Name: conflict_cases conflict_cases_accuser_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_cases
    ADD CONSTRAINT conflict_cases_accuser_id_fkey FOREIGN KEY (accuser_id) REFERENCES auth.users(id);

--
-- Name: conflict_cases conflict_cases_community_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_cases
    ADD CONSTRAINT conflict_cases_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: conflict_cases conflict_cases_related_request_match_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_cases
    ADD CONSTRAINT conflict_cases_related_request_match_id_fkey FOREIGN KEY (related_request_match_id) REFERENCES requests.matches(id);

--
-- Name: conflict_mediators conflict_mediators_conflict_case_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_mediators
    ADD CONSTRAINT conflict_mediators_conflict_case_id_fkey FOREIGN KEY (conflict_case_id) REFERENCES governance.conflict_cases(id) ON DELETE CASCADE;

--
-- Name: conflict_mediators conflict_mediators_mediator_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.conflict_mediators
    ADD CONSTRAINT conflict_mediators_mediator_id_fkey FOREIGN KEY (mediator_id) REFERENCES auth.users(id);

--
-- Name: proposals proposals_community_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.proposals
    ADD CONSTRAINT proposals_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: proposals proposals_proposed_by_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.proposals
    ADD CONSTRAINT proposals_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES auth.users(id);

--
-- Name: votes votes_community_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.votes
    ADD CONSTRAINT votes_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: votes votes_proposal_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.votes
    ADD CONSTRAINT votes_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES governance.proposals(id) ON DELETE CASCADE;

--
-- Name: votes votes_voter_id_fkey; Type: FK CONSTRAINT; Schema: governance; Owner: -
--

ALTER TABLE ONLY governance.votes
    ADD CONSTRAINT votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES auth.users(id);

--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES messaging.conversations(id) ON DELETE CASCADE;

--
-- Name: conversation_participants conversation_participants_participant_id_fkey; Type: FK CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversation_participants
    ADD CONSTRAINT conversation_participants_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: conversations conversations_request_match_id_fkey; Type: FK CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.conversations
    ADD CONSTRAINT conversations_request_match_id_fkey FOREIGN KEY (request_match_id) REFERENCES requests.matches(id) ON DELETE CASCADE;

--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES messaging.conversations(id) ON DELETE CASCADE;

--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: messaging; Owner: -
--

ALTER TABLE ONLY messaging.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id);

--
-- Name: global_preferences global_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.global_preferences
    ADD CONSTRAINT global_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: preferences preferences_community_id_fkey; Type: FK CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.preferences
    ADD CONSTRAINT preferences_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: preferences preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: notifications; Owner: -
--

ALTER TABLE ONLY notifications.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: offers offers_provider_id_fkey; Type: FK CONSTRAINT; Schema: provider; Owner: -
--

ALTER TABLE ONLY provider.offers
    ADD CONSTRAINT offers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: offers offers_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: provider; Owner: -
--

ALTER TABLE ONLY provider.offers
    ADD CONSTRAINT offers_provider_user_id_fkey FOREIGN KEY (provider_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: offers offers_request_id_fkey; Type: FK CONSTRAINT; Schema: provider; Owner: -
--

ALTER TABLE ONLY provider.offers
    ADD CONSTRAINT offers_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: activity_log activity_log_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.activity_log
    ADD CONSTRAINT activity_log_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: badges badges_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.badges
    ADD CONSTRAINT badges_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE SET NULL;

--
-- Name: badges badges_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.badges
    ADD CONSTRAINT badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: community_evolution_log community_evolution_log_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_evolution_log
    ADD CONSTRAINT community_evolution_log_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_health_metrics community_health_metrics_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_health_metrics
    ADD CONSTRAINT community_health_metrics_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_trust_scores community_trust_scores_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.community_trust_scores
    ADD CONSTRAINT community_trust_scores_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: karma_records karma_records_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.karma_records
    ADD CONSTRAINT karma_records_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: karma_records karma_records_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.karma_records
    ADD CONSTRAINT karma_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: milestone_events milestone_events_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.milestone_events
    ADD CONSTRAINT milestone_events_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: provider_reviews provider_reviews_match_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_reviews
    ADD CONSTRAINT provider_reviews_match_id_fkey FOREIGN KEY (match_id) REFERENCES requests.matches(id) ON DELETE SET NULL;

--
-- Name: provider_reviews provider_reviews_provider_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_reviews
    ADD CONSTRAINT provider_reviews_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: provider_reviews provider_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_reviews
    ADD CONSTRAINT provider_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: provider_trust_scores provider_trust_scores_provider_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.provider_trust_scores
    ADD CONSTRAINT provider_trust_scores_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: trust_scores trust_scores_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.trust_scores
    ADD CONSTRAINT trust_scores_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: trust_scores trust_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.trust_scores
    ADD CONSTRAINT trust_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_trust_configs user_trust_configs_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_configs
    ADD CONSTRAINT user_trust_configs_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: user_trust_configs user_trust_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_configs
    ADD CONSTRAINT user_trust_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_trust_evolution_log user_trust_evolution_log_community_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_evolution_log
    ADD CONSTRAINT user_trust_evolution_log_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: user_trust_evolution_log user_trust_evolution_log_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_evolution_log
    ADD CONSTRAINT user_trust_evolution_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_trust_preferences user_trust_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: reputation; Owner: -
--

ALTER TABLE ONLY reputation.user_trust_preferences
    ADD CONSTRAINT user_trust_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: collective_community_links collective_community_links_collective_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.collective_community_links
    ADD CONSTRAINT collective_community_links_collective_id_fkey FOREIGN KEY (collective_id) REFERENCES requests.provider_collectives(id) ON DELETE CASCADE;

--
-- Name: dibs dibs_provider_user_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.dibs
    ADD CONSTRAINT dibs_provider_user_id_fkey FOREIGN KEY (provider_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: dibs dibs_request_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.dibs
    ADD CONSTRAINT dibs_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: dibs dibs_requester_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.dibs
    ADD CONSTRAINT dibs_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: feed_events feed_events_request_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.feed_events
    ADD CONSTRAINT feed_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: feed_events feed_events_user_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.feed_events
    ADD CONSTRAINT feed_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: help_requests fk_help_requests_preferred_provider; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_requests
    ADD CONSTRAINT fk_help_requests_preferred_provider FOREIGN KEY (preferred_provider_id) REFERENCES requests.provider_profiles(id) ON DELETE SET NULL;

--
-- Name: help_offers help_offers_community_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_offers
    ADD CONSTRAINT help_offers_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id);

--
-- Name: help_offers help_offers_offerer_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_offers
    ADD CONSTRAINT help_offers_offerer_id_fkey FOREIGN KEY (offerer_id) REFERENCES auth.users(id);

--
-- Name: help_requests help_requests_boosted_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_requests
    ADD CONSTRAINT help_requests_boosted_by_fkey FOREIGN KEY (boosted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: help_requests help_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.help_requests
    ADD CONSTRAINT help_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id);

--
-- Name: interaction_feedback interaction_feedback_from_user_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.interaction_feedback
    ADD CONSTRAINT interaction_feedback_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: interaction_feedback interaction_feedback_match_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.interaction_feedback
    ADD CONSTRAINT interaction_feedback_match_id_fkey FOREIGN KEY (match_id) REFERENCES requests.matches(id) ON DELETE CASCADE;

--
-- Name: interaction_feedback interaction_feedback_to_user_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.interaction_feedback
    ADD CONSTRAINT interaction_feedback_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: matches matches_offer_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.matches
    ADD CONSTRAINT matches_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES requests.help_offers(id) ON DELETE SET NULL;

--
-- Name: matches matches_request_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.matches
    ADD CONSTRAINT matches_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: matches matches_responder_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.matches
    ADD CONSTRAINT matches_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES auth.users(id);

--
-- Name: provider_collective_members provider_collective_members_collective_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_collective_members
    ADD CONSTRAINT provider_collective_members_collective_id_fkey FOREIGN KEY (collective_id) REFERENCES requests.provider_collectives(id) ON DELETE CASCADE;

--
-- Name: provider_collective_members provider_collective_members_provider_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_collective_members
    ADD CONSTRAINT provider_collective_members_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: provider_collectives provider_collectives_created_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_collectives
    ADD CONSTRAINT provider_collectives_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: provider_profiles provider_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_profiles
    ADD CONSTRAINT provider_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: provider_rate_cards provider_rate_cards_provider_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_rate_cards
    ADD CONSTRAINT provider_rate_cards_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: provider_ride_details provider_ride_details_provider_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.provider_ride_details
    ADD CONSTRAINT provider_ride_details_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES requests.provider_profiles(id) ON DELETE CASCADE;

--
-- Name: request_admin_notes request_admin_notes_community_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_admin_notes
    ADD CONSTRAINT request_admin_notes_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: request_admin_notes request_admin_notes_request_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_admin_notes
    ADD CONSTRAINT request_admin_notes_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: request_admin_notes request_admin_notes_updated_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_admin_notes
    ADD CONSTRAINT request_admin_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);

--
-- Name: request_communities request_communities_community_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_communities
    ADD CONSTRAINT request_communities_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: request_communities request_communities_request_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.request_communities
    ADD CONSTRAINT request_communities_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests.help_requests(id) ON DELETE CASCADE;

--
-- Name: retention_config retention_config_community_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.retention_config
    ADD CONSTRAINT retention_config_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: ui_schema_versions ui_schema_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schema_versions
    ADD CONSTRAINT ui_schema_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: ui_schema_versions ui_schema_versions_schema_id_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schema_versions
    ADD CONSTRAINT ui_schema_versions_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES requests.ui_schemas(id) ON DELETE CASCADE;

--
-- Name: ui_schemas ui_schemas_created_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schemas
    ADD CONSTRAINT ui_schemas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: ui_schemas ui_schemas_updated_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.ui_schemas
    ADD CONSTRAINT ui_schemas_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: validation_rules validation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.validation_rules
    ADD CONSTRAINT validation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: validation_rules validation_rules_type_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.validation_rules
    ADD CONSTRAINT validation_rules_type_fkey FOREIGN KEY (type) REFERENCES requests.ui_schemas(type) ON DELETE CASCADE;

--
-- Name: validation_rules validation_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: requests; Owner: -
--

ALTER TABLE ONLY requests.validation_rules
    ADD CONSTRAINT validation_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: community_trust_edges community_trust_edges_community_id_a_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.community_trust_edges
    ADD CONSTRAINT community_trust_edges_community_id_a_fkey FOREIGN KEY (community_id_a) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: community_trust_edges community_trust_edges_community_id_b_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.community_trust_edges
    ADD CONSTRAINT community_trust_edges_community_id_b_fkey FOREIGN KEY (community_id_b) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: connections connections_user_a_id_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.connections
    ADD CONSTRAINT connections_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: connections connections_user_b_id_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.connections
    ADD CONSTRAINT connections_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: interaction_weights interaction_weights_community_id_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.interaction_weights
    ADD CONSTRAINT interaction_weights_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: trust_decay_config trust_decay_config_community_id_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_decay_config
    ADD CONSTRAINT trust_decay_config_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: trust_edges trust_edges_community_id_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_edges
    ADD CONSTRAINT trust_edges_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities.communities(id) ON DELETE CASCADE;

--
-- Name: trust_edges trust_edges_user_id_a_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_edges
    ADD CONSTRAINT trust_edges_user_id_a_fkey FOREIGN KEY (user_id_a) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trust_edges trust_edges_user_id_b_fkey; Type: FK CONSTRAINT; Schema: social_graph; Owner: -
--

ALTER TABLE ONLY social_graph.trust_edges
    ADD CONSTRAINT trust_edges_user_id_b_fkey FOREIGN KEY (user_id_b) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_invitations invitations_insert_policy; Type: POLICY; Schema: auth; Owner: -
--

CREATE POLICY invitations_insert_policy ON auth.user_invitations FOR INSERT WITH CHECK (((inviter_id = (current_setting('app.current_user_id'::text))::uuid) AND (community_id IN ( SELECT members.community_id
   FROM communities.members
  WHERE (members.user_id = (current_setting('app.current_user_id'::text))::uuid)))));

--
-- Name: user_invitations invitations_select_policy; Type: POLICY; Schema: auth; Owner: -
--

CREATE POLICY invitations_select_policy ON auth.user_invitations FOR SELECT USING ((community_id IN ( SELECT members.community_id
   FROM communities.members
  WHERE (members.user_id = (current_setting('app.current_user_id'::text))::uuid))));

--
-- Name: inviter_stats; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.inviter_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: inviter_stats inviter_stats_select_policy; Type: POLICY; Schema: auth; Owner: -
--

CREATE POLICY inviter_stats_select_policy ON auth.inviter_stats FOR SELECT USING (((user_id = (current_setting('app.current_user_id'::text))::uuid) OR (community_id IN ( SELECT members.community_id
   FROM communities.members
  WHERE (members.user_id = (current_setting('app.current_user_id'::text))::uuid)))));

--
-- Name: social_distances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.social_distances ENABLE ROW LEVEL SECURITY;

--
-- Name: social_distances social_distances_select_policy; Type: POLICY; Schema: auth; Owner: -
--

CREATE POLICY social_distances_select_policy ON auth.social_distances FOR SELECT USING (((community_id IN ( SELECT members.community_id
   FROM communities.members
  WHERE (members.user_id = (current_setting('app.current_user_id'::text))::uuid))) AND ((user_a_id = (current_setting('app.current_user_id'::text))::uuid) OR (user_b_id = (current_setting('app.current_user_id'::text))::uuid))));

--
-- Name: social_distances social_distances_system_only; Type: POLICY; Schema: auth; Owner: -
--

CREATE POLICY social_distances_system_only ON auth.social_distances USING (false);

--
-- Name: user_invitations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.user_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: communities; Type: ROW SECURITY; Schema: communities; Owner: -
--

ALTER TABLE communities.communities ENABLE ROW LEVEL SECURITY;

--
-- Name: communities community_isolation; Type: POLICY; Schema: communities; Owner: -
--

CREATE POLICY community_isolation ON communities.communities USING ((id IN ( SELECT members.community_id
   FROM communities.members
  WHERE (members.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));

--
-- Name: members community_isolation; Type: POLICY; Schema: communities; Owner: -
--

CREATE POLICY community_isolation ON communities.members USING ((community_id IN ( SELECT members_1.community_id
   FROM communities.members members_1
  WHERE (members_1.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));

--
-- Name: norm_approvals community_isolation; Type: POLICY; Schema: communities; Owner: -
--

CREATE POLICY community_isolation ON communities.norm_approvals USING ((norm_id IN ( SELECT norms.id
   FROM communities.norms
  WHERE (norms.community_id = (current_setting('app.current_community_id'::text, true))::uuid))));

--
-- Name: norms community_isolation; Type: POLICY; Schema: communities; Owner: -
--

CREATE POLICY community_isolation ON communities.norms USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: members; Type: ROW SECURITY; Schema: communities; Owner: -
--

ALTER TABLE communities.members ENABLE ROW LEVEL SECURITY;

--
-- Name: norm_approvals; Type: ROW SECURITY; Schema: communities; Owner: -
--

ALTER TABLE communities.norm_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: norms; Type: ROW SECURITY; Schema: communities; Owner: -
--

ALTER TABLE communities.norms ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_items community_isolation; Type: POLICY; Schema: feed; Owner: -
--

CREATE POLICY community_isolation ON feed.dismissed_items USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));

--
-- Name: preferences community_isolation; Type: POLICY; Schema: feed; Owner: -
--

CREATE POLICY community_isolation ON feed.preferences USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));

--
-- Name: dismissed_items; Type: ROW SECURITY; Schema: feed; Owner: -
--

ALTER TABLE feed.dismissed_items ENABLE ROW LEVEL SECURITY;

--
-- Name: preferences; Type: ROW SECURITY; Schema: feed; Owner: -
--

ALTER TABLE feed.preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback community_isolation; Type: POLICY; Schema: feedback; Owner: -
--

CREATE POLICY community_isolation ON feedback.feedback USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: feedback; Type: ROW SECURITY; Schema: feedback; Owner: -
--

ALTER TABLE feedback.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: conflict_cases community_isolation; Type: POLICY; Schema: governance; Owner: -
--

CREATE POLICY community_isolation ON governance.conflict_cases USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: proposals community_isolation; Type: POLICY; Schema: governance; Owner: -
--

CREATE POLICY community_isolation ON governance.proposals USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: votes community_isolation; Type: POLICY; Schema: governance; Owner: -
--

CREATE POLICY community_isolation ON governance.votes USING ((proposal_id IN ( SELECT proposals.id
   FROM governance.proposals
  WHERE (proposals.community_id = (current_setting('app.current_community_id'::text, true))::uuid))));

--
-- Name: conflict_cases; Type: ROW SECURITY; Schema: governance; Owner: -
--

ALTER TABLE governance.conflict_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: governance; Owner: -
--

ALTER TABLE governance.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: votes; Type: ROW SECURITY; Schema: governance; Owner: -
--

ALTER TABLE governance.votes ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants community_isolation; Type: POLICY; Schema: messaging; Owner: -
--

CREATE POLICY community_isolation ON messaging.conversation_participants USING ((conversation_id IN ( SELECT c.id
   FROM messaging.conversations c
  WHERE (c.request_match_id IN ( SELECT m.id
           FROM requests.matches m
          WHERE (m.request_id IN ( SELECT rc.request_id
                   FROM requests.request_communities rc
                  WHERE (rc.community_id = (current_setting('app.current_community_id'::text, true))::uuid))))))));

--
-- Name: conversations community_isolation; Type: POLICY; Schema: messaging; Owner: -
--

CREATE POLICY community_isolation ON messaging.conversations USING ((request_match_id IN ( SELECT m.id
   FROM requests.matches m
  WHERE (m.request_id IN ( SELECT rc.request_id
           FROM requests.request_communities rc
          WHERE (rc.community_id = (current_setting('app.current_community_id'::text, true))::uuid))))));

--
-- Name: messages community_isolation; Type: POLICY; Schema: messaging; Owner: -
--

CREATE POLICY community_isolation ON messaging.messages USING ((conversation_id IN ( SELECT c.id
   FROM messaging.conversations c
  WHERE (c.request_match_id IN ( SELECT m.id
           FROM requests.matches m
          WHERE (m.request_id IN ( SELECT rc.request_id
                   FROM requests.request_communities rc
                  WHERE (rc.community_id = (current_setting('app.current_community_id'::text, true))::uuid))))))));

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: messaging; Owner: -
--

ALTER TABLE messaging.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: messaging; Owner: -
--

ALTER TABLE messaging.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: messaging; Owner: -
--

ALTER TABLE messaging.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications community_isolation; Type: POLICY; Schema: notifications; Owner: -
--

CREATE POLICY community_isolation ON notifications.notifications USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));

--
-- Name: preferences community_isolation; Type: POLICY; Schema: notifications; Owner: -
--

CREATE POLICY community_isolation ON notifications.preferences USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));

--
-- Name: notifications; Type: ROW SECURITY; Schema: notifications; Owner: -
--

ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: preferences; Type: ROW SECURITY; Schema: notifications; Owner: -
--

ALTER TABLE notifications.preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: badges; Type: ROW SECURITY; Schema: reputation; Owner: -
--

ALTER TABLE reputation.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: badges community_isolation; Type: POLICY; Schema: reputation; Owner: -
--

CREATE POLICY community_isolation ON reputation.badges USING (true);

--
-- Name: karma_records community_isolation; Type: POLICY; Schema: reputation; Owner: -
--

CREATE POLICY community_isolation ON reputation.karma_records USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: trust_scores community_isolation; Type: POLICY; Schema: reputation; Owner: -
--

CREATE POLICY community_isolation ON reputation.trust_scores USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: karma_records; Type: ROW SECURITY; Schema: reputation; Owner: -
--

ALTER TABLE reputation.karma_records ENABLE ROW LEVEL SECURITY;

--
-- Name: trust_scores; Type: ROW SECURITY; Schema: reputation; Owner: -
--

ALTER TABLE reputation.trust_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: help_offers community_isolation; Type: POLICY; Schema: requests; Owner: -
--

CREATE POLICY community_isolation ON requests.help_offers USING ((community_id = (current_setting('app.current_community_id'::text, true))::uuid));

--
-- Name: help_requests community_isolation; Type: POLICY; Schema: requests; Owner: -
--

CREATE POLICY community_isolation ON requests.help_requests USING ((EXISTS ( SELECT 1
   FROM requests.request_communities rc
  WHERE ((rc.request_id = help_requests.id) AND (rc.community_id = (current_setting('app.current_community_id'::text, true))::uuid)))));

--
-- Name: matches community_isolation; Type: POLICY; Schema: requests; Owner: -
--

CREATE POLICY community_isolation ON requests.matches USING ((request_id IN ( SELECT rc.request_id
   FROM requests.request_communities rc
  WHERE (rc.community_id = (current_setting('app.current_community_id'::text, true))::uuid))));

--
-- Name: help_offers; Type: ROW SECURITY; Schema: requests; Owner: -
--

ALTER TABLE requests.help_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: help_requests; Type: ROW SECURITY; Schema: requests; Owner: -
--

ALTER TABLE requests.help_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: requests; Owner: -
--

ALTER TABLE requests.matches ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


-- =============================================================================
-- CURATED SEED DATA — MAINTAIN infrastructure/postgres/seed-data.sql
-- =============================================================================
-- Curated development seed rows preserved across init.sql regeneration.
-- Keep schema definitions in migrations; this file contains data only.

INSERT INTO communities.config_templates (name, description, config_json) VALUES
('Cohousing Default', 'High-trust, balanced participation, relationship-focused', '{"member_cap": 150, "visibility_mode": "public", "outsider_response_allowed": true, "enabled_request_types": [{"name": "meal_share", "description": "Share meals or cooking", "karma_multiplier": 1.0}, {"name": "tool_borrow", "description": "Borrow tools or equipment", "karma_multiplier": 0.8}, {"name": "ride_share", "description": "Share rides or transportation", "karma_multiplier": 1.2}, {"name": "childcare", "description": "Help with childcare or babysitting", "karma_multiplier": 1.5}], "karma_split_helper": 60, "karma_split_requestor": 40, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.6, "trust_breadth_weight": 0.4, "trust_decay_half_life_days": 180, "trust_path_max_hops": 3, "min_interactions_for_trust": 1, "request_approval_required": false, "new_member_karma_lockout_days": 0, "join_approval_required": true, "joining_counts_as_interaction": true, "feed_weight_skill_match": 0.40, "feed_weight_trust_distance": 0.25, "feed_weight_community_relevance": 0.20, "feed_weight_urgency": 0.15}'::jsonb),
('Neighborhood Cautious', 'Boundary-conscious, helper-focused, gradual trust-building', '{"member_cap": 100, "visibility_mode": "members_only", "outsider_response_allowed": false, "enabled_request_types": [{"name": "skill_share", "description": "Share skills or expertise", "karma_multiplier": 1.0}, {"name": "errand_help", "description": "Help with errands or tasks", "karma_multiplier": 0.9}, {"name": "pet_sitting", "description": "Pet sitting or care", "karma_multiplier": 1.1}], "karma_split_helper": 80, "karma_split_requestor": 20, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.7, "trust_breadth_weight": 0.3, "trust_decay_half_life_days": 90, "trust_path_max_hops": 2, "min_interactions_for_trust": 3, "request_approval_required": true, "new_member_karma_lockout_days": 7, "join_approval_required": true, "joining_counts_as_interaction": false, "feed_weight_skill_match": 0.30, "feed_weight_trust_distance": 0.35, "feed_weight_community_relevance": 0.20, "feed_weight_urgency": 0.15}'::jsonb),
('Experimental Reciprocal', 'Experimental gift economy with equal karma split', '{"member_cap": 50, "visibility_mode": "hybrid", "outsider_response_allowed": false, "enabled_request_types": [{"name": "general_help", "description": "General help or support", "karma_multiplier": 1.0}], "karma_split_helper": 50, "karma_split_requestor": 50, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.5, "trust_breadth_weight": 0.5, "trust_decay_half_life_days": 30, "trust_path_max_hops": 3, "min_interactions_for_trust": 1, "request_approval_required": false, "new_member_karma_lockout_days": 0, "join_approval_required": false, "joining_counts_as_interaction": true, "feed_weight_skill_match": 0.35, "feed_weight_trust_distance": 0.20, "feed_weight_community_relevance": 0.30, "feed_weight_urgency": 0.15}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO social_graph.interaction_weights (community_id, interaction_type, weight) VALUES
  (NULL, 'match_completed', 10.0),
  (NULL, 'endorsement',      5.0),
  (NULL, 'karma_given',      3.0),
  (NULL, 'event',            2.0)
ON CONFLICT (interaction_type) WHERE community_id IS NULL DO NOTHING;

-- =============================================================================
-- MIGRATION LEDGER — GENERATED FROM SORTED migrations/*.sql
-- =============================================================================
INSERT INTO public.schema_migrations (migration_name) VALUES
  ('001-add-polymorphic-requests.sql'),
  ('001_add_community_location_category.sql'),
  ('001_ephemeral_data_and_decay.sql'),
  ('001_federation_schema.sql'),
  ('001_request_community_junction.sql'),
  ('002_add_skills_and_community_access.sql'),
  ('005_notifications_schema.sql'),
  ('006_social_karma_v2_schema.sql'),
  ('009-governance-schema.sql'),
  ('009_polymorphic_requests.sql'),
  ('009_social_graph.sql'),
  ('010_user_privacy_settings.sql'),
  ('010_user_request_preferences.sql'),
  ('011_community_configuration_system.sql'),
  ('012_backfill_community_configs.sql'),
  ('013_feed_scoring_weights.sql'),
  ('014_multi_tier_visibility.sql'),
  ('015_ui_schemas_dynamic.sql'),
  ('016-match-fulfillment.sql'),
  ('017-two-phase-match-completion.sql'),
  ('018-feedback-community-index.sql'),
  ('019-trust-config-fields.sql'),
  ('020-trust-carry-fields.sql'),
  ('021-community-trust-scores.sql'),
  ('022-provider-profiles.sql'),
  ('023-provider-collectives.sql'),
  ('024-prestige-badges.sql'),
  ('025-community-links.sql'),
  ('026-cohort-layers.sql'),
  ('20260223-add-connection-type-to-social-distances.sql'),
  ('20260311-network-cohesion-metrics.sql'),
  ('20260313-admin-request-triage.sql'),
  ('20260314-add-provider-availability.sql'),
  ('20260315-social-graph-connections.sql'),
  ('20260318-rate-cards.sql'),
  ('20260319-trust-evolution.sql'),
  ('20260320-community-evolution.sql'),
  ('20260320-fractal-feed.sql'),
  ('20260322-community-tags-geo.sql'),
  ('20260322-request-boost.sql'),
  ('20260324-user-tags.sql'),
  ('20260325-admin-proposed-match.sql'),
  ('20260326-device-push-tokens.sql'),
  ('20260326-provider-offers.sql'),
  ('20260328-dibs.sql'),
  ('20260328-help-requests-scheduled-for.sql'),
  ('20260403-feed-ranking-v2.sql'),
  ('20260404-trust-questions.sql'),
  ('20260407-group-communities.sql'),
  ('20260510-refresh-tokens.sql'),
  ('20260525-trust-graph-foundation.sql'),
  ('20260526-interaction-halflife.sql'),
  ('20260527-fission.sql'),
  ('20260527-fusion.sql'),
  ('20260530-community-dedup.sql'),
  ('20260603-feed-vocab-reconciliation.sql'),
  ('20260605-fusion-member-count-backfill.sql'),
  ('20260605-split-carry-trust-karma-backfill.sql'),
  ('20260607-designed-to-forget.sql'),
  ('20260608-backfill-community-admins.sql'),
  ('20260612-founding-circle-submissions.sql'),
  ('20260613-demo-data-quality-repair.sql'),
  ('20260614-trust-truth-repair.sql'),
  ('20260615-split-proposal-active-unique.sql'),
  ('20260716-path-trust-score-double-precision.sql'),
  ('20260819-standing-projection-foundation.sql')
ON CONFLICT (migration_name) DO NOTHING;
