# ADR-001: Natural Language Parsing for Location Input

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: DEVELOPMENT_ROADMAP.md Decision Log (2025-12-29)

## Context

Users need to input location information when creating ride requests and event requests. We needed to decide how users would specify locations (origin/destination for rides, venue for events).

### Initial Approach

The initial implementation used `@` symbols as triggers for autocomplete:
- Users would type `@` to trigger location autocomplete
- This required users to learn a special syntax
- Not intuitive for new users

### Problem

- Users don't naturally type `@` when expressing locations
- Extra training required to teach users the syntax
- Breaks the natural flow of describing what they need
- More common in developer tools than consumer apps

## Decision

**We will use natural language parsing to detect location inputs** instead of requiring special symbols.

The system detects patterns like:
- `"from X"` and `"to Y"` for ride requests
- `"at X"` for event locations
- Direct address typing with smart detection

Implementation:
- Parser detects location patterns in natural text (apps/frontend/src/lib/requestParser.ts)
- Triggers geocoding service automatically
- Position tracking prevents unwanted text replacement
- `@` symbols still work as a fallback/power-user feature

## Consequences

### Positive Consequences

- **Better UX**: Users can type naturally: "Need a ride from SFO to SJC tomorrow"
- **No training required**: Intuitive interface works how users expect
- **Faster input**: No need to remember special syntax
- **More accessible**: Lower barrier to entry for non-technical users
- **Natural language friendly**: Aligns with conversational interface patterns

### Negative Consequences

- **Parser complexity**: Need to maintain regex patterns for location detection
- **False positives possible**: Common words ("from", "to", "at") might trigger in wrong contexts
- **Debugging harder**: Natural language is less predictable than explicit syntax
- **Performance overhead**: Parser runs on every keystroke

### Neutral Consequences

- **Dual interface**: Both natural language and `@` symbols supported
- **Parser maintenance**: Patterns need periodic review and improvement

## Alternatives Considered

### Alternative 1: `@` Symbol Triggers Only

- **Description**: Require users to type `@location` to trigger geocoding
- **Pros**:
  - Explicit and unambiguous
  - No false positives
  - Simpler to implement
- **Cons**:
  - Not intuitive for average users
  - Requires training/documentation
  - Breaks natural flow
- **Why rejected**: Poor UX for non-technical users

### Alternative 2: Separate Location Fields

- **Description**: Dedicated form fields for origin/destination instead of natural language input
- **Pros**:
  - Very explicit
  - No parsing needed
  - Clear structure
- **Cons**:
  - More UI clutter
  - Requires more clicks
  - Less conversational
  - Harder on mobile
- **Why rejected**: We wanted a conversational, mobile-friendly interface

### Alternative 3: AI/LLM-Based Parsing

- **Description**: Use GPT or similar LLM to extract location information
- **Pros**:
  - Most accurate parsing
  - Handles edge cases better
  - Natural language understanding
- **Cons**:
  - Expensive (API costs)
  - Latency (200-500ms per request)
  - Requires internet connection
  - Overkill for structured data
- **Why rejected**: Too expensive and slow for real-time autocomplete

## Implementation Notes

### Files Affected

- `apps/frontend/src/lib/requestParser.ts` - Parser implementation
- `apps/frontend/src/pages/dashboard.tsx:328-365` - Integration in dashboard
- `apps/frontend/src/lib/geocoding.ts` - Geocoding service integration

### Key Patterns Detected

```typescript
// Ride requests
/from\s+([^,]+?)(?:\s+to\s+([^,]+))?/i
/to\s+([^,]+)/i

// Event locations
/at\s+([^,]+)/i
```

### Position Tracking

The parser tracks cursor position to prevent unwanted text replacement:
```typescript
setAutocompleteTriggerPosition(index)
// Ensures replacements happen at the right location
```

## References

- Initial implementation: T-005 (Natural language parser debugging)
- Geocoding integration: T-006 (LocationPicker geocoding integration)
- User feedback: "More intuitive than @ symbols" (Session 2025-12-29)
- Related: ADR-002 (3-Tier Geocoding Cache Architecture)
