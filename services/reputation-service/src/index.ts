import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import { initEventSubscriber } from './events/subscriber';
import reputationRouter from './routes/reputation';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'reputation-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/reputation', reputationRouter);

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
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
async function start() {
  try {
    await initDatabase();
    await initEventSubscriber();

    app.listen(PORT, () => {
      console.log(`🚀 Reputation Service running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
