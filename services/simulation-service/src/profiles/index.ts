/**
 * User behavior profiles for synthetic simulation
 * Based on ADR-006
 */

import { UserProfile } from '../types';

export const ACTIVE_HELPER: UserProfile = {
  name: 'Active Helper',
  frequency: 'high',
  actions: {
    offerHelp: { weight: 0.6, avgPerSession: 3 },
    browseRequests: { weight: 0.8, avgPerSession: 5 },
    sendMessages: { weight: 0.7, avgPerSession: 4 },
    completeMatches: { weight: 0.5, avgPerSession: 2 },
    createRequests: { weight: 0.1, avgPerSession: 0.3 }
  },
  sessionDuration: { min: 15, max: 45, unit: 'minutes' },
  responseTime: { min: 5, max: 30, unit: 'minutes' }
};

export const REQUESTER: UserProfile = {
  name: 'Requester',
  frequency: 'medium',
  actions: {
    createRequests: { weight: 0.8, avgPerSession: 2 },
    acceptOffers: { weight: 0.6, avgPerSession: 1.5 },
    sendMessages: { weight: 0.5, avgPerSession: 3 },
    browseRequests: { weight: 0.3, avgPerSession: 2 },
    offerHelp: { weight: 0.1, avgPerSession: 0.2 }
  },
  sessionDuration: { min: 10, max: 30, unit: 'minutes' },
  responseTime: { min: 30, max: 120, unit: 'minutes' }
};

export const BROWSER: UserProfile = {
  name: 'Browser',
  frequency: 'low',
  actions: {
    browseRequests: { weight: 0.9, avgPerSession: 10 },
    viewProfiles: { weight: 0.4, avgPerSession: 3 },
    offerHelp: { weight: 0.1, avgPerSession: 0.5 },
    createRequests: { weight: 0.05, avgPerSession: 0.1 }
  },
  sessionDuration: { min: 5, max: 15, unit: 'minutes' },
  responseTime: { min: 60, max: 240, unit: 'minutes' }
};

export const COMMUNITY_BUILDER: UserProfile = {
  name: 'Community Builder',
  frequency: 'medium',
  actions: {
    createCommunities: { weight: 0.05, avgPerSession: 0.1 },
    inviteMembers: { weight: 0.6, avgPerSession: 5 },
    moderateContent: { weight: 0.4, avgPerSession: 2 },
    createRequests: { weight: 0.5, avgPerSession: 1 },
    offerHelp: { weight: 0.4, avgPerSession: 2 }
  },
  sessionDuration: { min: 20, max: 60, unit: 'minutes' },
  responseTime: { min: 10, max: 60, unit: 'minutes' }
};

export const SOCIAL_USER: UserProfile = {
  name: 'Social User',
  frequency: 'high',
  actions: {
    sendMessages: { weight: 0.9, avgPerSession: 8 },
    browseRequests: { weight: 0.6, avgPerSession: 4 },
    viewProfiles: { weight: 0.7, avgPerSession: 6 },
    offerHelp: { weight: 0.3, avgPerSession: 1 },
    createRequests: { weight: 0.2, avgPerSession: 0.5 }
  },
  sessionDuration: { min: 15, max: 45, unit: 'minutes' },
  responseTime: { min: 2, max: 15, unit: 'minutes' }
};

export const ALL_PROFILES: UserProfile[] = [
  ACTIVE_HELPER,
  REQUESTER,
  BROWSER,
  COMMUNITY_BUILDER,
  SOCIAL_USER
];

export function getProfileByName(name: string): UserProfile | undefined {
  return ALL_PROFILES.find(p => p.name === name);
}

export function assignProfile(distribution: { [key: string]: number }): UserProfile {
  const rand = Math.random();
  let cumulative = 0;

  if (rand < (cumulative += distribution.activeHelper)) return ACTIVE_HELPER;
  if (rand < (cumulative += distribution.requester)) return REQUESTER;
  if (rand < (cumulative += distribution.browser)) return BROWSER;
  if (rand < (cumulative += distribution.communityBuilder)) return COMMUNITY_BUILDER;
  return SOCIAL_USER;
}
