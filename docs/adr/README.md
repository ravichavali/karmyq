# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Karmyq project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:
- **Status**: Proposed → Accepted → Implemented | Superseded | Deprecated
- **Context**: What is the issue we're trying to solve?
- **Decision**: What is the change we're proposing/doing?
- **Consequences**: What becomes easier or harder as a result?
- **Alternatives Considered**: What other options did we evaluate?

## Status Lifecycle

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet committed to |
| **Accepted** | Decision made, implementation pending or in progress |
| **Implemented** | Code shipped and deployed |
| **Superseded** | Replaced by a newer ADR |
| **Deprecated** | No longer relevant |

When code implementing an ADR is deployed, update the status from `Accepted` → `Implemented`.

## Index

### Core Architecture
- [ADR-003: Multi-Tenant RLS Database Design](ADR-003-multi-tenant-rls.md) — Accepted
- [ADR-004: Microservices Event-Driven Architecture](ADR-004-microservices-event-driven.md) — Accepted
- [ADR-006: Standardized API Response Format](ADR-006-standardized-api-response.md) — Accepted
- [ADR-074: Canonical Error Response Contract](ADR-074-canonical-error-response-contract.md) — **Accepted**
- [ADR-007: Polymorphic Request System ("Everything App")](ADR-007-polymorphic-request-system.md) — Accepted
- [ADR-010: JWT-Based Multi-Community Authentication](ADR-010-jwt-multi-community-auth.md) — Accepted
- [ADR-013: Monorepo with Turborepo](ADR-013-monorepo-turborepo.md) — Accepted

### User Experience
- [ADR-001: Natural Language Parsing for Location Input](ADR-001-natural-language-location-parsing.md) — Accepted
- [ADR-002: 3-Tier Geocoding Cache Architecture](ADR-002-geocoding-cache-architecture.md) — Accepted
- [ADR-005: Minimalist Dashboard Design](ADR-005-minimalist-dashboard.md) — Accepted
- [ADR-008: 3-Column Dashboard Layout (V7)](ADR-008-three-column-dashboard.md) — Superseded

### Data & Infrastructure
- [ADR-009: Ephemeral Data Design](ADR-009-ephemeral-data.md) — Accepted
- [ADR-011: Reputation Decay System](ADR-011-reputation-decay.md) — Accepted
- [ADR-012: Real-Time Communication Stack (WebSocket + SSE)](ADR-012-realtime-communication.md) — Accepted

### Development & Operations
- [ADR-014: Testing Strategy (Integration + E2E + Unit)](ADR-014-testing-strategy.md) — Accepted
- [ADR-015: Observability Stack (Grafana/Loki/Prometheus)](ADR-015-observability-stack.md) — Implemented
- [ADR-023: Infrastructure Standardization and Environment Management](ADR-023-infrastructure-standardization.md) — Accepted
- [ADR-024: Synthetic User Simulation for Demo Environment](ADR-024-synthetic-user-simulation.md) — Proposed
- [ADR-027: Docker Image Size Optimization (Deferred Technical Debt)](ADR-027-docker-image-optimization-deferred.md) — Accepted
- [ADR-028: NPM Workspace Docker Build Pattern](ADR-028-npm-workspace-docker-build.md) — Accepted
- [ADR-029: TDD Test Framework](ADR-029-tdd-test-framework.md) — Accepted

### Social Architecture
- [ADR-016: Prestige-Based Recognition System](ADR-016-prestige-based-recognition.md) — **Partially Implemented** (Phase 1)
- [ADR-017: Cohort-Based Community Layers](ADR-017-cohort-based-community-layers.md) — Accepted
- [ADR-018: Community Splitting Mechanics](ADR-018-community-splitting-mechanics.md) — Accepted (Phase 1 implemented Sprint 15)
- [ADR-019: Referral Chain Trust System](ADR-019-referral-chain-trust.md) — Proposed
- [ADR-020: Trust-First Design Philosophy](ADR-020-trust-first-design.md) — Accepted
- [ADR-021: Configurable Trust Path Filtering & Adaptive Trust Preferences](ADR-021-trust-path-filtering.md) — Accepted
- [ADR-022: Multi-Tier Feed Architecture (Explore-Exploit Balance)](ADR-022-multi-tier-feed-architecture.md) — Accepted
- [ADR-030: Community Configuration System (Phase 1)](ADR-030-community-configuration-system.md) — Accepted
- [ADR-031: Unified Trust-Scored Feed with Multi-Tier Visibility](ADR-031-unified-trust-scored-feed.md) — Accepted
- [ADR-032: Server-Driven UI / Dynamic Forms](ADR-032-server-driven-ui-dynamic-schemas.md) — Implemented
- [ADR-033: Offer Fulfillment Workflow](ADR-033-offer-fulfillment-workflow.md) — Proposed
- [ADR-034: Multi-Layer Trust Path Computation](ADR-034-multi-layer-trust-computation.md) — Implemented
- [ADR-035: Karma Allocation Strategy and Trust Score Abstraction](ADR-035-karma-allocation-trust-score-strategy.md) — Implemented
- [ADR-036: Private Feedback Model — Trust Without Rating Economies](ADR-036-private-feedback-model.md) — Accepted
- [ADR-037: Multi-Signal Trust Score — Bonding Capital, Bridging Capital, and Community-Configurable Floors](ADR-037-multi-signal-trust-score.md) — **Implemented**
- [ADR-038: Cross-Community Trust — Carry Model with Community-Configurable Decay](ADR-038-cross-community-trust.md) — **Implemented**
- [ADR-039: Trust Score Decay Consistency — Time-Weighted Signals](ADR-039-trust-score-decay-consistency.md) — **Implemented**
- [ADR-040: Community Trust Score — Bonding/Bridging Social Capital at the Community Level](ADR-040-community-trust-score.md) — **Implemented**
- [ADR-041: Two-Layer Mutual Aid + Professional Services](ADR-041-two-layer-mutual-aid-services.md) — Accepted
- [ADR-042: Provider Trust Score](ADR-042-provider-trust-score.md) — Accepted
- [ADR-043: Three-Score Model — Karma, Personal Trust, and Provider Trust](ADR-043-three-score-model.md) — **Implemented**
- [ADR-044: Community Trust Model Questionnaire](ADR-044-community-trust-questionnaire.md) — **Implemented**
- [ADR-045: Network Cohesion Score — Graph Topology Metrics for Community Health](ADR-045-network-cohesion-score.md) — **Implemented**
- [ADR-046: Trust Model Evolution](ADR-046-trust-model-evolution.md) — **Implemented**
- [ADR-047: Community Evolution Engine](ADR-047-community-evolution-engine.md) — **Implemented**
- [ADR-048: Feed Ranking v2 — 7-Signal Formula + Interaction Logging](ADR-048-feed-ranking-v2.md) — **Implemented**
- [ADR-049: Error Visibility — `error_type` Discriminator and `X-Request-Id` Convention](ADR-049-error-visibility.md) — **Implemented**
- [ADR-050: Group Communities as a Distinct Community Type](ADR-050-group-communities.md) — **Implemented**
- [ADR-051: Explore/Exploit Two-Tier Dibs Candidate Selection](ADR-051-explore-exploit-dibs.md) — **Implemented**
- [ADR-052: Security Hardening — OWASP Top 10 Baseline](ADR-052-security-hardening.md) — **Implemented**
- [ADR-053: Feed Design Philosophy](ADR-053-feed-design-philosophy.md) — **Accepted**
- [ADR-054: Trust Graph Architecture](ADR-054-trust-graph-architecture.md) — **Implemented**
- [ADR-055: Trust-Based Governance Architecture](ADR-055-trust-governance-architecture.md) — **Accepted**
- [ADR-056: Intrinsic Trust Decay (Interaction Half-Life)](ADR-056-intrinsic-trust-decay.md) — **Implemented**
- [ADR-057: Community Fission Mechanism](ADR-057-fission-mechanism.md) — **Implemented**
- [ADR-058: Community Fusion Mechanism](ADR-058-fusion-mechanism.md) — **Implemented**
- [ADR-059: Dependency Vulnerability Remediation + Blocking CI Security Gate](ADR-059-dependency-security-gate.md) — **Implemented**
- [ADR-060: Code Scanning Remediation + Blocking CI Code-Scanning Gate](ADR-060-code-scanning-gate.md) — **Implemented**
- [ADR-061: Supply-Chain & Secrets Hardening](ADR-061-supply-chain-and-secrets-hardening.md) — **Implemented**
- [ADR-062: Community Identity & Idempotent Creation](ADR-062-community-identity-idempotent-creation.md) — **Implemented**
- [ADR-063: Canonical Decayed Trust Metric & Unified Graph Visualization](ADR-063-canonical-trust-metric-and-unified-graph.md) — **Implemented**
- [ADR-064: Authorize Mutations from Authenticated Identity, Not Client-Supplied IDs](ADR-064-authorize-from-authenticated-identity.md) — **Implemented**
- [ADR-065: Karmyq.org and Karmyq.com Domain Roles](ADR-065-karmyq-org-and-com-domain-roles.md) — **Implemented**
- [ADR-066: Unified Feed Model](ADR-066-unified-feed-model.md) — **Implemented**
- [ADR-067: request_type vs payload_type Vocabulary](ADR-067-request-type-payload-vocabulary.md) — **Implemented**
- [ADR-068: Community Page Information Architecture (warm four-tab model)](ADR-068-community-page-information-architecture.md) — **Implemented**
- [ADR-069: Data Retention and Forgetting (content anonymization policy)](ADR-069-data-retention-and-forgetting.md) — **Implemented**
- [ADR-070: Visible Decay Model (decay tiers + re-warming nudge)](ADR-070-visible-decay-model.md) — **Implemented**
- [ADR-071: Service Consolidation — Fold Feed Service Into Request Service (11→10 services)](ADR-071-service-consolidation-feed-service.md) — **Implemented**
- [ADR-072: Dibs Scope — the Neighbor/Provider First-Ask Seam](ADR-072-dibs-scope.md) — **Implemented**
- [ADR-073: Provider↔Community Link-Up](ADR-073-provider-community-linkup.md) — **Accepted**
- [ADR-075: karmyq.org Multi-Route Relaunch (five static public routes)](ADR-075-karmyq-org-multi-route-relaunch.md) — **Accepted**
- [ADR-076: Founding-Circle Backend Intake (public persist-only landing submissions)](ADR-076-founding-circle-intake.md) — **Accepted**
- [ADR-077: Trust Path Topology is Platform-Wide; Strength is Community-Scoped](ADR-077-trust-path-platform-topology.md) — **Implemented**
- [ADR-078: Community Connection Reconciliation from `request_communities`](ADR-078-community-connection-reconciliation.md) — **Accepted**
- [ADR-079: Karmyq Visual Design System v2 (finish the warm system + harden it into tokens)](ADR-079-visual-design-system-v2.md) — **Implemented**
- [ADR-080: Retain Geocoding Cache as External API Policy Boundary](ADR-080-geocoding-cache-policy-boundary.md) — **Implemented**

## Creating a New ADR

1. Copy `template.md` to a new file: `ADR-XXX-short-title.md`
2. Fill in all sections
3. Set status to `Proposed` or `Accepted`
4. **Update this README index** (add entry under the right category with status)
5. Submit for review
6. When code implementing the ADR is deployed, update status to `Implemented`

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
