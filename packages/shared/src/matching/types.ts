/**
 * Matching Algorithm Types
 *
 * Defines the interface for type-specific matching algorithms
 * Each request type can have custom matching logic based on its payload
 */

export interface MatchScore {
  score: number; // 0-100, higher is better
  reasons: string[]; // Human-readable reasons for the match
  breakdown: {
    locationScore?: number;
    skillScore?: number;
    availabilityScore?: number;
    preferenceScore?: number;
    urgencyBonus?: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  location?: {
    lat: number;
    lng: number;
  };
  skills: string[];
  availability?: {
    days: string[];
    timeOfDay: string[];
  };
  preferences?: {
    maxDistance?: number; // in km
    vehicleType?: string;
    certifications?: string[];
  };
}

export interface MatchCandidate {
  user: UserProfile;
  matchScore: MatchScore;
}

/**
 * Base matcher interface
 * Each request type implements this
 */
export interface RequestMatcher {
  calculateMatch(request: any, user: UserProfile): MatchScore;
  findCandidates(request: any, users: UserProfile[]): MatchCandidate[];
}
