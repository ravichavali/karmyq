# Matching Service (Future)

## Status: 🚧 Not Implemented

This directory is reserved for a future **intelligent matching service** with ML-powered recommendations.

## Current Implementation

**Matching is currently handled by the [Request Service](../request-service/)**.

The request-service implements basic matching functionality:
- Manual offer creation (`POST /requests/:id/offers`)
- Match creation when offer is accepted (`POST /offers/:id/accept`)
- Match completion tracking (`PUT /matches/:id/complete`)

See: [request-service/CONTEXT.md](../request-service/CONTEXT.md)

## Future Vision

When implemented, this service will provide intelligent, ML-powered matching.

### Algorithm

Score = (skill_match * 0.4) + (proximity * 0.3) + (trust_score * 0.2) + (availability * 0.1)

### Planned Features

- Automatic helper suggestions for new requests
- Request recommendations for users (what they can help with)
- ML-based match success prediction
- Time-based patterns and optimization

## Implementation Roadmap

### Phase 1: Basic Scoring (v7.0)
- Move matching logic from request-service
- Implement simple scoring algorithm
- Test with existing data

### Phase 2: ML Integration (v8.0)
- Collect match history data
- Train initial ML model
- A/B test ML vs rule-based matching

### Phase 3: Advanced Features (v9.0)
- Location-based recommendations
- Time-based patterns
- Community-specific models
- Explainable AI

## Why Separate Service?

A separate service makes sense when:
1. ML models require dedicated infrastructure
2. Matching becomes computationally expensive
3. Need to iterate on models independently

## Related Documentation

- **Current**: [request-service/CONTEXT.md](../request-service/CONTEXT.md)
- **Future**: [FR-004: Matching System](../../docs/requirements/functional/FR-004-matching.md)

---

**Status**: 🚧 Placeholder for future implementation
**Planned Version**: 7.0.0+
