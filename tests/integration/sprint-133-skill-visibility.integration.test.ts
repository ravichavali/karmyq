/** Real service/JWT/SQL. Missing infrastructure is a failure, never a silent skip. */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 133 PR A live skill visibility and opt-out', () => {
  const pool = createPool();
  const owner = randomUUID(), viewer = randomUUID(), other = randomUUID(), pending = randomUUID();
  const c = randomUUID(), d = randomUUID(), tag = randomUUID();
  const users = [owner, viewer, other, pending];
  const api = (userId: string) => {
    const token = jwt.sign({ userId, email: `${userId}@skills.test`, communities: [{ id: c, role: 'admin', name: 'Stale claim' }] }, process.env.JWT_SECRET!);
    return {
      get: (path: string) => request(ServiceUrls.AUTH).get(path).set('Authorization', `Bearer ${token}`),
      patch: (path: string) => request(ServiceUrls.AUTH).patch(path).set('Authorization', `Bearer ${token}`),
    };
  };
  const directory = () => api(viewer).get(`/auth/skills/communities/${c}`);
  const search = (text = 'Carpentry') => api(viewer).get(`/auth/skills/communities/${c}/search`).query({ skill: text });
  const read = (userId: string) => api(userId).get(`/auth/skills/users/${owner}`);
  const error = (res: request.Response) => ({ success: res.body.success, error: res.body.error, message: res.body.message });

  beforeAll(async () => {
    await pool.query('SELECT 1');
    for (const id of users) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, id === owner ? 'Ada' : 'Zoe', `${id}@skills.test`, 'not-a-login']);
    for (const id of [c, d]) await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `Skills ${id}`, 'Fixture', owner]);
    for (const id of [owner, viewer]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, c]);
    await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [other, d]);
    await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','pending')", [pending, c]);
    await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value,skill_slug) VALUES ($1,$2,'skill','Carpentry','carpentry')", [tag, owner]);
    for (const id of [viewer, pending]) await pool.query("INSERT INTO auth.user_tags(user_id,tag_type,tag_value,skill_slug) VALUES ($1,'skill','Carpentry','carpentry')", [id]);
    await pool.query("INSERT INTO auth.user_tags(user_id,tag_type,tag_value) VALUES ($1,'interest','Private interest'),($1,'need','Private need'),($1,'skill','Underwater Basket')", [owner]);
  });
  afterAll(async () => {
    try {
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[c, d]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  beforeEach(async () => { await pool.query('DELETE FROM auth.user_privacy_settings WHERE user_id=ANY($1::uuid[])', [users]); });

  it('shows only skills to an active co-member with no privacy row; outsiders and pending members get indistinguishable 404s', async () => {
    const visible = await read(viewer);
    expect(visible.status).toBe(200);
    expect(visible.body.data).toEqual(expect.arrayContaining([{ tag_id: tag, label: 'Carpentry', skill_slug: 'carpentry' }]));
    expect(visible.body.data).toHaveLength(2);
    const unknown = await api(other).get(`/auth/skills/users/${randomUUID()}`);
    const pendingOwner = await api(viewer).get(`/auth/skills/users/${pending}`);
    expect(pendingOwner.status).toBe(404);
    expect(error(pendingOwner)).toEqual(error(unknown));
    const pendingSelf = await api(pending).get(`/auth/skills/users/${pending}`);
    expect(pendingSelf.status).toBe(200);
    expect(pendingSelf.body.data.map((skill: any) => skill.label)).toEqual(['Carpentry']);
    for (const id of [other, pending]) {
      const hidden = await read(id);
      expect(hidden.status).toBe(404);
      expect(error(hidden)).toEqual(error(unknown));
      expect((await api(id).get(`/auth/skills/communities/${c}`)).status).toBe(404);
      expect((await api(id).get(`/auth/skills/communities/${c}/search?skill=Carpentry`)).status).toBe(404);
    }
    expect((await directory()).body.data).toEqual(expect.arrayContaining([{ skill_key: 'carpentry', label: 'Carpentry', member_count: 2 }]));
  });

  it('opt-out hides all three co-member surfaces and lowers the directory count exactly once; self still sees their skills', async () => {
    expect((await directory()).body.data.find((r: any) => r.skill_key === 'carpentry').member_count).toBe(2);
    expect((await search()).body.data.map((r: any) => r.user_id)).toEqual([owner, viewer]);
    const updated = await api(owner).patch('/users/me/settings').send({ share_skills_with_communities: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.share_skills_with_communities).toBe(false);
    expect((await read(viewer)).status).toBe(404);
    expect((await search()).body.data.map((r: any) => r.user_id)).toEqual([viewer]);
    expect((await directory()).body.data.find((r: any) => r.skill_key === 'carpentry').member_count).toBe(1);
    expect((await read(owner)).body.data).toHaveLength(2);
  });

  it('resolves exact vocabulary and free text but never substrings', async () => {
    expect((await search('carp')).body.data).toEqual([]);
    const custom = await search(' underwater basket ');
    expect(custom.status).toBe(200);
    expect(custom.body.data.map((r: any) => r.user_id)).toEqual([owner]);
    expect(custom.body.data[0].skills.map((r: any) => r.label)).toEqual(['Underwater Basket']);
  });

  it('settings updates preserve the omitted boolean in both directions', async () => {
    expect((await api(owner).patch('/users/me/settings').send({ show_my_karma_to_me: true })).status).toBe(200);
    const skills = await api(owner).patch('/users/me/settings').send({ share_skills_with_communities: false });
    expect(skills.body.data).toMatchObject({ show_my_karma_to_me: true, share_skills_with_communities: false });
    const karma = await api(owner).patch('/users/me/settings').send({ show_my_karma_to_me: false });
    expect(karma.body.data).toMatchObject({ show_my_karma_to_me: false, share_skills_with_communities: false });
  });

  it('uses identical SQL normalization for a full Unicode custom skill and its directory chip', async () => {
    const unicodeTag = randomUUID();
    await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value) VALUES ($1,$2,'skill','İğne oyası')", [unicodeTag, owner]);
    try {
      expect((await directory()).body.data).toEqual(expect.arrayContaining([{ skill_key: '_ne_oyas_', label: 'İğne oyası', member_count: 1 }]));
      for (const text of ['İğne oyası', '_ne_oyas_']) {
        const found = await search(text);
        expect(found.status).toBe(200);
        expect(found.body.data).toEqual([{ user_id: owner, name: 'Ada', skills: [{ tag_id: unicodeTag, label: 'İğne oyası' }] }]);
      }
    } finally { await pool.query('DELETE FROM auth.user_tags WHERE id=$1', [unicodeTag]); }
  });
});
