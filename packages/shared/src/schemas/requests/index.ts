/**
 * Request Schemas - Discriminated Union for Polymorphic Requests
 *
 * This module exports all request type schemas and provides a discriminated union
 * that enables type-safe polymorphic request handling across the platform.
 *
 * Usage:
 * ```typescript
 * import { CreateRequestSchema } from '@karmyq/shared/schemas';
 *
 * const result = CreateRequestSchema.safeParse(requestData);
 * if (result.success) {
 *   // result.data is properly typed based on request_type
 *   if (result.data.request_type === 'ride') {
 *     console.log(result.data.payload.origin); // TypeScript knows this exists
 *   }
 * }
 * ```
 */

import { z } from 'zod';

// Import all specialized schemas
export * from './base';
export * from './generic';
export * from './ride';
export * from './borrow';
export * from './service';
export * from './event';

import { GenericRequestSchema } from './generic';
import { RideRequestSchema } from './ride';
import { BorrowRequestSchema } from './borrow';
import { ServiceRequestSchema } from './service';
import { EventRequestSchema } from './event';

/**
 * Discriminated Union - Type-safe polymorphic request schema
 *
 * This schema uses Zod's discriminatedUnion to provide compile-time type safety
 * for different request types. The discriminator is 'request_type'.
 *
 * Benefits:
 * - TypeScript narrows types based on request_type
 * - Validation ensures payload matches request_type
 * - Adding new types is as simple as adding to this array
 */
export const CreateRequestSchema = z.discriminatedUnion('request_type', [
  GenericRequestSchema,
  RideRequestSchema,
  BorrowRequestSchema,
  ServiceRequestSchema,
  EventRequestSchema,
]);

/**
 * TypeScript types inferred from schemas
 */
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

/**
 * Type guard to check if a request is a specific type
 *
 * Usage:
 * ```typescript
 * if (isRideRequest(request)) {
 *   // TypeScript knows request.payload has origin/destination
 *   const distance = calculateDistance(request.payload.origin, request.payload.destination);
 * }
 * ```
 */
export function isRideRequest(request: CreateRequestInput): request is z.infer<typeof RideRequestSchema> {
  return request.request_type === 'ride';
}

export function isBorrowRequest(request: CreateRequestInput): request is z.infer<typeof BorrowRequestSchema> {
  return request.request_type === 'borrow';
}

export function isServiceRequest(request: CreateRequestInput): request is z.infer<typeof ServiceRequestSchema> {
  return request.request_type === 'service';
}

export function isEventRequest(request: CreateRequestInput): request is z.infer<typeof EventRequestSchema> {
  return request.request_type === 'event';
}

export function isGenericRequest(request: CreateRequestInput): request is z.infer<typeof GenericRequestSchema> {
  return request.request_type === 'generic';
}

/**
 * Helper to validate request data
 *
 * Usage:
 * ```typescript
 * const validation = validateRequest(req.body);
 * if (!validation.success) {
 *   return res.status(400).json({ errors: validation.error.format() });
 * }
 * // validation.data is properly typed
 * ```
 */
export function validateRequest(data: unknown) {
  return CreateRequestSchema.safeParse(data);
}
