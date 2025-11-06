import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'your-service-name',
    timestamp: new Date().toISOString()
  });
});

// Import routes here
// import { router as yourRouter } from './routes/your-routes';
// app.use('/api', yourRouter);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Your Service running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

export { pool };
