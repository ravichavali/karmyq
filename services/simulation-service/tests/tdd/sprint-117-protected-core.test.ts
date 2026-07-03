import fs from 'fs';
import path from 'path';

const mockQuery = jest.fn();
jest.mock('pg', () => ({
  __esModule: true,
  Pool: class {
    query = mockQuery;
    end = jest.fn();
  },
}));

import { getRandomUser, getUserCount, initPool } from '../../src/db-user-loader';
import { getProtectedFixtureEmails } from '../../src/fixtures/curatedDemo/manifest';

function scriptPath(name: string): string {
  return path.resolve(__dirname, '../../../../scripts', name);
}

describe('Sprint 117 protected core', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEMO_PERSONA_EMAIL;
    initPool('postgres://ignored', 'secret');
  });

  it('binds every protected manifest email as an exclusion in actor and count queries', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'other@test.karmyq.com', name: 'Other' }] })
      .mockResolvedValueOnce({ rows: [{ count: '30' }] });

    const protectedEmails = getProtectedFixtureEmails();
    await getRandomUser();
    await getUserCount();

    for (const [sql, params] of mockQuery.mock.calls) {
      expect(sql).toContain('lower(email) <> ALL');
      expect(params).toContainEqual(protectedEmails.map(x => x.toLowerCase()));
    }
  });

  it('excludes every protected identity, not only the configured persona', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'other@test.karmyq.com', name: 'Other' }] });
    await getRandomUser();
    const params = mockQuery.mock.calls[0][1] as string[][];
    const exclusions = params[0];
    expect(exclusions).toEqual(expect.arrayContaining([
      'maria.reyes@test.karmyq.com',
      'elena.torres@test.karmyq.com',
      'noah.williams@test.karmyq.com',
      'sophia.chen@test.karmyq.com',
    ]));
    expect(exclusions.length).toBeGreaterThanOrEqual(9);
  });

  it('routes legacy shell/batch truncate wrappers to the guarded reset:demo path', () => {
    expect(fs.readFileSync(scriptPath('truncate-database.sh'), 'utf8')).toContain('reset:demo');
    expect(fs.readFileSync(scriptPath('truncate-database.bat'), 'utf8')).toContain('reset:demo');
  });

  it('makes the raw SQL truncate refuse instead of destroying data', () => {
    const sql = fs.readFileSync(scriptPath('truncate-database.sql'), 'utf8');
    expect(sql).not.toMatch(/TRUNCATE\s+TABLE/i);
    expect(sql).not.toMatch(/session_replication_role/i);
    expect(sql).toMatch(/refus/i);
  });

  it('keeps deploy read-only: no automatic reset apply, recommends verify:demo', () => {
    const deploy = fs.readFileSync(scriptPath('deploy.sh'), 'utf8');
    expect(deploy).not.toContain('reset:demo -- --apply');
    expect(deploy).toContain('verify:demo');
  });
});
