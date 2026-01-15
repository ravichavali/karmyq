# Karmyq Requirements Index

This directory contains all system requirements organized by category.

## Directory Structure

```
requirements/
├── functional/          # What the system does (user-facing features)
├── technical/          # How the system works (architecture, APIs)
├── non-functional/     # Quality attributes (performance, security)
└── REQUIREMENTS_INDEX.md
```

## Functional Requirements

### Core Features (Implemented)
- [FR-001: User Authentication](functional/FR-001-authentication.md)
- [FR-002: Community Management](functional/FR-002-communities.md)
- [FR-003: Help Requests](functional/FR-003-help-requests.md)
- [FR-004: Matching System](functional/FR-004-matching.md)
- [FR-005: Reputation System](functional/FR-005-reputation.md)
- [FR-006: Notifications](functional/FR-006-notifications.md)
- [FR-007: Messaging](functional/FR-007-messaging.md)
- [FR-008: Activity Feed](functional/FR-008-feed.md)
- [FR-009: Data Cleanup](functional/FR-009-cleanup.md)
- [FR-010: Community Norms](functional/FR-010-norms.md)

## Technical Requirements

### Architecture (Implemented)
- [TR-001: Microservices Architecture](technical/TR-001-microservices.md)
- [TR-002: Multi-Tenancy](technical/TR-002-multi-tenancy.md)
- [TR-003: Event-Driven Architecture](technical/TR-003-events.md)
- [TR-004: Row-Level Security](technical/TR-004-rls.md)
- [TR-005: Real-Time Features](technical/TR-005-realtime.md)

## Non-Functional Requirements

### Quality Attributes
- [NFR-001: Performance](non-functional/NFR-001-performance.md)
- [NFR-002: Security](non-functional/NFR-002-security.md)
- [NFR-003: Scalability](non-functional/NFR-003-scalability.md)
- [NFR-004: Data Privacy](non-functional/NFR-004-privacy.md)
- [NFR-005: Ephemeral Data](non-functional/NFR-005-ephemeral.md)

## Requirement Status

| ID | Title | Priority | Status | Version |
|----|-------|----------|--------|---------|
| FR-001 | Authentication | High | ✅ Implemented | v5.1.0 |
| FR-002 | Communities | High | ✅ Implemented | v5.1.0 |
| FR-003 | Help Requests | High | ✅ Implemented | v5.1.0 |
| FR-004 | Matching | High | ✅ Implemented | v5.1.0 |
| FR-005 | Reputation | Medium | ✅ Implemented | v5.1.0 |
| FR-006 | Notifications | Medium | ✅ Implemented | v5.1.0 |
| FR-007 | Messaging | Medium | ✅ Implemented | v5.1.0 |
| FR-008 | Feed | Low | ✅ Implemented | v5.1.0 |
| FR-009 | Cleanup | High | ✅ Implemented | v5.1.0 |
| FR-010 | Norms | Low | ✅ Implemented | v5.1.0 |

## Traceability Matrix

| Requirement | User Stories | Technical Specs | Test Cases | Implementation |
|-------------|--------------|-----------------|------------|----------------|
| FR-001 | #TBD | TR-001 | tests/auth/ | services/auth-service |
| FR-002 | #TBD | TR-001, TR-002 | tests/community/ | services/community-service |
| FR-003 | #TBD | TR-001, TR-003 | tests/requests/ | services/request-service |

## Related Documentation

- [Architecture Overview](../architecture/README.md)
- [Feature Specifications](../features/README.md)
- [API Documentation](../api/README.md)
- [Testing Guide](../development/testing-guide.md)
