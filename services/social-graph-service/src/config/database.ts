import { Pool } from 'pg';

// Support both DATABASE_URL (production) and individual DB_* vars (development)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'karmyq_db',
      user: process.env.DB_USER || 'karmyq_user',
      password: process.env.DB_PASSWORD,
      max: 5,
    };

export const pool = new Pool(poolConfig);
