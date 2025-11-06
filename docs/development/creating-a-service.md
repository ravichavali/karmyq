# Creating a New Service

Step-by-step guide to creating a new microservice in the Karmyq platform.

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker
- Basic knowledge of Express.js and TypeScript

## Quick Start

```bash
# 1. Copy the template
cp -r services/_template services/your-service-name

# 2. Update package.json
cd services/your-service-name
# Edit name, description, etc.

# 3. Install dependencies
npm install

# 4. Start development
npm run dev
```

## Step-by-Step Guide

### 1. Copy Template

```bash
cp -r services/_template services/your-service-name
cd services/your-service-name
```

### 2. Update Configuration Files

#### package.json

```json
{
  "name": "@karmyq/your-service-name",
  "version": "1.0.0",
  "description": "Brief description of your service"
}
```

#### README.md

Update the template README with:
- Service description
- Port number
- API endpoints
- Database schema
- Related services

### 3. Define Your Database Schema

Add your tables to `infrastructure/postgres/init.sql`:

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS your_schema;

-- Create tables
CREATE TABLE your_schema.your_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_your_table_name ON your_schema.your_table(name);
```

### 4. Implement Routes

Create route files in `src/routes/`:

```typescript
// src/routes/your.routes.ts
import { Router, Request, Response } from 'express';
import { pool } from '../index';

const router = Router();

router.get('/your-endpoint', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM your_schema.your_table'
    );

    res.json({
      success: true,
      data: result.rows
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
```

### 5. Register Routes

Update `src/index.ts`:

```typescript
import { router as yourRouter } from './routes/your.routes';

// Register routes
app.use('/api', yourRouter);
```

### 6. Add to Docker Compose

Edit `infrastructure/docker/docker-compose.yml`:

```yaml
your-service:
  build:
    context: ../../services/your-service
    dockerfile: Dockerfile
  container_name: karmyq-your-service
  environment:
    NODE_ENV: development
    PORT: 3008  # Choose an available port
    DATABASE_URL: postgresql://karmyq_user:karmyq_password_dev@postgres:5432/karmyq_db
    REDIS_URL: redis://redis:6379
  ports:
    - "3008:3008"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  volumes:
    - ../../services/your-service/src:/app/src
    - ../../packages/shared:/app/shared
  networks:
    - karmyq-network
  command: npm run dev
```

### 7. Write Tests

#### Unit Test Example

```typescript
// tests/unit/your-service.test.ts
describe('Your Service', () => {
  describe('yourFunction', () => {
    it('should return expected result', () => {
      const result = yourFunction('input');
      expect(result).toBe('expected');
    });
  });
});
```

#### Integration Test Example

```typescript
// tests/integration/api.test.ts
import request from 'supertest';
import { app } from '../../src/index';

describe('API Tests', () => {
  it('should return data from /api/your-endpoint', async () => {
    const response = await request(app)
      .get('/api/your-endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  });
});
```

### 8. Add Event Publishing (Optional)

If your service needs to publish events:

```typescript
// src/services/event-publisher.ts
import { Queue } from 'bull';

const eventQueue = new Queue('karmyq-events', process.env.REDIS_URL);

export const publishEvent = async (eventType: string, data: any) => {
  await eventQueue.add({
    type: eventType,
    data,
    timestamp: new Date().toISOString()
  });
};
```

Usage in your route:

```typescript
import { publishEvent } from '../services/event-publisher';

// After creating a resource
await publishEvent('resource_created', {
  resourceId: newResource.id,
  userId: req.user.id
});
```

### 9. Add Event Listening (Optional)

If your service needs to listen to events:

```typescript
// src/services/event-listener.ts
import { Queue } from 'bull';

const eventQueue = new Queue('karmyq-events', process.env.REDIS_URL);

eventQueue.process(async (job) => {
  const { type, data } = job.data;

  switch (type) {
    case 'resource_created':
      await handleResourceCreated(data);
      break;
    // Add more event handlers
  }
});

async function handleResourceCreated(data: any) {
  // Your logic here
}
```

### 10. Update Service Test Script

Add your service to `scripts/dev/test-services.sh`:

```bash
echo "Testing Your Service..."
curl -s http://localhost:3008/health > /dev/null && \
  echo "✅ Your Service: OK" || echo "❌ Your Service: FAILED"
```

## Testing Your Service

### Start All Services

```bash
# From project root
bash scripts/dev/start.sh
```

### Test Your Service

```bash
# Health check
curl http://localhost:3008/health

# Test your endpoint
curl http://localhost:3008/api/your-endpoint

# Run tests
cd services/your-service
npm test
```

## Best Practices

### 1. Error Handling

Always wrap route handlers in try-catch:

```typescript
router.get('/endpoint', async (req, res) => {
  try {
    // Your logic
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### 2. Input Validation

Validate all inputs:

```typescript
if (!req.body.name || !req.body.email) {
  return res.status(400).json({
    success: false,
    error: 'Name and email are required'
  });
}
```

### 3. Use Parameterized Queries

Prevent SQL injection:

```typescript
// ✅ Good
await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ Bad
await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 4. Logging

Add meaningful logs:

```typescript
console.log(`Creating resource for user ${userId}`);
console.error('Database error:', error);
```

### 5. Database Transactions

For multiple related operations:

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO table1 ...');
  await client.query('INSERT INTO table2 ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Common Issues

### Port Already in Use

```bash
# Find process using the port
lsof -ti:3008 | xargs kill
```

### Database Connection Failed

- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Verify database schema exists

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Checklist

Before submitting your service:

- [ ] Service starts without errors
- [ ] Health endpoint works
- [ ] All routes return expected responses
- [ ] Database queries use parameterized statements
- [ ] Error handling in place
- [ ] Tests written and passing
- [ ] README.md updated
- [ ] Added to docker-compose.yml
- [ ] Added to test-services.sh
- [ ] Event publishing/listening implemented (if needed)

## Next Steps

1. Add authentication middleware
2. Implement rate limiting
3. Add request logging
4. Set up monitoring/metrics
5. Write comprehensive tests
6. Add API documentation

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Jest Testing](https://jestjs.io/docs/getting-started)
- [Bull Queue](https://github.com/OptimalBits/bull)

## Need Help?

- Check existing services for examples
- Review the template code
- Ask in #development channel
- Open an issue on GitHub

Happy coding! 🚀
