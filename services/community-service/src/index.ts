import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { initEventPublisher } from './events/publisher';
import pool from './database/db';
import communitiesRouter from './routes/communities';
import membersRouter from './routes/members';
import normsRouter from './routes/norms';
import settingsRouter from './routes/settings';
import exportRouter from './routes/export';
import statsRouter from './routes/stats';
import configRouter from './routes/config';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import {
  authMiddleware,
  optionalAuthMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware,
  globalRateLimiter,
  rateLimiters,
} from '@karmyq/shared/middleware';
import { requestIdMiddleware, sendSuccess, sendError, sendInternalError } from '@karmyq/shared/utils/response';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const logger = createLogger('community-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res: Response) => {
  sendSuccess(res, {
    service: 'community-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }, 200, { requestId: req.id });
});

// Routes with authentication and tenant context
// All community routes require authentication
// Tenant context is set based on X-Community-ID header or community_id param
// IMPORTANT: Register specific routes BEFORE generic /:id routes to avoid path conflicts

// Specific nested routes (must come before /:id routes)
app.use(
  '/communities',
  authMiddleware,
  optionalTenantMiddleware,        // Stats routes use communityId param
  dbContextMiddleware(pool),
  statsRouter     // Stats routes: /communities/:communityId/stats
);

app.use(
  '/communities',
  authMiddleware,
  optionalTenantMiddleware,        // Settings routes use communityId param
  dbContextMiddleware(pool),
  settingsRouter  // Settings routes nested under /communities/:communityId/settings
);

app.use(
  '/communities',
  authMiddleware,
  optionalTenantMiddleware,        // Export routes use communityId param
  dbContextMiddleware(pool),
  exportRouter    // Export routes: /communities/:communityId/export
);

app.use(
  '/communities',
  authMiddleware,
  optionalTenantMiddleware,        // Norms routes use communityId param
  dbContextMiddleware(pool),
  normsRouter    // Norms routes nested under /communities/:communityId/norms
);

app.use(
  '/communities',
  authMiddleware,
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  membersRouter  // Member routes nested under /communities/:communityId/members
);

// Config routes (must come before generic community routes)
// Uses optionalAuthMiddleware to allow public access to templates and public configs
// Individual routes handle their own auth checks where needed
app.use(
  '/communities',
  optionalAuthMiddleware,  // Allow public access - routes handle their own auth
  optionalTenantMiddleware,
  dbContextMiddleware(pool),
  configRouter    // Config routes: /communities/:id/config, /config-templates, /configs/public
);

// Generic community routes (must come AFTER specific nested routes)
app.use(
  '/communities',
  rateLimiters.readHeavy,          // Rate limit (300/min for read-heavy endpoints)
  authMiddleware,                  // 1. Verify JWT token
  optionalTenantMiddleware,        // 2. Set community context (optional for listing communities)
  dbContextMiddleware(pool),       // 3. Set PostgreSQL session variables for RLS
  communitiesRouter
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

// Only start the server if this file is run directly (not imported for testing)
if (require.main === module) {
  start();
}

export default app;
