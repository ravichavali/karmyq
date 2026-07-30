import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import preferencesRoutes from './routes/preferences'; // Day 8
import profileTagsRoutes from './routes/profileTags';
import pushTokensRoutes from './routes/pushTokens';
import foundingCircleRoutes from './routes/foundingCircle';
import { initDatabase } from './database/db';
import { initEventPublisher } from './events/publisher';
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
import { globalRateLimiter, rateLimiters, normalizeRequestBody } from '@karmyq/shared/middleware';
import { requestIdMiddleware, sendSuccess, sendInternalError } from '@karmyq/shared/utils/response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('auth-service');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());
// Express 5 leaves req.body undefined when no body was sent; restore the Express 4
// `{}` default before any route destructures it. Must follow express.json().
app.use(normalizeRequestBody);
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));

// Global rate limiting
app.use(globalRateLimiter);

// Health check (no rate limit)
app.get('/health', (req: any, res) => {
  sendSuccess(res, { status: 'healthy', service: 'auth-service' }, 200, { requestId: req.id });
});

// Routes with specific rate limits
app.use('/auth', rateLimiters.auth, authRoutes); // Stricter limit for auth
app.use('/users', rateLimiters.standard, userRoutes);
app.use('/preferences', rateLimiters.standard, preferencesRoutes); // Day 8
app.use('/auth/profile/tags', rateLimiters.standard, profileTagsRoutes);
app.use('/auth', rateLimiters.standard, pushTokensRoutes);
// Public founding-circle intake (Sprint 96, ADR-076) — no auth, no per-route limiter;
// the app-wide globalRateLimiter above already applies.
app.use('/founding-circle', foundingCircleRoutes);

// Error handling
app.use((err: any, req: any, res: express.Response, _next: express.NextFunction) => {
  req.logger?.error('Unhandled error', err instanceof Error ? err : new Error(String(err)), {
    method: req.method,
    path: req.path,
    body: req.body
  });
  sendInternalError(
    res,
    process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    err instanceof Error ? err : undefined,
    { requestId: req.id }
  );
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
