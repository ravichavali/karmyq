import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { authMiddleware } from '@karmyq/shared/middleware';
import { logger } from './config/logger';
import invitationRoutes from './routes/invitations';
import pathRoutes from './routes/paths';

const app = express();
const PORT = process.env.PORT || 3010;

// Database connection
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'karmyq_db',
  user: process.env.DB_USER || 'karmyq_user',
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check (unauthenticated)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'social-graph-service',
    port: PORT,
  });
});

// All routes require authentication
app.use(authMiddleware);

// Routes
app.use('/invitations', invitationRoutes);
app.use('/paths', pathRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: Function) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Social Graph Service running on port ${PORT}`);
});

export default app;
