import express, { NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import { initEventSubscriber } from './events/subscriber';
import notificationRoutes from './routes/notifications';
import pushRouter from './routes/push';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import {
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware,
  globalRateLimiter,
  rateLimiters,
} from '@karmyq/shared/middleware';
import { requestIdMiddleware, sendSuccess, sendInternalError } from '@karmyq/shared/utils/response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const logger = createLogger('notification-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res) => {
  sendSuccess(res, { status: 'healthy', service: 'notification-service' }, 200, { requestId: req.id });
});

// Import the SSE route handler
import { sseHandler } from './routes/notifications';

// SSE endpoint (no auth required because EventSource doesn't support custom headers)
// Security: userId is in URL, and SSE only streams notifications for that specific user
app.get('/notifications/stream/:userId', rateLimiters.relaxed, sseHandler);

// Internal push delivery route (no auth — internal only, behind nginx)
app.use('/notifications', pushRouter);

// Other notification routes with authentication
app.use(
  '/notifications',
  rateLimiters.relaxed,  // Higher limit for notifications (polling/SSE)
  authMiddleware,
  optionalTenantMiddleware,  // Notifications can span multiple communities
  dbContextMiddleware(pool),
  notificationRoutes
);

// Error handling middleware
app.use((err: any, req: any, res: express.Response, _next: NextFunction) => {
  req.logger?.error('Unhandled error', err instanceof Error ? err : new Error(String(err)), {
    method: req.method,
    path: req.path,
    body: req.body
  });
  sendInternalError(
    res,
    process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    err,
    { requestId: req.id }
  );
});

// Initialize database and event subscriber
async function initialize() {
  try {
    const dbTimer = logger.timer('database_connection');
    await pool.query('SELECT NOW()');
    dbTimer();
    logger.info('Database connected successfully');

    const eventTimer = logger.timer('event_subscriber_init');
    await initEventSubscriber();
    eventTimer();
    logger.info('Event subscriber initialized successfully');

    app.listen(PORT, () => {
      logger.info('Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`,
        sse_endpoint: '/notifications/stream/:userId'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

initialize();
