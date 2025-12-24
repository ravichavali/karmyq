/**
 * Base Request Schema - Common fields for all request types
 * Used by all specialized request types (generic, ride, borrow, service, event)
 */

import { z } from 'zod';

export const BaseRequestSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type BaseRequest = z.infer<typeof BaseRequestSchema>;
