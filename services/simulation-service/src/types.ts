/**
 * Types for synthetic user simulation system
 */

export interface ActionWeight {
  weight: number;           // Probability weight (0-1)
  avgPerSession: number;    // Average actions per session
}

export interface TimeRange {
  min: number;
  max: number;
  unit: 'seconds' | 'minutes' | 'hours';
}

export interface UserProfile {
  name: string;
  frequency: 'low' | 'medium' | 'high';
  actions: {
    browseRequests?: ActionWeight;
    createRequests?: ActionWeight;
    offerHelp?: ActionWeight;
    acceptOffers?: ActionWeight;
    sendMessages?: ActionWeight;
    completeMatches?: ActionWeight;
    viewProfiles?: ActionWeight;
    createCommunities?: ActionWeight;
    inviteMembers?: ActionWeight;
    moderateContent?: ActionWeight;
  };
  sessionDuration: TimeRange;
  responseTime: TimeRange;
}

export interface SimulatedUser {
  id: string;
  email: string;
  name: string;
  profile: UserProfile;
  token?: string;
  currentSession?: UserSession;
}

export interface UserSession {
  user: SimulatedUser;
  startedAt: Date;
  actions: ActionLog[];
  isActive: boolean;
}

export interface ActionLog {
  type: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  error?: string;
}

export interface SimulationConfig {
  enabled: boolean;
  environment: 'dev' | 'staging' | 'production';
  schedule: {
    type: 'continuous' | 'cron';
    businessHours: {
      start: string;
      end: string;
      timezone: string;
    };
  };
  users: {
    total: number;
    concurrentSessions: {
      min: number;
      max: number;
    };
    profiles: {
      activeHelper: number;
      requester: number;
      browser: number;
      communityBuilder: number;
      socialUser: number;
    };
  };
  rateLimit: {
    respectLimits: boolean;
    minDelayMs: number;
    maxRetries: number;
  };
  apiBaseUrl: string;
}

export interface WorkflowContext {
  session: UserSession;
  config: SimulationConfig;
}

export type Workflow = (context: WorkflowContext) => Promise<void>;
