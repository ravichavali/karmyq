import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@karmyq/shared/middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'member-1', email: 'member@example.test', communities: [] };
    next();
  },
}));

import profileTagsRouter from '../../src/routes/profileTags';
import usersRouter from '../../src/routes/users';

const vocabulary = [
  { slug: 'carpentry', label: 'Carpentry', synonyms: [] },
  { slug: 'pet_care', label: 'Pet care', synonyms: ['pet care'] },
  { slug: 'tutoring', label: 'Tutoring', synonyms: ['spanish tutoring'] },
];

function app() {
  const server = express();
  server.use(express.json());
  server.use('/auth/profile/tags', profileTagsRouter);
  server.use('/users', usersRouter);
  return server;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (/FROM auth\.skill_vocabulary/i.test(sql)) {
      if (params.length === 0) {
        return { rows: vocabulary.map(({ label }) => ({ label })), rowCount: vocabulary.length };
      }
      const normalized = String(params[0]);
      const row = vocabulary.find(v =>
        v.slug === normalized.replace(/ /g, '_') ||
        v.label.toLowerCase() === normalized ||
        v.synonyms.includes(normalized)
      );
      return { rows: row ? [{ slug: row.slug }] : [], rowCount: row ? 1 : 0 };
    }
    if (/INSERT INTO auth\.user_tags/i.test(sql)) {
      const [userId, tagType, tagValue, skillSlug] = params;
      return {
        rows: [{ id: 'tag-1', user_id: userId, tag_type: tagType, tag_value: tagValue,
          skill_slug: /skill_slug/i.test(sql) ? (skillSlug ?? null) : undefined }],
        rowCount: 1,
      };
    }
    if (/SELECT id, tag_type, tag_value, skill_slug FROM auth\.user_tags/i.test(sql)) {
      return {
        rows: [{ id: 'tag-1', tag_type: 'skill', tag_value: 'Carpentry', skill_slug: 'carpentry' }],
        rowCount: 1,
      };
    }
    return { rows: [{ id: 'legacy-skill', skill: 'carpentry' }], rowCount: 1 };
  });
});

describe('Sprint 132 skill vocabulary', () => {
  it.each([
    ['Carpentry', 'carpentry', 'carpentry'],
    ['  pet care ', 'pet_care', 'pet care'],
    ['Spanish tutoring', 'tutoring', 'spanish tutoring'],
    ['underwater basket', null, 'underwater basket'],
    ['carp', null, 'carp'],
  ])('resolves %j exactly to %j', async (input, expected, normalized) => {
    // This import is inside the test so the still-missing module fails this assertion,
    // while the route-removal test can run and report its own red result.
    const { resolveSkillSlug } = require('../../src/services/skillVocabulary');
    expect(await resolveSkillSlug(input)).toBe(expected);
    const [sql, params] = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(sql).toMatch(/FROM auth\.skill_vocabulary/i);
    expect(sql).not.toMatch(/\bI?LIKE\b|position\s*\(/i);
    expect(params).toEqual([normalized]);
  });

  it('returns the resolved slug when posting a skill tag', async () => {
    const response = await request(app()).post('/auth/profile/tags')
      .send({ tag_type: 'skill', tag_value: 'Carpentry' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      tag_type: 'skill', tag_value: 'Carpentry', skill_slug: 'carpentry',
    }));
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO auth\.user_tags/i.test(sql));
    expect(insert?.[0]).toMatch(/skill_slug/);
    expect(insert?.[1]).toEqual(['member-1', 'skill', 'Carpentry', 'carpentry']);
  });

  it('does not resolve an interest tag', async () => {
    const response = await request(app()).post('/auth/profile/tags')
      .send({ tag_type: 'interest', tag_value: 'Carpentry' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      tag_type: 'interest', skill_slug: null,
    }));
    expect(mockQuery.mock.calls.some(([sql]) => /FROM auth\.skill_vocabulary/i.test(sql))).toBe(false);
  });

  it('serves skill suggestions from the vocabulary table', async () => {
    const response = await request(app()).get('/auth/profile/tags/suggestions?tag_type=skill');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(vocabulary.map(({ label }) => label));
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT label FROM auth\.skill_vocabulary/i);
  });

  it('returns the canonical slug with each saved skill tag', async () => {
    const response = await request(app()).get('/auth/profile/tags');
    expect(response.status).toBe(200);
    expect(response.body.data.skills).toEqual([
      { id: 'tag-1', tag_value: 'Carpentry', skill_slug: 'carpentry' },
    ]);
    expect(mockQuery.mock.calls[0][1]).toEqual(['member-1']);
  });

  it('removes the legacy public user skills route', async () => {
    const response = await request(app()).get('/users/member-1/skills');
    expect(response.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
