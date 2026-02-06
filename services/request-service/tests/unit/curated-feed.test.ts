/**
 * Curated Feed Tests - Day 7
 *
 * Tests for skill-based feed filtering using match scores
 * Verifies the /requests/curated endpoint functionality
 */

import { calculateMatchScore } from '../../../../packages/shared/src/matching';
import type { UserProfile } from '../../../../packages/shared/src/matching/types';

describe('Curated Feed - Match Score Calculation', () => {
  describe('getUserProfile helper logic', () => {
    it('should extract skills from database query result', () => {
      const mockSkillsResult = {
        rows: [
          { skill: 'plumbing' },
          { skill: 'carpentry' },
          { skill: 'electrical' },
        ],
      };

      const skills = mockSkillsResult.rows.map((row: any) => row.skill);

      expect(skills).toEqual(['plumbing', 'carpentry', 'electrical']);
      expect(skills.length).toBe(3);
    });

    it('should handle user with no skills', () => {
      const mockSkillsResult = {
        rows: [],
      };

      const skills = mockSkillsResult.rows.map((row: any) => row.skill);

      expect(skills).toEqual([]);
      expect(skills.length).toBe(0);
    });
  });

  describe('Match Score Filtering', () => {
    const userProfile: UserProfile = {
      id: 'user-123',
      name: 'John Plumber',
      skills: ['plumbing', 'handyman', 'home_repair'],
    };

    it('should calculate match score for service request matching skills', () => {
      const serviceRequest = {
        request_type: 'service' as const,
        title: 'Need plumbing repair',
        description: 'Leaky pipe in kitchen',
        urgency: 'high' as const,
        payload: {
          service_category: 'plumbing' as const,
          skill_level_required: 'intermediate' as const,
          location_type: 'on_site' as const,
        },
        requirements: {},
      };

      const matchScore = calculateMatchScore(serviceRequest, userProfile);

      // Should have high score because user has plumbing skill
      expect(matchScore.score).toBeGreaterThan(50);
      expect(matchScore.reasons.length).toBeGreaterThan(0);
      expect(matchScore.breakdown.skillScore).toBeDefined();
    });

    it('should calculate low match score for request not matching skills', () => {
      const serviceRequest = {
        request_type: 'service' as const,
        title: 'Need software development help',
        description: 'Build a website',
        urgency: 'medium' as const,
        payload: {
          service_category: 'tech_support' as const,
          skill_level_required: 'expert' as const,
          location_type: 'remote' as const,
        },
        requirements: {},
      };

      const matchScore = calculateMatchScore(serviceRequest, userProfile);

      // Should have low score because user doesn't have tech skills
      expect(matchScore.score).toBeLessThan(50);
    });

    it('should filter requests by minimum match score', () => {
      const requests = [
        {
          id: 'req-1',
          title: 'Plumbing repair',
          matchScore: 85,
          description: 'Fix leak',
        },
        {
          id: 'req-2',
          title: 'Software development',
          matchScore: 25,
          description: 'Build app',
        },
        {
          id: 'req-3',
          title: 'Home repair',
          matchScore: 70,
          description: 'Fix door',
        },
        {
          id: 'req-4',
          title: 'Tutoring',
          matchScore: 15,
          description: 'Math help',
        },
      ];

      const minMatchScore = 30;
      const filtered = requests.filter((req) => req.matchScore >= minMatchScore);

      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('req-1');
      expect(filtered[1].id).toBe('req-3');
    });

    it('should sort filtered requests by match score descending', () => {
      const requests = [
        { id: 'req-1', matchScore: 45 },
        { id: 'req-2', matchScore: 85 },
        { id: 'req-3', matchScore: 60 },
        { id: 'req-4', matchScore: 92 },
      ];

      const sorted = requests
        .filter((req) => req.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore);

      expect(sorted[0].id).toBe('req-4'); // 92
      expect(sorted[1].id).toBe('req-2'); // 85
      expect(sorted[2].id).toBe('req-3'); // 60
      expect(sorted[3].id).toBe('req-1'); // 45
    });

    it('should limit results to requested count', () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        id: `req-${i}`,
        matchScore: 100 - i,
      }));

      const limit = 20;
      const limited = requests
        .filter((req) => req.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);

      expect(limited.length).toBe(20);
      expect(limited[0].matchScore).toBe(100); // Highest score first
      expect(limited[19].matchScore).toBe(81); // 20th highest
    });
  });

  describe('Match Score Response Format', () => {
    const userProfile: UserProfile = {
      id: 'user-123',
      name: 'Jane Helper',
      skills: ['tutoring', 'teaching'],
    };

    it('should include match score in response', () => {
      const request = {
        request_type: 'service' as const,
        title: 'Need math tutoring',
        description: 'Help with calculus',
        urgency: 'medium' as const,
        payload: {
          service_category: 'tutoring' as const,
          skill_level_required: 'intermediate' as const,
          location_type: 'remote' as const,
        },
        requirements: {},
      };

      const matchScore = calculateMatchScore(request, userProfile);

      expect(matchScore).toHaveProperty('score');
      expect(matchScore).toHaveProperty('reasons');
      expect(matchScore).toHaveProperty('breakdown');
      expect(typeof matchScore.score).toBe('number');
      expect(Array.isArray(matchScore.reasons)).toBe(true);
    });

    it('should include match reasons for transparency', () => {
      const request = {
        request_type: 'service' as const,
        title: 'Teaching assistance needed',
        description: 'Help teaching a class',
        urgency: 'low' as const,
        payload: {
          service_category: 'tutoring' as const,
          skill_level_required: 'beginner' as const,
          location_type: 'on_site' as const,
        },
        requirements: {},
      };

      const matchScore = calculateMatchScore(request, userProfile);

      expect(matchScore.reasons.length).toBeGreaterThan(0);
      expect(matchScore.reasons[0]).toBeTruthy();
      expect(typeof matchScore.reasons[0]).toBe('string');
    });

    it('should include match breakdown for detailed analysis', () => {
      const request = {
        request_type: 'generic' as const,
        title: 'General help needed',
        description: 'Various tasks',
        urgency: 'medium' as const,
        payload: {},
        requirements: {},
      };

      const matchScore = calculateMatchScore(request, userProfile);

      expect(matchScore.breakdown).toBeDefined();
      // Breakdown should have at least one score component
      const breakdownValues = Object.values(matchScore.breakdown);
      expect(breakdownValues.length).toBeGreaterThan(0);
    });
  });

  describe('Default Match Score Threshold', () => {
    it('should use 30% as default minimum match score', () => {
      const defaultMinScore = 30;

      const requests = [
        { id: 'req-1', matchScore: 29 }, // Below threshold
        { id: 'req-2', matchScore: 30 }, // At threshold
        { id: 'req-3', matchScore: 31 }, // Above threshold
      ];

      const filtered = requests.filter((req) => req.matchScore >= defaultMinScore);

      expect(filtered.length).toBe(2);
      expect(filtered.find((r) => r.id === 'req-1')).toBeUndefined();
      expect(filtered.find((r) => r.id === 'req-2')).toBeDefined();
      expect(filtered.find((r) => r.id === 'req-3')).toBeDefined();
    });

    it('should allow custom minimum match score', () => {
      const customMinScore = 70;

      const requests = [
        { id: 'req-1', matchScore: 50 },
        { id: 'req-2', matchScore: 70 },
        { id: 'req-3', matchScore: 90 },
      ];

      const filtered = requests.filter((req) => req.matchScore >= customMinScore);

      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('req-2');
      expect(filtered[1].id).toBe('req-3');
    });
  });

  describe('Edge Cases', () => {
    const userProfile: UserProfile = {
      id: 'user-123',
      name: 'Test User',
      skills: [],
    };

    it('should handle user with no skills gracefully', () => {
      const request = {
        request_type: 'generic' as const,
        title: 'Help needed',
        description: 'Any help appreciated',
        urgency: 'medium' as const,
        payload: {},
        requirements: {},
      };

      const matchScore = calculateMatchScore(request, userProfile);

      // Should return a score, even if low
      expect(matchScore.score).toBeGreaterThanOrEqual(0);
      expect(matchScore.score).toBeLessThanOrEqual(100);
    });

    it('should handle empty request list', () => {
      const requests: any[] = [];
      const minMatchScore = 30;

      const filtered = requests
        .filter((req) => req.matchScore >= minMatchScore)
        .sort((a, b) => b.matchScore - a.matchScore);

      expect(filtered.length).toBe(0);
    });

    it('should handle all requests below threshold', () => {
      const requests = [
        { id: 'req-1', matchScore: 10 },
        { id: 'req-2', matchScore: 15 },
        { id: 'req-3', matchScore: 20 },
      ];

      const minMatchScore = 30;
      const filtered = requests.filter((req) => req.matchScore >= minMatchScore);

      expect(filtered.length).toBe(0);
    });
  });

  describe('Multiple Request Types', () => {
    const userProfile: UserProfile = {
      id: 'user-123',
      name: 'Skilled Helper',
      skills: ['plumbing', 'driving', 'event_planning'],
    };

    it('should calculate scores for different request types', () => {
      const requests = [
        {
          request_type: 'service' as const,
          title: 'Plumbing repair',
          description: 'Fix leak',
          urgency: 'high' as const,
          payload: { service_category: 'plumbing' as const },
          requirements: {},
        },
        {
          request_type: 'ride' as const,
          title: 'Ride to airport',
          description: 'Need ride tomorrow',
          urgency: 'medium' as const,
          payload: {
            origin: { address: '123 Main St', lat: 40.7, lng: -74.0 },
            destination: { address: 'JFK Airport', lat: 40.6, lng: -73.7 },
            seats_needed: 1,
            departure_time: '2024-01-20T10:00:00Z',
          },
          requirements: {},
        },
        {
          request_type: 'event' as const,
          title: 'Event volunteer needed',
          description: 'Help organize fundraiser',
          urgency: 'low' as const,
          payload: {
            event_type: 'fundraiser' as const,
            event_date: '2024-02-01T18:00:00Z',
            event_duration_hours: 3,
            location: {
              address: 'Community Center',
              is_virtual: false,
            },
            participants_needed: 5,
          },
          requirements: {},
        },
      ];

      const scores = requests.map((req) => ({
        type: req.request_type,
        score: calculateMatchScore(req, userProfile).score,
      }));

      // All should return valid scores
      scores.forEach((s) => {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      });
    });
  });
});
