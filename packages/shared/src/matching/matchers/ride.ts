/**
 * Ride Request Matcher
 *
 * Matches ride requests with potential drivers based on:
 * - Proximity to origin/destination
 * - Vehicle capacity
 * - Departure time compatibility
 * - Preferences (pet-friendly, etc.)
 */

import { RequestMatcher, MatchScore, UserProfile, MatchCandidate } from '../types';
import { calculateDistance, scoreByDistance, applyUrgencyBonus } from '../utils';
import type { RideRequest } from '../../schemas/requests/ride';

export class RideMatcher implements RequestMatcher {
  calculateMatch(request: RideRequest, user: UserProfile): MatchScore {
    const reasons: string[] = [];
    const breakdown: MatchScore['breakdown'] = {};

    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. Location Score (40% weight) - Distance from user to origin
    if (user.location && request.payload.origin) {
      const distanceToOrigin = calculateDistance(
        user.location.lat,
        user.location.lng,
        request.payload.origin.lat,
        request.payload.origin.lng
      );

      breakdown.locationScore = scoreByDistance(distanceToOrigin);
      totalScore += breakdown.locationScore * 0.4;
      maxPossibleScore += 100 * 0.4;

      if (distanceToOrigin <= 5) {
        reasons.push(`Very close to pickup location (${distanceToOrigin.toFixed(1)}km)`);
      } else if (distanceToOrigin <= 10) {
        reasons.push(`Near pickup location (${distanceToOrigin.toFixed(1)}km)`);
      } else {
        reasons.push(`${distanceToOrigin.toFixed(1)}km from pickup location`);
      }
    }

    // 2. Vehicle Capacity (20% weight)
    if (user.preferences?.vehicleType) {
      // Assume vehicle types have default capacities
      const vehicleCapacities: Record<string, number> = {
        sedan: 4,
        suv: 6,
        van: 8,
        truck: 2,
      };

      const userCapacity = vehicleCapacities[user.preferences.vehicleType] || 4;
      const canAccommodate = userCapacity >= request.payload.seats_needed;

      if (canAccommodate) {
        breakdown.preferenceScore = 100;
        totalScore += 100 * 0.2;
        reasons.push(`Vehicle can accommodate ${request.payload.seats_needed} passengers`);
      } else {
        breakdown.preferenceScore = 30;
        totalScore += 30 * 0.2;
        reasons.push(`Vehicle may be too small (needs ${request.payload.seats_needed} seats)`);
      }
      maxPossibleScore += 100 * 0.2;
    }

    // 3. Availability Score (20% weight) - Based on departure time
    // In real implementation, check user's calendar/availability
    // For now, assume available if they have availability data
    if (user.availability) {
      const departureDate = new Date(request.payload.departure_time);
      const dayOfWeek = departureDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      const isAvailable = user.availability.days.includes(dayOfWeek);
      breakdown.availabilityScore = isAvailable ? 100 : 30;
      totalScore += breakdown.availabilityScore * 0.2;
      maxPossibleScore += 100 * 0.2;

      if (isAvailable) {
        reasons.push('Available on requested day');
      }
    }

    // 4. Preference Matching (20% weight)
    let preferenceMatches = 0;
    let totalPreferences = 0;

    if (request.payload.preferences) {
      if (request.payload.preferences.pet_friendly !== undefined) {
        totalPreferences++;
        // In real implementation, check if user allows pets
        // For now, give partial credit
        preferenceMatches += 0.5;
      }

      if (request.payload.preferences.wheelchair_accessible !== undefined) {
        totalPreferences++;
        // Check if user's vehicle is wheelchair accessible
        preferenceMatches += 0.5;
      }

      if (totalPreferences > 0) {
        const prefScore = (preferenceMatches / totalPreferences) * 100;
        totalScore += prefScore * 0.2;
        maxPossibleScore += 100 * 0.2;
      }
    }

    // Normalize score to 0-100
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

  findCandidates(request: RideRequest, users: UserProfile[]): MatchCandidate[] {
    return users
      .map((user) => ({
        user,
        matchScore: this.calculateMatch(request, user),
      }))
      .filter((candidate) => candidate.matchScore.score >= 30) // Minimum threshold
      .sort((a, b) => b.matchScore.score - a.matchScore.score)
      .slice(0, 10); // Top 10 matches
  }
}
