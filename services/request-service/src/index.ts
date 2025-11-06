import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { initEventPublisher } from './events/publisher';
import requestsRouter from './routes/requests';
import offersRouter from './routes/offers';
import matchesRouter from './routes/matches';
import { createLogger, requestLoggingMiddleware } from '../../../packages/shared/utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const logger = createLogger('request-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'request-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/requests', requestsRouter);
app.use('/offers', offersRouter);
app.use('/matches', matchesRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, req: any, res: Response, next: NextFunction) => {
  req.logger?.error('Unhandled error', err, {
    method: req.method,
    path: req.path
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
