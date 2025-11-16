import { query } from '../database/db';

export interface Message {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string;
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  request_match_id: string | null;
  last_message_at: string | null;
  created_at: string;
  participants?: any[];
  lastMessage?: Message;
}

// Get or create conversation for a match
export async function getOrCreateConversation(matchId: string, participantIds: string[]) {
  try {
    // Check if conversation exists for this match
    const existingConv = await query(
      `SELECT * FROM messaging.conversations WHERE request_match_id = $1`,
      [matchId]
    );

    if (existingConv.rows.length > 0) {
      return existingConv.rows[0];
    }

    // Create new conversation
    const newConv = await query(
      `INSERT INTO messaging.conversations (request_match_id)
       VALUES ($1)
       RETURNING *`,
      [matchId]
    );

    const conversationId = newConv.rows[0].id;

    // Add participants
    for (const participantId of participantIds) {
      await query(
        `INSERT INTO messaging.conversation_participants (conversation_id, participant_id)
         VALUES ($1, $2)
         ON CONFLICT (conversation_id, participant_id) DO NOTHING`,
        [conversationId, participantId]
      );
    }

    return newConv.rows[0];
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    throw error;
  }
}

// Get user's conversations
export async function getUserConversations(userId: string) {
  try {
    const result = await query(
      `SELECT
        c.*,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email
          )
        ) as participants,
        (
          SELECT json_build_object(
            'id', m.id,
            'content', m.content,
            'sender_id', m.sender_id,
            'created_at', m.created_at
          )
          FROM messaging.messages m
          WHERE m.conversation_id = c.id AND m.expired = FALSE
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message
       FROM messaging.conversations c
       JOIN messaging.conversation_participants cp ON c.id = cp.conversation_id
       JOIN messaging.conversation_participants cp2 ON c.id = cp2.conversation_id
       JOIN auth.users u ON cp2.participant_id = u.id
       WHERE cp.participant_id = $1
       GROUP BY c.id
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error in getUserConversations:', error);
    throw error;
  }
}

// Get conversation by ID
export async function getConversation(conversationId: string, userId: string) {
  try {
    // Verify user is a participant
    const participantCheck = await query(
      `SELECT * FROM messaging.conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2`,
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      throw new Error('User is not a participant in this conversation');
    }

    const result = await query(
      `SELECT
        c.*,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email
          )
        ) as participants
       FROM messaging.conversations c
       JOIN messaging.conversation_participants cp ON c.id = cp.conversation_id
       JOIN auth.users u ON cp.participant_id = u.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error in getConversation:', error);
    throw error;
  }
}

// Get messages for a conversation
export async function getMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0) {
  try {
    // Verify user is a participant
    const participantCheck = await query(
      `SELECT * FROM messaging.conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2`,
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      throw new Error('User is not a participant in this conversation');
    }

    const result = await query(
      `SELECT
        m.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as sender
       FROM messaging.messages m
       JOIN auth.users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 AND m.expired = FALSE
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    return result.rows.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error in getMessages:', error);
    throw error;
  }
}

// Send a message
export async function sendMessage(conversationId: string, senderId: string, content: string) {
  try {
    // Verify user is a participant
    const participantCheck = await query(
      `SELECT * FROM messaging.conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2`,
      [conversationId, senderId]
    );

    if (participantCheck.rows.length === 0) {
      throw new Error('User is not a participant in this conversation');
    }

    // Insert message
    const result = await query(
      `INSERT INTO messaging.messages (conversation_id, sender_id, content, status)
       VALUES ($1, $2, $3, 'sent')
       RETURNING *`,
      [conversationId, senderId, content]
    );

    // Update conversation last_message_at
    await query(
      `UPDATE messaging.conversations
       SET last_message_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    // Get sender info
    const senderInfo = await query(
      `SELECT id, name, email FROM auth.users WHERE id = $1`,
      [senderId]
    );

    const message = {
      ...result.rows[0],
      sender: senderInfo.rows[0],
    };

    return message;
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
}

// Mark messages as read
export async function markMessagesAsRead(conversationId: string, userId: string) {
  try {
    await query(
      `UPDATE messaging.messages
       SET status = 'read'
       WHERE conversation_id = $1
       AND sender_id != $2
       AND status = 'sent'`,
      [conversationId, userId]
    );
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    throw error;
  }
}
