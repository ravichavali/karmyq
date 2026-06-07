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
