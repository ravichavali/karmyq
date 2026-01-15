# Implementing Structured Logging in Services

Quick guide to integrating the structured logger into Karmyq services.

## Step 1: Import the Logger

In your service's `src/index.ts`:

```typescript
import { createLogger, requestLoggingMiddleware } from '../../../packages/shared/utils/logger';

const logger = createLogger('your-service-name');
```

## Step 2: Add Request Logging Middleware

Add the middleware early in your middleware chain:

```typescript
import express from 'express';
import cors from 'cors';
import { createLogger, requestLoggingMiddleware } from '../../../packages/shared/utils/logger';

const app = express();
const logger = createLogger('auth-service');

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger)); // Add this line

// Your routes...
```

## Step 3: Update Service Startup Logs

Replace console.log with structured logger:

```typescript
// ❌ Before
app.listen(PORT, () => {
  console.log(`🚀 Auth Service running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

// ✅ After
app.listen(PORT, () => {
  logger.info('Service started', {
    port: PORT,
    environment: process.env.NODE_ENV,
    url: `http://localhost:${PORT}`
  });
});
```

## Step 4: Update Database Connection Logs

```typescript
// ❌ Before
try {
  await pool.query('SELECT NOW()');
  console.log('✅ PostgreSQL connected');
} catch (error) {
  console.error('Database connection failed:', error);
  process.exit(1);
}

// ✅ After
try {
  const timer = logger.timer('database_connection');
  await pool.query('SELECT NOW()');
  timer();
  logger.info('Database connected successfully', {
    database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[1]
  });
} catch (error) {
  logger.error('Database connection failed', error instanceof Error ? error : new Error(String(error)), {
    database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[1]
  });
  process.exit(1);
}
```

## Step 5: Update Route Handlers

Use the request logger (automatically added by middleware):

```typescript
// ❌ Before
router.get('/users/:id', async (req, res) => {
  console.log('GET /users/:id', { id: req.params.id });

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    console.log('User found:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ After
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const timer = req.logger.timer('fetch_user');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    timer();

    if (result.rowCount === 0) {
      req.logger.warn('User not found', { userId: id });
      return res.status(404).json({ error: 'User not found' });
    }

    req.logger.info('User fetched successfully', {
      userId: id,
      rowCount: result.rowCount
    });

    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Failed to fetch user', error instanceof Error ? error : new Error(String(error)), {
      userId: id
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Step 6: Event Publishing/Listening

```typescript
// ❌ Before
await eventQueue.add({
  type: 'user_registered',
  data: { userId: user.id }
});
console.log('Event published: user_registered');

// ✅ After
await eventQueue.add({
  type: 'user_registered',
  data: { userId: user.id }
});
logger.event('user_registered', {
  userId: user.id,
  email: user.email
});
```

## Step 7: Error Handling Middleware

Update global error handler:

```typescript
// ❌ Before
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ After
app.use((err, req, res, next) => {
  req.logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    body: req.body
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
```

## Complete Example

Here's a complete service file with structured logging:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createLogger, requestLoggingMiddleware } from '../../../packages/shared/utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('auth-service');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLoggingMiddleware(logger));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Example route
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const timer = req.logger.timer('user_login');

    // Query user
    req.logger.debug('Looking up user by email', { email });
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      req.logger.warn('Login attempt with unknown email', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password (simplified)
    if (user.password !== password) {
      req.logger.warn('Login attempt with incorrect password', {
        userId: user.id,
        email
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    timer();
    req.logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email
    });

    res.json({
      token: 'jwt_token_here',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    req.logger.error('Login failed', error instanceof Error ? error : new Error(String(error)), {
      email
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  req.logger.warn('Route not found', {
    method: req.method,
    path: req.path
  });
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  req.logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    const timer = logger.timer('database_connection');
    await pool.query('SELECT NOW()');
    timer();

    logger.info('Database connected successfully');

    app.listen(PORT, () => {
      logger.info('Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`
      });
    });
  } catch (error) {
    logger.error('Failed to start service', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

start();

export default app;
```

## Testing Your Logs

### 1. Development Mode

Set `NODE_ENV=development` to see pretty-printed logs:

```bash
NODE_ENV=development npm run dev
```

Output:
```
🔍 [10:30:45] [DEBUG] Looking up user by email
  Context: {
    "email": "user@example.com"
  }

📝 [10:30:46] [INFO] User logged in successfully
  Context: {
    "userId": "123",
    "email": "user@example.com"
  }
  Duration: 45ms
```

### 2. Production Mode

Set `NODE_ENV=production` for JSON logs:

```bash
NODE_ENV=production npm start
```

Output:
```json
{"timestamp":"2025-11-06T20:30:45.123Z","level":"info","message":"User logged in successfully","service":"auth-service","context":{"userId":"123","email":"user@example.com"},"duration":45}
```

### 3. View in Grafana

1. Open Grafana: http://localhost:3007
2. Navigate to Karmyq > Service Overview
3. View logs in real-time

## Next Steps

1. Update all existing `console.log` statements to use the logger
2. Add performance timers to slow operations
3. Include relevant context in all log statements
4. Set up alerts in Grafana for critical errors
5. Review logs regularly to identify issues

## Common Patterns

### Pattern: Try-Catch with Logging

```typescript
try {
  const timer = req.logger.timer('operation_name');
  const result = await doSomething();
  timer();
  req.logger.info('Operation completed', { result });
  return result;
} catch (error) {
  req.logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)), {
    context: 'relevant context'
  });
  throw error;
}
```

### Pattern: Database Query Logging

```typescript
const timer = req.logger.timer('db_query');
const result = await pool.query('SELECT ...', params);
timer();

if (result.rowCount === 0) {
  req.logger.warn('No results found', { query: 'SELECT ...', params });
} else {
  req.logger.debug('Query successful', {
    rowCount: result.rowCount,
    query: 'SELECT ...'
  });
}
```

### Pattern: Event Publishing

```typescript
await publishEvent('event_type', data);
logger.event('event_type', {
  eventId: eventId,
  ...relevantData
});
```
