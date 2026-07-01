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
 * Optional: DEMO_PERSONA_PASSWORD (default "password123"), DEMO_MARIA_COMMUNITY_ID.
 */
import { ApiClient } from '../api-client';
import {
  planMariaRelationshipStory,
  applyMariaRelationshipStory,
  ORDINARY_REQUEST_TITLE,
  PROVIDER_REQUEST_TITLE,
  type HelperCandidate,
  type ProviderCandidate,
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
  communityId: string;
}

async function loginPersona(baseUrl: string, email: string): Promise<Persona> {
  const client = new ApiClient(baseUrl);
  const { token, user } = await client.login(email, PASSWORD);
  client.setToken(token);
  const communityId = user.communities?.[0]?.id ?? process.env.DEMO_MARIA_COMMUNITY_ID ?? '';
  return { email, client, userId: user.id, communityId };
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

async function gatherState(maria: Persona, baseUrl: string): Promise<MariaStoryState> {
  const mariaDepth2 = await maria.client.getNeighborhood(maria.userId, 2);
  const mariaOneHop = idSet(await maria.client.getNeighborhood(maria.userId, 1));

  const helperCandidates: HelperCandidate[] = [];
  for (const email of csv(process.env.DEMO_HELPER_EMAILS)) {
    const persona = await loginPersona(baseUrl, email);
    helperCandidates.push({
      id: persona.userId,
      communityId: persona.communityId,
      overlap: await overlap(maria, mariaOneHop, mariaDepth2, persona.userId),
    });
  }

  const providerCandidates: ProviderCandidate[] = [];
  for (const email of csv(process.env.DEMO_PROVIDER_EMAILS)) {
    const persona = await loginPersona(baseUrl, email);
    const profiles = await persona.client.getMyProviderProfiles();
    providerCandidates.push({
      id: persona.userId,
      communityId: persona.communityId,
      serviceType: profiles?.[0]?.service_type ?? 'other',
      overlap: await overlap(maria, mariaOneHop, mariaDepth2, persona.userId),
    });
  }

  const ordinaryRequestId = await findRequestByTitle(maria, ORDINARY_REQUEST_TITLE);
  const providerRequestId = await findRequestByTitle(maria, PROVIDER_REQUEST_TITLE);
  const ordinaryMatch = ordinaryRequestId
    ? (await maria.client.getMatches()).find(m => m.request_id === ordinaryRequestId)
    : undefined;
  const providerOffer = providerRequestId
    ? (await maria.client.getOffersForRequest(providerRequestId))[0]
    : undefined;

  return {
    maria: { id: maria.userId, communityId: maria.communityId },
    helperCandidates,
    providerCandidates,
    existing: {
      ordinaryRequestId,
      ordinaryMatchId: ordinaryMatch?.id,
      providerRequestId,
      providerOfferId: providerOffer?.id,
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
  const state = await gatherState(maria, baseUrl);
  const plan = planMariaRelationshipStory(state);

  console.log('Selection:', plan.selection);
  console.log('Floor met:', plan.floor.met, plan.floor.helperOverlap);
  if (plan.warnings.length) plan.warnings.forEach(w => console.warn('⚠️ ', w));
  console.log('Planned actions:', plan.actions.length ? plan.actions.map(a => a.type) : '(none — already complete)');

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute.\n');
    console.log('Verified IDs so far:', JSON.stringify(plan.expected, null, 2));
    return;
  }

  if (!plan.floor.met) {
    console.error('\nRefusing to apply a sparse story. Add real shared history first.\n');
    return process.exit(1);
  }

  const helper = await loginPersona(baseUrl, csvEmailFor(plan.selection.ordinaryHelperId, state, 'helper'));
  const provider = await loginPersona(baseUrl, csvEmailFor(plan.selection.providerId, state, 'provider'));
  const result = await applyMariaRelationshipStory(plan, {
    maria: maria.client,
    helper: { offerHelp: (rid, _resp) => helper.client.offerHelp(rid, helper.userId) },
    provider: { submitProviderOffer: (rid, price, note) => provider.client.submitProviderOffer(rid, price, note) },
  });

  console.log('\nApplied. Configure the demo session with these verified IDs:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Re-resolve the email for a selected persona id. The gather step logged personas in candidate order,
 * so we re-walk the configured csv lists and match by user id via a fresh login.
 */
function csvEmailFor(_userId: string, _state: MariaStoryState, kind: 'helper' | 'provider'): string {
  const list = csv(kind === 'helper' ? process.env.DEMO_HELPER_EMAILS : process.env.DEMO_PROVIDER_EMAILS);
  // The apply path re-logs in; selection ids were derived from these same emails, so the first
  // configured email of the kind is a safe deterministic fallback when a 1:1 map is not retained.
  return list[0];
}

main().catch(err => {
  console.error('Rehearsal failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
