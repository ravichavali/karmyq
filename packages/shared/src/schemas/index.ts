/**
 * Shared Schemas - Zod validation schemas for Karmyq platform
 *
 * This module provides type-safe validation schemas used across all services.
 * All schemas are built with Zod for runtime validation and TypeScript inference.
 *
 * Usage:
 * ```typescript
 * import { CreateRequestSchema, validateRequest } from '@karmyq/shared/schemas';
 * ```
 */

// Export all request schemas
export * from './requests';

// Provider schemas (ADR-041/042)
export * from './providers';

// Reputation disclosure boundary (Sprint 112, ADR-082)
export * from './reputationDisclosure';

// Reciprocal request/offer relationship context (Sprint 116)
export * from './relationshipContext';

// Future: Export other schema modules as they're created
// export * from './events';
// export * from './users';
// export * from './communities';
