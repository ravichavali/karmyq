/**
 * Borrow Request Schema - Specialized schema for item borrowing
 * Example: "Need to borrow a power drill for weekend"
 */

import { z } from 'zod';
import { BaseRequestSchema } from './base';

export const BorrowPayloadSchema = z.object({
  item_category: z.enum([
    'tools',
    'electronics',
    'kitchen',
    'books',
    'sports',
    'camping',
    'party',
    'other'
  ]),
  duration_days: z.number().int().min(1).max(30, 'Duration must be between 1 and 30 days'),
  condition_min: z.enum(['fair', 'good', 'like_new', 'new']).optional(),
  images: z.array(z.string().url()).max(5, 'Maximum 5 images allowed').optional(),
  return_date: z.string().datetime().optional(),
});

export const BorrowRequestSchema = BaseRequestSchema.extend({
  request_type: z.literal('borrow'),
  payload: BorrowPayloadSchema,
});

export type BorrowPayload = z.infer<typeof BorrowPayloadSchema>;
export type BorrowRequest = z.infer<typeof BorrowRequestSchema>;
