/**
 * Workflow runner — executes a named workflow and returns timing + success
 */

import { SimApiClient } from '../api/client';
import { PersonaState } from '../personas/types';
import { logWorkflow } from '../utils/logger';
import { pickRandom, chance, sleep } from '../utils/random';
import { pickRequest, pickProvider, COMMUNITY_TEMPLATES, OFFER_MESSAGES, REPLY_MESSAGES, COMPLETION_FEEDBACKS } from './data';

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

  // Only accept matches where this user is the requester (not a random stranger's match)
  const myMatches = matches.filter(
    (m: any) => m.requester_id === state.userId && m.responder_id !== state.userId
  );
  if (myMatches.length === 0) return { success: false, skipped: true, error: 'no proposed matches for my requests' };

  state.pendingOfferCount = myMatches.length;

  const match = pickRandom(myMatches);
  await sleep(500 + Math.random() * 1000);

  await client.acceptMatch(match.id, state.userId!);
  state.pendingOfferCount = Math.max(0, state.pendingOfferCount - 1);
  return { success: true };
}

async function completeMatch(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  const active = await client.getMatches('matched');
  if (active.length === 0) return { success: false, skipped: true, error: 'no active matches' };

  // Only complete matches where this user is a participant and hasn't marked their side done
  const myCompletable = active.filter((m: any) => {
    if (m.responder_id === m.requester_id) return false;
    const isRequester = m.requester_id === state.userId;
    const isResponder = m.responder_id === state.userId;
    if (!isRequester && !isResponder) return false;
    if (isRequester && m.requester_done_at) return false;
    if (isResponder && m.responder_done_at) return false;
    return true;
  });
  if (myCompletable.length === 0) return { success: false, skipped: true, error: 'no completable matches' };

  const match = pickRandom(myCompletable);
  const feedback = pickRandom(COMPLETION_FEEDBACKS);
  await sleep(500 + Math.random() * 1000);

  await client.completeMatch(match.id, state.userId!, feedback);
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
  // Only create if user isn't already in many communities
  if (state.communityIds.length >= 3) return { success: false, skipped: true };

  // Don't create if a community with this name already exists — join it instead
  const existing = await client.discoverCommunities(50);
  const template = pickRandom(COMMUNITY_TEMPLATES);
  const alreadyExists = existing.some((c: any) => c.name === template.name);
  if (alreadyExists) {
    const match = existing.find((c: any) => c.name === template.name && !state.communityIds.includes(c.id));
    if (match) {
      await client.joinCommunity(match.id);
      state.communityIds.push(match.id);
    }
    return { success: false, skipped: true };
  }

  await sleep(3000 + Math.random() * 5000); // Takes thought

  const community = await client.createCommunity(template);
  const newId = community.id ?? community.community?.id;
  if (newId) state.communityIds.push(newId);
  return { success: true };
}

async function registerAsProvider(client: SimApiClient, state: PersonaState): Promise<WorkflowResult> {
  if (state.isProvider) return { success: false, skipped: true };

  const template = pickProvider();

  await sleep(2000 + Math.random() * 3000);

  const profile = await client.registerAsProvider({
    service_type: template.service_type,
    display_name: template.display_name,
    bio: template.bio,
    pricing_notes: template.pricing_notes,
    location_notes: template.location_notes,
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
