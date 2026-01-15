# FR-004: Matching System

**Status:** ✅ Implemented | **Priority:** High | **Version:** 5.1.0

## Overview

The Matching System connects help requests with offers, creating helping exchanges that earn karma when completed.

## Key Features

### FR-004.1: Create Match
- [x] Responder proposes to help with a request
- [x] Match status: 'proposed' → 'matched' → 'completed'
- [x] Requester notified of new match
- [x] One active match per request

### FR-004.2: Accept/Reject Match
- [x] Requester accepts or rejects proposed matches
- [x] Acceptance changes status to 'matched'
- [x] Request status changes to 'matched'
- [x] Both parties notified

### FR-004.3: Complete Match
- [x] Either party can mark as completed
- [x] Triggers karma award event
- [x] Request status changes to 'completed'
- [x] Match archived after TTL

## Data Model
```sql
CREATE TABLE requests.matches (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES help_requests(id),
  responder_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'proposed',
  completed_at TIMESTAMP,
  created_at TIMESTAMP
);
```

## Status Flow
```
proposed → matched → completed
   ↓
cancelled
```

## Related
- [FR-003: Help Requests](FR-003-help-requests.md)
- [FR-005: Reputation](FR-005-reputation.md)
