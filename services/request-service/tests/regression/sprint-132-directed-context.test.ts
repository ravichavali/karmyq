jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/db/eligibility', () => ({ getRequestReachability: jest.fn() }));
import { query } from '../../src/database/db';
import { getRequestReachability } from '../../src/db/eligibility';
import { resolveRequestPair, resolveMatchPair, resolveProviderOfferPair } from '../../src/db/relationshipContextDb';
beforeEach(() => {
  jest.resetAllMocks();
  (getRequestReachability as jest.Mock).mockResolvedValue({ exists: true, requesterId: 'R', status: 'open', expired: false, visibilityScope: 'community', isDirected: true, reachable: true, reachability: 'directed' });
  (query as jest.Mock).mockResolvedValue({ rows: [{ requester_id: 'R', responder_id: 'O', provider_user_id: 'O', visibility_scope: 'community' }] });
});
it('returns no invented relationship tier for an authorized directed recipient', async () => {
  expect(await resolveRequestPair('ask', 'O')).toEqual({ kind: 'no_context' });
});
it('makes a directed pre-offer context indistinguishable from an unknown request to an outsider', async () => {
  (getRequestReachability as jest.Mock).mockResolvedValue({ exists: true, requesterId: 'R', status: 'open', expired: false, visibilityScope: 'platform', isDirected: true, reachable: false, reachability: null });
  expect(await resolveRequestPair('ask', 'M')).toEqual({ kind: 'not_found' });
});
it.each(['match', 'provider'])('guards a private %s context lookup and returns no context', async kind => {
  const result = kind === 'match' ? await resolveMatchPair('ask', 'match', 'O') : await resolveProviderOfferPair('ask', 'offer', 'O');
  expect(result).toEqual({ kind: 'no_context' });
  expect(query).toHaveBeenCalledWith(expect.stringContaining('/* directed-audience */'), ['ask', kind === 'match' ? 'match' : 'offer', 'O']);
});
it('returns absence before resolving topology for a rejected match audience', async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  expect(await resolveMatchPair('ask', 'match', 'M')).toEqual({ kind: 'not_found' });
  expect(getRequestReachability).not.toHaveBeenCalled();
});
