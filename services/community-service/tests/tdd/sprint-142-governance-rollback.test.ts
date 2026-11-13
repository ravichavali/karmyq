import { createNomination } from '../../src/database/governanceDb';
import pool from '../../src/database/db';
jest.mock('../../src/database/db', () => ({ __esModule: true,default: { connect: jest.fn() } }));

describe('Sprint 142 transaction failure boundary', () => {
  it.each(['40P01','XX000'])('rolls back and releases the client on DB failure %s', async code => {
    const failure = Object.assign(new Error('private database failure'),{ code });
    const query = jest.fn().mockResolvedValue({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(failure);
    const release = jest.fn();
    (pool.connect as jest.Mock).mockResolvedValue({ query,release });
    const action = createNomination({ communityId: 'c',nominatorId: 'n',nominatedUserId: 't',role: 'moderator' });
    if (code === '40P01') await expect(action).rejects.toMatchObject({ status: 503,code: 'GOVERNANCE_RETRY' });
    else await expect(action).rejects.toBe(failure);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
