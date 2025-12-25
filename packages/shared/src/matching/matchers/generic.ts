/**
 * Generic Request Matcher
 *
 * Fallback matcher for traditional help requests that don't fit specialized types.
 * Matches based on:
 * - Category/keyword matching with user skills
 * - Location proximity (if available)
 * - General availability
 * - Description keyword analysis
 */

import { RequestMatcher, MatchScore, UserProfile, MatchCandidate } from '../types';
import { calculateDistance, scoreByDistance, scoreBySkills, applyUrgencyBonus } from '../utils';
import type { GenericRequest } from '../../schemas/requests/generic';

export class GenericMatcher implements RequestMatcher {
  /**
   * Category to skills mapping for generic requests
   */
  private readonly categoryToSkills: Record<string, string[]> = {
    transport: ['driving', 'vehicle', 'transportation'],
    moving: ['moving', 'lifting', 'physical_labor', 'driving'],
    errands: ['running_errands', 'shopping', 'transportation'],
    grocery_shopping: ['shopping', 'errands'],
    pet_care: ['pet_care', 'animal_care', 'pets'],
    childcare: ['childcare', 'babysitting', 'children', 'teaching'],
    elder_care: ['elder_care', 'caregiving', 'senior_care', 'nursing'],
    home_repair: ['handyman', 'home_repair', 'maintenance', 'construction'],
    tech_support: ['tech_support', 'computer', 'technology', 'IT'],
    tutoring: ['tutoring', 'teaching', 'education'],
    language_exchange: ['language', 'teaching', 'translation'],
    legal_advice: ['legal', 'law', 'attorney'],
    emotional_support: ['counseling', 'mental_health', 'listening', 'support'],
    other: [],
  };

  calculateMatch(request: GenericRequest, user: UserProfile): MatchScore {
    const reasons: string[] = [];
    const breakdown: MatchScore['breakdown'] = {};

    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. Skill/Category Match (40% weight)
    // Extract keywords from title and description for matching
    const requestText = `${request.title} ${request.description}`.toLowerCase();
    const categorySkills = this.categoryToSkills[(request as any).category] || [];

    let skillScore = 0;
    const matchedSkills: string[] = [];

    // Check if user has skills matching the category
    if (categorySkills.length > 0) {
      const skillMatch = scoreBySkills(categorySkills, user.skills);
      skillScore = skillMatch.score;
      matchedSkills.push(...skillMatch.matched);
    }

    // Also check for keyword matches in user skills
    if (skillScore < 100) {
      for (const skill of user.skills) {
        const skillLower = skill.toLowerCase();
        if (requestText.includes(skillLower)) {
          skillScore = Math.max(skillScore, 80);
          if (!matchedSkills.includes(skill)) {
            matchedSkills.push(skill);
          }
        }
      }
    }

    // If no specific match, give moderate score (anyone can help)
    if (skillScore === 0) {
      skillScore = 50;
    }

    breakdown.skillScore = skillScore;
    totalScore += skillScore * 0.4;
    maxPossibleScore += 100 * 0.4;

    if (matchedSkills.length > 0) {
      reasons.push(`Matches skills: ${matchedSkills.slice(0, 2).join(', ')}`);
    } else if (skillScore === 50) {
      reasons.push('Can provide general help');
    }

    // 2. Location Score (30% weight)
    // Note: location comes from database row, not schema payload
    if (user.location && (request as any).location?.lat && (request as any).location?.lng) {
      const distance = calculateDistance(
        user.location.lat,
        user.location.lng,
        (request as any).location.lat,
        (request as any).location.lng
      );

      breakdown.locationScore = scoreByDistance(distance);
      totalScore += breakdown.locationScore * 0.3;
      maxPossibleScore += 100 * 0.3;

      if (distance <= 5) {
        reasons.push(`Very close (${distance.toFixed(1)}km)`);
      } else if (distance <= 20) {
        reasons.push(`${distance.toFixed(1)}km away`);
      } else {
        reasons.push(`${distance.toFixed(1)}km distance`);
      }
    } else {
      // No location data, give neutral score
      breakdown.locationScore = 50;
      totalScore += 50 * 0.3;
      maxPossibleScore += 100 * 0.3;
    }

    // 3. Availability Score (30% weight)
    // Check if user has general availability
    if (user.availability) {
      // For generic requests, any availability is good
      const hasAvailability = user.availability.days && user.availability.days.length > 0;
      const availabilityScore = hasAvailability ? 80 : 60;

      breakdown.availabilityScore = availabilityScore;
      totalScore += availabilityScore * 0.3;
      maxPossibleScore += 100 * 0.3;

      if (hasAvailability) {
        reasons.push(`Available ${user.availability.days.length} days/week`);
      }
    } else {
      // No availability data, assume moderate availability
      breakdown.availabilityScore = 60;
      totalScore += 60 * 0.3;
      maxPossibleScore += 100 * 0.3;
    }

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

  findCandidates(request: GenericRequest, users: UserProfile[]): MatchCandidate[] {
    return users
      .map((user) => ({
        user,
        matchScore: this.calculateMatch(request, user),
      }))
      .filter((candidate) => candidate.matchScore.score >= 30)
      .sort((a, b) => b.matchScore.score - a.matchScore.score)
      .slice(0, 10); // Generic requests get top 10 matches
  }
}
