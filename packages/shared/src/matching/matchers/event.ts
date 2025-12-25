/**
 * Event Request Matcher
 *
 * Matches event requests with potential volunteers/participants based on:
 * - Location proximity (for physical events)
 * - Event type interest
 * - Schedule availability
 * - Role requirements
 */

import { RequestMatcher, MatchScore, UserProfile, MatchCandidate } from '../types';
import { calculateDistance, scoreByDistance, scoreBySchedule, applyUrgencyBonus } from '../utils';
import type { EventRequest } from '../../schemas/requests/event';

export class EventMatcher implements RequestMatcher {
  calculateMatch(request: EventRequest, user: UserProfile): MatchScore {
    const reasons: string[] = [];
    const breakdown: MatchScore['breakdown'] = {};

    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. Location Score (35% weight) - For physical events
    if (!request.payload.location.is_virtual && user.location) {
      if (request.payload.location.lat && request.payload.location.lng) {
        const distance = calculateDistance(
          user.location.lat,
          user.location.lng,
          request.payload.location.lat,
          request.payload.location.lng
        );

        breakdown.locationScore = scoreByDistance(distance);
        totalScore += breakdown.locationScore * 0.35;
        maxPossibleScore += 100 * 0.35;

        if (distance <= 10) {
          reasons.push(`Event nearby (${distance.toFixed(1)}km away)`);
        } else {
          reasons.push(`${distance.toFixed(1)}km from event location`);
        }
      } else {
        // No coordinates, give neutral score
        breakdown.locationScore = 50;
        totalScore += 50 * 0.35;
        maxPossibleScore += 100 * 0.35;
      }
    } else if (request.payload.location.is_virtual) {
      // Virtual events - location doesn't matter
      breakdown.locationScore = 100;
      totalScore += 100 * 0.35;
      maxPossibleScore += 100 * 0.35;
      reasons.push('Virtual event (attend from anywhere)');
    }

    // 2. Schedule Availability (40% weight) - CRITICAL
    const eventDate = new Date(request.payload.event_date);
    const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hour = eventDate.getHours();

    let timeOfDay: string;
    if (hour < 12) {
      timeOfDay = 'morning';
    } else if (hour < 17) {
      timeOfDay = 'afternoon';
    } else {
      timeOfDay = 'evening';
    }

    if (user.availability) {
      const scheduleScore = scoreBySchedule([dayOfWeek], timeOfDay, user.availability);
      breakdown.availabilityScore = scheduleScore;
      totalScore += scheduleScore * 0.4;
      maxPossibleScore += 100 * 0.4;

      if (scheduleScore >= 80) {
        reasons.push(`Available on ${eventDate.toLocaleDateString()}`);
      } else if (scheduleScore >= 50) {
        reasons.push('Potentially available');
      } else {
        reasons.push('May have schedule conflict');
      }
    }

    // 3. Role Match (15% weight)
    if (request.payload.roles && request.payload.roles.length > 0) {
      // Check if user has skills matching any roles
      let roleScore = 0;
      const matchedRoles: string[] = [];

      for (const role of request.payload.roles) {
        const roleKeywords = role.role_name.toLowerCase().split(' ');
        const hasMatchingSkill = roleKeywords.some((keyword) =>
          user.skills.some((skill) => skill.toLowerCase().includes(keyword))
        );

        if (hasMatchingSkill) {
          roleScore = 100;
          matchedRoles.push(role.role_name);
        }
      }

      if (roleScore === 0) {
        roleScore = 50; // Neutral if no specific match
      }

      breakdown.skillScore = roleScore;
      totalScore += roleScore * 0.15;
      maxPossibleScore += 100 * 0.15;

      if (matchedRoles.length > 0) {
        reasons.push(`Good fit for: ${matchedRoles.join(', ')}`);
      }
    }

    // 4. Preference Score (10% weight) - Event type interest
    // In real implementation, track user's event participation history
    // For now, give average score
    const preferenceScore = 60;
    breakdown.preferenceScore = preferenceScore;
    totalScore += preferenceScore * 0.1;
    maxPossibleScore += 100 * 0.1;

    // Normalize score
    const normalizedScore = maxPossibleScore > 0
      ? (totalScore / maxPossibleScore) * 100
      : 50;

    // Apply urgency bonus
    const finalScore = Math.min(100, applyUrgencyBonus(request.urgency, normalizedScore));
    breakdown.urgencyBonus = finalScore - normalizedScore;

    return {
      score: Math.round(finalScore),
      reasons,
      breakdown,
    };
  }

  findCandidates(request: EventRequest, users: UserProfile[]): MatchCandidate[] {
    return users
      .map((user) => ({
        user,
        matchScore: this.calculateMatch(request, user),
      }))
      .filter((candidate) => candidate.matchScore.score >= 30)
      .sort((a, b) => b.matchScore.score - a.matchScore.score)
      .slice(0, 20); // Events can have more participants
  }
}
