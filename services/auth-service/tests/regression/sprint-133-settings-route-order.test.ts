import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
import users from '../../src/routes/users';

const SELF = '11111111-1111-4111-8111-111111111111';
const token = () => jwt.sign({ userId: SELF, email: 'self@example.test', communities: [] }, process.env.JWT_SECRET!);
const app = express();
app.use(express.json());
app.use('/users', users);
beforeEach(() => mockQuery.mockReset());

describe('Sprint 133 privacy settings (route-order guard, not a reorder fix)', () => {
  it('reaches settings and defaults skill sharing on when no row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app).get('/users/me/settings').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ user_id: SELF, show_my_karma_to_me: false, share_skills_with_communities: true });
    expect(mockQuery.mock.calls[0][0]).toContain('auth.user_privacy_settings');
    expect(mockQuery.mock.calls[0][1]).toEqual([SELF]);
  });

  it.each([
    [{ share_skills_with_communities: false }, ['share_skills_with_communities']],
    [{ show_my_karma_to_me: true }, ['show_my_karma_to_me']],
    [{ show_my_karma_to_me: true, share_skills_with_communities: false }, ['show_my_karma_to_me', 'share_skills_with_communities']],
  ])('persists only provided booleans: %j', async (body, fields) => {
    mockQuery.mockResolvedValue({ rows: [{ user_id: SELF, show_my_karma_to_me: true, share_skills_with_communities: false }], rowCount: 1 });
    const res = await request(app).patch('/users/me/settings').set('Authorization', `Bearer ${token()}`).send(body);
    expect(res.status).toBe(200);
    const [sql, params] = mockQuery.mock.calls[0];
    const writes = sql.split(/RETURNING/i)[0];
    for (const field of fields) expect(writes).toContain(field);
    for (const field of ['show_my_karma_to_me', 'share_skills_with_communities'].filter(f => !fields.includes(f))) expect(writes).not.toContain(field);
    expect(params[0]).toBe(SELF);
    expect(params.slice(1)).toEqual(fields.map(f => (body as any)[f]));
  });

  it.each([{}, { share_skills_with_communities: 'false' }, { share_skills_with_communities: null },
    { show_my_karma_to_me: true, share_skills_with_communities: 'false' }])('rejects invalid %j without writing', async body => {
    expect((await request(app).patch('/users/me/settings').set('Authorization', `Bearer ${token()}`).send(body)).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
