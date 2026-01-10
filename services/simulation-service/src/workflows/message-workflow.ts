/**
 * Send messages workflow
 */

import { Workflow } from '../types';
import { delay, pickRandom, randomInt, CHAT_MESSAGES } from '../utils';

/**
 * User sends messages in conversations
 */
export const messageWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);

  console.log(`[${session.user.email}] Checking messages...`);

  try {
    // Get conversations
    const conversations = await sessionManager.executeAction(
      session,
      'getConversations',
      () => client.getConversations()
    );

    if (!conversations || conversations.length === 0) {
      console.log(`[${session.user.email}] No conversations to reply to`);
      return;
    }

    console.log(`[${session.user.email}] Found ${conversations.length} conversations`);

    // Check each conversation
    for (const conversation of conversations) {
      // Get messages in this conversation
      const messages = await sessionManager.executeAction(
        session,
        'getMessages',
        () => client.getMessages(conversation.id)
      );

      if (!messages || messages.length === 0) continue;

      // Read messages (simulate reading time)
      await delay({ min: 5, max: 15, unit: 'seconds' });

      // Check if the last message is not from this user
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender_id === session.user.id) {
        // Already replied, skip
        continue;
      }

      // Decide whether to reply (50% chance)
      if (Math.random() > 0.5) {
        continue;
      }

      // Think about reply (simulate typing)
      await delay({ min: 10, max: 30, unit: 'seconds' });

      const reply = pickRandom(CHAT_MESSAGES);

      // Send message
      const sentMessage = await sessionManager.executeAction(
        session,
        'sendMessage',
        () => client.sendMessage(conversation.id, reply)
      );

      if (sentMessage) {
        console.log(`[${session.user.email}] Sent message in conversation ${conversation.id}`);
      }

      // Don't reply to all conversations immediately (simulate natural pacing)
      if (randomInt(0, 1) === 0) {
        break;
      }
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Message workflow failed:`, error.message);
  }
};
