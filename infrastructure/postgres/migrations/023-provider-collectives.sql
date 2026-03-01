-- Migration 023: Provider Collectives
-- Adds provider_collectives, provider_collective_members, and collective_community_links tables
-- Supports the two-layer model: individual providers + collective organizations (e.g. rickshaw stands)

CREATE TABLE IF NOT EXISTS requests.provider_collectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  service_types TEXT[] DEFAULT '{}',
  location_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which providers belong to a collective
CREATE TABLE IF NOT EXISTS requests.provider_collective_members (
  collective_id UUID REFERENCES requests.provider_collectives(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collective_id, provider_id)
);

-- Which communities a collective serves
CREATE TABLE IF NOT EXISTS requests.collective_community_links (
  collective_id UUID REFERENCES requests.provider_collectives(id) ON DELETE CASCADE,
  community_id UUID NOT NULL, -- References community.communities(id); FK omitted (cross-service schema boundary)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
  established_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collective_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_collective_members_collective ON requests.provider_collective_members(collective_id);
CREATE INDEX IF NOT EXISTS idx_collective_members_provider ON requests.provider_collective_members(provider_id);
CREATE INDEX IF NOT EXISTS idx_collective_community_links_collective ON requests.collective_community_links(collective_id);
CREATE INDEX IF NOT EXISTS idx_collective_community_links_community ON requests.collective_community_links(community_id);
