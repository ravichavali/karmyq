import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import { initDatabase } from './database/db';
import { initEventPublisher } from './events/publisher';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';
import { globalRateLimiter, rateLimiters } from '../shared/middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('auth-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Global rate limiting
app.use(globalRateLimiter);

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service' });
});

// Routes with specific rate limits
app.use('/auth', rateLimiters.auth, authRoutes); // Stricter limit for auth
app.use('/users', rateLimiters.standard, userRoutes);

// Error handling
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

// Initialize and start server
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
