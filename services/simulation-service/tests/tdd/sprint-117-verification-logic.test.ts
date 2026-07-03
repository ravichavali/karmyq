import {
  demoSessionMatchesPublished,
  reciprocalContextsMatch,
} from '../../src/fixtures/curatedDemo/demoVerificationLogic';

const IDS = {
  ordinaryRequestId: 'ord-req',
  ordinaryMatchId: 'ord-match',
  providerRequestId: 'prov-req',
  providerOfferId: 'prov-offer',
};

function node(id: string) {
  return { user_id: id };
}

describe('reciprocalContextsMatch (reversed-orientation node/path sets)', () => {
  const maria = {
    path: { degrees: 2 },
    networks: { viewer: [node('wei')], counterpart: [node('fatima')], shared: [node('s1'), node('s2'), node('s3')] },
  };
  const helperReciprocal = {
    path: { degrees: 2 },
    networks: { viewer: [node('fatima')], counterpart: [node('wei')], shared: [node('s3'), node('s1'), node('s2')] },
  };

  it('accepts a true reversed-orientation match regardless of ordering', () => {
    expect(reciprocalContextsMatch(maria, helperReciprocal)).toBe(true);
  });

  it('rejects a mismatched shared set', () => {
    const helper = { ...helperReciprocal, networks: { ...helperReciprocal.networks, shared: [node('s1'), node('s2')] } };
    expect(reciprocalContextsMatch(maria, helper)).toBe(false);
  });

  it('rejects when viewer/counterpart are not actually swapped', () => {
    const helper = { path: { degrees: 2 }, networks: { viewer: [node('wei')], counterpart: [node('fatima')], shared: [node('s1'), node('s2'), node('s3')] } };
    expect(reciprocalContextsMatch(maria, helper)).toBe(false);
  });

  it('rejects when either side has no finite path', () => {
    expect(reciprocalContextsMatch(maria, { ...helperReciprocal, path: { degrees: null } })).toBe(false);
  });
});

describe('demoSessionMatchesPublished (IDs live under demo.stories)', () => {
  const session = {
    token: 'tok',
    demo: {
      stories: [
        { kind: 'ordinary', requestId: 'ord-req', matchId: 'ord-match' },
        { kind: 'provider', requestId: 'prov-req', offerId: 'prov-offer' },
      ],
    },
  };

  it('accepts a session whose demo.stories match the published IDs', () => {
    expect(demoSessionMatchesPublished(session, IDS)).toBe(true);
  });

  it('rejects a token whose stories are stale (the top-level-field bug)', () => {
    const stale = { token: 'tok', demo: { stories: [
      { kind: 'ordinary', requestId: 'OLD-req', matchId: 'ord-match' },
      { kind: 'provider', requestId: 'prov-req', offerId: 'prov-offer' },
    ] } };
    expect(demoSessionMatchesPublished(stale, IDS)).toBe(false);
  });

  it('rejects a session with no token', () => {
    expect(demoSessionMatchesPublished({ demo: session.demo }, IDS)).toBe(false);
  });

  it('rejects a session with no demo.stories', () => {
    expect(demoSessionMatchesPublished({ token: 'tok' }, IDS)).toBe(false);
  });
});
