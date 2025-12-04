import { Router, Request, Response } from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUserPreferences,
  updateGlobalPreferences,
  notificationEmitter,
} from '../services/notificationService';

const router = Router();

// Server-Sent Events (SSE) endpoint for real-time notifications
export const sseHandler = (req: Request, res: Response) => {
  const { userId } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  // Listen for notifications for this user
  const notificationHandler = (data: any) => {
    if (data.user_id === userId) {
      res.write(`data: ${JSON.stringify(data.notification)}\n\n`);
    }
  };

  notificationEmitter.on('notification', notificationHandler);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    notificationEmitter.removeListener('notification', notificationHandler);
    clearInterval(heartbeat);
    console.log(`SSE connection closed for user ${userId}`);
  });

  console.log(`SSE connection established for user ${userId}`);
};

// Also register it on the router for completeness
router.get('/stream/:userId', sseHandler);

// Get user's notifications
router.get('/:userId', async (req: Request, res: Response) => {
  console.log(`GET /notifications/${req.params.userId}`, {
    body: req.body,
    query: req.query,
  });

  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await getUserNotifications(userId, limit, offset);
    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        total: notifications.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications',
    });
  }
});

// Get unread count
router.get('/:userId/unread-count', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const count = await getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch unread count',
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const notification = await markAsRead(notificationId, user_id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
    });
  }
});

// Mark all notifications as read
router.put('/:userId/read-all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = await markAllAsRead(userId);

    res.json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`,
    });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all as read',
    });
  }
});

// Delete notification
router.delete('/:notificationId', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const notification = await deleteNotification(notificationId, user_id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notification',
    });
  }
});

// Get user preferences
router.get('/:userId/preferences', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = await getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch preferences',
    });
  }
});

// Update global preferences
router.put('/:userId/preferences', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { in_app_enabled, push_enabled, email_enabled } = req.body;

    const preferences = await updateGlobalPreferences(userId, {
      in_app_enabled,
      push_enabled,
      email_enabled,
    });

    res.json({
      success: true,
      data: preferences,
      message: 'Preferences updated',
    });
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update preferences',
    });
  }
});

export default router;
