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
import { reportDemoSessionHealth } from './services/demoSessionSelfCheck';
import { globalRateLimiter, rateLimiters, normalizeRequestBody } from '@karmyq/shared/middleware';
import { requestIdMiddleware, sendSuccess, sendInternalError } from '@karmyq/shared/utils/response';

dotenv.config({ quiet: true });

const app = express();
// ADR-098 (BUG-049): exactly one proxy hop. Must stay 1 — `true` lets a client spoof req.ip.
app.set('trust proxy', 1);
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

      // Sprint 129 (BUG-039): report whether the guided demo can actually issue a session, so a
      // stale DEMO_* config shows up in the deploy log instead of waiting for a visitor to find it.
      // It is a report, not a gate — never awaited, and `reportDemoSessionHealth` never rejects
      // (see its contract). The .catch stays as belt-and-braces: an unhandled rejection inside the
      // startup try/catch would reach a catch that calls process.exit(1), taking auth down over an
      // optional feature.
      //
      // Deferred past the boot burst rather than run inline. The check exercises the full issuance
      // path, whose Promise.all fires four queries at once against a pool of max 5 that holds one
      // warm connection at boot — three extra handshakes competing with the real login traffic
      // arriving at a cold instance, on a Critical service with seven dependents. `unref()` keeps
      // the "changes nothing about process liveness" property: this timer alone will not hold the
      // process open.
      setTimeout(() => {
        void reportDemoSessionHealth(logger).catch(() => { /* never blocks startup */ });
      }, 5000).unref();
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

start();
