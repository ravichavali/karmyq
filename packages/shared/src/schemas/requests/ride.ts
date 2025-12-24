/**
 * Ride Request Schema - Specialized schema for ride sharing requests
 * Example: "Need a ride from SF to Oakland"
 */

import { z } from 'zod';
import { BaseRequestSchema } from './base';

// Location schema (reusable)
export const LocationSchema = z.object({
  address: z.string().min(3, 'Address must be at least 3 characters'),
  lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});

export const RidePayloadSchema = z.object({
  origin: LocationSchema,
  destination: LocationSchema,
  seats_needed: z.number().int().min(1).max(10, 'Seats needed must be between 1 and 10'),
  departure_time: z.string().datetime({ message: 'Must be valid ISO datetime string' }),
  preferences: z.object({
    women_only: z.boolean().optional(),
    pet_friendly: z.boolean().optional(),
    wheelchair_accessible: z.boolean().optional(),
  }).optional(),
});

export const RideRequestSchema = BaseRequestSchema.extend({
  request_type: z.literal('ride'),
  payload: RidePayloadSchema,
});

export type Location = z.infer<typeof LocationSchema>;
export type RidePayload = z.infer<typeof RidePayloadSchema>;
export type RideRequest = z.infer<typeof RideRequestSchema>;
