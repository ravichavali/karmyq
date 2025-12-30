import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'karmyq_db',
  user: process.env.DB_USER || 'karmyq_user',
  password: process.env.DB_PASSWORD,
});
