import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { initEventSubscriber } from './events/subscriber';
import { initEventPublisher } from './events/publisher';
import pool from './database/db';
import reputationRouter from './routes/reputation';
import healthRouter from './routes/health';
import providerReviewsRouter from './routes/providerReviews';
import { initHealthMetricsCalculator } from './cron/healthMetricsCalculator';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import {
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware,
  globalRateLimiter,
  rateLimiters,
} from '@karmyq/shared/middleware';
import { requestIdMiddleware, sendSuccess, sendError, sendInternalError } from '@karmyq/shared/utils/response';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;
const logger = createLogger('reputation-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res: Response) => {
  sendSuccess(res, {
    service: 'reputation-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }, 200, { requestId: req.id });
});

// Routes with authentication and optional tenant context
// optionalTenantMiddleware used because reputation data can be global or per-community;
// handlers extract communityId from URL params directly rather than relying on tenant context.
// This also prevents 403s from stale JWTs after the user joins new communities.
app.use(
  '/reputation',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  reputationRouter
);

app.use(
  '/reputation',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  healthRouter
);

// Provider reviews + trust (GET is public; POST handles auth internally)
app.use('/reputation', rateLimiters.standard, providerReviewsRouter);

// 404 handler
app.use((req: any, res: Response) => {
  sendError(res, 'NOT_FOUND', 'Route not found', 404, { path: req.path }, { requestId: req.id });
});

// Error handling middleware
app.use((err: Error, req: any, res: Response, next: NextFunction) => {
  req.logger?.error('Unhandled error', err, {
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

// Start server
async function start() {
  try {
    const dbTimer = logger.timer('database_connection');
    await initDatabase();
    dbTimer();
    logger.info('Database connected successfully');

    const publisherTimer = logger.timer('event_publisher_init');
    await initEventPublisher();
    publisherTimer();
    logger.info('Event publisher initialized successfully');

    const eventTimer = logger.timer('event_subscriber_init');
    await initEventSubscriber();
    eventTimer();
    logger.info('Event subscriber initialized successfully');

    initHealthMetricsCalculator();
    logger.info('Health metrics calculator initialized successfully');

    app.listen(PORT, () => {
      logger.info('Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

start();

export default app;
