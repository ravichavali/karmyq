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

const MARIA = 'maria.reyes@test.karmyq.com';

describe('Sprint 116 demo persona simulation exclusion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEMO_PERSONA_EMAIL = MARIA;
    initPool('postgres://ignored', 'secret');
  });

  afterEach(() => {
    delete process.env.DEMO_PERSONA_EMAIL;
  });

  it('excludes the configured demo persona from random actors and actor counts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'other@test.karmyq.com', name: 'Other' }] })
      .mockResolvedValueOnce({ rows: [{ count: '41' }] });

    await getRandomUser();
    await expect(getUserCount()).resolves.toBe(41);

    for (const [sql, params] of mockQuery.mock.calls) {
      expect(sql).toContain('LOWER(email) <> LOWER($1)');
      expect(params).toEqual([MARIA]);
    }
  });

  it('propagates the configured demo persona into the PM2 simulation environment', () => {
    const deployScript = fs.readFileSync(
      path.resolve(__dirname, '../../../../scripts/deploy.sh'),
      'utf8',
    );

    expect(deployScript).toContain('echo "DEMO_PERSONA_EMAIL=${DEMO_PERSONA_EMAIL:-}"');
  });
});
