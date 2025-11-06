import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import { initEventSubscriber } from './events/subscriber';
import notificationRoutes from './routes/notifications';
import { createLogger, requestLoggingMiddleware } from '../../../packages/shared/utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const logger = createLogger('notification-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// Routes
app.use('/notifications', notificationRoutes);

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
