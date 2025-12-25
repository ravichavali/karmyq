/**
 * Matching Utility Functions
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate match score based on distance
 * - Within 5km: 100 points
 * - 5-10km: 80 points
 * - 10-20km: 60 points
 * - 20-50km: 40 points
 * - 50km+: 20 points
 */
export function scoreByDistance(distanceKm: number): number {
  if (distanceKm <= 5) return 100;
  if (distanceKm <= 10) return 80;
  if (distanceKm <= 20) return 60;
  if (distanceKm <= 50) return 40;
  return 20;
}

/**
 * Calculate skill match score
 * Returns percentage of required skills that user has
 */
export function scoreBySkills(
  requiredSkills: string[],
  userSkills: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (requiredSkills.length === 0) {
    return { score: 100, matched: [], missing: [] };
  }

  const matched = requiredSkills.filter((skill) =>
    userSkills.some((userSkill) =>
      userSkill.toLowerCase().includes(skill.toLowerCase())
    )
  );

  const missing = requiredSkills.filter((skill) => !matched.includes(skill));
  const score = (matched.length / requiredSkills.length) * 100;

  return { score, matched, missing };
}

/**
 * Calculate schedule compatibility score
 * Checks if user is available on the required days/times
 */
export function scoreBySchedule(
  requiredDays: string[],
  requiredTime: string,
  userAvailability?: { days: string[]; timeOfDay: string[] }
): number {
  if (!userAvailability) return 50; // Neutral if no availability data

  let score = 0;

  // Check day compatibility (60% weight)
  if (requiredDays.length > 0 && userAvailability.days.length > 0) {
    const matchingDays = requiredDays.filter((day) =>
      userAvailability.days.includes(day)
    );
    score += (matchingDays.length / requiredDays.length) * 60;
  } else {
    score += 30; // Neutral
  }

  // Check time compatibility (40% weight)
  if (userAvailability.timeOfDay.includes(requiredTime)) {
    score += 40;
  } else if (userAvailability.timeOfDay.includes('flexible')) {
    score += 30;
  } else {
    score += 10;
  }

  return score;
}

/**
 * Apply urgency bonus
 * High urgency requests get priority in matching
 */
export function applyUrgencyBonus(urgency: string, baseScore: number): number {
  const bonuses = {
    high: 15,
    medium: 5,
    low: 0,
  };

  return baseScore + (bonuses[urgency as keyof typeof bonuses] || 0);
}
