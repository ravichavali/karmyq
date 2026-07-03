// Re-export all shared types, constants, and utilities
export * from './types';
export * from './constants/config';

// Middleware
export * from './middleware';

// Utilities
export * from './utils/logger';
export * from './utils/response';

// Events
export { createPublisher } from './events/publisher';

// Trust (Sprint 90 — visible decay model, ADR-070)
export { classifyDecayTier } from './src/trust/decayTier';
export type { DecayTier } from './src/trust/decayTier';

// Reputation disclosure boundary (Sprint 112 — ADR-082)
export * from './src/schemas/reputationDisclosure';

// Reciprocal request/offer relationship context (Sprint 116)
export * from './src/schemas/relationshipContext';

// Fixture-only completed-exchange projection (Sprint 117 — curated demo reset)
export * from './src/projections/completedExchange';
