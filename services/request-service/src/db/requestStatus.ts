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
 * Sprint 136 (BUG-085): an open ask past its expiry takes no new commitment. It is past expiry when the sweep flagged it
 * (expired) or its expires_at has passed and the sweep has not run yet. The writers that start a commitment (propose,
 * accept, dibs create, provider-offer accept, POST /matches) read lockRequestForCommitment, which reports such an ask as
 * 'expired', so each refuses it as not open. Cancel and reject read lockRequest, so an expired ask can still be
 * closed. Dibs accept reads lockRequest too, by decision (spec D): the invitation carries its own expiry, which the
 * accept checks under the dibs row lock (the sweep flags only asks stored as 'open'). The stored status does not
 * change: an expired ask stays 'open' in the column.
 *
 * tests/regression/sprint-135-request-status-gate.test.ts fails on a request-status write anywhere else.
 */
export type TxQuery = (text: string, params?: any[]) => Promise<any>;
export type RequestStatus = 'open' | 'dibs_pending' | 'matched' | 'completed' | 'cancelled';
/** What a commitment writer reads: the derived status, or 'expired' for an open ask past its expiry (BUG-085). */
export type CommitmentStatus = RequestStatus | 'expired';

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
  return (await lockAndDerive(q, requestId))?.status ?? null;
}

/**
 * lockRequest for the writers that start a commitment (propose, accept, dibs create, provider-offer accept, POST
 * /matches): an open ask past its expiry reads 'expired', so each refuses it as not open, as POST /matches's fast path
 * always has for a flagged ask (BUG-085). Every other derived status is returned unchanged.
 */
export async function lockRequestForCommitment(q: TxQuery, requestId: string): Promise<CommitmentStatus | null> {
  const locked = await lockAndDerive(q, requestId);
  if (!locked) return null;
  return locked.status === 'open' && locked.pastExpiry ? 'expired' : locked.status;
}

/**
 * The lock, then the derived status and whether the ask is past its expiry, in one statement after it. The expiry uses
 * clock_timestamp(), not NOW(): the statement runs after a lock wait, and NOW() is the transaction's start. `expired` is
 * nullable, hence IS TRUE; expires_at is a timestamp without time zone, compared as the feed compares it.
 */
async function lockAndDerive(q: TxQuery, requestId: string): Promise<{ status: RequestStatus; pastExpiry: boolean } | null> {
  await q(LOCK_REQUEST, [requestId]);
  const result = await q(
    `SELECT CASE
       WHEN r.status = 'cancelled' THEN 'cancelled'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched'
       WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed'
       WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending'
       ELSE 'open' END AS status,
       (r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp())) AS past_expiry
     FROM requests.help_requests r WHERE r.id = $1`,
    [requestId]
  );
  const row = result.rows[0];
  return row ? { status: row.status, pastExpiry: row.past_expiry === true } : null;
}

/**
 * Derive the request's status from its matches and dibs, and write it. Call it after the writer's own row changes.
 *
 * The UPDATE is its own statement after the lock. A single UPDATE that waited on the row lock would re-check only the
 * request row, while its EXISTS subqueries kept the snapshot from before the wait (the BUG-074 cancel note). It writes
 * status only, as the match routes always have: updated_at stays put, as the time of the last edit. Memory retention
 * ages a completed ask from its newest completed match, with updated_at only as the fallback (BUG-083).
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
 * request lock. Call it after lockRequest in the same transaction.
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
 * Free a matched offer only when no proposed, matched or completed match still holds it (BUG-089). The caller must
 * update its own match row first. Among runtime writers in services/<service>/src, only POST /matches sets matched
 * (from active) and inserts an offer-backed match; B4 gates both. Overlapping releases can still permit a matched ->
 * active -> matched cycle. Compare the target's statement-local CTID to a distinct scalar snapshot self-scan, so EPQ
 * cannot free a newer version whose hold the old snapshot misses. Even metadata changes defer release to a later D2.
 * CTID is never persisted or used as logical identity; see spec B5's PostgreSQL 15 source reasoning and CI cases.
 */
export async function releaseOffer(q: TxQuery, offerId: string): Promise<void> {
  await q(
    `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE o.id = $1 AND o.status = 'matched'
       AND NOT EXISTS (SELECT 1 FROM requests.matches m
                        WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed'))
       AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`,
    [offerId]
  );
}

/**
 * Reject every proposal still open on the request, and free each one's offer only while the proposal holds it: a
 * withdrawn offer stays withdrawn (BUG-008, BUG-078), and a shared offer stays matched while another match holds it
 * (BUG-089). Offers first, so the subquery still sees the proposals. The statement-local version check defers a
 * concurrently changed offer, including a re-held one, to a later sweep (spec B5, I1).
 */
export async function closeProposals(q: TxQuery, requestId: string): Promise<void> {
  await q(
    // Keep this SQL text for text with cleanup-service/src/jobs/expirationJob.ts's expired-proposal offer release.
    `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE o.status = 'matched'
       AND o.id IN (SELECT offer_id FROM requests.matches
                     WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM requests.matches m
                        WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed')
                          AND NOT (m.request_id = $1 AND m.status = 'proposed'))
       AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`,
    [requestId]
  );
  await q(
    `UPDATE requests.matches
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1 AND status = 'proposed'`,
    [requestId]
  );
}
