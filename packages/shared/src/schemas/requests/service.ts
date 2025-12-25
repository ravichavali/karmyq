/**
 * Service Request Schema - Specialized schema for service requests
 * Example: "Need a plumber to fix leak", "Looking for tutoring in math"
 */

import { z } from 'zod';
import { BaseRequestSchema } from './base';

export const ServicePayloadSchema = z.object({
  service_category: z.enum([
    'plumbing',
    'electrical',
    'carpentry',
    'tutoring',
    'consulting',
    'repair',
    'cleaning',
    'gardening',
    'pet_care',
    'childcare',
    'elder_care',
    'tech_support',
    'legal',
    'financial',
    'other'
  ]),
  skill_level_required: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  estimated_duration_hours: z.number().min(0.5).max(80).optional(),
  budget_range: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  }).optional(),
  preferred_schedule: z.object({
    days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
    time_of_day: z.enum(['morning', 'afternoon', 'evening', 'flexible']).optional(),
  }).optional(),
  location_type: z.enum(['remote', 'on_site', 'hybrid']).default('on_site'),
  certifications_required: z.array(z.string()).max(5).optional(),
});

export const ServiceRequestSchema = BaseRequestSchema.extend({
  request_type: z.literal('service'),
  payload: ServicePayloadSchema,
});

export type ServicePayload = z.infer<typeof ServicePayloadSchema>;
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
