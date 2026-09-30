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
import type { SSEAuthenticatedRequest } from '../middleware/sseAuth';
import { RouteParams } from '@karmyq/shared/middleware/auth';

const router = Router();

// BUG-055: every user-facing route acts on the JWT caller only. A `:userId` that names anyone else is
// refused, the same shape as the SSE stream's check below. Services connect as the table owner, so RLS
// on notifications.notifications does not enforce this. Returns the caller id, or null after responding.
function callerMatchingParam(req: Request<RouteParams>, res: Response): string | null {
  const callerId = (req as any).user?.userId as string | undefined;
  if (!callerId) {
    res.status(401).json({ success: false, message: 'Authentication required', error: 'UNAUTHORIZED' });
    return null;
  }
  if (req.params.userId !== callerId) {
    res.status(403).json({ success: false, message: 'Forbidden: user does not match token user', error: 'FORBIDDEN' });
    return null;
  }
  return callerId;
}

// BUG-055: routes addressed by notification id take the owner from the JWT; a body `user_id` is ignored.
function callerId(req: Request<RouteParams>, res: Response): string | null {
  const id = (req as any).user?.userId as string | undefined;
  if (!id) {
    res.status(401).json({ success: false, message: 'Authentication required', error: 'UNAUTHORIZED' });
    return null;
  }
  return id;
}

// Server-Sent Events (SSE) endpoint for real-time notifications
export const sseHandler = (req: SSEAuthenticatedRequest, res: Response) => {
  const tokenUserId = req.user?.userId;
  if (!tokenUserId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'UNAUTHORIZED',
    });
  }

  const requestedUserId = req.params.userId
    ? String(req.params.userId).replace(/[\r\n]/g, '').slice(0, 100)
    : undefined;

  if (requestedUserId && requestedUserId !== tokenUserId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: stream user does not match token user',
      error: 'FORBIDDEN',
    });
  }

  const userId = tokenUserId;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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

// Get user's notifications
router.get('/:userId', async (req: Request<RouteParams>, res: Response) => {
  const safeUserId = String(req.params.userId).replace(/[\r\n]/g, '').slice(0, 100);
  console.log(`GET /notifications/${safeUserId}`, {
    body: req.body,
    query: req.query,
  });

  const userId = callerMatchingParam(req, res);
  if (!userId) return;

  try {
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
    (req as any).logger?.error('Error fetching notifications', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications',
    });
  }
});

// Get unread count
router.get('/:userId/unread-count', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerMatchingParam(req, res);
  if (!userId) return;

  try {
    const count = await getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching unread count', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch unread count',
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerId(req, res);
  if (!userId) return;

  try {
    const { notificationId } = req.params;
    const notification = await markAsRead(notificationId, userId);

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
    (req as any).logger?.error('Error marking notification as read', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
    });
  }
});

// Mark all notifications as read
router.put('/:userId/read-all', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerMatchingParam(req, res);
  if (!userId) return;

  try {
    const count = await markAllAsRead(userId);

    res.json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error marking all as read', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all as read',
    });
  }
});

// Delete notification
router.delete('/:notificationId', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerId(req, res);
  if (!userId) return;

  try {
    const { notificationId } = req.params;
    const notification = await deleteNotification(notificationId, userId);

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
    (req as any).logger?.error('Error deleting notification', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notification',
    });
  }
});

// Get user preferences
router.get('/:userId/preferences', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerMatchingParam(req, res);
  if (!userId) return;

  try {
    const preferences = await getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching preferences', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch preferences',
    });
  }
});

// Update global preferences
router.put('/:userId/preferences', async (req: Request<RouteParams>, res: Response) => {
  const userId = callerMatchingParam(req, res);
  if (!userId) return;

  try {
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
    (req as any).logger?.error('Error updating preferences', error instanceof Error ? error : new Error(String(error)), { service: 'notification-service' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update preferences',
    });
  }
});

export default router;
