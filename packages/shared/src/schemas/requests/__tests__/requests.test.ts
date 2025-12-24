/**
 * Request Schema Tests
 * Validates that polymorphic request schemas work correctly
 */

import { describe, it, expect } from '@jest/globals';
import {
  CreateRequestSchema,
  validateRequest,
  isRideRequest,
  isBorrowRequest,
  isGenericRequest,
} from '../index';

describe('Request Schemas', () => {
  describe('Generic Request', () => {
    it('should validate a valid generic request', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help moving',
        description: 'Need help moving furniture this weekend',
        urgency: 'medium',
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.request_type).toBe('generic');
      }
    });

    it('should reject generic request with short title', () => {
      const data = {
        request_type: 'generic',
        title: 'Hi',
        description: 'Need help moving furniture',
        urgency: 'medium',
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Ride Request', () => {
    it('should validate a valid ride request', () => {
      const data = {
        request_type: 'ride',
        title: 'Need ride to Oakland',
        description: 'Need a ride from SF to Oakland on Friday',
        urgency: 'high',
        payload: {
          origin: {
            address: '123 Market St, San Francisco, CA',
            lat: 37.7749,
            lng: -122.4194,
          },
          destination: {
            address: '456 Broadway, Oakland, CA',
            lat: 37.8044,
            lng: -122.2712,
          },
          seats_needed: 2,
          departure_time: '2025-01-15T09:00:00Z',
          preferences: {
            pet_friendly: true,
          },
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.request_type).toBe('ride');
        expect(isRideRequest(result.data)).toBe(true);
        if (isRideRequest(result.data)) {
          expect(result.data.payload.origin.lat).toBe(37.7749);
          expect(result.data.payload.seats_needed).toBe(2);
        }
      }
    });

    it('should reject ride request with invalid coordinates', () => {
      const data = {
        request_type: 'ride',
        title: 'Need ride',
        description: 'Need a ride somewhere',
        urgency: 'medium',
        payload: {
          origin: {
            address: '123 Market St',
            lat: 200, // Invalid latitude
            lng: -122.4194,
          },
          destination: {
            address: '456 Broadway',
            lat: 37.8044,
            lng: -122.2712,
          },
          seats_needed: 2,
          departure_time: '2025-01-15T09:00:00Z',
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject ride request with too many seats', () => {
      const data = {
        request_type: 'ride',
        title: 'Need ride',
        description: 'Need a ride somewhere',
        urgency: 'medium',
        payload: {
          origin: { address: '123 Market St', lat: 37.7749, lng: -122.4194 },
          destination: { address: '456 Broadway', lat: 37.8044, lng: -122.2712 },
          seats_needed: 15, // Too many seats
          departure_time: '2025-01-15T09:00:00Z',
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Borrow Request', () => {
    it('should validate a valid borrow request', () => {
      const data = {
        request_type: 'borrow',
        title: 'Need power drill',
        description: 'Need to borrow a power drill for weekend project',
        urgency: 'low',
        payload: {
          item_category: 'tools',
          duration_days: 3,
          condition_min: 'good',
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.request_type).toBe('borrow');
        expect(isBorrowRequest(result.data)).toBe(true);
        if (isBorrowRequest(result.data)) {
          expect(result.data.payload.item_category).toBe('tools');
          expect(result.data.payload.duration_days).toBe(3);
        }
      }
    });

    it('should reject borrow request with invalid duration', () => {
      const data = {
        request_type: 'borrow',
        title: 'Need power drill',
        description: 'Need to borrow a power drill',
        urgency: 'low',
        payload: {
          item_category: 'tools',
          duration_days: 45, // Too long
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject borrow request with too many images', () => {
      const data = {
        request_type: 'borrow',
        title: 'Need camping gear',
        description: 'Need camping gear for trip',
        urgency: 'medium',
        payload: {
          item_category: 'camping',
          duration_days: 7,
          images: [
            'https://example.com/1.jpg',
            'https://example.com/2.jpg',
            'https://example.com/3.jpg',
            'https://example.com/4.jpg',
            'https://example.com/5.jpg',
            'https://example.com/6.jpg', // 6 images, max is 5
          ],
        },
      };

      const result = CreateRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify request types', () => {
      const genericData = {
        request_type: 'generic' as const,
        title: 'Generic request',
        description: 'A generic help request',
        urgency: 'medium' as const,
      };

      const rideData = {
        request_type: 'ride' as const,
        title: 'Need ride',
        description: 'Need a ride',
        urgency: 'high' as const,
        payload: {
          origin: { address: '123 St', lat: 37.7, lng: -122.4 },
          destination: { address: '456 Ave', lat: 37.8, lng: -122.3 },
          seats_needed: 1,
          departure_time: '2025-01-15T09:00:00Z',
        },
      };

      const borrowData = {
        request_type: 'borrow' as const,
        title: 'Need tool',
        description: 'Need a tool',
        urgency: 'low' as const,
        payload: {
          item_category: 'tools' as const,
          duration_days: 2,
        },
      };

      expect(isGenericRequest(genericData)).toBe(true);
      expect(isRideRequest(rideData)).toBe(true);
      expect(isBorrowRequest(borrowData)).toBe(true);

      expect(isRideRequest(genericData)).toBe(false);
      expect(isBorrowRequest(rideData)).toBe(false);
      expect(isGenericRequest(borrowData)).toBe(false);
    });
  });

  describe('validateRequest helper', () => {
    it('should provide formatted error messages', () => {
      const invalidData = {
        request_type: 'ride',
        title: 'Hi', // Too short
        description: 'Short', // Too short
        urgency: 'invalid', // Invalid enum value
        payload: {
          origin: { address: 'A', lat: 200, lng: -500 }, // Invalid coords
          destination: { address: 'B', lat: 0, lng: 0 },
          seats_needed: 20, // Too many
          departure_time: 'not-a-date', // Invalid datetime
        },
      };

      const result = validateRequest(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = result.error.format();
        expect(formatted).toBeDefined();
      }
    });
  });
});
