# Logging and Monitoring

Comprehensive guide to logging, monitoring, and observability in the Karmyq platform.

## Overview

The Karmyq platform uses a modern observability stack:

- **Loki**: Log aggregation and storage
- **Promtail**: Log collection from Docker containers and files
- **Grafana**: Visualization and dashboards
- **Prometheus**: Metrics collection and alerting
- **Structured Logging**: Consistent JSON-formatted logs across all services

## Architecture

```
┌─────────────┐
│  Services   │
│  (7 total)  │
└──────┬──────┘
       │ logs
       ▼
┌─────────────┐      ┌──────────┐
│  Promtail   │─────▶│   Loki   │
│ (collector) │      │ (storage)│
└─────────────┘      └────┬─────┘
                          │
       ┌──────────────────┘
       ▼
┌─────────────┐      ┌────────────┐
│ Prometheus  │─────▶│  Grafana   │
│  (metrics)  │      │ (dashboards)│
└─────────────┘      └────────────┘
```

## Structured Logging

### Logger Usage

All services use the shared structured logger from `@karmyq/shared/utils/logger`.

#### Basic Usage

```typescript
import { createLogger } from '@karmyq/shared/utils/logger';

const logger = createLogger('my-service');

// Different log levels
logger.debug('Detailed debugging information', { userId: '123' });
logger.info('Important information', { action: 'user_login' });
logger.warn('Warning message', { resource: 'database', status: 'high_load' });
logger.error('Error occurred', error, { userId: '123', operation: 'payment' });
```

#### Request Logging

```typescript
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';

const logger = createLogger('my-service');
app.use(requestLoggingMiddleware(logger));

// Every request is automatically logged with:
// - Request ID
// - Method and path
// - Response status code
// - Duration
// - User ID (if authenticated)
```

#### Specialized Logging

```typescript
// Database queries
logger.query('SELECT * FROM users WHERE id = $1', 45, { userId: '123' });

// Event publication
logger.event('user_registered', { userId: '123', email: 'user@example.com' });

// Performance timing
const timer = logger.timer('complex_operation');
// ... do complex work ...
timer(); // Logs: "complex_operation completed in 523ms"

// Child logger with persistent context
const requestLogger = logger.child({
  requestId: 'req_abc123',
  userId: '456'
});
requestLogger.info('Processing request'); // Context automatically included
```

### Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Detailed debugging info, database queries | "DB Query: SELECT * FROM..." |
| `info` | Important events, state changes | "User logged in", "Request completed" |
| `warn` | Warning conditions, degraded state | "Database connection slow", "Rate limit approaching" |
| `error` | Error conditions requiring attention | "Database connection failed", "Payment processing error" |

### Log Format

#### Development Mode

Human-readable format with emojis:

```
🔍 [10:30:45] [DEBUG] DB Query: SELECT * FROM users WHERE id = $1
  Context: {
    "userId": "123",
    "duration": 45
  }

📝 [10:30:46] [INFO] User login successful
  Context: {
    "userId": "123",
    "email": "user@example.com"
  }

❌ [10:30:47] [ERROR] Database connection failed
  Error: ConnectionError: ECONNREFUSED
  Context: {
    "database": "karmyq_db"
  }
```

#### Production Mode

JSON format for log aggregation:

```json
{
  "timestamp": "2025-11-06T20:30:45.123Z",
  "level": "info",
  "message": "User login successful",
  "service": "auth-service",
  "context": {
    "userId": "123",
    "email": "user@example.com",
    "requestId": "req_abc123"
  }
}
```

### Environment Configuration

```bash
# Set minimum log level (debug, info, warn, error)
LOG_LEVEL=info

# Set environment (affects log format)
NODE_ENV=production
```

## Grafana Dashboards

### Accessing Grafana

```
URL: http://localhost:3007
Username: admin
Password: admin
```

### Available Dashboards

#### 1. Karmyq Service Overview

**Path**: Karmyq > Service Overview

**Panels**:
- Auth Service Logs
- Community Service Logs
- Request Service Logs
- Messaging Service Logs
- All Service Errors (aggregated)

**Use Cases**:
- Monitor overall system health
- Track errors across all services
- Debug issues in specific services

#### 2. Creating Custom Dashboards

1. Navigate to Dashboards > New Dashboard
2. Add Panel
3. Select Data Source: Loki
4. Enter LogQL query (examples below)

### LogQL Query Examples

```logql
# All logs from a specific service
{service="auth-service"}

# Error logs from all services
{service=~".*-service"} |~ "error|ERROR|Error"

# Logs containing specific text
{service="request-service"} |= "match created"

# Logs with JSON parsing
{service="auth-service"} | json | userId="123"

# Rate of errors per minute
rate({service=~".*-service"} |~ "error" [1m])

# Count of log lines by service
sum by (service) (count_over_time({service=~".*-service"}[5m]))

# HTTP 500 errors
{service=~".*-service"} | json | statusCode="500"
```

## Prometheus Metrics

### Accessing Prometheus

```
URL: http://localhost:9090
```

### Available Metrics

Prometheus scrapes metrics from all services (when instrumented):

```promql
# HTTP request rate
rate(http_requests_total[5m])

# HTTP request duration (p95)
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Adding Metrics to Services

```typescript
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics();

// Custom metrics
const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path']
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Loki Log Aggregation

### Log Storage

Logs are stored in Docker volume `loki-data`:

```bash
# View Loki data
docker volume inspect karmyq_loki-data

# Cleanup old logs (careful!)
docker volume rm karmyq_loki-data
```

### Retention Policy

Default retention: 30 days

Configure in `infrastructure/observability/loki/loki-config.yml`:

```yaml
limits_config:
  retention_period: 720h  # 30 days
```

## Alerting

### Setting Up Alerts in Grafana

1. Navigate to Alerting > Alert Rules
2. Create New Alert Rule
3. Set Query (e.g., error rate threshold)
4. Define Alert Conditions
5. Configure Notifications (email, Slack, etc.)

### Example Alert Rules

#### High Error Rate

```yaml
Query: rate({service=~".*-service"} |~ "error" [5m]) > 10
Condition: Error rate > 10 per minute
Action: Send notification to #alerts channel
```

#### Service Down

```yaml
Query: up{job="auth-service"} == 0
Condition: Service unreachable
Action: Page on-call engineer
```

## Best Practices

### 1. Consistent Context

Always include relevant context in logs:

```typescript
// ✅ Good
logger.info('User created', {
  userId: user.id,
  email: user.email,
  source: 'registration_form'
});

// ❌ Bad
logger.info('User created');
```

### 2. Structured Data

Use structured fields instead of string interpolation:

```typescript
// ✅ Good
logger.info('Database query completed', {
  table: 'users',
  duration: 45,
  rowCount: 10
});

// ❌ Bad
logger.info(`Query to users table took 45ms and returned 10 rows`);
```

### 3. Log Levels

Use appropriate log levels:

```typescript
// ✅ Good
logger.debug('Cache hit', { key: 'user:123' });
logger.info('Payment processed', { amount: 99.99 });
logger.warn('Rate limit approaching', { current: 95, limit: 100 });
logger.error('Payment failed', error, { userId: '123' });

// ❌ Bad
logger.info('Checking cache for key user:123'); // Too verbose, use debug
logger.debug('Payment processed'); // Too important, use info
```

### 4. Error Logging

Include full error context:

```typescript
// ✅ Good
try {
  await processPayment(order);
} catch (error) {
  logger.error('Payment processing failed', error, {
    orderId: order.id,
    userId: order.userId,
    amount: order.amount,
    paymentMethod: order.paymentMethod
  });
  throw error;
}

// ❌ Bad
catch (error) {
  logger.error('Error occurred');
}
```

### 5. Performance Logging

Track performance of critical operations:

```typescript
const timer = logger.timer('process_large_dataset');

await Promise.all(
  items.map(item => processItem(item))
);

timer(); // Logs: "process_large_dataset completed in 1234ms"
```

### 6. Avoid Logging Sensitive Data

```typescript
// ✅ Good
logger.info('User authenticated', {
  userId: user.id,
  email: user.email
});

// ❌ Bad
logger.info('User authenticated', {
  password: user.password,
  creditCard: user.creditCard,
  ssn: user.ssn
});
```

## Troubleshooting

### No Logs Appearing in Grafana

1. Check Promtail is running:
   ```bash
   docker logs karmyq-promtail
   ```

2. Verify Loki is receiving logs:
   ```bash
   curl http://localhost:3100/ready
   ```

3. Check Promtail configuration:
   ```bash
   docker exec karmyq-promtail cat /etc/promtail/config.yml
   ```

### High Memory Usage (Loki)

1. Reduce retention period
2. Increase compaction intervals
3. Add memory limits in docker-compose.yml:

```yaml
loki:
  deploy:
    resources:
      limits:
        memory: 1G
```

### Grafana Dashboard Not Loading

1. Check datasource configuration:
   - Navigate to Configuration > Data Sources
   - Verify Loki URL: `http://loki:3100`

2. Test connection:
   - Click "Save & Test"
   - Should show "Data source connected"

### Logs Not Appearing for Specific Service

1. Check service is outputting logs:
   ```bash
   docker logs karmyq-auth-service
   ```

2. Verify Promtail is collecting from service:
   ```bash
   docker logs karmyq-promtail | grep auth-service
   ```

3. Check label configuration in Promtail config

## Maintenance

### Log Rotation

Logs are automatically rotated by Loki based on retention policy.

Manual cleanup:

```bash
# Stop Loki
docker stop karmyq-loki

# Remove old data
docker volume rm karmyq_loki-data

# Restart
docker start karmyq-loki
```

### Backup Dashboards

```bash
# Export dashboard JSON
curl http://localhost:3007/api/dashboards/uid/karmyq-service-overview \
  -u admin:admin | jq .dashboard > dashboard-backup.json

# Import dashboard
curl -X POST http://localhost:3007/api/dashboards/db \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d @dashboard-backup.json
```

### Upgrade Observability Stack

Update versions in `docker-compose.yml`:

```yaml
loki:
  image: grafana/loki:2.9.0  # Update version

grafana:
  image: grafana/grafana:10.2.0  # Update version

prometheus:
  image: prom/prometheus:v2.48.0  # Update version
```

## Resources

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Cheat Sheet](https://grafana.com/docs/loki/latest/logql/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Best Practices for Logging](https://cloud.google.com/logging/docs/best-practices)
