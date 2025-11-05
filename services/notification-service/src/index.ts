import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import { initEventSubscriber } from './events/subscriber';
import notificationRoutes from './routes/notifications';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('GET /health', { body: req.body, query: req.query });
  res.json({ status: 'ok', service: 'notification-service' });
});

// Routes
app.use('/notifications', notificationRoutes);

// Initialize database and event subscriber
async function initialize() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');

    // Initialize event subscriber
    await initEventSubscriber();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Notification Service running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`📡 SSE endpoint: /notifications/stream/:userId`);
    });
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

initialize();
