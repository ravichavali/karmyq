import { Router, Request, Response } from 'express';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversation,
  getMessages,
  sendMessage,
} from '../services/messageService';
import { query } from '../database/db';

// AuthenticatedRequest type - matches the shared middleware
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    communities?: Array<{ id: string; name: string; role: string }>;
  };
}

const router = Router();

// Get user's conversations
// SECURITY: userId comes from verified JWT token via authMiddleware, not from query params
router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const conversations = await getUserConversations(userId);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching conversations', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversations',
    });
  }
});

// Get or create conversation for a match
// SECURITY: Validates that current user is one of the participants
router.post('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { match_id, participant_ids } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!match_id || !participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({
        success: false,
        message: 'match_id and participant_ids are required',
      });
    }

    // SECURITY: Ensure the authenticated user is one of the participants
    if (!participant_ids.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You must be a participant in the conversation',
      });
    }

    const conversation = await getOrCreateConversation(match_id, participant_ids);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error creating conversation', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create conversation',
    });
  }
});

// Get specific conversation
// SECURITY: userId comes from verified JWT token via authMiddleware
router.get('/conversations/:conversationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const conversation = await getConversation(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching conversation', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch conversation',
    });
  }
});

// Get messages for a conversation
// SECURITY: userId comes from verified JWT token via authMiddleware
router.get('/conversations/:conversationId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const messages = await getMessages(conversationId, userId, limit, offset);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching messages', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch messages',
    });
  }
});

// Send message (REST API fallback - Socket.IO is preferred)
// SECURITY: sender_id is taken from verified JWT token, not from request body
router.post('/conversations/:conversationId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'content is required',
      });
    }

    // SECURITY: Always use verified userId from JWT, never trust client-provided sender_id
    const message = await sendMessage(conversationId, userId, content);

    res.json({
      success: true,
      data: message,
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error sending message', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
});

// Match-based messaging endpoints
// GET /match/:matchId - Get or create conversation for a match and return messages
router.get('/match/:matchId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matchId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get match details to find both participants (requester and responder)
    const matchResult = await query(
      `SELECT
        m.id, m.request_id, m.responder_id,
        r.requester_id
       FROM requests.matches m
       JOIN requests.help_requests r ON m.request_id = r.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchResult.rows[0];
    const participantIds = [match.requester_id, match.responder_id];

    // Verify current user is one of the participants
    if (!participantIds.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this match',
      });
    }

    // Get or create conversation with both participants
    const conversation = await getOrCreateConversation(matchId, participantIds);

    // Get messages for this conversation
    const messages = await getMessages(conversation.id, userId, 50, 0);

    res.json({
      success: true,
      data: {
        conversation_id: conversation.id,
        messages: messages,
      },
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching match conversation', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch match conversation',
    });
  }
});

// POST /match/:matchId/messages - Send message in match conversation
router.post('/match/:matchId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matchId } = req.params;
    const userId = req.user?.userId;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'content is required',
      });
    }

    // Get match details to find both participants (requester and responder)
    const matchResult = await query(
      `SELECT
        m.id, m.request_id, m.responder_id,
        r.requester_id
       FROM requests.matches m
       JOIN requests.help_requests r ON m.request_id = r.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const match = matchResult.rows[0];
    const participantIds = [match.requester_id, match.responder_id];

    // Verify current user is one of the participants
    if (!participantIds.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this match',
      });
    }

    // Get or create conversation with both participants
    const conversation = await getOrCreateConversation(matchId, participantIds);

    // Send message
    const message = await sendMessage(conversation.id, userId, content);

    res.json({
      success: true,
      data: message,
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error sending match message', error instanceof Error ? error : new Error(String(error)), { service: 'messaging-service' });
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
});

export default router;
