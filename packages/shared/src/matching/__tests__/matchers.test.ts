/**
 * Matching Algorithm Tests
 *
 * Tests for type-specific request matchers to ensure accurate scoring
 * and candidate ranking.
 */

import { describe, it, expect } from '@jest/globals';
import { RideMatcher } from '../matchers/ride';
import { ServiceMatcher } from '../matchers/service';
import { EventMatcher } from '../matchers/event';
import { BorrowMatcher } from '../matchers/borrow';
import { GenericMatcher } from '../matchers/generic';
import { getMatcherForRequest, findMatches, calculateMatchScore } from '../index';
import type { UserProfile } from '../types';
import type { CreateRequestInput } from '../../schemas/requests';

// Test user profiles
const userProfiles: UserProfile[] = [
  {
    id: 'user-1',
    name: 'Alice Driver',
    location: { lat: 40.7128, lng: -74.0060 }, // NYC
    skills: ['driving', 'vehicle'],
    availability: {
      days: ['monday', 'wednesday', 'friday'],
      timeOfDay: ['morning', 'afternoon'],
    },
    preferences: {
      maxDistance: 20,
      vehicleType: 'sedan',
    },
  },
  {
    id: 'user-2',
    name: 'Bob Plumber',
    location: { lat: 40.7580, lng: -73.9855 }, // Times Square
    skills: ['plumbing', 'home_repair', 'handyman'],
    availability: {
      days: ['tuesday', 'thursday', 'saturday'],
      timeOfDay: ['afternoon', 'evening'],
    },
  },
  {
    id: 'user-3',
    name: 'Carol Teacher',
    location: { lat: 40.7489, lng: -73.9680 }, // Queens
    skills: ['tutoring', 'teaching', 'education', 'math'],
    availability: {
      days: ['monday', 'tuesday', 'wednesday', 'thursday'],
      timeOfDay: ['afternoon', 'evening'],
    },
  },
  {
    id: 'user-4',
    name: 'Dave Volunteer',
    location: { lat: 40.7306, lng: -73.9352 }, // Brooklyn
    skills: ['volunteer', 'community_service', 'outdoor'],
    availability: {
      days: ['saturday', 'sunday'],
      timeOfDay: ['morning', 'afternoon'],
    },
  },
  {
    id: 'user-5',
    name: 'Eve Tools',
    location: { lat: 40.7589, lng: -73.9851 }, // Midtown
    skills: ['tools', 'handyman', 'construction'],
    availability: {
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timeOfDay: ['morning', 'afternoon', 'evening'],
    },
  },
];

describe('RideMatcher', () => {
  const matcher = new RideMatcher();

  it('should match users close to ride origin', () => {
    const request: any = {
      request_type: 'ride',
      title: 'Ride to airport',
      description: 'Need ride to JFK',
      urgency: 'medium',
      payload: {
        origin: { lat: 40.7128, lng: -74.0060, address: 'NYC' },
        destination: { lat: 40.6413, lng: -73.7781, address: 'JFK Airport' },
        seats_needed: 2,
        departure_time: '2024-06-15T10:00:00Z', // Monday morning
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[0]); // Alice Driver
    expect(score.score).toBeGreaterThan(60);
    expect(score.reasons.some((r) => r.includes('close') || r.includes('0.0km'))).toBe(true);
  });

  it('should prioritize users with adequate vehicle capacity', () => {
    const request: any = {
      request_type: 'ride',
      title: 'Group ride',
      description: 'Need ride for 6 people',
      urgency: 'high',
      payload: {
        origin: { lat: 40.7128, lng: -74.0060, address: 'NYC' },
        destination: { lat: 40.7589, lng: -73.9851, address: 'Midtown' },
        seats_needed: 6,
        departure_time: '2024-06-15T14:00:00Z',
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[0]); // Alice with sedan (4 seats)
    expect(score.breakdown.preferenceScore).toBe(30); // Can't fit all passengers (sedan only has 4 seats)
  });

  it('should find top candidates for ride requests', () => {
    const request: any = {
      request_type: 'ride',
      title: 'Ride downtown',
      description: 'Need ride',
      urgency: 'low',
      payload: {
        origin: { lat: 40.7128, lng: -74.0060, address: 'NYC' },
        destination: { lat: 40.7589, lng: -73.9851, address: 'Midtown' },
        seats_needed: 2,
        departure_time: '2024-06-17T09:00:00Z', // Wednesday
      },
    };

    const candidates = matcher.findCandidates(request, userProfiles);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(10);
    // Should be sorted by score
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].matchScore.score).toBeGreaterThanOrEqual(
        candidates[i].matchScore.score
      );
    }
  });
});

describe('ServiceMatcher', () => {
  const matcher = new ServiceMatcher();

  it('should match users with relevant service skills', () => {
    const request: any = {
      request_type: 'service',
      title: 'Fix leaking pipe',
      description: 'Need plumber urgently',
      urgency: 'high',
      category: 'home_repair',
      location: { lat: 40.7489, lng: -73.9680 },
      payload: {
        service_category: 'plumbing',
        skill_level_required: 'intermediate',
        estimated_duration_hours: 2,
        location_type: 'on_site',
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[1]); // Bob Plumber
    expect(score.score).toBeGreaterThan(70);
    expect(score.breakdown.skillScore).toBe(100); // Perfect skill match
  });

  it('should score tutoring requests with teacher skills highly', () => {
    const request: any = {
      request_type: 'service',
      title: 'Math tutoring',
      description: 'Need help with calculus',
      urgency: 'medium',
      category: 'tutoring',
      location: { lat: 40.7489, lng: -73.9680 },
      payload: {
        service_category: 'tutoring',
        skill_level_required: 'intermediate',
        estimated_duration_hours: 1.5,
        location_type: 'remote',
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[2]); // Carol Teacher
    expect(score.score).toBeGreaterThan(75);
    expect(score.breakdown.skillScore).toBe(100);
  });

  it('should filter candidates below minimum threshold', () => {
    const request: any = {
      request_type: 'service',
      title: 'Expert plumbing',
      description: 'Complex commercial plumbing',
      urgency: 'critical',
      category: 'home_repair',
      location: { lat: 40.7489, lng: -73.9680 },
      payload: {
        service_category: 'plumbing',
        skill_level_required: 'expert',
      },
    };

    const candidates = matcher.findCandidates(request, userProfiles);
    // All candidates should have score >= 40
    candidates.forEach((candidate) => {
      expect(candidate.matchScore.score).toBeGreaterThanOrEqual(40);
    });
  });
});

describe('EventMatcher', () => {
  const matcher = new EventMatcher();

  it('should match users available on event date', () => {
    const request: any = {
      request_type: 'event',
      title: 'Community cleanup',
      description: 'Beach cleanup event',
      urgency: 'medium',
      category: 'volunteer',
      location: { lat: 40.7306, lng: -73.9352 },
      payload: {
        event_type: 'community_cleanup',
        event_date: '2024-06-22T09:00:00Z', // Saturday morning
        event_duration_hours: 3,
        location: {
          address: 'Brooklyn Beach',
          lat: 40.7306,
          lng: -73.9352,
          is_virtual: false,
        },
        participants_needed: 20,
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[3]); // Dave Volunteer (available Sat/Sun)
    expect(score.score).toBeGreaterThan(60);
    expect(score.breakdown.availabilityScore).toBeGreaterThan(50);
  });

  it('should score virtual events with 100 location score', () => {
    const request: any = {
      request_type: 'event',
      title: 'Virtual workshop',
      description: 'Online training session',
      urgency: 'low',
      category: 'workshop',
      payload: {
        event_type: 'workshop',
        event_date: '2024-06-18T14:00:00Z', // Tuesday afternoon
        event_duration_hours: 2,
        location: {
          address: 'Zoom',
          is_virtual: true,
          virtual_link: 'https://zoom.us/meeting',
        },
        participants_needed: 50,
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[2]); // Carol Teacher
    expect(score.breakdown.locationScore).toBe(100);
  });

  it('should return up to 20 candidates for events', () => {
    const request: any = {
      request_type: 'event',
      title: 'Fundraiser',
      description: 'Charity fundraising event',
      urgency: 'medium',
      category: 'fundraiser',
      payload: {
        event_type: 'fundraiser',
        event_date: '2024-06-29T18:00:00Z',
        event_duration_hours: 4,
        location: {
          address: 'Community Center',
          lat: 40.7489,
          lng: -73.9680,
          is_virtual: false,
        },
        participants_needed: 100,
      },
    };

    const candidates = matcher.findCandidates(request, userProfiles);
    expect(candidates.length).toBeLessThanOrEqual(20);
  });
});

describe('BorrowMatcher', () => {
  const matcher = new BorrowMatcher();

  it('should match users likely to have tools', () => {
    const request: any = {
      request_type: 'borrow',
      title: 'Borrow power drill',
      description: 'Need drill for weekend project',
      urgency: 'low',
      category: 'tools',
      location: { lat: 40.7589, lng: -73.9851 },
      payload: {
        item_category: 'tools',
        duration_days: 3,
        condition_min: 'good',
      },
    };

    const score = matcher.calculateMatch(request, userProfiles[4]); // Eve Tools
    expect(score.score).toBeGreaterThan(60);
    expect(score.breakdown.skillScore).toBe(100); // Has tool-related skills
  });

  it('should prefer short-term borrows', () => {
    const shortRequest: any = {
      request_type: 'borrow',
      title: 'Borrow camera',
      description: 'Need for one day',
      urgency: 'medium',
      category: 'electronics',
      location: { lat: 40.7489, lng: -73.9680 },
      payload: {
        item_category: 'electronics',
        duration_days: 1,
      },
    };

    const longRequest: any = {
      ...shortRequest,
      payload: {
        ...shortRequest.payload,
        duration_days: 25,
      },
    };

    const shortScore = matcher.calculateMatch(shortRequest, userProfiles[0]);
    const longScore = matcher.calculateMatch(longRequest, userProfiles[0]);

    expect(shortScore.breakdown.availabilityScore).toBeGreaterThan(
      longScore.breakdown.availabilityScore!
    );
  });
});

describe('GenericMatcher', () => {
  const matcher = new GenericMatcher();

  it('should match skills from category mapping', () => {
    const request: any = {
      request_type: 'generic',
      title: 'Need help moving',
      description: 'Moving to new apartment',
      urgency: 'medium',
      category: 'moving',
      location: { lat: 40.7128, lng: -74.0060 },
    };

    const score = matcher.calculateMatch(request, userProfiles[0]); // Alice (has driving)
    expect(score.score).toBeGreaterThan(40);
  });

  it('should match keywords in title/description', () => {
    const request: any = {
      request_type: 'generic',
      title: 'Need tutoring help',
      description: 'Looking for someone to teach math',
      urgency: 'low',
      category: 'other',
      location: { lat: 40.7489, lng: -73.9680 },
    };

    const score = matcher.calculateMatch(request, userProfiles[2]); // Carol Teacher
    expect(score.breakdown.skillScore).toBeGreaterThan(50);
  });

  it('should handle requests without location gracefully', () => {
    const request: any = {
      request_type: 'generic',
      title: 'General help needed',
      description: 'Need assistance',
      urgency: 'low',
      category: 'other',
    };

    const score = matcher.calculateMatch(request, userProfiles[0]);
    expect(score.breakdown.locationScore).toBe(50); // Neutral score
  });
});

describe('Factory Functions', () => {
  it('should return correct matcher for request type', () => {
    expect(getMatcherForRequest('ride')).toBeInstanceOf(RideMatcher);
    expect(getMatcherForRequest('service')).toBeInstanceOf(ServiceMatcher);
    expect(getMatcherForRequest('event')).toBeInstanceOf(EventMatcher);
    expect(getMatcherForRequest('borrow')).toBeInstanceOf(BorrowMatcher);
    expect(getMatcherForRequest('generic')).toBeInstanceOf(GenericMatcher);
  });

  it('should find matches using factory function', () => {
    const request: any = {
      request_type: 'service',
      title: 'Plumbing repair',
      description: 'Fix sink',
      urgency: 'high',
      payload: {
        service_category: 'plumbing',
        location_type: 'on_site',
      },
    };

    const candidates = findMatches(request, userProfiles);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]).toHaveProperty('user');
    expect(candidates[0]).toHaveProperty('matchScore');
  });

  it('should calculate match score using factory function', () => {
    const request: any = {
      request_type: 'ride',
      title: 'Ride needed',
      description: 'Need a ride',
      urgency: 'medium',
      payload: {
        origin: { lat: 40.7128, lng: -74.0060, address: 'NYC' },
        destination: { lat: 40.7589, lng: -73.9851, address: 'Midtown' },
        seats_needed: 2,
        departure_time: '2024-06-15T10:00:00Z',
      },
    };

    const score = calculateMatchScore(request, userProfiles[0]);
    expect(score).toHaveProperty('score');
    expect(score).toHaveProperty('reasons');
    expect(score).toHaveProperty('breakdown');
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});
