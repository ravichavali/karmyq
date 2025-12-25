/**
 * Event Request Schema - Specialized schema for event participation/help
 * Example: "Need volunteers for community cleanup", "Looking for band members for concert"
 */

import { z } from 'zod';
import { BaseRequestSchema } from './base';

export const EventPayloadSchema = z.object({
  event_type: z.enum([
    'volunteer',
    'community_cleanup',
    'fundraiser',
    'workshop',
    'meetup',
    'sports',
    'cultural',
    'educational',
    'social',
    'other'
  ]),
  event_date: z.string().datetime({ message: 'Must be valid ISO datetime string' }),
  event_duration_hours: z.number().min(0.5).max(24),
  location: z.object({
    address: z.string().min(3),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    is_virtual: z.boolean().default(false),
    virtual_link: z.string().url().optional(),
  }),
  participants_needed: z.number().int().min(1).max(1000),
  roles: z.array(z.object({
    role_name: z.string().min(2).max(50),
    count: z.number().int().min(1),
    description: z.string().max(200).optional(),
  })).max(10).optional(),
  requirements: z.object({
    age_minimum: z.number().int().min(0).max(100).optional(),
    background_check: z.boolean().optional(),
    experience_required: z.boolean().optional(),
  }).optional(),
  recurring: z.object({
    is_recurring: z.boolean().default(false),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
    end_date: z.string().datetime().optional(),
  }).optional(),
});

export const EventRequestSchema = BaseRequestSchema.extend({
  request_type: z.literal('event'),
  payload: EventPayloadSchema,
});

export type EventPayload = z.infer<typeof EventPayloadSchema>;
export type EventRequest = z.infer<typeof EventRequestSchema>;
