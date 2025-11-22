import { Server, Socket } from 'socket.io';
import { sendMessage, markMessagesAsRead } from '../services/messageService';

// Store user socket mappings
const userSockets = new Map<string, string>(); // userId -> socketId
const socketUsers = new Map<string, string>(); // socketId -> userId

export function initializeMessageSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    // User ID is already verified via JWT in the io.use() middleware
    const userId = socket.data.userId as string;

    if (!userId) {
      console.error('Socket connected without verified userId - this should not happen');
      socket.disconnect(true);
      return;
    }

    // Register the authenticated user's socket
    userSockets.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    console.log(`User ${userId} connected with socket ${socket.id}`);

    // Legacy 'authenticate' event - now just acknowledges (user already authenticated via JWT)
    socket.on('authenticate', () => {
      // User is already authenticated via JWT middleware
      // This event is kept for backward compatibility but no longer accepts userId
      socket.emit('authenticated', { userId, message: 'Already authenticated via token' });
      console.log(`User ${userId} re-confirmed authentication`);
    });

    // Join conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Handle send message - senderId is taken from verified JWT, not from client data
    socket.on('send_message', async (data: {
      conversationId: string;
      content: string;
      senderId?: string; // Deprecated: ignored, using verified userId from JWT
    }) => {
      try {
        const { conversationId, content } = data;
        // SECURITY: Always use verified userId from JWT, never trust client-provided senderId
        const senderId = userId;

        // Save message to database
        const message = await sendMessage(conversationId, senderId, content);

        // Emit message to all participants in the conversation room
        io.to(conversationId).emit('new_message', message);

        console.log(`Message sent in conversation ${conversationId} by user ${senderId}`);
      } catch (error: any) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: error.message });
      }
    });

    // Handle typing indicator - uses verified userId from JWT
    socket.on('typing', (data: { conversationId: string; userName: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: userId, // Use verified userId from JWT
        userName: data.userName,
      });
    });

    // Handle stop typing - uses verified userId from JWT
    socket.on('stop_typing', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_stop_typing', {
        userId: userId, // Use verified userId from JWT
      });
    });

    // Handle mark as read - uses verified userId from JWT
    socket.on('mark_as_read', async (data: { conversationId: string }) => {
      try {
        // SECURITY: Always use verified userId from JWT
        await markMessagesAsRead(data.conversationId, userId);
        io.to(data.conversationId).emit('messages_read', {
          conversationId: data.conversationId,
          userId: userId,
        });
      } catch (error: any) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { error: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userId = socketUsers.get(socket.id);
      if (userId) {
        userSockets.delete(userId);
        socketUsers.delete(socket.id);
      }
      console.log('Client disconnected:', socket.id);
    });
  });
}
