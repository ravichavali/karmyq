/**
 * Sprint 125 / ADR-095 — the provider reach gate, proven against a real planner.
 *
 * WHY THIS FILE IS THE ONE THAT COUNTS
 * ------------------------------------
 * The three reach conditions live in SQL. `tests/unit/providerReachService.test.ts` pins the
 * query's SHAPE (LEFT JOIN, COALESCE, cardinality-means-all) and `tests/tdd/...` pins the route's
 * auth and membership gates — but neither can prove the gate actually REJECTS anyone, because with
 * `query` mocked the database never evaluates a condition. A gate demonstrated only by a green
 * mocked run cannot be told apart from an inert one.
 *
 * So every condition below is asserted in BOTH directions, independently: an eligible provider
 * appears AND an ineligible one is absent, with only that one condition varied between them.
 *
 * Requires: PostgreSQL. RLS is on, so a query that skips setDbContext sees nothing rather than
 * erroring — a silently empty layer is the tell, which is why the accept-side assertions matter as
 * much as the reject-side ones.
 */

import { query } from '../../src/database/db';
import { getCommunityProviders, isActiveMember } from '../../src/services/providerReachService';

const TAG = `s125-${Date.now()}`;

/** Everything created here, torn down in reverse. */
const created = { users: [] as string[], communities: [] as string[], providers: [] as string[] };

async function mkUser(label: string): Promise<string> {
  const r = await query(
    `INSERT INTO auth.users (email, name, password_hash) VALUES ($1, $2, 'hash') RETURNING id`,
    [`${TAG}-${label}@example.com`, label]
  );
  created.users.push(r.rows[0].id);
  return r.rows[0].id;
}

interface FixtureConfig {
  enabled?: boolean;
  floor?: number;
  list?: string[];
  noConfigRow?: boolean;
}

async function mkCommunity(label: string, config: FixtureConfig): Promise<string> {
  // `creator_id` is NOT NULL with no default, so every fixture community needs a real owner row.
  const creator = await mkUser(`${label}-creator`);
  const c = await query(
    `INSERT INTO communities.communities (name, description, community_type, creator_id)
     VALUES ($1, 'sprint-125 fixture', 'mutual_aid', $2) RETURNING id`,
    [`${TAG}-${label}`, creator]
  );
  const id = c.rows[0].id;
  created.communities.push(id);

  if (!config.noConfigRow) {
    await query(
      `INSERT INTO communities.community_configs
         (community_id, provider_services_enabled, provider_min_personal_trust_score, provider_services_list)
       VALUES ($1, $2, $3, $4)`,
      [id, config.enabled ?? true, config.floor ?? 0, config.list ?? []]
    );
  }
  return id;
}

async function addMember(userId: string, communityId: string, status = 'active') {
  await query(
    `INSERT INTO communities.members (user_id, community_id, role, status)
     VALUES ($1, $2, 'member', $3)`,
    [userId, communityId, status]
  );
}

async function mkProvider(userId: string, serviceType = 'ride'): Promise<string> {
  const r = await query(
    `INSERT INTO requests.provider_profiles (user_id, service_type, display_name, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [userId, serviceType, `${TAG}-provider`]
  );
  created.providers.push(r.rows[0].id);
  return r.rows[0].id;
}

async function setTrust(userId: string, communityId: string, score: number) {
  await query(
    `INSERT INTO reputation.trust_scores (user_id, community_id, score)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, community_id) DO UPDATE SET score = EXCLUDED.score`,
    [userId, communityId, score]
  );
}

const idsIn = async (communityId: string) =>
  (await getCommunityProviders(communityId, { limit: 100 })).map((p) => p.id);

afterAll(async () => {
  for (const id of created.providers) {
    await query('DELETE FROM requests.provider_profiles WHERE id = $1', [id]);
  }
  for (const id of created.communities) {
    await query('DELETE FROM reputation.trust_scores WHERE community_id = $1', [id]);
    await query('DELETE FROM communities.members WHERE community_id = $1', [id]);
    await query('DELETE FROM communities.community_configs WHERE community_id = $1', [id]);
    await query('DELETE FROM communities.communities WHERE id = $1', [id]);
  }
  for (const id of created.users) {
    await query('DELETE FROM auth.users WHERE id = $1', [id]);
  }
});

describe('Condition 1 — provider_services_enabled', () => {
  it('APPEARS when the community opted in', async () => {
    const c = await mkCommunity('c1-on', { enabled: true });
    const u = await mkUser('c1on');
    await addMember(u, c);
    const p = await mkProvider(u);

    expect(await idsIn(c)).toContain(p);
  });

  it('is ABSENT when the community opted out — same fixture, one flag flipped', async () => {
    const c = await mkCommunity('c1-off', { enabled: false });
    const u = await mkUser('c1off');
    await addMember(u, c);
    const p = await mkProvider(u);

    const ids = await idsIn(c);
    expect(ids).not.toContain(p);
    expect(ids).toEqual([]);
  });

  it('is ABSENT — and does not error — when the community has NO config row', async () => {
    // Unconfigured is disabled, not missing. config.ts returns 404 for this; the layer must not.
    const c = await mkCommunity('c1-norow', { noConfigRow: true });
    const u = await mkUser('c1norow');
    await addMember(u, c);
    await mkProvider(u);

    await expect(getCommunityProviders(c)).resolves.toEqual([]);
  });
});

describe('Condition 2 — provider_min_personal_trust_score', () => {
  it('APPEARS when the provider clears the floor', async () => {
    const c = await mkCommunity('c2-over', { enabled: true, floor: 40 });
    const u = await mkUser('c2over');
    await addMember(u, c);
    const p = await mkProvider(u);
    await setTrust(u, c, 50);

    expect(await idsIn(c)).toContain(p);
  });

  it('APPEARS at exactly the floor (>= is inclusive)', async () => {
    const c = await mkCommunity('c2-eq', { enabled: true, floor: 40 });
    const u = await mkUser('c2eq');
    await addMember(u, c);
    const p = await mkProvider(u);
    await setTrust(u, c, 40);

    expect(await idsIn(c)).toContain(p);
  });

  it('is ABSENT when the provider is below the floor', async () => {
    const c = await mkCommunity('c2-under', { enabled: true, floor: 40 });
    const u = await mkUser('c2under');
    await addMember(u, c);
    const p = await mkProvider(u);
    await setTrust(u, c, 39);

    expect(await idsIn(c)).not.toContain(p);
  });

  it('is ABSENT with NO trust row when the floor is above 0 — fails closed at 0', async () => {
    // The COALESCE rule. Unknown standing is 0, not "unconstrained".
    const c = await mkCommunity('c2-norow-floor', { enabled: true, floor: 1 });
    const u = await mkUser('c2norowfloor');
    await addMember(u, c);
    const p = await mkProvider(u);

    expect(await idsIn(c)).not.toContain(p);
  });

  it('APPEARS with NO trust row when the floor is 0 — the LEFT JOIN must not drop them', async () => {
    // The other direction, and the one an INNER JOIN would silently break. Floor 0 is the DEFAULT,
    // so an INNER JOIN would empty the layer for most communities while every mocked test stayed
    // green.
    const c = await mkCommunity('c2-norow-zero', { enabled: true, floor: 0 });
    const u = await mkUser('c2norowzero');
    await addMember(u, c);
    const p = await mkProvider(u);

    expect(await idsIn(c)).toContain(p);
  });

  it('filters PERSONAL standing, not provider-profile quality', async () => {
    // High profile quality but low personal standing must still be excluded — the two-scores trap.
    const c = await mkCommunity('c2-wrongscore', { enabled: true, floor: 60 });
    const u = await mkUser('c2wrong');
    await addMember(u, c);
    const p = await mkProvider(u);
    await setTrust(u, c, 10);
    await query(
      `INSERT INTO reputation.provider_trust_scores (provider_id, trust_score)
       VALUES ($1, 99)
       ON CONFLICT (provider_id) DO UPDATE SET trust_score = EXCLUDED.trust_score`,
      [p]
    );

    expect(await idsIn(c)).not.toContain(p);
  });
});

describe('Condition 3 — provider_services_list', () => {
  it('APPEARS when the type is on the list', async () => {
    const c = await mkCommunity('c3-in', { enabled: true, list: ['ride'] });
    const u = await mkUser('c3in');
    await addMember(u, c);
    const p = await mkProvider(u, 'ride');

    expect(await idsIn(c)).toContain(p);
  });

  it('is ABSENT when the type is not on the list', async () => {
    const c = await mkCommunity('c3-out', { enabled: true, list: ['tutor'] });
    const u = await mkUser('c3out');
    await addMember(u, c);
    const p = await mkProvider(u, 'ride');

    expect(await idsIn(c)).not.toContain(p);
  });

  it('APPEARS when the list is EMPTY — empty means all types, never deny-all', async () => {
    // The column defaults to '{}'. A deny-all reading switches off every community that opted in
    // without curating a list, which is most of them.
    const c = await mkCommunity('c3-empty', { enabled: true, list: [] });
    const u = await mkUser('c3empty');
    await addMember(u, c);
    const p = await mkProvider(u, 'ride');

    expect(await idsIn(c)).toContain(p);
  });
});

describe('Provider membership and profile state', () => {
  it('is ABSENT when the provider is not a member of this community', async () => {
    const c = await mkCommunity('m-nonmember', { enabled: true });
    const u = await mkUser('mnonmember');
    const p = await mkProvider(u);

    expect(await idsIn(c)).not.toContain(p);
  });

  it('is ABSENT when the provider left (membership not active)', async () => {
    const c = await mkCommunity('m-left', { enabled: true });
    const u = await mkUser('mleft');
    await addMember(u, c, 'removed');
    const p = await mkProvider(u);

    expect(await idsIn(c)).not.toContain(p);
  });

  it('is ABSENT when the provider profile is inactive', async () => {
    const c = await mkCommunity('m-inactive', { enabled: true });
    const u = await mkUser('minactive');
    await addMember(u, c);
    const p = await mkProvider(u);
    await query('UPDATE requests.provider_profiles SET is_active = FALSE WHERE id = $1', [p]);

    expect(await idsIn(c)).not.toContain(p);
  });

  it('does not leak a provider from a DIFFERENT community', async () => {
    const a = await mkCommunity('x-a', { enabled: true });
    const b = await mkCommunity('x-b', { enabled: true });
    const u = await mkUser('xb');
    await addMember(u, b);
    const p = await mkProvider(u);

    expect(await idsIn(b)).toContain(p);
    expect(await idsIn(a)).not.toContain(p);
  });
});

describe('isActiveMember against the live table', () => {
  it('is true for an active member and false once they are removed', async () => {
    const c = await mkCommunity('mem', { enabled: true });
    const u = await mkUser('memu');
    await addMember(u, c);

    await expect(isActiveMember(u, c)).resolves.toBe(true);

    await query(
      `UPDATE communities.members SET status = 'removed' WHERE user_id = $1 AND community_id = $2`,
      [u, c]
    );

    // The whole reason membership is re-derived rather than read from the JWT claim.
    await expect(isActiveMember(u, c)).resolves.toBe(false);
  });
});
