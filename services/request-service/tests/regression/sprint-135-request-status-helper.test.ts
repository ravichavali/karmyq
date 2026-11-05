/**
 * Sprint 135 (BUG-075, BUG-078): src/db/requestStatus.ts is the only module that writes a request's status.
 *
 * Mocked SQL contract for its four helpers: the exact statements, their order and parameters (no status is ever a
 * parameter), and what each returns. Their behaviour against real rows, including the races, runs in the root
 * tests/integration/sprint-135-request-status-guards.integration.test.ts.
 */
import { closeProposals, lockRequest, markRequestCancelled, reconcileRequestStatus } from '../../src/db/requestStatus';

const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const q = jest.fn();
const sqlOf = (n: number) => flat(String(q.mock.calls[n][0]));
const paramsOf = (n: number) => q.mock.calls[n][1];

const LOCK = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';
// Sprint 136 (BUG-085) adds the past_expiry column after the CASE; the CASE itself is unchanged.
const DERIVE =
  "SELECT CASE WHEN r.status = 'cancelled' THEN 'cancelled' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' " +
  "WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending' " +
  "ELSE 'open' END AS status, " +
  '(r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp())) AS past_expiry ' +
  'FROM requests.help_requests r WHERE r.id = $1';
const RECONCILE =
  'UPDATE requests.help_requests r SET status = CASE ' +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' " +
  "WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending' " +
  "ELSE 'open' END WHERE r.id = $1 AND r.status <> 'cancelled'";
const CANCEL =
  "UPDATE requests.help_requests r SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP " +
  "WHERE r.id = $1 AND r.requester_id = $2 AND r.status <> 'cancelled' " +
  "AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status IN ('matched', 'completed'))";

beforeEach(() => q.mockReset());

describe('lockRequest', () => {
  it('locks the row, then returns the DERIVED status from its own statement', async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] });
    await expect(lockRequest(q, 'req-1')).resolves.toBe('completed');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(LOCK);
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(DERIVE);
    expect(paramsOf(1)).toEqual(['req-1']);
  });

  it('returns null when there is no such request', async () => {
    q.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(lockRequest(q, 'missing')).resolves.toBeNull();
  });

  it('derives with the same three EXISTS branches, in the same order, as the reconcile write', () => {
    const branches = (sql: string) => sql.match(/WHEN EXISTS \([^)]*\) THEN '\w+'/g);
    expect(branches(DERIVE)).toEqual(branches(RECONCILE));
  });
});

describe('reconcileRequestStatus', () => {
  it('takes the lock, then derives the status in its own statement, leaving a cancelled request alone', async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await reconcileRequestStatus(q, 'req-1');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(LOCK);
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(RECONCILE);
    expect(paramsOf(1)).toEqual(['req-1']);
  });

  it('writes status only, so updated_at (the memory-retention clock) does not move', async () => {
    q.mockResolvedValue({ rowCount: 1, rows: [] });
    await reconcileRequestStatus(q, 'req-1');
    expect(sqlOf(1)).not.toContain('updated_at');
  });
});

describe('markRequestCancelled', () => {
  it("cancels only the caller's request, not already cancelled, with no exchange in progress or completed", async () => {
    q.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(markRequestCancelled(q, 'req-1', 'requester-1')).resolves.toBe(true);
    expect(q).toHaveBeenCalledTimes(1);
    expect(sqlOf(0)).toBe(CANCEL);
    expect(paramsOf(0)).toEqual(['req-1', 'requester-1']);
  });

  it('reports a guard miss', async () => {
    q.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(markRequestCancelled(q, 'req-1', 'requester-1')).resolves.toBe(false);
  });
});

describe('closeProposals', () => {
  it('frees only offers a proposal still holds, then rejects the proposals, in that order', async () => {
    q.mockResolvedValue({ rowCount: 1, rows: [] });
    await closeProposals(q, 'req-1');
    expect(q).toHaveBeenCalledTimes(2);
    expect(sqlOf(0)).toBe(
      "UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP " +
      "WHERE o.status = 'matched' AND o.id IN (SELECT offer_id FROM requests.matches " +
      "WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL) " +
      "AND NOT EXISTS (SELECT 1 FROM requests.matches m " +
      "WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed') " +
      "AND NOT (m.request_id = $1 AND m.status = 'proposed')) " +
      "AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)");
    expect(paramsOf(0)).toEqual(['req-1']);
    expect(sqlOf(1)).toBe(
      "UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP " +
      "WHERE request_id = $1 AND status = 'proposed'");
    expect(paramsOf(1)).toEqual(['req-1']);
  });
});
