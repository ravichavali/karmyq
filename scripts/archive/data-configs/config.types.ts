/**
 * Configuration schema for data generation
 */

export interface KnownUser {
  email: string;
  name: string;
  role: 'super_helper' | 'new_member' | 'moderator' | 'requester' | 'inactive' | 'connector' | 'teacher' | 'catalyst' | 'caregiver' | 'reliable';
  karma: number;
  exchanges: number;
  joinedDaysAgo: number;
  communities?: string[];
  skills?: string[];
  requestToOfferRatio?: number;
  lastActiveDaysAgo?: number;
  invitedUsers?: number;
  completionRate?: number;
}

export interface DataConfig {
  users: number;
  communities: number;
  requestsPerUserAvg: number;
  offersPerUserAvg: number;
  matchesRate: number;
  invitationRate: number;
}

export interface TimelineConfig {
  ageInDays: number;      // How far back to start timeline (0 = today)
  spreadInDays: number;   // How much to spread data across time
}

export interface FeaturesConfig {
  polymorphicRequests: boolean;
  socialGraph: boolean;
  reputation: boolean;
  knownTestUsers: boolean;
}

export interface GenerationConfig {
  mode: 'dev' | 'test' | 'staging' | 'production';
  description: string;
  seed: number | null;    // null = random seed
  data: DataConfig;
  timeline: TimelineConfig;
  features: FeaturesConfig;
  knownUsers: KnownUser[];
}
