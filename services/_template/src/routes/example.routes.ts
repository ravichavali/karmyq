import { Router, Request, Response } from 'express';
import { pool } from '../index';

const router = Router();

/**
 * GET /api/example
 * Example endpoint - replace with your actual route
 */
router.get('/example', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/example
 * Example POST endpoint
 */
router.post('/example', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    // Your business logic here

    res.status(201).json({
      success: true,
      message: 'Created successfully',
      data: { data }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router };
