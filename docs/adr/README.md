# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Karmyq project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:
- **Status**: Accepted, Proposed, Deprecated, Superseded
- **Context**: What is the issue we're trying to solve?
- **Decision**: What is the change we're proposing/doing?
- **Consequences**: What becomes easier or harder as a result?
- **Alternatives Considered**: What other options did we evaluate?

## Index

### Core Architecture
- [ADR-003: Multi-Tenant RLS Database Design](ADR-003-multi-tenant-rls.md)
- [ADR-004: Microservices Event-Driven Architecture](ADR-004-microservices-event-driven.md)
- [ADR-006: Standardized API Response Format](ADR-006-standardized-api-response.md)
- [ADR-007: Polymorphic Request System ("Everything App")](ADR-007-polymorphic-request-system.md)
- [ADR-010: JWT-Based Multi-Community Authentication](ADR-010-jwt-multi-community-auth.md)
- [ADR-013: Monorepo with Turborepo](ADR-013-monorepo-turborepo.md)

### User Experience
- [ADR-001: Natural Language Parsing for Location Input](ADR-001-natural-language-location-parsing.md)
- [ADR-002: 3-Tier Geocoding Cache Architecture](ADR-002-geocoding-cache-architecture.md)
- [ADR-005: Minimalist Dashboard Design](ADR-005-minimalist-dashboard.md)
- [ADR-008: 3-Column Dashboard Layout (V7) - SUPERSEDED](ADR-008-three-column-dashboard.md)

### Data & Infrastructure
- [ADR-009: Ephemeral Data Design](ADR-009-ephemeral-data.md)
- [ADR-011: Reputation Decay System](ADR-011-reputation-decay.md)
- [ADR-012: Real-Time Communication Stack (WebSocket + SSE)](ADR-012-realtime-communication.md)

### Development & Operations
- [ADR-014: Testing Strategy (Integration + E2E + Unit)](ADR-014-testing-strategy.md)
- [ADR-015: Observability Stack (Grafana/Loki/Prometheus)](ADR-015-observability-stack.md)
- [ADR-023: Infrastructure Standardization and Environment Management](ADR-023-infrastructure-standardization.md)
- [ADR-024: Synthetic User Simulation for Demo Environment](ADR-024-synthetic-user-simulation.md) 🔮 PROPOSED
- [ADR-026: Self-Hosted Docker Registry](../operations/SELF_HOSTED_REGISTRY.md) ⭐ NEW
- [ADR-027: Docker Image Size Optimization (Deferred Technical Debt)](ADR-027-docker-image-optimization-deferred.md) 📋 BACKLOG

### Social Architecture
- [ADR-016: Prestige-Based Recognition System](ADR-016-prestige-based-recognition.md)
- [ADR-017: Cohort-Based Community Layers](ADR-017-cohort-based-community-layers.md)
- [ADR-018: Community Splitting Mechanics](ADR-018-community-splitting-mechanics.md)
- [ADR-019: Referral Chain Trust System](ADR-019-referral-chain-trust.md)
- [ADR-020: Trust-First Design Philosophy](ADR-020-trust-first-design.md)
- [ADR-021: Configurable Trust Path Filtering & Adaptive Trust Preferences](ADR-021-trust-path-filtering.md)
- [ADR-022: Multi-Tier Feed Architecture (Explore-Exploit Balance)](ADR-022-multi-tier-feed-architecture.md)
- [ADR-030: Community Configuration System (Phase 1)](ADR-030-community-configuration-system.md) ⭐ NEW

## Creating a New ADR

1. Copy `template.md` to a new file: `ADR-XXX-short-title.md`
2. Fill in all sections
3. Update this README index
4. Submit for review

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
