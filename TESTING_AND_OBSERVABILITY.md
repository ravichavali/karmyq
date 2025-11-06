# Testing & Observability Setup

Complete testing and observability infrastructure for the Karmyq platform.

## What's Included

### 1. End-to-End Testing Framework ✅

**Location**: `tests/e2e/`

**Features**:
- Playwright-based browser automation
- Multi-browser testing (Chrome, Firefox, Safari)
- Mobile viewport testing
- Screenshot and video recording on failure
- Parallel test execution
- HTML test reports

**Test Suites**:
- Authentication flow (login, logout, session)
- Community management (create, view, join, search)
- Help requests (create, view, filter)
- Messaging (conversations, send messages)
- Notifications (view, mark as read)

**Quick Start**:
```bash
cd tests/e2e
npm install
npx playwright install
npm test
```

📚 **Documentation**: [tests/e2e/README.md](tests/e2e/README.md)

---

### 2. Structured Logging System ✅

**Location**: `packages/shared/utils/logger.ts`

**Features**:
- Consistent JSON-formatted logs across all services
- Multiple log levels (debug, info, warn, error)
- Request correlation IDs
- Performance timing
- Context-aware logging
- Development-friendly pretty printing
- Production-ready JSON output

**Usage Example**:
```typescript
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';

const logger = createLogger('my-service');

// Express middleware for automatic request logging
app.use(requestLoggingMiddleware(logger));

// In routes
router.get('/users/:id', async (req, res) => {
  req.logger.info('Fetching user', { userId: req.params.id });

  const timer = req.logger.timer('database_query');
  const user = await fetchUser(req.params.id);
  timer(); // Logs: "database_query completed in 45ms"

  res.json(user);
});
```

📚 **Documentation**: [docs/development/implementing-logging.md](docs/development/implementing-logging.md)

---

### 3. Observability Stack ✅

**Components**:

#### Grafana (Port 3007)
- Visual dashboards for logs and metrics
- Pre-configured Karmyq Service Overview dashboard
- Alert management
- **Access**: http://localhost:3007 (admin/admin)

#### Loki (Port 3100)
- Log aggregation and storage
- High-performance log queries with LogQL
- 30-day retention by default

#### Promtail
- Automatic log collection from Docker containers
- File-based log collection
- Label extraction and processing

#### Prometheus (Port 9090)
- Metrics collection and storage
- PromQL query language
- Alerting rules
- **Access**: http://localhost:9090

**Quick Start**:
```bash
# Services and observability stack start together
bash scripts/dev/start.sh

# Access Grafana
open http://localhost:3007

# View logs
Navigate to: Karmyq > Service Overview
```

📚 **Documentation**: [docs/operations/logging-and-monitoring.md](docs/operations/logging-and-monitoring.md)

---

### 4. Grafana Dashboards ✅

**Pre-configured Dashboards**:

#### Karmyq Service Overview
- Auth Service logs
- Community Service logs
- Request Service logs
- Messaging Service logs
- Aggregated error logs from all services

**Dashboard Features**:
- Real-time log streaming
- Log level filtering
- Time range selection
- Full-text search
- JSON log parsing

**Creating Custom Dashboards**:
1. Open Grafana at http://localhost:3007
2. Navigate to Dashboards > New Dashboard
3. Add Panel
4. Select Loki data source
5. Write LogQL query

Example LogQL queries:
```logql
# All logs from auth service
{service="auth-service"}

# Error logs from all services
{service=~".*-service"} |~ "error|ERROR"

# Logs for specific user
{service="auth-service"} | json | userId="123"
```

---

## Documentation Structure

```
docs/
├── development/
│   ├── creating-a-service.md        # Service creation guide
│   ├── implementing-logging.md      # How to add structured logging
│   └── testing-guide.md             # Comprehensive testing guide
│
└── operations/
    └── logging-and-monitoring.md    # Observability guide
```

---

## Service Integration Checklist

To integrate logging and observability into a service:

- [ ] Import and create logger instance
- [ ] Add request logging middleware
- [ ] Replace all `console.log` with structured logger
- [ ] Add performance timers to slow operations
- [ ] Log database queries with context
- [ ] Log event publications
- [ ] Add error context in catch blocks
- [ ] Test logs appear in Grafana

**Example PR**: See any service in `services/` directory

---

## Running Tests

### E2E Tests
```bash
cd tests/e2e

# All tests
npm test

# Specific suite
npm test -- 01-auth.spec.ts

# UI mode (interactive)
npm run test:ui

# Headed mode (see browser)
npm run test:headed

# Debug mode
npm run test:debug
```

### Service Unit/Integration Tests
```bash
cd services/auth-service

# Unit tests
npm test

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

---

## Monitoring in Production

### View Logs
1. Open Grafana: http://localhost:3007
2. Navigate to: Karmyq > Service Overview
3. Select time range
4. Filter by service or log level

### Query Logs
```logql
# Find all 500 errors in last hour
{service=~".*-service"} | json | statusCode="500"

# Find slow database queries
{service=~".*-service"} | json | duration > 1000

# Find logs for specific user
{service=~".*-service"} | json | userId="abc-123"
```

### Set Up Alerts
1. Navigate to Alerting > Alert Rules
2. Create New Alert Rule
3. Set query and threshold
4. Configure notification channel (Slack, email, etc.)

Example alert:
```
Alert: High error rate
Query: rate({service=~".*-service"} |~ "error" [5m]) > 10
Condition: Error rate > 10 per minute
```

---

## Performance

### Metrics Tracked

- **Request metrics**: Method, path, status code, duration
- **Database metrics**: Query count, duration, errors
- **Event metrics**: Event type, publication count
- **System metrics**: CPU, memory, disk I/O

### Performance Monitoring

```promql
# Request rate per service
rate(http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

---

## Troubleshooting

### No logs in Grafana?

1. Check Loki is running:
   ```bash
   docker ps | grep loki
   ```

2. Check Promtail is collecting logs:
   ```bash
   docker logs karmyq-promtail
   ```

3. Verify data source in Grafana:
   - Configuration > Data Sources > Loki
   - Test connection

### Tests failing?

1. Ensure all services are running:
   ```bash
   bash scripts/dev/start.sh
   ```

2. Check service health:
   ```bash
   curl http://localhost:3001/health  # Auth
   curl http://localhost:3002/health  # Community
   curl http://localhost:3003/health  # Request
   ```

3. View service logs:
   ```bash
   docker logs karmyq-auth-service
   ```

### High memory usage?

1. Check retention settings in `infrastructure/observability/loki/loki-config.yml`
2. Reduce log level: `LOG_LEVEL=warn`
3. Add memory limits in docker-compose.yml

---

## Next Steps

### Immediate
1. ✅ E2E testing framework set up
2. ✅ Structured logging implemented
3. ✅ Observability stack configured
4. ✅ Documentation created

### Short Term
- [ ] Add structured logging to all services
- [ ] Write more E2E test scenarios
- [ ] Set up CI/CD integration
- [ ] Configure production alerts

### Long Term
- [ ] Add distributed tracing (Jaeger/Tempo)
- [ ] Implement custom metrics
- [ ] Create service-specific dashboards
- [ ] Set up log retention policies
- [ ] Add performance testing (Artillery)

---

## Resources

### Documentation
- [E2E Testing README](tests/e2e/README.md)
- [Testing Guide](docs/development/testing-guide.md)
- [Logging Implementation](docs/development/implementing-logging.md)
- [Logging & Monitoring](docs/operations/logging-and-monitoring.md)

### External Resources
- [Playwright Docs](https://playwright.dev)
- [Grafana Docs](https://grafana.com/docs/)
- [Loki Docs](https://grafana.com/docs/loki/)
- [LogQL Cheat Sheet](https://grafana.com/docs/loki/latest/logql/)
- [Prometheus Docs](https://prometheus.io/docs/)

---

## Summary

You now have a complete testing and observability infrastructure:

✅ **E2E Testing** - Comprehensive browser-based testing with Playwright
✅ **Structured Logging** - Consistent, queryable logs across all services
✅ **Log Aggregation** - Centralized log storage with Loki
✅ **Visualization** - Beautiful dashboards in Grafana
✅ **Metrics** - System and application metrics with Prometheus
✅ **Documentation** - Complete guides for developers and operators

**Access Points**:
- Frontend: http://localhost:3000
- Grafana: http://localhost:3007 (admin/admin)
- Prometheus: http://localhost:9090

**Start Everything**:
```bash
bash scripts/dev/start.sh
```

Happy testing and monitoring! 🚀
