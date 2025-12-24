/**
 * Generic Request Schema - Traditional help request (backward compatible)
 */

import { z } from 'zod';
import { BaseRequestSchema } from './base';

export const GenericPayloadSchema = z.object({
  // Generic requests don't have additional payload fields
  // Keeping this for consistency with discriminated union structure
}).optional();

export const GenericRequestSchema = BaseRequestSchema.extend({
  request_type: z.literal('generic'),
  payload: GenericPayloadSchema,
});

export type GenericPayload = z.infer<typeof GenericPayloadSchema>;
export type GenericRequest = z.infer<typeof GenericRequestSchema>;
