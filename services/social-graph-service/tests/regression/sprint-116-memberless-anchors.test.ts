jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../src/database/relationshipContextDb', () => ({
  getContextLinks: jest.fn(),
  getPlatformShortestPath: jest.fn(),
  getPublicIdentities: jest.fn(),
  getPublicOneHop: jest.fn(),
  getVisibleCommunities: jest.fn(),
}));

import { pool } from '../../src/config/database';
import {
  getContextLinks,
  getPlatformShortestPath,
  getPublicIdentities,
  getPublicOneHop,
  getVisibleCommunities,
} from '../../src/database/relationshipContextDb';
import { buildRelationshipContext } from '../../src/services/relationshipContextService';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const COUNTERPART = '22222222-2222-2222-2222-222222222222';
const INTERMEDIATE = '33333333-3333-3333-3333-333333333333';

it('allows only authorized anchors to bypass active-membership identity filtering', async () => {
  (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
  const actualDb = jest.requireActual('../../src/database/relationshipContextDb') as {
    getPublicIdentities: typeof getPublicIdentities;
  };

  await actualDb.getPublicIdentities(
    [VIEWER, COUNTERPART, INTERMEDIATE],
    [VIEWER, COUNTERPART],
  );

  const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
  expect(sql).toContain('u.id = ANY($2::uuid[])');
  expect(sql).toContain("m.status = 'active'");
  expect(params).toEqual([[VIEWER, COUNTERPART, INTERMEDIATE], [VIEWER, COUNTERPART]]);
});

it('builds an empty-network context for authorized memberless anchors', async () => {
  (getPublicOneHop as jest.Mock).mockResolvedValue([]);
  (getPlatformShortestPath as jest.Mock).mockResolvedValue(null);
  (getPublicIdentities as jest.Mock).mockResolvedValue([
    { id: VIEWER, name: 'Asha' },
    { id: COUNTERPART, name: 'Ben' },
  ]);
  (getVisibleCommunities as jest.Mock).mockResolvedValue(new Map([
    [VIEWER, []],
    [COUNTERPART, []],
  ]));
  (getContextLinks as jest.Mock).mockResolvedValue([]);

  const result = await buildRelationshipContext(VIEWER, COUNTERPART);

  expect(getPublicIdentities).toHaveBeenCalledWith(
    [VIEWER, COUNTERPART],
    [VIEWER, COUNTERPART],
  );
  expect(result).toMatchObject({
    viewer: { id: VIEWER, name: 'Asha' },
    counterpart: { id: COUNTERPART, name: 'Ben' },
    path: { degrees: null, nodes: [] },
    networks: { viewer: [], counterpart: [], shared: [] },
  });
});
