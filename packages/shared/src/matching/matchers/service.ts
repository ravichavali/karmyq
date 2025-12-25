/**
 * Service Request Matcher
 *
 * Matches service requests with skilled helpers based on:
 * - Skill match (primary factor)
 * - Skill level requirements
 * - Location (for on-site services)
 * - Budget compatibility
 * - Availability/schedule
 */

import { RequestMatcher, MatchScore, UserProfile, MatchCandidate } from '../types';
import { calculateDistance, scoreByDistance, scoreBySkills, scoreBySchedule, applyUrgencyBonus } from '../utils';
import type { ServiceRequest } from '../../schemas/requests/service';

export class ServiceMatcher implements RequestMatcher {
  // Mapping of service categories to required skills
  private readonly serviceToSkills: Record<string, string[]> = {
    plumbing: ['plumbing', 'home_repair', 'handyman'],
    electrical: ['electrical', 'home_repair', 'handyman'],
    carpentry: ['carpentry', 'woodworking', 'home_repair', 'handyman'],
    tutoring: ['tutoring', 'teaching', 'education'],
    consulting: ['consulting', 'business', 'professional_advice'],
    repair: ['repair', 'handyman', 'fixing'],
    cleaning: ['cleaning', 'organizing', 'housekeeping'],
    gardening: ['gardening', 'landscaping', 'plants'],
    pet_care: ['pet_care', 'animals', 'veterinary'],
    childcare: ['childcare', 'babysitting', 'children'],
    elder_care: ['elder_care', 'caregiving', 'nursing'],
    tech_support: ['tech_support', 'IT', 'computer', 'coding'],
    legal: ['legal', 'law', 'attorney'],
    financial: ['financial', 'accounting', 'finance'],
  };

  calculateMatch(request: ServiceRequest, user: UserProfile): MatchScore {
    const reasons: string[] = [];
    const breakdown: MatchScore['breakdown'] = {};

    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. Skill Match (50% weight) - MOST IMPORTANT
    const requiredSkills = this.serviceToSkills[request.payload.service_category] || [];
    const skillMatch = scoreBySkills(requiredSkills, user.skills);

    breakdown.skillScore = skillMatch.score;
    totalScore += skillMatch.score * 0.5;
    maxPossibleScore += 100 * 0.5;

    if (skillMatch.score === 100) {
      reasons.push(`Perfect skill match (${skillMatch.matched.join(', ')})`);
    } else if (skillMatch.score >= 70) {
      reasons.push(`Good skill match (${skillMatch.matched.join(', ')})`);
    } else if (skillMatch.score >= 40) {
      reasons.push(`Partial skill match (missing: ${skillMatch.missing.join(', ')})`);
    } else {
      reasons.push(`Low skill match (needs: ${skillMatch.missing.join(', ')})`);
    }

    // 2. Skill Level (15% weight)
    if (request.payload.skill_level_required) {
      const skillLevelScores: Record<string, number> = {
        beginner: 100, // Anyone can help beginners
        intermediate: 70, // Needs some experience
        expert: 40, // Needs verification
      };

      const levelScore = skillLevelScores[request.payload.skill_level_required] || 50;
      totalScore += levelScore * 0.15;
      maxPossibleScore += 100 * 0.15;

      if (request.payload.skill_level_required === 'expert') {
        reasons.push('Requires expert-level skills');
      }
    }

    // 3. Location Score (20% weight) - Only for on-site services
    if (request.payload.location_type === 'on_site' && user.location) {
      // Assume service location is user's location (in real app, would be in request)
      // For now, give average score
      breakdown.locationScore = 60;
      totalScore += 60 * 0.2;
      maxPossibleScore += 100 * 0.2;
      reasons.push('On-site service required');
    } else if (request.payload.location_type === 'remote') {
      breakdown.locationScore = 100; // Perfect for remote
      totalScore += 100 * 0.2;
      maxPossibleScore += 100 * 0.2;
      reasons.push('Remote service (location flexible)');
    }

    // 4. Schedule Compatibility (15% weight)
    if (request.payload.preferred_schedule && user.availability) {
      const scheduleScore = scoreBySchedule(
        request.payload.preferred_schedule.days || [],
        request.payload.preferred_schedule.time_of_day || 'flexible',
        user.availability
      );

      breakdown.availabilityScore = scheduleScore;
      totalScore += scheduleScore * 0.15;
      maxPossibleScore += 100 * 0.15;

      if (scheduleScore >= 80) {
        reasons.push('Great schedule compatibility');
      }
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

  findCandidates(request: ServiceRequest, users: UserProfile[]): MatchCandidate[] {
    return users
      .map((user) => ({
        user,
        matchScore: this.calculateMatch(request, user),
      }))
      .filter((candidate) => candidate.matchScore.score >= 40) // Higher threshold for services
      .sort((a, b) => b.matchScore.score - a.matchScore.score)
      .slice(0, 10);
  }
}
