/**
 * Sprint 140 — simulation containment for BUG-100.
 *
 * The nominate/ratify workflows call `client.getCommunities()` without a user id. Until BUG-100
 * was fixed, GET /communities/my/communities answered that with a 400, the workflows caught it
 * and found no community, so they never nominated or ratified anything. The fix makes the route
 * use the JWT identity, which would silently switch both workflows on the next time pm2 restarts
 * the simulation on deploy.
 *
 * The maintainer has not approved simulated nominations/ratifications while the ratification
 * quorum question is open, so every profile carries weight 0 for both actions, and the weighted
 * selector — which only admits truthy weights — can never return either of them. Reactivating
 * them is a separate product decision.
 */

jest.mock('../../src/db-user-loader', () => ({
  getPool: () => ({
    query: jest.fn().mockResolvedValue({ rows: [{ count: '0' }] }),
  }),
}));

import { ALL_PROFILES, selectWorkflow } from '../../src/profiles';
import type { SimulatedUser, SimulationConfig } from '../../src/types';

const DISABLED = ['nominateMember', 'ratifyNomination'] as const;

/** Names selectWorkflow can return for a profile, sweeping Math.random evenly across [0, 1). */
async function reachableActions(profileIndex: number, samples = 2000): Promise<Set<string>> {
  const profile = ALL_PROFILES[profileIndex];
  const user = { id: 'u-1', email: 'sim@test.local', name: 'Sim', profile } as SimulatedUser;
  const names = new Set<string>();
  const log = jest.spyOn(console, 'log').mockImplementation((msg?: any) => {
    const m = /^\[worker\] action: (\S+) /.exec(String(msg));
    if (m) names.add(m[1]);
  });
  const random = jest.spyOn(Math, 'random');
  try {
    for (let i = 0; i < samples; i++) {
      random.mockReturnValue(i / samples);
      await selectWorkflow(user, {} as any, {} as SimulationConfig);
    }
  } finally {
    random.mockRestore();
    log.mockRestore();
  }
  return names;
}

describe('Sprint 140: simulated nomination and ratification are disabled', () => {
  it('the profile list is the five known personas (a renamed or added profile must be checked here)', () => {
    expect(ALL_PROFILES.map((p) => p.name)).toEqual([
      'Active Helper',
      'Requester',
      'Browser',
      'Community Builder',
      'Social User',
    ]);
  });

  it.each(ALL_PROFILES.map((p, i) => [p.name, i] as const))(
    '%s gives every listed nominate/ratify action weight 0',
    (_name, i) => {
      const { actions } = ALL_PROFILES[i];
      for (const action of DISABLED) {
        if (actions[action] !== undefined) expect(actions[action]!.weight).toBe(0);
      }
    },
  );

  it('the profiles that used to carry these actions still list them, with averages kept for reactivation', () => {
    const builder = ALL_PROFILES.find((p) => p.name === 'Community Builder')!;
    const social = ALL_PROFILES.find((p) => p.name === 'Social User')!;
    expect(builder.actions.nominateMember).toEqual({ weight: 0, avgPerSession: 0.05 });
    expect(builder.actions.ratifyNomination).toEqual({ weight: 0, avgPerSession: 0.1 });
    expect(social.actions.ratifyNomination).toEqual({ weight: 0, avgPerSession: 0.05 });
  });

  it.each(ALL_PROFILES.map((p, i) => [p.name, i] as const))(
    'selectWorkflow never returns a disabled action for %s',
    async (_name, i) => {
      const names = await reachableActions(i);
      for (const action of DISABLED) expect(names.has(action)).toBe(false);
      // Non-vacuous: the sweep really does reach the profile's other actions.
      expect(names.has('joinCommunity')).toBe(true);
      expect(names.size).toBeGreaterThan(2);
    },
  );

  it('unrelated governance selection is unchanged: Community Builder can still vote and propose helpers', async () => {
    const i = ALL_PROFILES.findIndex((p) => p.name === 'Community Builder');
    const names = await reachableActions(i);
    expect(names.has('voteOnGovernance')).toBe(true);
    expect(names.has('adminProposeHelper')).toBe(true);
    expect(names.has('callDibs')).toBe(true);
  });
});
