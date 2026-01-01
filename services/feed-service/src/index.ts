import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, getPool } from './database/db';
import feedRouter from './routes/feed';
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
const PORT = process.env.PORT || 3007;
const logger = createLogger('feed-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res: Response) => {
  sendSuccess(res, {
    service: 'feed-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }, 200, { requestId: req.id });
});

// Start server
async function start() {
  try {
    const dbTimer = logger.timer('database_connection');
    await initDatabase();
    dbTimer();
    logger.info('Database connected successfully');

    // Routes with authentication (feed can aggregate across communities)
    // Set up after database is initialized
    app.use(
      '/feed',
      rateLimiters.relaxed,  // Higher limit for feed reads
      authMiddleware,
      optionalTenantMiddleware,  // Feed can show cross-community content
      dbContextMiddleware(getPool()),
      feedRouter
    );

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
