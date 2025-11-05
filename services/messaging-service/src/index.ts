import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database/db';
import messageRoutes from './routes/messages';
import { initializeMessageSocket } from './socket/messageHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'messaging-service' });
});

// Routes
app.use('/messages', messageRoutes);

// Initialize Socket.IO handlers
initializeMessageSocket(io);

// Initialize database and start server
async function initialize() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Messaging Service running on port ${PORT}`);
      console.log(`📍 HTTP: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

initialize();
