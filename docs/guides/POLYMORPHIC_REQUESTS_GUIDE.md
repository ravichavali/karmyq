# Polymorphic Requests Guide - Everything App v9.0

This guide explains how to create and work with the 5 different request types in Karmyq v9.0.

## Table of Contents
- [Quick Start](#quick-start)
- [Request Types](#request-types)
  - [1. Ride Requests](#1-ride-requests)
  - [2. Service Requests](#2-service-requests)
  - [3. Event Requests](#3-event-requests)
  - [4. Borrow Requests](#4-borrow-requests)
  - [5. Generic Requests](#5-generic-requests)
- [Creating via API](#creating-via-api)
- [Creating via Scripts](#creating-via-scripts)
- [Schema Reference](#schema-reference)

---

## Quick Start

All polymorphic requests follow this structure:

```javascript
{
  community_id: "uuid",           // Required
  request_type: "ride|service|event|borrow|generic",  // Required
  title: "string",                // Required
  description: "string",          // Required
  urgency: "low|medium|high",     // Optional, default: "medium"
  payload: { /* type-specific fields */ },  // Required for ride/service/event/borrow
  requirements: { /* optional constraints */ }  // Optional
}
```

---

## Request Types

### 1. Ride Requests

**Use Case**: Ridesharing, carpools, airport rides, road trips

**Example:**
```javascript
{
  request_type: "ride",
  title: "Ride to airport Friday morning",
  description: "Need ride to SFO for 6am flight",
  urgency: "high",
  payload: {
    origin: {
      address: "123 Main St, San Francisco, CA",
      lat: 37.7749,
      lng: -122.4194
    },
    destination: {
      address: "San Francisco International Airport",
      lat: 37.6213,
      lng: -122.3790
    },
    seats_needed: 2,                    // 1-10 seats
    departure_time: "2024-06-15T05:30:00Z",  // ISO datetime
    preferences: {                       // Optional
      women_only: false,
      pet_friendly: true,
      wheelchair_accessible: false
    }
  }
}
```

**Payload Fields:**
- `origin` (required): `{ address, lat, lng }`
- `destination` (required): `{ address, lat, lng }`
- `seats_needed` (required): integer 1-10
- `departure_time` (required): ISO datetime string
- `preferences` (optional): `{ women_only?, pet_friendly?, wheelchair_accessible? }`

**Matching Algorithm**: 40% location, 20% capacity, 20% availability, 20% preferences

---

### 2. Service Requests

**Use Case**: Professional services, tutoring, repairs, consulting

**Example:**
```javascript
{
  request_type: "service",
  title: "Plumber needed for kitchen sink",
  description: "Sink is leaking, need professional repair",
  urgency: "high",
  payload: {
    service_category: "plumbing",         // Required
    skill_level_required: "expert",       // Optional: beginner|intermediate|expert
    estimated_duration_hours: 2,          // Optional: 0.5-80 hours
    location_type: "on_site",             // Default: "on_site", also: remote|hybrid
    certifications_required: [            // Optional: max 5
      "licensed_plumber",
      "insured"
    ],
    budget_range: {                       // Optional
      min: 50,
      max: 150,
      currency: "USD"                     // USD|EUR|GBP
    },
    preferred_schedule: {                 // Optional
      days: ["monday", "tuesday", "wednesday"],
      time_of_day: "morning"              // morning|afternoon|evening|flexible
    }
  }
}
```

**Service Categories:**
- `plumbing`, `electrical`, `carpentry`
- `tutoring`, `consulting`, `repair`
- `cleaning`, `gardening`, `pet_care`
- `childcare`, `elder_care`, `tech_support`
- `legal`, `financial`, `other`

**Matching Algorithm**: 50% skills, 15% skill level, 20% location, 15% schedule

---

### 3. Event Requests

**Use Case**: Volunteer events, community cleanups, workshops, meetups

**Example:**
```javascript
{
  request_type: "event",
  title: "Community garden planting day",
  description: "Need volunteers to help plant spring vegetables",
  urgency: "medium",
  payload: {
    event_type: "volunteer",              // Required
    event_date: "2024-06-20T09:00:00Z",   // Required: ISO datetime
    event_duration_hours: 4,              // Required: 0.5-24 hours
    location: {                           // Required
      address: "Community Garden, 456 Oak St",
      lat: 37.7699,
      lng: -122.4469,
      is_virtual: false,
      virtual_link: null                  // URL if is_virtual=true
    },
    participants_needed: 15,              // Required: 1-1000
    roles: [                              // Optional: max 10 roles
      {
        role_name: "planter",
        count: 10,
        description: "Help plant vegetables"
      },
      {
        role_name: "tool_coordinator",
        count: 2
      }
    ],
    requirements: {                       // Optional
      age_minimum: 16,
      background_check: false,
      experience_required: false
    },
    recurring: {                          // Optional
      is_recurring: true,
      frequency: "weekly",                // daily|weekly|biweekly|monthly
      end_date: "2024-09-01T00:00:00Z"
    }
  }
}
```

**Event Types:**
- `volunteer`, `community_cleanup`, `fundraiser`
- `workshop`, `meetup`, `sports`
- `cultural`, `educational`, `social`, `other`

**Matching Algorithm**: 35% location, 40% schedule, 15% role match, 10% preference

---

### 4. Borrow Requests

**Use Case**: Borrowing tools, equipment, books, camping gear

**Example:**
```javascript
{
  request_type: "borrow",
  title: "Need ladder for weekend project",
  description: "Painting exterior, need 10ft ladder for 2 days",
  urgency: "medium",
  payload: {
    item_category: "tools",               // Required
    duration_days: 2,                     // Required: 1-30 days
    condition_min: "good",                // Optional: fair|good|like_new|new
    return_date: "2024-06-17T18:00:00Z",  // Optional: ISO datetime
    images: [                             // Optional: max 5 image URLs
      "https://example.com/ladder.jpg"
    ]
  }
}
```

**Item Categories:**
- `tools`, `electronics`, `kitchen`
- `books`, `sports`, `camping`
- `party`, `other`

**Matching Algorithm**: 40% item availability, 25% duration, 20% location, 15% condition

---

### 5. Generic Requests

**Use Case**: Any request that doesn't fit the specialized types

**Example:**
```javascript
{
  request_type: "generic",
  title: "Help moving boxes",
  description: "Need strong person to help move boxes to storage unit",
  urgency: "medium"
  // No payload required for generic requests
}
```

**Matching Algorithm**: 40% skills, 30% location, 30% availability

---

## Creating via API

### Using curl
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"password123"}' \
  | jq -r '.data.token')

# Create ride request
curl -X POST http://localhost:3003/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "community_id": "your-community-uuid",
    "request_type": "ride",
    "title": "Ride to airport",
    "description": "Need ride Friday",
    "urgency": "high",
    "payload": {
      "origin": {"address": "123 Main St", "lat": 37.7749, "lng": -122.4194},
      "destination": {"address": "SFO", "lat": 37.6213, "lng": -122.3790},
      "seats_needed": 2,
      "departure_time": "2024-06-15T05:30:00Z"
    }
  }'
```

### Using JavaScript (Node.js)
```javascript
const token = 'your-jwt-token';
const communityId = 'your-community-uuid';

const rideRequest = {
  community_id: communityId,
  request_type: 'ride',
  title: 'Ride to airport',
  description: 'Need ride Friday morning',
  urgency: 'high',
  payload: {
    origin: {
      address: '123 Main St, SF',
      lat: 37.7749,
      lng: -122.4194
    },
    destination: {
      address: 'SFO Airport',
      lat: 37.6213,
      lng: -122.3790
    },
    seats_needed: 2,
    departure_time: '2024-06-15T05:30:00Z'
  }
};

const response = await fetch('http://localhost:3003/requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(rideRequest)
});

const result = await response.json();
console.log(result);
```

---

## Creating via Scripts

### Run the Polymorphic Data Generator
```bash
cd scripts
node populate-polymorphic-data.js
```

This creates 10 sample requests (2 of each type).

### Run Multiple Times for Larger Dataset
```bash
# Create 100 requests (10 runs x 10 requests)
for i in {1..10}; do
  node populate-polymorphic-data.js
done
```

---

## Schema Reference

### Base Request Schema
All request types extend this base:

```typescript
{
  request_type: "ride" | "service" | "event" | "borrow" | "generic",
  title: string (3-200 chars),
  description: string (10-2000 chars),
  urgency?: "low" | "medium" | "high"  // default: "medium"
}
```

### Validation
Validation happens automatically using Zod schemas in `packages/shared/src/schemas/requests/`.

If validation fails, you'll receive a 400 error with details:
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": {
    "payload": {
      "seats_needed": {
        "_errors": ["Seats needed must be between 1 and 10"]
      }
    }
  }
}
```

---

## Frontend Integration

### TypeScript Example
```typescript
import { CreateRequestSchema, isRideRequest } from '@karmyq/shared/schemas';

// Validate before sending
const validation = CreateRequestSchema.safeParse(requestData);

if (!validation.success) {
  console.error('Validation errors:', validation.error.format());
  return;
}

// Type-safe access
if (isRideRequest(validation.data)) {
  const distance = calculateDistance(
    validation.data.payload.origin,
    validation.data.payload.destination
  );
}
```

---

## Database Storage

All requests are stored in `requests.help_requests` table with these polymorphic columns:

- `request_type` (VARCHAR(50)): "ride", "service", etc.
- `payload` (JSONB): Type-specific data
- `requirements` (JSONB): Optional constraints
- `category` (VARCHAR(100)): Legacy field, now stores request_type for backward compatibility

**Example query:**
```sql
-- Get all ride requests with origin in San Francisco
SELECT id, title, payload->>'origin' as origin
FROM requests.help_requests
WHERE request_type = 'ride'
  AND payload->'origin'->>'address' LIKE '%San Francisco%';
```

---

## Matching Algorithm

Each request type has a specialized matching algorithm in `packages/shared/src/matching/matchers/`.

To use matching:
```typescript
import { findMatches, calculateMatchScore } from '@karmyq/shared/matching';

const candidates = findMatches(request, userProfiles);
// Returns ranked candidates sorted by match score (0-100)

const score = calculateMatchScore(request, userProfile);
// Returns { score, reasons, breakdown }
```

**Note**: Matching endpoint is temporarily disabled in request-service until Docker rebuild.

---

## Migration from v8.0

Old generic requests still work:
```javascript
// Old way (still supported)
{
  title: "Need help",
  description: "...",
  category: "moving"  // Ignored, becomes generic
}

// New way (recommended)
{
  request_type: "borrow",
  title: "Need truck for moving",
  payload: {
    item_category: "tools",
    duration_days: 1
  }
}
```

---

## Troubleshooting

### Common Validation Errors

**1. "Invalid option: expected one of..."**
- Check enum values match exactly (case-sensitive)
- Service skill_level: `beginner|intermediate|expert` (not "professional")
- Borrow item_category: `tools|electronics|kitchen|books|sports|camping|party|other` (not "recreation")

**2. "Invalid input: expected string, received undefined"**
- Required fields are missing
- Event requires: `event_date`, `event_duration_hours`, `participants_needed`
- Borrow requires: `duration_days`

**3. "HTTP 403: Only community members can post requests"**
- User must be an active member of the community
- Use the correct community_id from user's memberships

**4. "Must be valid ISO datetime string"**
- Use format: `"2024-06-15T14:30:00Z"`
- Not: `"June 15, 2024"` or `"2024-06-15"`

---

## Next Steps

1. **Try the polymorphic script**: `node scripts/populate-polymorphic-data.js`
2. **View in feed**: http://localhost:3000
3. **Test matching**: Create offers that match the requests
4. **Build UI forms**: Use schemas for form validation in frontend

For questions, see:
- [Request Schemas](../packages/shared/src/schemas/requests/)
- [Matching Algorithms](../packages/shared/src/matching/matchers/)
- [API Documentation](../docs/api/)
