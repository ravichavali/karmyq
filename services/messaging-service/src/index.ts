import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import pool from './database/db';
import messageRoutes from './routes/messages';
import { initializeMessageSocket } from './socket/messageHandler';
import { createLogger, requestLoggingMiddleware } from '../shared/utils/logger';
import { authMiddleware, globalRateLimiter, rateLimiters } from '../shared/middleware';
import { requestIdMiddleware, sendSuccess, sendInternalError } from '../shared/utils/response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const logger = createLogger('messaging-service');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET not configured - Socket.IO authentication will fail');
  process.exit(1);
}

// Create HTTP server
const httpServer = createServer(app);

// Allowed origins for CORS
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
];

// Initialize Socket.IO with proper CORS and JWT authentication
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO authentication middleware - verify JWT before connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    logger.warn('Socket connection rejected - no token provided', { socketId: socket.id });
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token as string, JWT_SECRET) as { userId: string; email: string };
    // Attach verified user data to socket
    socket.data.userId = decoded.userId;
    socket.data.email = decoded.email;
    logger.info('Socket authenticated', { socketId: socket.id, userId: decoded.userId });
    next();
  } catch (error) {
    logger.warn('Socket connection rejected - invalid token', { socketId: socket.id });
    return next(new Error('Invalid token'));
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware(logger));
app.use(globalRateLimiter);

// Health check (no auth required)
app.get('/health', (req: any, res) => {
  sendSuccess(res, { status: 'healthy', service: 'messaging-service' }, 200, { requestId: req.id });
});

// Routes with authentication (no tenant context required for messaging)
// Messaging is user-scoped, not community-scoped
app.use(
  '/',
  rateLimiters.standard,
  authMiddleware,
  messageRoutes
);

// Error handling middleware
app.use((err: any, req: any, res: express.Response) => {
  req.logger?.error('Unhandled error', err instanceof Error ? err : new Error(String(err)), {
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
