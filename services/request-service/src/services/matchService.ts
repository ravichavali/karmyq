/**
 * Match Service - Business logic for match creation, acceptance, and rejection
 * Extracted from route handlers to enable unit testing following TDD principles
 */

import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

export interface CreateMatchParams {
  request_id: string;
  offer_id?: string;
  responder_id: string;
}

export interface AcceptMatchParams {
  match_id: string;
  user_id: string;
}

export interface RejectMatchParams {
  match_id: string;
  user_id: string;
}

export interface MatchValidationResult {
  valid: boolean;
  error?: string;
  status?: number;
  data?: any;
}

/**
 * Validate request for match creation
 */
export async function validateRequestForMatch(request_id: string): Promise<MatchValidationResult> {
  const requestCheck = await query(
    'SELECT id, requester_id, status FROM requests.help_requests WHERE id = $1',
    [request_id]
  );

  if (requestCheck.rowCount === 0) {
    return {
      valid: false,
      error: 'Request not found',
      status: 404,
    };
  }

  const request = requestCheck.rows[0];

  if (request.status !== 'open') {
    return {
      valid: false,
      error: 'Request must be in open status',
      status: 400,
    };
  }

  return {
    valid: true,
    data: request,
  };
}

/**
 * Validate offer for match creation
 */
export async function validateOfferForMatch(offer_id: string, responder_id: string): Promise<MatchValidationResult> {
  const offerCheck = await query(
    'SELECT id, offerer_id, status FROM requests.help_offers WHERE id = $1',
    [offer_id]
  );

  if (offerCheck.rowCount === 0) {
    return {
      valid: false,
      error: 'Offer not found',
      status: 404,
    };
  }

  const offer = offerCheck.rows[0];

  if (offer.status !== 'active') {
    return {
      valid: false,
      error: 'Offer must be in active status',
      status: 400,
    };
  }

  if (offer.offerer_id !== responder_id) {
    return {
      valid: false,
      error: 'Responder must be the offer creator',
      status: 403,
    };
  }

  return {
    valid: true,
    data: offer,
  };
}

/**
 * Create a match between a request and responder/offer
 */
export async function createMatch(params: CreateMatchParams) {
  const { request_id, offer_id, responder_id } = params;

  // Validate request
  const requestValidation = await validateRequestForMatch(request_id);
  if (!requestValidation.valid) {
    throw new Error(requestValidation.error);
  }

  // Validate offer if provided
  if (offer_id) {
    const offerValidation = await validateOfferForMatch(offer_id, responder_id);
    if (!offerValidation.valid) {
      throw new Error(offerValidation.error);
    }
  }

  // Create match
  const matchResult = await query(
    `INSERT INTO requests.matches
      (request_id, offer_id, responder_id, status)
    VALUES ($1, $2, $3, 'proposed')
    RETURNING *`,
    [request_id, offer_id, responder_id]
  );

  const match = matchResult.rows[0];

  // Update offer status if provided
  if (offer_id) {
    await query(
      `UPDATE requests.help_offers SET status = 'matched' WHERE id = $1`,
      [offer_id]
    );
  }

  // Publish event
  await publishEvent('match_created', {
    match_id: match.id,
    request_id,
    offer_id,
    requester_id: requestValidation.data.requester_id,
    responder_id,
  });

  return match;
}

/**
 * Accept a proposed match
 */
export async function acceptMatch(params: AcceptMatchParams) {
  const { match_id, user_id } = params;

  // Get match details
  const matchCheck = await query(
    `SELECT
      m.id, m.request_id, m.offer_id, m.responder_id, m.status,
      r.requester_id
    FROM requests.matches m
    LEFT JOIN requests.help_requests r ON m.request_id = r.id
    WHERE m.id = $1`,
    [match_id]
  );

  if (matchCheck.rowCount === 0) {
    throw new Error('Match not found');
  }

  const match = matchCheck.rows[0];

  // Verify user is the requester
  if (match.requester_id !== user_id) {
    throw new Error('Only the requester can accept this match');
  }

  // Verify match is in proposed state
  if (match.status !== 'proposed') {
    throw new Error('Match must be in proposed state to accept');
  }

  // Accept match
  await query(
    `UPDATE requests.matches
     SET status = 'matched'
     WHERE id = $1`,
    [match_id]
  );

  // Update request status to matched
  await query(
    `UPDATE requests.help_requests
     SET status = 'matched'
     WHERE id = $1`,
    [match.request_id]
  );

  // Reject all other proposed matches for this request
  await query(
    `UPDATE requests.matches
     SET status = 'rejected'
     WHERE request_id = $1 AND id != $2 AND status = 'proposed'`,
    [match.request_id, match_id]
  );

  // Publish event
  await publishEvent('match_accepted', {
    match_id,
    request_id: match.request_id,
    requester_id: match.requester_id,
    responder_id: match.responder_id,
  });

  return match;
}

/**
 * Reject a proposed match
 */
export async function rejectMatch(params: RejectMatchParams) {
  const { match_id, user_id } = params;

  // Get match details
  const matchCheck = await query(
    `SELECT
      m.id, m.request_id, m.status,
      r.requester_id
    FROM requests.matches m
    LEFT JOIN requests.help_requests r ON m.request_id = r.id
    WHERE m.id = $1`,
    [match_id]
  );

  if (matchCheck.rowCount === 0) {
    throw new Error('Match not found');
  }

  const match = matchCheck.rows[0];

  // Verify user is the requester
  if (match.requester_id !== user_id) {
    throw new Error('Only the requester can reject this match');
  }

  // Reject match
  await query(
    `UPDATE requests.matches
     SET status = 'rejected'
     WHERE id = $1`,
    [match_id]
  );

  // Check if there are any remaining proposed matches
  const remainingMatches = await query(
    `SELECT COUNT(*) as count FROM requests.matches
     WHERE request_id = $1 AND status = 'proposed'`,
    [match.request_id]
  );

  // If no more proposed matches, reopen the request
  const shouldReopenRequest = remainingMatches.rows[0].count === '0';

  if (shouldReopenRequest) {
    await query(
      `UPDATE requests.help_requests SET status = 'open' WHERE id = $1`,
      [match.request_id]
    );
  }

  // Publish event
  await publishEvent('match_rejected', {
    match_id,
    request_id: match.request_id,
  });

  return {
    match,
    requestReopened: shouldReopenRequest,
  };
}
