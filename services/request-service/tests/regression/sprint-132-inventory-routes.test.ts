/** Real app/middleware/SQL builders, with only the PostgreSQL boundary replaced. */
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
process.env.JWT_SECRET = 'sprint-132-inventory-test-secret';
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {
    query: (...args: any[]) => mockQuery(...args),
    connect: async () => ({ query: (...args: any[]) => mockQuery(...args), release: () => {} }),
  },
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
  initDatabase: jest.fn(),
}));

const OWNER = '10000000-0000-4000-8000-000000000001';
const COMMUNITY = '20000000-0000-4000-8000-000000000001';
const ITEM = '30000000-0000-4000-8000-000000000001';
const item = {
  id: ITEM,
  owner_user_id: OWNER,
  owner_community_id: null,
  name: 'Ladder',
  category: 'tools',
  status: 'available',
  shared_with: [],
};
let app: any;
const token = () =>
  jwt.sign(
    { userId: OWNER, email: 'owner@test.example', communities: [] },
    process.env.JWT_SECRET || 'dev-secret-key'
  );
const api = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) =>
  request(app)[method](`/requests/inventory${path}`).set('Authorization', `Bearer ${token()}`);

beforeAll(async () => {
  app = (await import('../../src/index')).default;
});
beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

it('mounts mine before /requests/:id and returns the inventory envelope', async () => {
  mockQuery.mockImplementation(async (sql: string) => ({
    rows: sql.includes('inventory.items') ? [item] : [],
    rowCount: 1,
  }));
  const res = await api('get', '/mine');
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ items: [item] });
});
it('requires a JWT', async () => {
  expect((await request(app).get('/requests/inventory/mine')).status).toBe(401);
});
it.each([
  { name: '', category: 'tools' },
  { name: 'x'.repeat(121), category: 'tools' },
  { name: 'Ladder', category: 'unknown' },
  { name: 'Ladder', category: 'tools', condition: 'broken' },
  { name: 'Ladder', category: 'tools', description: 'x'.repeat(2001) },
  { name: 'Ladder', category: 'tools', owner_user_id: COMMUNITY },
])('rejects invalid create input %j', async (body) => {
  expect((await api('post', '/items').send(body)).status).toBe(400);
});
it('creates a personal item as the caller, ignoring no ownership fields', async () => {
  mockQuery.mockImplementation(async (sql: string) => ({
    rows: sql.includes('INSERT INTO inventory.items') ? [item] : [],
    rowCount: 1,
  }));
  const res = await api('post', '/items').send({ name: ' Ladder ', category: 'tools' });
  expect(res.status).toBe(201);
  expect(res.body.data.id).toBe(ITEM);
  const insert = mockQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO inventory.items'));
  expect(insert[1]).toContain(OWNER);
  expect(insert[1]).toContain('Ladder');
});
it('rejects community creation by a non-admin even with an admin JWT hint', async () => {
  const hinted = jwt.sign(
    { userId: OWNER, communities: [{ id: COMMUNITY, role: 'admin' }] },
    process.env.JWT_SECRET || 'dev-secret-key'
  );
  const res = await request(app)
    .post('/requests/inventory/items')
    .set('Authorization', `Bearer ${hinted}`)
    .send({ name: 'Ladder', category: 'tools', owner_community_id: COMMUNITY });
  expect(res.status).toBe(403);
});
it.each([Array(51).fill(COMMUNITY), ['not-a-uuid'], [COMMUNITY, COMMUNITY]])(
  'rejects invalid share sets',
  async (community_ids) => {
    expect((await api('put', `/items/${ITEM}/shares`).send({ community_ids })).status).toBe(400);
  }
);
it('returns 404 for an invisible item and 403 for a non-member community', async () => {
  expect((await api('get', `/items/${ITEM}`)).status).toBe(404);
  expect((await api('get', `/community/${COMMUNITY}`)).status).toBe(403);
});
it.each(['patch', 'delete', 'put'] as const)(
  'does not leak invisible items on %s',
  async (method) => {
    const path = `/items/${ITEM}${method === 'put' ? '/shares' : ''}`;
    expect(
      (await api(method, path).send(method === 'put' ? { community_ids: [] } : { name: 'Updated' }))
        .status
    ).toBe(404);
  }
);
it.each([{ owner_community_id: COMMUNITY }, { status: 'on_loan' }, { name: '' }, {}])(
  'rejects invalid patches %j',
  async (body) => {
    expect((await api('patch', `/items/${ITEM}`).send(body)).status).toBe(400);
  }
);
it('rejects invalid item UUIDs without a database error', async () => {
  expect((await api('get', '/items/not-a-uuid')).status).toBe(400);
});
