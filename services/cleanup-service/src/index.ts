import express, { Request, Response, NextFunction } from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import { logger } from './utils/logger';
import { markExpiredData, hardDeleteExpiredData } from './jobs/expirationJob';
import {
  updateDecayedTrustScores,
  cleanupActivityLogs,
  generateDecayReport,
} from './jobs/reputationDecayJob';
import { sendMatchReminders } from './jobs/matchReminderJob';
import { expireDibs } from './jobs/expireDibs';
import pool from './database/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;
const JWT_SECRET = process.env.JWT_SECRET;
const sharedLogger = createLogger('cleanup-service');

if (!JWT_SECRET) {
  logger.error('JWT_SECRET not configured - admin authentication will fail');
  process.exit(1);
}

interface ExtendedRequest extends Request {
  id?: string;
  user?: { userId: string; email: string };
}

type Meta = Record<string, unknown>;

// Inline response helpers (cleanup-service doesn't use shared package)
const requestIdMiddleware = (req: ExtendedRequest, _res: Response, next: NextFunction): void => {
  req.id = uuidv4();
  next();
};

const sendSuccess = (res: Response, data: unknown, status = 200, meta: Meta = {}): void => {
  res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), ...meta }
  });
};

const sendUnauthorized = (res: Response, message: string, meta: Meta = {}): void => {
  res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
    meta: { timestamp: new Date().toISOString(), ...meta }
  });
};

const sendForbidden = (res: Response, message: string, meta: Meta = {}): void => {
  res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message },
    meta: { timestamp: new Date().toISOString(), ...meta }
  });
};

const sendInternalError = (res: Response, message: string, _error?: unknown, meta: Meta = {}): void => {
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message },
    meta: { timestamp: new Date().toISOString(), ...meta }
  });
};

// Rate limiter for admin endpoints (strict)
const adminRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many admin requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin authentication middleware
interface JwtPayload {
  userId: string;
  email: string;
}

const adminAuthMiddleware = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Authentication required', { requestId: req.id });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

    // Check if user is an admin in at least one community
    const adminCheck = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM community.members
        WHERE user_id = $1 AND role = 'admin' AND status = 'active'
      ) as is_admin`,
      [decoded.userId]
    );

    if (!adminCheck.rows[0]?.is_admin) {
      logger.warn('Non-admin user attempted to access admin endpoint', { userId: decoded.userId });
      return sendForbidden(res, 'Admin privileges required', { requestId: req.id });
    }

    // Attach user info to request
    req.user = decoded;
    logger.info('Admin authenticated', { userId: decoded.userId, endpoint: req.path });
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return sendUnauthorized(res, 'Token expired', { requestId: req.id });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return sendUnauthorized(res, 'Invalid token', { requestId: req.id });
    }
    logger.error('Admin auth error', { error });
    return sendInternalError(res, 'Authentication failed', error instanceof Error ? error : undefined, { requestId: req.id });
  }
};

app.use(express.json());
app.use(requestLoggingMiddleware(sharedLogger));
app.use(requestIdMiddleware);

// ============= HEALTH CHECK =============
app.get('/health', (req: ExtendedRequest, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    service: 'cleanup-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, 200, { requestId: req.id });
});

// ============= ADMIN JOB ENDPOINTS (protected) =============

app.post('/jobs/mark-expired', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: mark expired data');
    await markExpiredData();
    sendSuccess(res, { message: 'Expired data marked successfully' }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual expiration job failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

app.post('/jobs/hard-delete', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: hard delete expired data');
    await hardDeleteExpiredData();
    sendSuccess(res, { message: 'Expired data deleted successfully' }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual hard delete job failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

app.post('/jobs/update-decay', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: update reputation decay');
    await updateDecayedTrustScores();
    sendSuccess(res, { message: 'Trust scores updated successfully' }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual decay update job failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

app.post('/jobs/cleanup-activity-logs', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: cleanup activity logs');
    await cleanupActivityLogs();
    sendSuccess(res, { message: 'Activity logs cleaned up successfully' }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual activity log cleanup failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

app.get('/jobs/decay-report', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: generate decay report');
    await generateDecayReport();
    sendSuccess(res, { message: 'Decay report generated (check logs)' }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual decay report generation failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

app.post('/jobs/expire-dibs', adminRateLimiter, adminAuthMiddleware, async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info('Manual trigger: expire dibs');
    const expiredCount = await expireDibs();
    sendSuccess(res, { message: `Expired ${expiredCount} dibs record(s)` }, 200, { requestId: req.id });
  } catch (error) {
    logger.error('Manual dibs expiry job failed', { error });
    sendInternalError(res, error instanceof Error ? error.message : String(error), error, { requestId: req.id });
  }
});

// ============= SCHEDULED JOBS =============

/**
 * Match Reminder Job
 * Runs every 15 minutes. Sends departure reminders to helpers based on scheduled_at - travel_time_minutes.
 */
cron.schedule('*/15 * * * *', async () => {
  logger.info('Cron: Running match reminder job');
  try {
    await sendMatchReminders();
  } catch (error) {
    logger.error('Scheduled match reminder job failed', { error });
  }
});

/**
 * Dibs Expiry Job
 * Runs every 5 minutes. Finds pending dibs records where expires_at < NOW(),
 * marks them as expired, and resets requests to open for public broadcast.
 */
cron.schedule('*/5 * * * *', async () => {
  logger.info('Cron: Running dibs expiry job');
  try {
    await expireDibs();
  } catch (error) {
    logger.error('Scheduled dibs expiry job failed', { error });
  }
});

/**
 * Mark Expired Data Job
 * Runs every hour at minute 0
 * Marks data that has passed its expires_at as expired (soft delete)
 */
cron.schedule('0 * * * *', async () => {
  logger.info('Cron: Running expiration job');
  try {
    await markExpiredData();
  } catch (error) {
    logger.error('Scheduled expiration job failed', { error });
  }
});

/**
 * Hard Delete Expired Data Job
 * Runs daily at 2:00 AM
 * Permanently deletes data that's been expired for > 7 days
 */
cron.schedule('0 2 * * *', async () => {
  logger.info('Cron: Running hard delete job');
  try {
    await hardDeleteExpiredData();
  } catch (error) {
    logger.error('Scheduled hard delete job failed', { error });
  }
});

/**
 * Reputation Decay Update Job
 * Runs daily at 3:00 AM
 * Recalculates trust scores based on time-decayed karma
 */
cron.schedule('0 3 * * *', async () => {
  logger.info('Cron: Running reputation decay job');
  try {
    await updateDecayedTrustScores();
  } catch (error) {
    logger.error('Scheduled reputation decay job failed', { error });
  }
});

/**
 * Activity Log Cleanup Job
 * Runs weekly on Sunday at 4:00 AM
 * Removes activity logs older than 90 days
 */
cron.schedule('0 4 * * 0', async () => {
  logger.info('Cron: Running activity log cleanup job');
  try {
    await cleanupActivityLogs();
  } catch (error) {
    logger.error('Scheduled activity log cleanup failed', { error });
  }
});

/**
 * Decay Report Generation Job
 * Runs weekly on Monday at 9:00 AM
 * Generates report on community decay rates
 */
cron.schedule('0 9 * * 1', async () => {
  logger.info('Cron: Generating weekly decay report');
  try {
    await generateDecayReport();
  } catch (error) {
    logger.error('Scheduled decay report generation failed', { error });
  }
});

// ============= START SERVER =============

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Database connection established');

    app.listen(PORT, () => {
      logger.info(`Cleanup Service running on port ${PORT}`);
      logger.info('Scheduled jobs:');
      logger.info('  - Dibs expiry: Every 5 minutes');
      logger.info('  - Match reminders: Every 15 minutes');
      logger.info('  - Mark expired data: Every hour');
      logger.info('  - Hard delete: Daily at 2:00 AM');
      logger.info('  - Reputation decay: Daily at 3:00 AM');
      logger.info('  - Activity log cleanup: Weekly Sunday at 4:00 AM');
      logger.info('  - Decay report: Weekly Monday at 9:00 AM');
    });
  } catch (error) {
    logger.error('Failed to start cleanup service', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

startServer();
