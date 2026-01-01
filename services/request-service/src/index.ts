import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { initEventPublisher } from './events/publisher';
import pool from './database/db';
import requestsRouter from './routes/requests';
import offersRouter from './routes/offers';
import matchesRouter from './routes/matches';
import feedbackRouter from './routes/feedback';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';
import {
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware,
  globalRateLimiter,
  rateLimiters,
} from '../shared/middleware';
import { requestIdMiddleware, sendSuccess, sendError, sendInternalError } from '../shared/utils/response';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const logger = createLogger('request-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res: Response) => {
  sendSuccess(res, {
    service: 'request-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }, 200, { requestId: req.id });
});

// Routes with authentication and optional tenant context
// Tenant context is optional because requests themselves contain community_id
app.use(
  '/requests',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  requestsRouter
);

app.use(
  '/offers',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  offersRouter
);

app.use(
  '/matches',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  matchesRouter
);

app.use(
  '/matches',
  rateLimiters.standard,
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  feedbackRouter
);

// 404 handler
app.use((req: any, res: Response) => {
  sendError(res, 'NOT_FOUND', 'Route not found', 404, { path: req.path }, { requestId: req.id });
});

// Error handling middleware
app.use((err: Error, req: any, res: Response, next: NextFunction) => {
  req.logger?.error('Unhandled error', err, {
    method: req.method,
    path: req.path
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

    const eventTimer = logger.timer('event_publisher_init');
    await initEventPublisher();
    eventTimer();
    logger.info('Event publisher initialized successfully');

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
