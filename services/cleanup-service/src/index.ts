import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { markExpiredData, hardDeleteExpiredData } from './jobs/expirationJob';
import {
  updateDecayedTrustScores,
  cleanupActivityLogs,
  generateDecayReport,
} from './jobs/reputationDecayJob';
import pool from './database/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(express.json());

// ============= HEALTH CHECK =============
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cleanup-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============= MANUAL TRIGGER ENDPOINTS (for testing/admin) =============

app.post('/jobs/mark-expired', async (req, res) => {
  try {
    logger.info('Manual trigger: mark expired data');
    await markExpiredData();
    res.json({ success: true, message: 'Expired data marked successfully' });
  } catch (error: any) {
    logger.error('Manual expiration job failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/jobs/hard-delete', async (req, res) => {
  try {
    logger.info('Manual trigger: hard delete expired data');
    await hardDeleteExpiredData();
    res.json({ success: true, message: 'Expired data deleted successfully' });
  } catch (error: any) {
    logger.error('Manual hard delete job failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/jobs/update-decay', async (req, res) => {
  try {
    logger.info('Manual trigger: update reputation decay');
    await updateDecayedTrustScores();
    res.json({ success: true, message: 'Trust scores updated successfully' });
  } catch (error: any) {
    logger.error('Manual decay update job failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/jobs/cleanup-activity-logs', async (req, res) => {
  try {
    logger.info('Manual trigger: cleanup activity logs');
    await cleanupActivityLogs();
    res.json({ success: true, message: 'Activity logs cleaned up successfully' });
  } catch (error: any) {
    logger.error('Manual activity log cleanup failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/jobs/decay-report', async (req, res) => {
  try {
    logger.info('Manual trigger: generate decay report');
    await generateDecayReport();
    res.json({ success: true, message: 'Decay report generated (check logs)' });
  } catch (error: any) {
    logger.error('Manual decay report generation failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= SCHEDULED JOBS =============

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
