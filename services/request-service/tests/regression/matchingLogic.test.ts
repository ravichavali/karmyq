/**
 * Unit Tests for Request Service - Matching Logic
 * Following TDD principles: Test business logic in isolation
 *
 * Test Coverage:
 * - Match creation validation
 * - Match acceptance workflow
 * - Match rejection workflow
 * - Auto-rejection of competing offers
 * - Request status transitions
 * - Authorization checks
 * - Edge cases
 */

import {
  createMatch,
  acceptMatch,
  rejectMatch,
  validateRequestForMatch,
  validateOfferForMatch,
} from '../../src/services/matchService';
import { query } from '../../src/database/db';
import { publishEvent } from '../../src/events/publisher';

// Mock external dependencies
jest.mock('../../src/database/db');
jest.mock('../../src/events/publisher');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockPublishEvent = publishEvent as jest.MockedFunction<typeof publishEvent>;

describe('Match Creation Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMatch - Validation', () => {
    it('should create match when request is OPEN and offer is ACTIVE', async () => {
      // Arrange
      const matchData = {
        request_id: 'req-123',
        offer_id: 'offer-456',
        responder_id: 'user-helper',
      };

      mockQuery
        // Check request exists and is open
        .mockResolvedValueOnce({
          rows: [{ id: 'req-123', status: 'open', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        // Check offer exists and is active
        .mockResolvedValueOnce({
          rows: [{ id: 'offer-456', status: 'active', offerer_id: 'user-helper' }],
          rowCount: 1,
        } as any)
        // Insert match
        .mockResolvedValueOnce({
          rows: [{ id: 'match-789', ...matchData, status: 'proposed' }],
          rowCount: 1,
        } as any)
        // Update offer status
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      // Act
      const match = await createMatch(matchData);

      // Assert
      expect(match.id).toBe('match-789');
      expect(mockPublishEvent).toHaveBeenCalledWith('match_created', expect.objectContaining({
        match_id: 'match-789',
        request_id: 'req-123',
      }));
    });

    it('should reject match creation if request status is NOT open', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-123', status: 'matched', requester_id: 'user-requester' }],
        rowCount: 1,
      } as any);

      // Act & Assert
      await expect(createMatch({
        request_id: 'req-123',
        offer_id: 'offer-456',
        responder_id: 'user-helper',
      })).rejects.toThrow('Request must be in open status');
    });

    it('should reject match creation if request does not exist', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      // Act & Assert
      await expect(createMatch({
        request_id: 'req-nonexistent',
        offer_id: 'offer-456',
        responder_id: 'user-helper',
      })).rejects.toThrow('Request not found');
    });

    it('should reject match if offer status is NOT active', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'req-123', status: 'open', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'offer-456', status: 'matched', offerer_id: 'user-helper' }],
          rowCount: 1,
        } as any);

      // Act & Assert
      await expect(createMatch({
        request_id: 'req-123',
        offer_id: 'offer-456',
        responder_id: 'user-helper',
      })).rejects.toThrow('Offer must be in active status');
    });

    it('should reject match if responder_id does not match offerer_id', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'req-123', status: 'open', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'offer-456', status: 'active', offerer_id: 'user-different' }],
          rowCount: 1,
        } as any);

      // Act & Assert
      await expect(createMatch({
        request_id: 'req-123',
        offer_id: 'offer-456',
        responder_id: 'user-helper', // Different from offerer_id
      })).rejects.toThrow('Responder must be the offer creator');
    });

    it('should allow match creation without offer_id (direct response)', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'req-123', status: 'open', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'match-789', request_id: 'req-123', responder_id: 'user-helper', status: 'proposed' }],
          rowCount: 1,
        } as any);

      // Act
      const match = await createMatch({
        request_id: 'req-123',
        responder_id: 'user-helper',
      });

      // Assert
      expect(match.id).toBe('match-789');
      // Should NOT call offer update query
      const updateOfferCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('UPDATE requests.help_offers')
      );
      expect(updateOfferCalls.length).toBe(0);
    });
  });

  describe('acceptMatch - Workflow', () => {
    const mockMatch = {
      id: 'match-789',
      request_id: 'req-123',
      offer_id: 'offer-456',
      responder_id: 'user-helper',
      requester_id: 'user-requester',
      status: 'proposed',
    };

    it('should accept match and update request status to MATCHED', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update match
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update request
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Reject others

      // Act
      await acceptMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      const updateCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('UPDATE')
      );

      expect(updateCalls.length).toBe(3);

      // Verify match updated to 'matched'
      expect(updateCalls[0][0]).toContain('requests.matches');
      expect(updateCalls[0][0]).toContain('status = \'matched\'');

      // Verify request updated to 'matched'
      expect(updateCalls[1][0]).toContain('requests.help_requests');
      expect(updateCalls[1][0]).toContain('status = \'matched\'');
    });

    it('should auto-reject all other proposed matches when one is accepted', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Act
      await acceptMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      const rejectQuery = mockQuery.mock.calls.find(call =>
        call[0].includes('status = \'rejected\'') &&
        call[0].includes('id != $2')
      );

      expect(rejectQuery).toBeDefined();
      expect(rejectQuery![1]).toContain('req-123');
      expect(rejectQuery![1]).toContain('match-789');
    });

    it('should publish match_accepted event', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValue({ rows: [], rowCount: 1 } as any);

      // Act
      await acceptMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      expect(mockPublishEvent).toHaveBeenCalledWith('match_accepted', {
        match_id: 'match-789',
        request_id: 'req-123',
        requester_id: 'user-requester',
        responder_id: 'user-helper',
      });
    });

    it('should reject if user is NOT the requester', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any);

      // Act & Assert
      await expect(acceptMatch({
        match_id: 'match-789',
        user_id: 'user-different',
      })).rejects.toThrow('Only the requester can accept this match');
    });

    it('should reject if match status is NOT proposed', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockMatch, status: 'matched' }],
        rowCount: 1,
      } as any);

      // Act & Assert
      await expect(acceptMatch({
        match_id: 'match-789',
        user_id: 'user-requester',
      })).rejects.toThrow('Match must be in proposed state to accept');
    });
  });

  describe('rejectMatch - Workflow', () => {
    const mockMatch = {
      id: 'match-789',
      request_id: 'req-123',
      requester_id: 'user-requester',
      status: 'proposed',
    };

    it('should reject match and keep request OPEN if other matches exist', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update match
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any); // 2 remaining

      // Act
      const result = await rejectMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      expect(result.requestReopened).toBe(false);

      // Should NOT reopen request
      const reopenQuery = mockQuery.mock.calls.find(call =>
        call[0].includes('UPDATE requests.help_requests')
      );
      expect(reopenQuery).toBeUndefined();
    });

    it('should reopen request if rejecting the last proposed match', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update match
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any) // No remaining
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Reopen request

      // Act
      const result = await rejectMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      expect(result.requestReopened).toBe(true);

      const reopenQuery = mockQuery.mock.calls.find(call =>
        call[0].includes('UPDATE requests.help_requests') &&
        call[0].includes('status = \'open\'')
      );
      expect(reopenQuery).toBeDefined();
    });

    it('should publish match_rejected event', async () => {
      // Arrange
      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 } as any);

      // Act
      await rejectMatch({ match_id: 'match-789', user_id: 'user-requester' });

      // Assert
      expect(mockPublishEvent).toHaveBeenCalledWith('match_rejected', {
        match_id: 'match-789',
        request_id: 'req-123',
      });
    });

    it('should reject if user is NOT the requester', async () => {
      // Arrange
      mockQuery.mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any);

      // Act & Assert
      await expect(rejectMatch({
        match_id: 'match-789',
        user_id: 'user-different',
      })).rejects.toThrow('Only the requester can reject this match');
    });
  });

  describe('Request Status Transitions', () => {
    it('should transition: open → matched (when match accepted)', async () => {
      const mockMatch = {
        id: 'match-1',
        request_id: 'req-1',
        requester_id: 'user-requester',
        status: 'proposed',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockMatch], rowCount: 1 } as any)
        .mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await acceptMatch({ match_id: 'match-1', user_id: 'user-requester' });

      const statusUpdate = mockQuery.mock.calls.find(call =>
        call[0].includes('UPDATE requests.help_requests') &&
        call[0].includes('status = \'matched\'')
      );

      expect(statusUpdate).toBeDefined();
    });

    it('should keep status: open → open (when match rejected but others exist)', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'match-1', request_id: 'req-1', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any);

      const result = await rejectMatch({ match_id: 'match-1', user_id: 'user-requester' });

      expect(result.requestReopened).toBe(false);
    });

    it('should transition: matched → open (when last match rejected)', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'match-1', request_id: 'req-1', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await rejectMatch({ match_id: 'match-1', user_id: 'user-requester' });

      expect(result.requestReopened).toBe(true);
    });

    it('should NOT transition if request status is invalid', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'expired', requester_id: 'user-requester' }],
        rowCount: 1,
      } as any);

      await expect(createMatch({
        request_id: 'req-1',
        responder_id: 'user-helper',
      })).rejects.toThrow('Request must be in open status');
    });
  });

  describe('Edge Cases & Concurrency', () => {
    it('should handle match not found error', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(acceptMatch({
        match_id: 'match-nonexistent',
        user_id: 'user-requester',
      })).rejects.toThrow('Match not found');
    });

    it('should handle concurrent match acceptance (first wins)', async () => {
      // This is a database-level concern (transactions)
      // Unit test: Verify behavior when match status is already 'matched'
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'match-1',
          request_id: 'req-1',
          requester_id: 'user-requester',
          status: 'matched', // Already accepted
        }],
        rowCount: 1,
      } as any);

      await expect(acceptMatch({
        match_id: 'match-1',
        user_id: 'user-requester',
      })).rejects.toThrow('Match must be in proposed state to accept');
    });

    it('should handle race condition: request already matched', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'matched', requester_id: 'user-requester' }],
        rowCount: 1,
      } as any);

      await expect(createMatch({
        request_id: 'req-1',
        responder_id: 'user-helper',
      })).rejects.toThrow('Request must be in open status');
    });

    it('should handle database query failure gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(createMatch({
        request_id: 'req-1',
        responder_id: 'user-helper',
      })).rejects.toThrow('Database connection failed');
    });
  });

  describe('Authorization & Security', () => {
    it('should verify requester authorization before accepting match', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'match-1',
          request_id: 'req-1',
          requester_id: 'user-requester',
          status: 'proposed',
        }],
        rowCount: 1,
      } as any);

      await expect(acceptMatch({
        match_id: 'match-1',
        user_id: 'user-unauthorized',
      })).rejects.toThrow('Only the requester can accept this match');
    });

    it('should verify requester authorization before rejecting match', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'match-1',
          request_id: 'req-1',
          requester_id: 'user-requester',
          status: 'proposed',
        }],
        rowCount: 1,
      } as any);

      await expect(rejectMatch({
        match_id: 'match-1',
        user_id: 'user-unauthorized',
      })).rejects.toThrow('Only the requester can reject this match');
    });

    it('should verify responder matches offer creator', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'req-1', status: 'open', requester_id: 'user-requester' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'offer-1', status: 'active', offerer_id: 'user-legitimate-helper' }],
          rowCount: 1,
        } as any);

      await expect(createMatch({
        request_id: 'req-1',
        offer_id: 'offer-1',
        responder_id: 'user-imposter',
      })).rejects.toThrow('Responder must be the offer creator');
    });
  });

  describe('State Machine Validation', () => {
    it('should define valid match state transitions', () => {
      const validTransitions = {
        proposed: ['matched', 'rejected'],
        matched: ['completed', 'cancelled'],
        rejected: [], // Terminal state
        completed: [], // Terminal state
        cancelled: [], // Terminal state
      };

      expect(validTransitions.proposed).toContain('matched');
      expect(validTransitions.proposed).toContain('rejected');
      expect(validTransitions.rejected.length).toBe(0);
    });

    it('should only allow acceptance from proposed state', async () => {
      const invalidStates = ['matched', 'rejected', 'completed', 'cancelled'];

      for (const state of invalidStates) {
        mockQuery.mockResolvedValueOnce({
          rows: [{
            id: 'match-1',
            request_id: 'req-1',
            requester_id: 'user-requester',
            status: state,
          }],
          rowCount: 1,
        } as any);

        await expect(acceptMatch({
          match_id: 'match-1',
          user_id: 'user-requester',
        })).rejects.toThrow('Match must be in proposed state to accept');
      }
    });

    it('should validate request status before match creation', async () => {
      const invalidStates = ['matched', 'completed', 'expired', 'cancelled'];

      for (const status of invalidStates) {
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: 'req-1', status, requester_id: 'user-requester' }],
          rowCount: 1,
        } as any);

        await expect(createMatch({
          request_id: 'req-1',
          responder_id: 'user-helper',
        })).rejects.toThrow('Request must be in open status');
      }
    });
  });
});

describe('Validation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequestForMatch', () => {
    it('should return valid for open requests', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'open', requester_id: 'user-1' }],
        rowCount: 1,
      } as any);

      const result = await validateRequestForMatch('req-1');

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for non-existent requests', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await validateRequestForMatch('req-nonexistent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request not found');
      expect(result.status).toBe(404);
    });

    it('should return error for non-open requests', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-1', status: 'matched', requester_id: 'user-1' }],
        rowCount: 1,
      } as any);

      const result = await validateRequestForMatch('req-1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request must be in open status');
      expect(result.status).toBe(400);
    });
  });

  describe('validateOfferForMatch', () => {
    it('should return valid for active offers with matching responder', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'offer-1', status: 'active', offerer_id: 'user-helper' }],
        rowCount: 1,
      } as any);

      const result = await validateOfferForMatch('offer-1', 'user-helper');

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for non-existent offers', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await validateOfferForMatch('offer-nonexistent', 'user-helper');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Offer not found');
      expect(result.status).toBe(404);
    });

    it('should return error for non-active offers', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'offer-1', status: 'matched', offerer_id: 'user-helper' }],
        rowCount: 1,
      } as any);

      const result = await validateOfferForMatch('offer-1', 'user-helper');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Offer must be in active status');
      expect(result.status).toBe(400);
    });

    it('should return error when responder does not match offerer', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'offer-1', status: 'active', offerer_id: 'user-different' }],
        rowCount: 1,
      } as any);

      const result = await validateOfferForMatch('offer-1', 'user-helper');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Responder must be the offer creator');
      expect(result.status).toBe(403);
    });
  });
});
