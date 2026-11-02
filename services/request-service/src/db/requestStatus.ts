/**
 * Sprint 135 (BUG-075, BUG-078): the only module that writes a request's status.
 *
 * A request's status follows its rows. It is 'matched' while an exchange on it is in progress, 'completed' once one has
 * completed and none is in progress, 'dibs_pending' while a dibs invitation waits, and 'open' otherwise. 'cancelled' is
 * the requester's decision, and nothing derives it away.
 *
 * Every writer changes its own row (a match, a dibs, an offer) with a guarded statement, then calls
 * reconcileRequestStatus in the same transaction. The reconcile takes the request row lock and derives the status in a
 * fresh statement, so the transaction that reconciles last sees every row committed before it.
 *
 * Lock order:
 * - request-first writers (accept, reject, propose-match, dibs create, provider-offer accept, requester cancel) touch
 *   only 'proposed' matches;
 * - match-first writers (complete, cancel) touch only 'matched' ones;
 * - the dibs routes lock the dibs row before the request, as cleanup-service's expiry job does.
 * Never lock a request and then a dibs row.
 *
 * tests/regression/sprint-135-request-status-gate.test.ts fails on a request-status write anywhere else.
 */
export type TxQuery = (text: string, params?: any[]) => Promise<any>;
export type RequestStatus = 'open' | 'dibs_pending' | 'matched' | 'completed' | 'cancelled';

/** The request row lock. One literal for both helpers, so the directed-surface allowlist has one entry for it. */
const LOCK_REQUEST = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';

/**
 * Lock the request row until the transaction ends, then return its DERIVED status (what reconcileRequestStatus would
 * write), or null when there is no such request. Preconditions read this, not the stored column: an old row whose stored
 * status disagrees with its rows (the 2026-10-29 demo rows) is judged by its rows.
 *
 * The derivation is its own statement after the lock: a statement that waited on the lock would keep a snapshot from
 * before the wait in its subqueries. The status is current, because no writer can change these rows while this
 * transaction holds the request lock.
 */
export async function lockRequest(q: TxQuery, requestId: string): Promise<RequestStatus | null> {
  await q(LOCK_REQUEST, [requestId]);
  const result = await q(
    `SELECT CASE
       WHEN r.status = 'cancelled' THEN 'cancelled'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending'
       ELSE 'open' END AS status
     FROM requests.help_requests r WHERE r.id = $1`,
    [requestId]
  );
  return result.rows[0]?.status ?? null;
}

/**
 * Derive the request's status from its matches and dibs, and write it. Call it after the writer's own row changes.
 *
 * The UPDATE is its own statement after the lock. A single UPDATE that waited on the row lock would re-check only the
 * request row, while its EXISTS subqueries kept the snapshot from before the wait (the BUG-074 cancel note). It writes
 * status only, as the match routes always have: updated_at stays put, so the memory-retention window does not move.
 * Re-taking a lock this transaction already holds is immediate, so callers need not track whether they hold it.
 */
export async function reconcileRequestStatus(q: TxQuery, requestId: string): Promise<void> {
  await q(LOCK_REQUEST, [requestId]);
  await q(
    `UPDATE requests.help_requests r
     SET status = CASE
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending'
       ELSE 'open' END
     WHERE r.id = $1 AND r.status <> 'cancelled'`,
    [requestId]
  );
}

/**
 * The requester's cancel, guarded in the write: the caller's own request, not already cancelled, with no exchange in
 * progress or completed (its derived status is open or dibs_pending). Returns whether it cancelled. The caller holds the
 * request lock.
 */
export async function markRequestCancelled(q: TxQuery, requestId: string, requesterId: string): Promise<boolean> {
  const result = await q(
    `UPDATE requests.help_requests r
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE r.id = $1 AND r.requester_id = $2 AND r.status <> 'cancelled'
       AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status IN ('matched', 'completed'))`,
    [requestId, requesterId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reject every proposal still open on the request, and free each one's offer only while the proposal holds it: a
 * withdrawn offer stays withdrawn (BUG-008, BUG-078). Offers first, so the subquery still sees the proposals.
 */
export async function closeProposals(q: TxQuery, requestId: string): Promise<void> {
  await q(
    `UPDATE requests.help_offers
     SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'matched' AND id IN (
       SELECT offer_id FROM requests.matches
       WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL
     )`,
    [requestId]
  );
  await q(
    `UPDATE requests.matches
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1 AND status = 'proposed'`,
    [requestId]
  );
}
