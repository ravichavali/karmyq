/**
 * User behavior profiles for synthetic simulation
 * Based on ADR-006
 */

import { UserProfile, SimulatedUser, SimulationConfig, WorkflowContext, UserSession } from '../types';
import { ApiClient } from '../api-client';
import { getPool } from '../db-user-loader';
import { voteOnGovernanceWorkflow } from '../workflows/vote-on-governance-workflow';
import { submitFeedbackWorkflow } from '../workflows/submit-feedback-workflow';
import { callDibsWorkflow, respondToDibsWorkflow } from '../workflows/dibs-workflow';
import { nominateMemberWorkflow, ratifyNominationWorkflow } from '../workflows/governance-nominate-workflow';
import {
  browseWorkflow,
  createRequestWorkflow,
  offerHelpWorkflow,
  messageWorkflow,
  completeMatchWorkflow,
  joinCommunityWorkflow,
  acceptOfferWorkflow,
  createCommunityWorkflow,
  registerAsProviderWorkflow,
  createCollectiveWorkflow,
  joinCollectiveWorkflow,
  browseProvidersWorkflow,
  scheduleActivityWorkflow,
  joinActivityWorkflow,
} from '../workflows';

export const ACTIVE_HELPER: UserProfile = {
  name: 'Active Helper',
  frequency: 'high',
  actions: {
    offerHelp: { weight: 0.6, avgPerSession: 3 },
    browseRequests: { weight: 0.8, avgPerSession: 5 },
    sendMessages: { weight: 0.7, avgPerSession: 4 },
    completeMatches: { weight: 0.5, avgPerSession: 2 },
    acceptOffers: { weight: 0.3, avgPerSession: 1 },
    createRequests: { weight: 0.1, avgPerSession: 0.3 },
    registerAsProvider: { weight: 0.02, avgPerSession: 0.05 },
    joinCollective: { weight: 0.01, avgPerSession: 0.01 },
    browseProviders: { weight: 0.05, avgPerSession: 0.2 },
    joinActivity: { weight: 0.15, avgPerSession: 1 },
    voteOnGovernance: { weight: 0.03, avgPerSession: 0.1 },
    submitFeedback: { weight: 0.25, avgPerSession: 1 },
    callDibs: { weight: 0.10, avgPerSession: 0.3 },
  },
  sessionDuration: { min: 15, max: 45, unit: 'minutes' },
  responseTime: { min: 5, max: 30, unit: 'minutes' }
};

export const REQUESTER: UserProfile = {
  name: 'Requester',
  frequency: 'medium',
  actions: {
    createRequests: { weight: 0.3, avgPerSession: 1 },
    acceptOffers: { weight: 0.6, avgPerSession: 1.5 },
    completeMatches: { weight: 0.6, avgPerSession: 1.5 },
    sendMessages: { weight: 0.5, avgPerSession: 3 },
    browseRequests: { weight: 0.3, avgPerSession: 2 },
    offerHelp: { weight: 0.1, avgPerSession: 0.2 },
    joinActivity: { weight: 0.05, avgPerSession: 0.2 },
    submitFeedback: { weight: 0.30, avgPerSession: 1 },
    acceptOrDeclineDibs: { weight: 0.10, avgPerSession: 0.2 },
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
    browseProviders: { weight: 0.1, avgPerSession: 0.5 },
    offerHelp: { weight: 0.1, avgPerSession: 0.5 },
    createRequests: { weight: 0.05, avgPerSession: 0.1 },
    joinActivity: { weight: 0.02, avgPerSession: 0.1 }
  },
  sessionDuration: { min: 5, max: 15, unit: 'minutes' },
  responseTime: { min: 60, max: 240, unit: 'minutes' }
};

export const COMMUNITY_BUILDER: UserProfile = {
  name: 'Community Builder',
  frequency: 'medium',
  actions: {
    createCommunities: { weight: 0.001, avgPerSession: 0.001 },
    joinCommunity: { weight: 0.08, avgPerSession: 0.3 },
    createCollective: { weight: 0.01, avgPerSession: 0.01 },
    createRequests: { weight: 0.5, avgPerSession: 1 },
    offerHelp: { weight: 0.4, avgPerSession: 2 },
    acceptOffers: { weight: 0.4, avgPerSession: 1.5 },
    completeMatches: { weight: 0.4, avgPerSession: 1.5 },
    browseRequests: { weight: 0.5, avgPerSession: 3 },
    registerAsProvider: { weight: 0.02, avgPerSession: 0.05 },
    joinCollective: { weight: 0.01, avgPerSession: 0.01 },
    scheduleActivity: { weight: 0.15, avgPerSession: 0.3 },
    joinActivity: { weight: 0.10, avgPerSession: 0.5 },
    voteOnGovernance: { weight: 0.05, avgPerSession: 0.2 },
    submitFeedback: { weight: 0.20, avgPerSession: 0.8 },
    callDibs: { weight: 0.05, avgPerSession: 0.1 },
    nominateMember: { weight: 0.02, avgPerSession: 0.05 },
    ratifyNomination: { weight: 0.05, avgPerSession: 0.1 },
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
    createRequests: { weight: 0.2, avgPerSession: 0.5 },
    registerAsProvider: { weight: 0.02, avgPerSession: 0.01 },
    joinActivity: { weight: 0.20, avgPerSession: 1 },
    voteOnGovernance: { weight: 0.03, avgPerSession: 0.1 },
    submitFeedback: { weight: 0.15, avgPerSession: 0.5 },
    ratifyNomination: { weight: 0.03, avgPerSession: 0.05 },
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

/**
 * Select a workflow for a user based on their profile weights.
 * Builds a fake WorkflowContext so legacy workflows continue to work unchanged.
 * New workflows (added in Tasks 6-9) are called directly with (user, client).
 */
export async function selectWorkflow(
  user: SimulatedUser,
  client: ApiClient,
  config: SimulationConfig
): Promise<() => Promise<void>> {
  const fakeSession: UserSession = { user, startedAt: new Date(), actions: [], isActive: true };
  const fakeSessionManager = {
    getClient: () => client,
    executeAction: async (_s: any, _n: string, fn: () => Promise<any>) => { try { return await fn(); } catch { return null; } },
    logAction: () => {},
  };
  const ctx: WorkflowContext = { session: fakeSession, config, sessionManager: fakeSessionManager };

  const { actions } = user.profile;
  type W = { weight: number; fn: () => Promise<void>; name: string };
  const candidates: W[] = [
    { weight: 0.05, fn: () => joinCommunityWorkflow(ctx), name: 'joinCommunity' },
  ];

  if (actions.browseRequests?.weight) candidates.push({ weight: actions.browseRequests.weight, fn: () => browseWorkflow(ctx), name: 'browse' });
  if (actions.createRequests?.weight) candidates.push({ weight: actions.createRequests.weight, fn: () => createRequestWorkflow(ctx), name: 'createRequest' });
  if (actions.offerHelp?.weight) candidates.push({ weight: actions.offerHelp.weight, fn: () => offerHelpWorkflow(ctx), name: 'offerHelp' });
  if (actions.sendMessages?.weight) candidates.push({ weight: actions.sendMessages.weight, fn: () => messageWorkflow(ctx), name: 'sendMessage' });
  if (actions.completeMatches?.weight) candidates.push({ weight: actions.completeMatches.weight, fn: () => completeMatchWorkflow(ctx), name: 'completeMatch' });
  if (actions.acceptOffers?.weight) candidates.push({ weight: actions.acceptOffers.weight, fn: () => acceptOfferWorkflow(ctx), name: 'acceptOffer' });
  if (actions.createCommunities?.weight) candidates.push({ weight: actions.createCommunities.weight, fn: () => createCommunityWorkflow(ctx), name: 'createCommunity' });
  if (actions.registerAsProvider?.weight) candidates.push({ weight: actions.registerAsProvider.weight, fn: () => registerAsProviderWorkflow(ctx), name: 'registerAsProvider' });
  if (actions.createCollective?.weight) candidates.push({ weight: actions.createCollective.weight, fn: () => createCollectiveWorkflow(ctx), name: 'createCollective' });
  if (actions.joinCollective?.weight) candidates.push({ weight: actions.joinCollective.weight, fn: () => joinCollectiveWorkflow(ctx), name: 'joinCollective' });
  if (actions.browseProviders?.weight) candidates.push({ weight: actions.browseProviders.weight, fn: () => browseProvidersWorkflow(ctx), name: 'browseProviders' });
  if (actions.scheduleActivity?.weight) candidates.push({ weight: actions.scheduleActivity.weight, fn: () => scheduleActivityWorkflow(ctx), name: 'scheduleActivity' });
  if (actions.joinActivity?.weight) candidates.push({ weight: actions.joinActivity.weight, fn: () => joinActivityWorkflow(ctx), name: 'joinActivity' });

  if (actions.voteOnGovernance?.weight) candidates.push({ weight: actions.voteOnGovernance.weight, fn: () => voteOnGovernanceWorkflow(user, client), name: 'voteOnGovernance' });
  if (actions.submitFeedback?.weight) candidates.push({ weight: actions.submitFeedback.weight, fn: () => submitFeedbackWorkflow(user, client), name: 'submitFeedback' });
  if (actions.callDibs?.weight) candidates.push({ weight: actions.callDibs.weight, fn: () => callDibsWorkflow(user, client), name: 'callDibs' });
  if (actions.acceptOrDeclineDibs?.weight) candidates.push({ weight: actions.acceptOrDeclineDibs.weight, fn: () => respondToDibsWorkflow(user, client), name: 'respondToDibs' });
  if (actions.nominateMember?.weight) candidates.push({ weight: actions.nominateMember.weight, fn: () => nominateMemberWorkflow(user, client), name: 'nominateMember' });
  if (actions.ratifyNomination?.weight) candidates.push({ weight: actions.ratifyNomination.weight, fn: () => ratifyNominationWorkflow(user, client), name: 'ratifyNomination' });

  // Session affinity: if user has open requests, boost acceptOffers and completeMatches
  try {
    const pool = getPool();
    const openRes = await pool.query(
      `SELECT COUNT(*) FROM requests.help_requests hr
       JOIN requests.request_communities rc ON hr.id = rc.request_id
       JOIN communities.members cm ON rc.community_id = cm.community_id AND cm.user_id = $1
       WHERE hr.requester_id = $1 AND hr.status IN ('open','matched')`,
      [user.id]
    );
    const hasOpen = parseInt(openRes.rows[0].count, 10) > 0;
    if (hasOpen) {
      for (const c of candidates) {
        if (c.name === 'acceptOffer' || c.name === 'completeMatch') c.weight *= 2;
      }
    }
  } catch {
    // non-fatal — proceed without affinity
  }

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) {
      console.log(`[worker] action: ${c.name} (${user.email})`);
      return c.fn;
    }
  }
  const last = candidates[candidates.length - 1];
  console.log(`[worker] action: ${last.name} (${user.email})`);
  return last.fn;
}
