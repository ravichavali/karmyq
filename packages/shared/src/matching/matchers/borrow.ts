/**
 * Borrow Request Matcher
 *
 * Matches borrow requests with potential lenders based on:
 * - Item availability (does user have the item category?)
 * - Duration compatibility (can lend for requested time period)
 * - Location proximity (for item pickup/return)
 * - Item condition requirements
 */

import { RequestMatcher, MatchScore, UserProfile, MatchCandidate } from '../types';
import { calculateDistance, scoreByDistance, applyUrgencyBonus } from '../utils';
import type { BorrowRequest } from '../../schemas/requests/borrow';

export class BorrowMatcher implements RequestMatcher {
  calculateMatch(request: BorrowRequest, user: UserProfile): MatchScore {
    const reasons: string[] = [];
    const breakdown: MatchScore['breakdown'] = {};

    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. Item Availability Score (40% weight) - MOST IMPORTANT
    // Check if user has skills/tags related to the item category
    const itemCategorySkills: Record<string, string[]> = {
      tools: ['handyman', 'construction', 'carpentry', 'plumbing', 'electrical'],
      electronics: ['tech', 'photography', 'gaming', 'audio_video'],
      kitchen: ['cooking', 'baking', 'catering'],
      books: ['reading', 'education', 'library'],
      sports: ['sports', 'fitness', 'outdoor'],
      camping: ['outdoor', 'hiking', 'camping', 'adventure'],
      party: ['event_planning', 'hosting', 'entertainment'],
      other: [],
    };

    const relevantSkills = itemCategorySkills[request.payload.item_category] || [];
    const hasItemLikely = relevantSkills.length === 0
      ? 50 // Neutral for 'other' category
      : relevantSkills.some((skill) =>
          user.skills.some((userSkill) => userSkill.toLowerCase().includes(skill.toLowerCase()))
        )
      ? 100
      : 30; // Low but not zero - they might still have the item

    breakdown.skillScore = hasItemLikely;
    totalScore += hasItemLikely * 0.4;
    maxPossibleScore += 100 * 0.4;

    if (hasItemLikely === 100) {
      reasons.push(`Likely has ${request.payload.item_category} items`);
    } else if (hasItemLikely === 30) {
      reasons.push(`May have ${request.payload.item_category} items`);
    }

    // 2. Duration Compatibility (25% weight)
    // In real implementation, check user's lending calendar
    // For now, score based on reasonableness of duration
    let durationScore = 100;
    if (request.payload.duration_days <= 7) {
      durationScore = 100; // Short-term borrows are easiest
      reasons.push(`Short-term borrow (${request.payload.duration_days} days)`);
    } else if (request.payload.duration_days <= 14) {
      durationScore = 80;
      reasons.push(`Medium-term borrow (${request.payload.duration_days} days)`);
    } else {
      durationScore = 60;
      reasons.push(`Long-term borrow (${request.payload.duration_days} days)`);
    }

    breakdown.availabilityScore = durationScore;
    totalScore += durationScore * 0.25;
    maxPossibleScore += 100 * 0.25;

    // 3. Location Score (20% weight) - Proximity for pickup/return
    // Note: location comes from database row, not schema payload
    if (user.location && (request as any).location?.lat && (request as any).location?.lng) {
      const distance = calculateDistance(
        user.location.lat,
        user.location.lng,
        (request as any).location.lat,
        (request as any).location.lng
      );

      breakdown.locationScore = scoreByDistance(distance);
      totalScore += breakdown.locationScore * 0.2;
      maxPossibleScore += 100 * 0.2;

      if (distance <= 5) {
        reasons.push(`Very close (${distance.toFixed(1)}km away)`);
      } else if (distance <= 20) {
        reasons.push(`${distance.toFixed(1)}km away for pickup`);
      } else {
        reasons.push(`${distance.toFixed(1)}km distance`);
      }
    } else {
      // No location data, give neutral score
      breakdown.locationScore = 50;
      totalScore += 50 * 0.2;
      maxPossibleScore += 100 * 0.2;
    }

    // 4. Item Condition (15% weight)
    // In real implementation, check user's item inventory and ratings
    // For now, assume most people maintain items in 'good' condition
    let conditionScore = 70; // Default assumption

    if (!request.payload.condition_min) {
      conditionScore = 100; // No specific requirement
      reasons.push('Any condition accepted');
    } else {
      const conditionValues = { fair: 1, good: 2, like_new: 3, new: 4 };
      const requiredCondition = conditionValues[request.payload.condition_min];

      // Assume user maintains items in 'good' condition (value 2)
      if (requiredCondition <= 2) {
        conditionScore = 100;
        reasons.push(`Can meet ${request.payload.condition_min} condition`);
      } else {
        conditionScore = 50;
        reasons.push(`${request.payload.condition_min} condition required`);
      }
    }

    breakdown.preferenceScore = conditionScore;
    totalScore += conditionScore * 0.15;
    maxPossibleScore += 100 * 0.15;

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

  findCandidates(request: BorrowRequest, users: UserProfile[]): MatchCandidate[] {
    return users
      .map((user) => ({
        user,
        matchScore: this.calculateMatch(request, user),
      }))
      .filter((candidate) => candidate.matchScore.score >= 35)
      .sort((a, b) => b.matchScore.score - a.matchScore.score)
      .slice(0, 15); // Borrowing usually needs fewer candidates
  }
}
