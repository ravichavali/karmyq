/**
 * Sprint 116 — Maria relationship-story rehearsal CLI (PR B, Task 10).
 *
 * Dry-run by DEFAULT: prints the planned actions and the verified story IDs, and mutates nothing
 * unless `--apply` is passed. All work goes through ordinary HTTP APIs (ApiClient) — this script
 * imports no database pool and never seeds trust edges or coordinates.
 *
 *   npm --workspace @karmyq/simulation-service run rehearse:maria-relationship        # dry-run
 *   npm --workspace @karmyq/simulation-service run rehearse:maria-relationship -- --apply
 *
 * Required env: API_BASE_URL, DEMO_MARIA_EMAIL, DEMO_HELPER_EMAILS (csv), DEMO_PROVIDER_EMAILS (csv).
 * Optional: DEMO_PERSONA_PASSWORD (default "password123").
 */
import { ApiClient } from '../api-client';
import {
  planMariaRelationshipStory,
  applyMariaRelationshipStory,
  ORDINARY_REQUEST_TITLE,
  PROVIDER_REQUEST_TITLE,
  type HelperCandidate,
  type ProviderCandidate,
  type ExistingMatch,
  type ExistingOffer,
  type MariaStoryState,
  type StoryOverlap,
} from '../scenarios/mariaRelationshipStory';

const PASSWORD = process.env.DEMO_PERSONA_PASSWORD || 'password123';
const csv = (value: string | undefined): string[] =>
  (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

interface Persona {
  email: string;
  client: ApiClient;
  userId: string;
  communityIds: string[];
}

async function loginPersona(baseUrl: string, email: string): Promise<Persona> {
  const client = new ApiClient(baseUrl);
  const { token, user } = await client.login(email, PASSWORD);
  client.setToken(token);
  const communityIds = ((user.communities ?? []) as Array<{ id: string }>).map(c => c.id);
  return { email, client, userId: user.id, communityIds };
}

const idSet = (neighborhood: any): Set<string> =>
  new Set<string>(((neighborhood?.nodes ?? []) as any[]).map(n => n.id));

/** Measure overlap between Maria and a candidate using privacy-scoped ego neighborhoods. */
async function overlap(
  maria: Persona,
  mariaOneHop: Set<string>,
  mariaDepth2: any,
  candidateId: string,
): Promise<StoryOverlap> {
  const candidateOneHop = idSet(await maria.client.getNeighborhood(candidateId, 1));
  let shared = 0;
  for (const id of candidateOneHop) if (mariaOneHop.has(id)) shared += 1;
  const reached = ((mariaDepth2?.nodes ?? []) as any[]).find(n => n.id === candidateId);
  const pathDegree =
    typeof reached?.degrees_of_separation === 'number' ? reached.degrees_of_separation : null;
  return {
    pathDegree,
    sharedConnections: shared,
    mariaOneHop: mariaOneHop.size,
    helperOneHop: candidateOneHop.size,
  };
}

async function findRequestByTitle(maria: Persona, title: string): Promise<string | undefined> {
  const mine = await maria.client.browseRequests({ requester_id: maria.userId, limit: 100 });
  return mine.find(r => r.title === title)?.id;
}

const matchesForRequest = async (maria: Persona, requestId: string): Promise<ExistingMatch[]> =>
  (await maria.client.getMatches())
    .filter(m => m.request_id === requestId)
    .map(m => ({ id: m.id, responderId: m.responder_id, status: m.status }));

const offersForRequest = async (maria: Persona, requestId: string): Promise<ExistingOffer[]> =>
  (await maria.client.getOffersForRequest(requestId)).map(o => ({
    id: o.id,
    providerUserId: o.provider_user_id,
    status: o.status,
  }));

interface GatheredWorld {
  state: MariaStoryState;
  /** Logged-in candidate personas keyed by user id, so apply reuses them without a second login. */
  personas: Map<string, Persona>;
}

async function gatherState(maria: Persona, baseUrl: string): Promise<GatheredWorld> {
  const mariaDepth2 = await maria.client.getNeighborhood(maria.userId, 2);
  const mariaOneHop = idSet(await maria.client.getNeighborhood(maria.userId, 1));
  const personas = new Map<string, Persona>();

  const helperCandidates: HelperCandidate[] = [];
  for (const email of csv(process.env.DEMO_HELPER_EMAILS)) {
    const persona = await loginPersona(baseUrl, email);
    personas.set(persona.userId, persona);
    helperCandidates.push({
      id: persona.userId,
      communityIds: persona.communityIds,
      overlap: await overlap(maria, mariaOneHop, mariaDepth2, persona.userId),
    });
  }

  const providerCandidates: ProviderCandidate[] = [];
  for (const email of csv(process.env.DEMO_PROVIDER_EMAILS)) {
    const persona = await loginPersona(baseUrl, email);
    personas.set(persona.userId, persona);
    const profiles = await persona.client.getMyProviderProfiles();
    providerCandidates.push({
      id: persona.userId,
      communityIds: persona.communityIds,
      serviceType: profiles?.[0]?.service_type ?? 'other',
      overlap: await overlap(maria, mariaOneHop, mariaDepth2, persona.userId),
    });
  }

  const ordinaryRequestId = await findRequestByTitle(maria, ORDINARY_REQUEST_TITLE);
  const providerRequestId = await findRequestByTitle(maria, PROVIDER_REQUEST_TITLE);

  return {
    personas,
    state: {
      maria: { id: maria.userId, communityIds: maria.communityIds },
      helperCandidates,
      providerCandidates,
      existing: {
        ordinaryRequestId,
        ordinaryMatches: ordinaryRequestId ? await matchesForRequest(maria, ordinaryRequestId) : [],
        providerRequestId,
        providerOffers: providerRequestId ? await offersForRequest(maria, providerRequestId) : [],
      },
    },
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const baseUrl = process.env.API_BASE_URL;
  const mariaEmail = process.env.DEMO_MARIA_EMAIL;
  if (!baseUrl || !mariaEmail) {
    console.error('Set API_BASE_URL and DEMO_MARIA_EMAIL before running the rehearsal.');
    return process.exit(1);
  }

  console.log(`\nMaria relationship-story rehearsal — ${apply ? 'APPLY (mutating)' : 'DRY RUN'}`);
  console.log(`Environment: ${baseUrl}  Persona: ${mariaEmail}\n`);

  const maria = await loginPersona(baseUrl, mariaEmail);
  const { state, personas } = await gatherState(maria, baseUrl);
  const plan = planMariaRelationshipStory(state);

  console.log('Selection:', plan.selection);
  console.log('Floor:', plan.floor);
  if (plan.warnings.length) plan.warnings.forEach(w => console.warn('⚠️ ', w));
  console.log('Planned actions:', plan.actions.length ? plan.actions.map(a => a.type) : '(none — already complete)');

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute.\n');
    console.log('Known IDs so far:', JSON.stringify(plan.expected, null, 2));
    return;
  }

  if (!plan.floor.achievable) {
    console.error('\nRefusing to apply: no structurally-rich helper. Add real shared history first.\n');
    return process.exit(1);
  }

  const helper = personas.get(plan.selection.ordinaryHelperId);
  const provider = personas.get(plan.selection.providerId);
  if (!helper || !provider) {
    console.error('\nSelected personas were not logged in during gather — cannot apply.\n');
    return process.exit(1);
  }

  const result = await applyMariaRelationshipStory(plan, {
    maria: {
      createRequest: (data) => maria.client.createRequest(data),
      acceptMatch: (mid) => maria.client.acceptMatch(mid, maria.userId),
      completeMatch: (mid) => maria.client.completeMatch(mid, maria.userId),
    },
    helper: {
      offerHelp: (rid) => helper.client.offerHelp(rid, helper.userId),
      completeMatch: (mid) => helper.client.completeMatch(mid, helper.userId),
    },
    provider: {
      submitProviderOffer: (rid) => provider.client.submitProviderOffer(rid, null, 'Available this weekend.'),
    },
    readback: {
      getRequest: async (rid) => (await maria.client.getRequest(rid)) ?? null,
      getMatchesForRequest: (rid) => matchesForRequest(maria, rid),
      getOffersForRequest: (rid) => offersForRequest(maria, rid),
    },
  });

  console.log('\nApplied and verified against authoritative re-read. Configure the demo session with:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Rehearsal failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
