import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import messageRoutes from './routes/messages';
import { initializeMessageSocket } from './socket/messageHandler';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';
import {
  authMiddleware,
  tenantMiddleware,
  dbContextMiddleware,
} from '../../packages/shared/middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const logger = createLogger('messaging-service');

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // In production, restrict this to your frontend domain
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'messaging-service' });
});

// Routes with authentication and tenant context
app.use(
  '/messages',
  authMiddleware,
  tenantMiddleware,
  dbContextMiddleware(pool),
  messageRoutes
);

// Error handling middleware
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

// Initialize Socket.IO handlers
initializeMessageSocket(io);

// Initialize database and start server
async function initialize() {
  try {
    const dbTimer = logger.timer('database_connection');
    await pool.query('SELECT NOW()');
    dbTimer();
    logger.info('Database connected successfully');

    httpServer.listen(PORT, () => {
      logger.info('Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        http_url: `http://localhost:${PORT}`,
        websocket_url: `ws://localhost:${PORT}`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

initialize();
