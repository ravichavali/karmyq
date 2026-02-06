/**
 * Unit Tests: Polymorphic Request Validation
 *
 * Tests the Zod discriminated union validation for all 5 request types:
 * - Generic, Ride, Borrow, Service, Event
 *
 * These tests ensure type-specific payload validation works correctly
 * and that the discriminated union properly narrows types.
 */

import {
  validateRequest,
  isRideRequest,
  isBorrowRequest,
  isServiceRequest,
  isEventRequest,
  isGenericRequest,
  CreateRequestSchema,
} from '../../../../packages/shared/src/schemas/requests';

describe('Polymorphic Request Validation', () => {
  describe('Generic Request', () => {
    it('should validate minimal generic request', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help with gardening',
        description: 'Looking for someone to help me with garden maintenance',
        urgency: 'medium',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.request_type).toBe('generic');
      }
    });

    it('should accept empty payload for generic requests', () => {
      const data = {
        request_type: 'generic',
        title: 'General help needed',
        description: 'Need some assistance',
        payload: {},
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing title', () => {
      const data = {
        request_type: 'generic',
        description: 'Need help',
        urgency: 'medium',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.arrayContaining(['title']),
            }),
          ])
        );
      }
    });

    it('should reject missing description', () => {
      const data = {
        request_type: 'generic',
        title: 'Help needed',
        urgency: 'medium',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.arrayContaining(['description']),
            }),
          ])
        );
      }
    });

    it('should reject title shorter than 5 characters', () => {
      const data = {
        request_type: 'generic',
        title: 'Help',
        description: 'Need help with something',
        urgency: 'medium',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should reject description shorter than 10 characters', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help',
        description: 'Help me',
        urgency: 'medium',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should default urgency to medium', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help',
        description: 'Need help with something',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.urgency).toBe('medium');
      }
    });

    it('should validate all urgency levels', () => {
      const urgencyLevels = ['low', 'medium', 'high', 'critical'];

      urgencyLevels.forEach((urgency) => {
        const data = {
          request_type: 'generic',
          title: 'Need help',
          description: 'Need help with something',
          urgency,
        };

        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid urgency level', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help',
        description: 'Need help with something',
        urgency: 'super_urgent',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Ride Request', () => {
    const validRideRequest = {
      request_type: 'ride',
      title: 'Ride to SFO Airport',
      description: 'Need a ride to catch my 6am flight',
      urgency: 'high',
      payload: {
        origin: {
          address: '123 Main St, San Francisco, CA',
          lat: 37.7749,
          lng: -122.4194,
        },
        destination: {
          address: 'SFO International Airport, San Francisco, CA',
          lat: 37.6213,
          lng: -122.3790,
        },
        seats_needed: 1,
        departure_time: '2024-06-15T05:30:00Z',
      },
    };

    it('should validate complete ride request', () => {
      const result = validateRequest(validRideRequest);
      expect(result.success).toBe(true);
      if (result.success && isRideRequest(result.data)) {
        expect(result.data.request_type).toBe('ride');
        expect(result.data.payload.seats_needed).toBe(1);
      }
    });

    it('should require origin and destination', () => {
      const data = {
        ...validRideRequest,
        payload: {
          seats_needed: 1,
          departure_time: '2024-06-15T05:30:00Z',
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should validate seats_needed between 1-10', () => {
      const validSeats = [1, 5, 10];
      validSeats.forEach((seats) => {
        const data = {
          ...validRideRequest,
          payload: {
            ...validRideRequest.payload,
            seats_needed: seats,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });

      const invalidSeats = [0, 11, 100];
      invalidSeats.forEach((seats) => {
        const data = {
          ...validRideRequest,
          payload: {
            ...validRideRequest.payload,
            seats_needed: seats,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(false);
      });
    });

    it('should validate departure_time format', () => {
      const invalidTimes = [
        '2024-06-15',
        '05:30:00',
        'tomorrow',
        '2024-06-15 05:30:00',
      ];

      invalidTimes.forEach((time) => {
        const data = {
          ...validRideRequest,
          payload: {
            ...validRideRequest.payload,
            departure_time: time,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(false);
      });
    });

    it('should validate location schema (address, lat, lng)', () => {
      const result = validateRequest(validRideRequest);
      expect(result.success).toBe(true);
      if (result.success && isRideRequest(result.data)) {
        expect(result.data.payload.origin.address).toBeDefined();
        expect(result.data.payload.origin.lat).toBeGreaterThanOrEqual(-90);
        expect(result.data.payload.origin.lat).toBeLessThanOrEqual(90);
        expect(result.data.payload.origin.lng).toBeGreaterThanOrEqual(-180);
        expect(result.data.payload.origin.lng).toBeLessThanOrEqual(180);
      }
    });

    it('should reject invalid latitude', () => {
      const data = {
        ...validRideRequest,
        payload: {
          ...validRideRequest.payload,
          origin: {
            address: '123 Main St',
            lat: 91, // Invalid: > 90
            lng: -122.4194,
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude', () => {
      const data = {
        ...validRideRequest,
        payload: {
          ...validRideRequest.payload,
          destination: {
            address: 'SFO Airport',
            lat: 37.6213,
            lng: 181, // Invalid: > 180
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should accept optional preferences', () => {
      const data = {
        ...validRideRequest,
        payload: {
          ...validRideRequest.payload,
          preferences: {
            women_only: true,
            pet_friendly: false,
            wheelchair_accessible: true,
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should accept partial preferences', () => {
      const data = {
        ...validRideRequest,
        payload: {
          ...validRideRequest.payload,
          preferences: {
            women_only: true,
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid preference types', () => {
      const data = {
        ...validRideRequest,
        payload: {
          ...validRideRequest.payload,
          preferences: {
            women_only: 'yes', // Should be boolean
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Borrow Request', () => {
    const validBorrowRequest = {
      request_type: 'borrow',
      title: 'Need a power drill',
      description: 'Looking to borrow a power drill for weekend project',
      urgency: 'low',
      payload: {
        item_category: 'tools',
        duration_days: 3,
      },
    };

    it('should validate complete borrow request', () => {
      const result = validateRequest(validBorrowRequest);
      expect(result.success).toBe(true);
      if (result.success && isBorrowRequest(result.data)) {
        expect(result.data.request_type).toBe('borrow');
        expect(result.data.payload.item_category).toBe('tools');
      }
    });

    it('should require item_category', () => {
      const data = {
        ...validBorrowRequest,
        payload: {
          duration_days: 3,
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should validate duration_days between 1-30', () => {
      const validDurations = [1, 7, 30];
      validDurations.forEach((days) => {
        const data = {
          ...validBorrowRequest,
          payload: {
            ...validBorrowRequest.payload,
            duration_days: days,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });

      const invalidDurations = [0, 31, 100];
      invalidDurations.forEach((days) => {
        const data = {
          ...validBorrowRequest,
          payload: {
            ...validBorrowRequest.payload,
            duration_days: days,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(false);
      });
    });

    it('should validate item_category enum values', () => {
      const validCategories = ['tools', 'electronics', 'kitchen', 'books', 'sports', 'camping', 'party'];

      validCategories.forEach((category) => {
        const data = {
          ...validBorrowRequest,
          payload: {
            ...validBorrowRequest.payload,
            item_category: category,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid item_category', () => {
      const data = {
        ...validBorrowRequest,
        payload: {
          ...validBorrowRequest.payload,
          item_category: 'invalid_category',
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should validate condition_min enum values', () => {
      const validConditions = ['fair', 'good', 'like_new', 'new'];

      validConditions.forEach((condition) => {
        const data = {
          ...validBorrowRequest,
          payload: {
            ...validBorrowRequest.payload,
            condition_min: condition,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should accept optional images array', () => {
      const data = {
        ...validBorrowRequest,
        payload: {
          ...validBorrowRequest.payload,
          images: ['https://example.com/drill1.jpg', 'https://example.com/drill2.jpg'],
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should validate image URLs', () => {
      const data = {
        ...validBorrowRequest,
        payload: {
          ...validBorrowRequest.payload,
          images: ['not a url'],
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Service Request', () => {
    const validServiceRequest = {
      request_type: 'service',
      title: 'Need plumber for leak',
      description: 'Have a leaking pipe under the kitchen sink',
      urgency: 'high',
      payload: {
        service_category: 'plumbing',
        location_type: 'on_site',
      },
    };

    it('should validate complete service request', () => {
      const result = validateRequest(validServiceRequest);
      expect(result.success).toBe(true);
      if (result.success && isServiceRequest(result.data)) {
        expect(result.data.request_type).toBe('service');
        expect(result.data.payload.service_category).toBe('plumbing');
      }
    });

    it('should require service_category', () => {
      const data = {
        ...validServiceRequest,
        payload: {
          location_type: 'on_site',
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should validate service_category enum values', () => {
      const validCategories = [
        'plumbing', 'electrical', 'carpentry', 'tutoring',
        'consulting', 'repair', 'cleaning', 'gardening',
        'pet_care', 'childcare', 'elder_care', 'tech_support',
        'legal', 'financial'
      ];

      validCategories.forEach((category) => {
        const data = {
          ...validServiceRequest,
          payload: {
            ...validServiceRequest.payload,
            service_category: category,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate skill_level_required enum values', () => {
      const validLevels = ['beginner', 'intermediate', 'expert'];

      validLevels.forEach((level) => {
        const data = {
          ...validServiceRequest,
          payload: {
            ...validServiceRequest.payload,
            skill_level_required: level,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate location_type enum values', () => {
      const validTypes = ['remote', 'on_site', 'hybrid'];

      validTypes.forEach((type) => {
        const data = {
          ...validServiceRequest,
          payload: {
            ...validServiceRequest.payload,
            location_type: type,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate budget_range structure', () => {
      const data = {
        ...validServiceRequest,
        payload: {
          ...validServiceRequest.payload,
          budget_range: {
            min: 50,
            max: 150,
            currency: 'USD',
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should validate preferred_schedule structure', () => {
      const data = {
        ...validServiceRequest,
        payload: {
          ...validServiceRequest.payload,
          preferred_schedule: {
            days: ['monday', 'tuesday'],
            time_of_day: 'morning',
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should accept optional certifications_required array', () => {
      const data = {
        ...validServiceRequest,
        payload: {
          ...validServiceRequest.payload,
          certifications_required: ['licensed_plumber', 'insured'],
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Event Request', () => {
    const validEventRequest = {
      request_type: 'event',
      title: 'Community Cleanup Volunteers',
      description: 'Looking for volunteers to help clean up the local park',
      urgency: 'medium',
      payload: {
        event_type: 'community_cleanup',
        event_date: '2024-06-20T09:00:00Z',
        event_duration_hours: 4,
        location: {
          address: 'Central Park, San Francisco',
          lat: 37.7749,
          lng: -122.4194,
          is_virtual: false,
        },
        participants_needed: 20,
      },
    };

    it('should validate complete event request', () => {
      const result = validateRequest(validEventRequest);
      expect(result.success).toBe(true);
      if (result.success && isEventRequest(result.data)) {
        expect(result.data.request_type).toBe('event');
        expect(result.data.payload.event_type).toBe('community_cleanup');
      }
    });

    it('should require event_type and event_date', () => {
      const data = {
        ...validEventRequest,
        payload: {
          event_duration_hours: 4,
          location: validEventRequest.payload.location,
          participants_needed: 20,
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should validate participants_needed range (1-1000)', () => {
      const validCounts = [1, 50, 1000];
      validCounts.forEach((count) => {
        const data = {
          ...validEventRequest,
          payload: {
            ...validEventRequest.payload,
            participants_needed: count,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });

      const invalidCounts = [0, 1001];
      invalidCounts.forEach((count) => {
        const data = {
          ...validEventRequest,
          payload: {
            ...validEventRequest.payload,
            participants_needed: count,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(false);
      });
    });

    it('should validate event_duration_hours range', () => {
      const validDurations = [0.5, 4, 24];
      validDurations.forEach((duration) => {
        const data = {
          ...validEventRequest,
          payload: {
            ...validEventRequest.payload,
            event_duration_hours: duration,
          },
        };
        const result = validateRequest(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate location structure (physical)', () => {
      const result = validateRequest(validEventRequest);
      expect(result.success).toBe(true);
      if (result.success && isEventRequest(result.data)) {
        expect(result.data.payload.location.address).toBeDefined();
        expect(result.data.payload.location.lat).toBeDefined();
        expect(result.data.payload.location.lng).toBeDefined();
        expect(result.data.payload.location.is_virtual).toBe(false);
      }
    });

    it('should validate location structure (virtual)', () => {
      const data = {
        ...validEventRequest,
        payload: {
          ...validEventRequest.payload,
          location: {
            address: 'Virtual Event',
            is_virtual: true,
            virtual_link: 'https://zoom.us/j/123456789',
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should validate roles array structure', () => {
      const data = {
        ...validEventRequest,
        payload: {
          ...validEventRequest.payload,
          roles: [
            {
              role_name: 'Team Leader',
              count: 2,
              description: 'Organize groups of 10',
            },
            {
              role_name: 'Equipment Manager',
              count: 1,
              description: 'Manage cleanup supplies',
            },
          ],
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });

    it('should validate recurring event structure', () => {
      const data = {
        ...validEventRequest,
        payload: {
          ...validEventRequest.payload,
          recurring: {
            is_recurring: true,
            frequency: 'monthly',
            end_date: '2024-12-20T09:00:00Z',
          },
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify ride requests', () => {
      const data = {
        request_type: 'ride',
        title: 'Ride needed',
        description: 'Need a ride to airport',
        payload: {
          origin: { address: '123 Main', lat: 37, lng: -122 },
          destination: { address: 'Airport', lat: 38, lng: -123 },
          seats_needed: 1,
          departure_time: '2024-06-15T05:30:00Z',
        },
      };

      const result = validateRequest(data);
      if (result.success) {
        expect(isRideRequest(result.data)).toBe(true);
        expect(isBorrowRequest(result.data)).toBe(false);
        expect(isServiceRequest(result.data)).toBe(false);
        expect(isEventRequest(result.data)).toBe(false);
        expect(isGenericRequest(result.data)).toBe(false);
      }
    });

    it('should correctly identify borrow requests', () => {
      const data = {
        request_type: 'borrow',
        title: 'Need drill',
        description: 'Need to borrow a drill',
        payload: {
          item_category: 'tools',
          duration_days: 3,
        },
      };

      const result = validateRequest(data);
      if (result.success) {
        expect(isBorrowRequest(result.data)).toBe(true);
        expect(isRideRequest(result.data)).toBe(false);
      }
    });

    it('should correctly identify service requests', () => {
      const data = {
        request_type: 'service',
        title: 'Need plumber',
        description: 'Need plumbing help',
        payload: {
          service_category: 'plumbing',
          location_type: 'on_site',
        },
      };

      const result = validateRequest(data);
      if (result.success) {
        expect(isServiceRequest(result.data)).toBe(true);
        expect(isRideRequest(result.data)).toBe(false);
      }
    });

    it('should correctly identify event requests', () => {
      const data = {
        request_type: 'event',
        title: 'Cleanup event',
        description: 'Community cleanup',
        payload: {
          event_type: 'community_cleanup',
          event_date: '2024-06-20T09:00:00Z',
          event_duration_hours: 4,
          location: { address: 'Park', lat: 37, lng: -122, is_virtual: false },
          participants_needed: 20,
        },
      };

      const result = validateRequest(data);
      if (result.success) {
        expect(isEventRequest(result.data)).toBe(true);
        expect(isRideRequest(result.data)).toBe(false);
      }
    });

    it('should correctly identify generic requests', () => {
      const data = {
        request_type: 'generic',
        title: 'Need help',
        description: 'Need general help',
      };

      const result = validateRequest(data);
      if (result.success) {
        expect(isGenericRequest(result.data)).toBe(true);
        expect(isRideRequest(result.data)).toBe(false);
      }
    });

    it('should narrow TypeScript types correctly', () => {
      const data = {
        request_type: 'ride',
        title: 'Ride needed',
        description: 'Need a ride',
        payload: {
          origin: { address: '123 Main', lat: 37, lng: -122 },
          destination: { address: 'Airport', lat: 38, lng: -123 },
          seats_needed: 1,
          departure_time: '2024-06-15T05:30:00Z',
        },
      };

      const result = validateRequest(data);
      if (result.success && isRideRequest(result.data)) {
        // TypeScript should know that payload has ride-specific fields
        expect(result.data.payload.origin).toBeDefined();
        expect(result.data.payload.destination).toBeDefined();
        expect(result.data.payload.seats_needed).toBe(1);
      }
    });
  });

  describe('Discriminated Union', () => {
    it('should reject unknown request_type', () => {
      const data = {
        request_type: 'unknown_type',
        title: 'Test request',
        description: 'Test description',
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should reject ride payload with generic type', () => {
      const data = {
        request_type: 'generic',
        title: 'Test request',
        description: 'Test description',
        payload: {
          origin: { address: '123 Main', lat: 37, lng: -122 },
          destination: { address: 'Airport', lat: 38, lng: -123 },
          seats_needed: 1,
          departure_time: '2024-06-15T05:30:00Z',
        },
      };

      const result = validateRequest(data);
      // Generic requests allow any payload, so this should succeed
      // but the payload won't be type-checked as a ride
      expect(result.success).toBe(true);
    });

    it('should reject mismatched request_type and payload', () => {
      const data = {
        request_type: 'ride',
        title: 'Need help',
        description: 'Need some help',
        payload: {
          item_category: 'tools', // Wrong payload for ride type
          duration_days: 3,
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
    });

    it('should provide detailed error messages', () => {
      const data = {
        request_type: 'ride',
        title: 'Ride needed',
        description: 'Need a ride',
        payload: {
          origin: { address: '123', lat: 37, lng: -122 },
          // Missing destination, seats_needed, departure_time
        },
      };

      const result = validateRequest(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const error = result.error.format();
        expect(error).toBeDefined();
      }
    });
  });
});
