import { Server, Socket } from 'socket.io';
import { sendMessage, markMessagesAsRead } from '../services/messageService';

// Store user socket mappings
const userSockets = new Map<string, string>(); // userId -> socketId
const socketUsers = new Map<string, string>(); // socketId -> userId

export function initializeMessageSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle user authentication
    socket.on('authenticate', (userId: string) => {
      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, userId);
      console.log(`User ${userId} authenticated with socket ${socket.id}`);
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

    // Handle send message
    socket.on('send_message', async (data: {
      conversationId: string;
      senderId: string;
      content: string;
    }) => {
      try {
        const { conversationId, senderId, content } = data;

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

    // Handle typing indicator
    socket.on('typing', (data: { conversationId: string; userId: string; userName: string }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: data.userId,
        userName: data.userName,
      });
    });

    // Handle stop typing
    socket.on('stop_typing', (data: { conversationId: string; userId: string }) => {
      socket.to(data.conversationId).emit('user_stop_typing', {
        userId: data.userId,
      });
    });

    // Handle mark as read
    socket.on('mark_as_read', async (data: { conversationId: string; userId: string }) => {
      try {
        await markMessagesAsRead(data.conversationId, data.userId);
        io.to(data.conversationId).emit('messages_read', {
          conversationId: data.conversationId,
          userId: data.userId,
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
