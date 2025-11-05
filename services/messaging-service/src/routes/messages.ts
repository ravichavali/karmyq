import { Router, Request, Response } from 'express';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversation,
  getMessages,
  sendMessage,
} from '../services/messageService';

const router = Router();

// Get user's conversations
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const conversations = await getUserConversations(userId);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversations',
    });
  }
});

// Get or create conversation for a match
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { match_id, participant_ids } = req.body;

    if (!match_id || !participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({
        success: false,
        message: 'match_id and participant_ids are required',
      });
    }

    const conversation = await getOrCreateConversation(match_id, participant_ids);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create conversation',
    });
  }
});

// Get specific conversation
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const conversation = await getConversation(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch conversation',
    });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const messages = await getMessages(conversationId, userId, limit, offset);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch messages',
    });
  }
});

// Send message (REST API fallback - Socket.IO is preferred)
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { sender_id, content } = req.body;

    if (!sender_id || !content) {
      return res.status(400).json({
        success: false,
        message: 'sender_id and content are required',
      });
    }

    const message = await sendMessage(conversationId, sender_id, content);

    res.json({
      success: true,
      data: message,
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(error.message.includes('not a participant') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
});

export default router;
