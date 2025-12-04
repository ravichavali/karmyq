import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import { initEventSubscriber } from './events/subscriber';
import notificationRoutes from './routes/notifications';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';
import {
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware,
  globalRateLimiter,
  rateLimiters,
} from '../shared/middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const logger = createLogger('notification-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// Import the SSE route handler
import { sseHandler } from './routes/notifications';

// SSE endpoint (no auth required because EventSource doesn't support custom headers)
// Security: userId is in URL, and SSE only streams notifications for that specific user
app.get('/notifications/stream/:userId', rateLimiters.relaxed, sseHandler);

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
app.use((err: any, req: any, res: express.Response, next: express.NextFunction) => {
  req.logger?.error('Unhandled error', err instanceof Error ? err : new Error(String(err)), {
    method: req.method,
    path: req.path,
    body: req.body
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
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
