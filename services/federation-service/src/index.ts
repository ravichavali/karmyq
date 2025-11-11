import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { getOrCreateInstanceIdentity } from './services/instanceService';
import wellKnownRouter from './routes/wellKnown';
import federationRouter from './routes/federation';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;
const logger = createLogger('federation-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'federation-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    federationEnabled: process.env.FEDERATION_ENABLED === 'true',
  });
});

// Well-known routes (for instance discovery)
app.use('/.well-known', wellKnownRouter);

// Federation routes
app.use('/federation', federationRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  (req as any).logger?.error('Unhandled error', err instanceof Error ? err : new Error(String(err)), {
    method: req.method,
    path: req.path,
    body: req.body
  });
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
async function start() {
  try {
    // Check if federation is enabled
    if (process.env.FEDERATION_ENABLED !== 'true') {
      logger.warn('Federation is disabled', {
        message: 'Set FEDERATION_ENABLED=true to enable federation'
      });
    }

    const dbTimer = logger.timer('database_connection');
    await initDatabase();
    dbTimer();
    logger.info('Database connected successfully');

    // Initialize instance identity
    const identityTimer = logger.timer('instance_identity_init');
    const instance = await getOrCreateInstanceIdentity();
    identityTimer();
    logger.info('Instance identity initialized', {
      domain: instance.domain,
      name: instance.name
    });

    app.listen(PORT, () => {
      logger.info('Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`,
        instance_domain: instance.domain,
        wellKnown: `http://localhost:${PORT}/.well-known/karmyq`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

start();

export default app;
