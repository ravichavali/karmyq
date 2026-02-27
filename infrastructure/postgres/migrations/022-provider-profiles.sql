-- Migration 022: Provider Profiles
-- ADR-041: Two-Layer Mutual Aid + Services
-- ADR-042: Provider Trust Score
-- Adds the professional services layer: provider profiles, ride details, reviews, trust scores

-- Provider profiles: generic base table (publicly visible, not community-gated)
CREATE TABLE IF NOT EXISTS requests.provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,              -- 'ride', 'tradesperson', 'tutor', etc.
  display_name TEXT NOT NULL,
  bio TEXT,
  pricing_notes TEXT,                      -- Advisory only — Karmyq never processes payment
  is_active BOOLEAN DEFAULT TRUE,
  location_notes TEXT,                     -- Free text: "Serving south neighborhood"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, service_type)           -- One profile per service type per user
);

-- Ride-specific extension (Phase 1 — tradespeople/tutors get own extensions in Phase 2)
CREATE TABLE IF NOT EXISTS requests.provider_ride_details (
  provider_id UUID PRIMARY KEY REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT,                       -- 'rickshaw', 'car', 'bike', etc.
  max_passengers INTEGER DEFAULT 1,
  typical_routes TEXT,                     -- Free text description
  advance_booking_required BOOLEAN DEFAULT FALSE
);

-- Provider reviews (tied to a completed match)
CREATE TABLE IF NOT EXISTS reputation.provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES requests.matches(id) ON DELETE SET NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (match_id, reviewer_id)           -- One review per match per reviewer
);

-- Provider trust scores (computed, cached — updated when new review arrives)
CREATE TABLE IF NOT EXISTS reputation.provider_trust_scores (
  provider_id UUID PRIMARY KEY REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  avg_stars NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,  -- completed_matches / total_matched
  response_rate NUMERIC(5,2) DEFAULT 0,   -- responded_within_24h / total_inquiries
  trust_score INTEGER DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
                                           -- 60% avg_stars + 30% completion_rate + 10% response_rate
  last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Community config: opt-in to showing provider services layer
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS provider_services_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_min_personal_trust_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_services_list TEXT[] DEFAULT '{}';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id ON requests.provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_service_type ON requests.provider_profiles(service_type);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_is_active ON requests.provider_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider_id ON reputation.provider_reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer_id ON reputation.provider_reviews(reviewer_id);
