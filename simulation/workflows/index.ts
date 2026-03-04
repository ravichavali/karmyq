/**
 * Workflow runner — executes a named workflow and returns timing + success
 */

import { SimApiClient } from '../api/client';
import { PersonaState } from '../personas/types';
import { logWorkflow } from '../utils/logger';
import { pickRandom, chance, sleep } from '../utils/random';
import { pickRequest, COMMUNITY_TEMPLATES, OFFER_MESSAGES, REPLY_MESSAGES, COMPLETION_FEEDBACKS } from './data';

export type WorkflowName =
  | 'browseRequests'
  | 'createRequest'
  | 'offerHelp'
  | 'acceptOffer'
  | 'completeMatch'
  | 'sendMessage'
  | 'generateInvite'
  | 'joinCommunity'
  | 'createCommunity'
  | 'registerAsProvider'
  | 'joinCollective';

export interface WorkflowResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export async function runWorkflow(
  workflow: WorkflowName,
  client: SimApiClient,
  state: PersonaState
): Promise<WorkflowResult> {
  const start = Date.now();
  let result: WorkflowResult = { success: true };

  try {
    switch (workflow) {
      case 'browseRequests':   result = await browseRequests(client, state); break;
      case 'createRequest':    result = await createRequest(client, state); break;
      case 'offerHelp':        result = await offerHelp(client, state); break;
      case 'acceptOffer':      result = await acceptOffer(client, state); break;
      case 'completeMatch':    result = await completeMatch(client, state); break;
      case 'sendMessage':      result = await sendMessage(client, state); break;
      case 'generateInvite':   result = await generateInvite(client, state); break;
      case 'joinCommunity':       result = await joinCommunity(client, state); break;
      case 'createCommunity':     result = await createCommunity(client, state); break;
      case 'registerAsProvider':  result = await registerAsProvider(client, state); break;
      case 'joinCollective':      result = await joinCollective(client, state); break;
    }
  } catch (err: any) {
    result = { success: false, error: err.message };
  }

  if (!result.skipped) {
    logWorkflow(
      state.persona.id,
      workflow,
      state.persona.location,
      Date.now() - start,
      result.success,
      result.error ? { error: result.error } : {}
    );
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

async function browseRequests(client: SimApiClient, _state: PersonaState): Promise<WorkflowResult> {
  const requests = await client.browseRequests(20);
  // Simulate reading time
  await sleep(500 + Math.random() * 1000);
  return { success: true };
}

async function createRequest(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  if (state.communityIds.length === 0) return { success: false, skipped: true, error: 'no community' };

  const template = pickRequest();
  await sleep(2000 + Math.random() * 3000); // "thinking" before posting

  await client.createRequest({
    community_id: pickRandom(state.communityIds),
    title: template.title,
    description: template.description,
    urgency: template.urgency,
    request_type: template.request_type,
    type_payload: template.type_payload,
  });

  return { success: true };
}

async function offerHelp(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const requests = await client.browseRequests(20);
  // Filter out own requests (we don't have requester_id here, so just pick any)
  if (requests.length === 0) return { success: false, skipped: true, error: 'no requests' };

  // 20% chance to bail after browsing (natural hesitation)
  if (!chance(0.8)) return { success: false, skipped: true };

  const target = pickRandom(requests);
  await sleep(1000 + Math.random() * 2000);

  await client.offerHelp(target.id, state.userId!);
  return { success: true };
}

async function acceptOffer(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const matches = await client.getMatches('proposed');
  if (matches.length === 0) return { success: false, skipped: true, error: 'no proposed matches' };

  // Update pending count for social graph context
  state.pendingOfferCount = matches.length;

  const match = pickRandom(matches);
  await sleep(500 + Math.random() * 1000);

  await client.acceptMatch(match.id, state.userId!);
  state.pendingOfferCount = Math.max(0, state.pendingOfferCount - 1);
  return { success: true };
}

async function completeMatch(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const active = await client.getMatches('matched');
  if (active.length === 0) return { success: false, skipped: true, error: 'no active matches' };

  const match = pickRandom(active);
  const feedback = pickRandom(COMPLETION_FEEDBACKS);
  await sleep(500 + Math.random() * 1000);

  await client.completeMatch(match.id, feedback);
  state.recentlyHelpedSomeone = true;
  return { success: true };
}

async function sendMessage(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const conversations = await client.getConversations();
  if (conversations.length === 0) return { success: false, skipped: true, error: 'no conversations' };

  const convo = pickRandom(conversations);
  const messages = await client.getMessages(convo.id);

  // Only reply if last message is from someone else
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.sender_id === state.userId) return { success: false, skipped: true };

  await sleep(1000 + Math.random() * 2000); // "typing" delay

  const text = pickRandom(REPLY_MESSAGES);
  await client.sendMessage(convo.id, text);
  return { success: true };
}

async function generateInvite(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  if (state.communityIds.length === 0) return { success: false, skipped: true, error: 'no community' };
  if (state.inviteCodesPending.length >= 3) return { success: false, skipped: true }; // Don't flood

  const communityId = pickRandom(state.communityIds);
  const invite = await client.generateInvite(communityId);
  state.inviteCodesPending.push(invite.code);

  // Invite code is saved to the shared pending-invites file by the orchestrator
  return { success: true, ...{ inviteCode: invite.code, communityId } };
}

async function joinCommunity(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const available = await client.discoverCommunities(20);
  const notJoined = available.filter(c => !state.communityIds.includes(c.id));
  if (notJoined.length === 0) return { success: false, skipped: true, error: 'no new communities' };

  const target = pickRandom(notJoined);
  await client.joinCommunity(target.id);
  state.communityIds.push(target.id);
  return { success: true };
}

async function createCommunity(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  // Only create if user has been active a while and isn't already in many communities
  if (state.communityIds.length >= 3) return { success: false, skipped: true };

  const template = pickRandom(COMMUNITY_TEMPLATES);
  await sleep(3000 + Math.random() * 5000); // Takes thought

  const community = await client.createCommunity(template);
  const newId = community.id ?? community.community?.id;
  if (newId) state.communityIds.push(newId);
  return { success: true };
}

// Provider service types available in the simulation
const PROVIDER_SERVICE_TYPES = ['ride', 'service', 'borrow'];

const PROVIDER_DISPLAY_NAMES: Record<string, string[]> = {
  ride: ['Reliable Rides with James', 'East Bay Carpool Collective', 'Bay Area Rideshare'],
  service: ['Handyman & Repairs', 'Tech Help & Setup', 'Yard Work & Gardening'],
  borrow: ['Tool Library', 'Camping Gear Lending', 'Kitchen Equipment Share'],
};

const PROVIDER_BIOS: Record<string, string[]> = {
  ride: [
    'Experienced driver offering rides around the Bay Area. Comfortable with groceries, appointments, and longer trips.',
    'Happy to give rides to neighbors in need. I work flexible hours so can accommodate daytime trips.',
  ],
  service: [
    'Skilled in home repairs, furniture assembly, and light electrical work. 10+ years experience.',
    'Tech professional offering help with computers, phones, and smart home setup.',
  ],
  borrow: [
    'I have a full set of tools — drills, saws, ladders — available to borrow for community members.',
    'Collection of camping and outdoor gear available for loan. First come, first served.',
  ],
};

async function registerAsProvider(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  if (state.isProvider) return { success: false, skipped: true };

  const service_type = pickRandom(PROVIDER_SERVICE_TYPES);
  const display_name = pickRandom(PROVIDER_DISPLAY_NAMES[service_type]);
  const bio = pickRandom(PROVIDER_BIOS[service_type]);

  await sleep(2000 + Math.random() * 3000);

  const profile = await client.registerAsProvider({
    service_type,
    display_name,
    bio,
    location_notes: state.persona.location,
  });

  state.isProvider = true;
  state.providerProfileId = profile.id;
  return { success: true };
}

async function joinCollective(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  if (!state.isProvider || !state.providerProfileId) return { success: false, skipped: true, error: 'not a provider' };

  const collectives = await client.getCollectives();
  if (collectives.length === 0) return { success: false, skipped: true, error: 'no collectives' };

  const notJoined = collectives.filter((c: any) => !state.collectiveIds.includes(c.id));
  if (notJoined.length === 0) return { success: false, skipped: true };

  const target = pickRandom(notJoined);
  await client.joinCollective(target.id, state.providerProfileId);
  state.collectiveIds.push(target.id);
  return { success: true };
}
