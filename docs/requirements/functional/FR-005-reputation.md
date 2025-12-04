# FR-005: Reputation System

**Status:** ✅ Implemented | **Priority:** Medium | **Version:** 5.1.0

## Overview

Karma-based reputation system that rewards helping behavior and tracks trustworthiness.

## Key Features

### FR-005.1: Karma Points
- [x] Earned when matches completed
- [x] First help bonus: +15 points
- [x] Standard help: +5 points (helper), +2 points (requester)
- [x] Milestone bonuses at 10, 50, 100 exchanges
- [x] Scoped per community

### FR-005.2: Trust Score
- [x] Calculated 0-100 based on karma
- [x] Formula: min(100, karma * activity_multiplier)
- [x] Updated after each exchange
- [x] Visible to community members

### FR-005.3: Karma Decay
- [x] Optional decay to encourage ongoing participation
- [x] Configurable half-life (default: 6 months)
- [x] Exponential decay formula
- [x] Cleanup Service runs decay job
- [x] Per-community setting

### FR-005.4: Leaderboards
- [x] Top helpers by karma
- [x] Most active recent users
- [x] Displayed in community stats

## Data Model
```sql
CREATE TABLE reputation.karma_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  community_id UUID REFERENCES communities.communities(id),
  points INT NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP
);

CREATE TABLE reputation.trust_scores (
  user_id UUID,
  community_id UUID,
  score INT DEFAULT 0,
  updated_at TIMESTAMP,
  PRIMARY KEY (user_id, community_id)
);
```

## Related
- [FR-004: Matching](FR-004-matching.md)
- [NFR-005: Ephemeral Data](../non-functional/NFR-005-ephemeral.md)
