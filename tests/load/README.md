# Karmyq Load Tests

Performance and stress testing for the Karmyq platform.

## Quick Start

```bash
# Install dependencies
npm install

# Run default load test (10 users, 30 seconds)
npm test

# Light load test (5 users, 15 seconds)
npm run test:light

# Heavy load test (50 users, 60 seconds)
npm run test:heavy

# Stress test (100 users, 120 seconds)
npm run test:stress
```

## Prerequisites

- Node.js 18+
- Running Karmyq services (all 8 backend services)
- PostgreSQL and Redis running

Start services:
```bash
# From project root
bash scripts/dev/start.sh
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# API URLs
AUTH_API_URL=http://localhost:3001
COMMUNITY_API_URL=http://localhost:3002
REQUEST_API_URL=http://localhost:3003
REPUTATION_API_URL=http://localhost:3004
NOTIFICATION_API_URL=http://localhost:3005
MESSAGING_API_URL=http://localhost:3006
FEED_API_URL=http://localhost:3007

# Load Test Parameters
LOAD_TEST_USERS=10        # Concurrent users
LOAD_TEST_DURATION=30     # Duration in seconds
LOAD_TEST_RAMP_UP=5       # Ramp-up time
```

### Custom Configuration

Override via command line:
```bash
LOAD_TEST_USERS=25 LOAD_TEST_DURATION=60 npm test
```

## Test Phases

### Phase 1: User Creation
- Creates test users via auth service
- Ramps up users gradually over `RAMP_UP` period
- Each user gets unique credentials

### Phase 2: Concurrent Activity
- Simulates realistic user behavior
- Random operations: list communities, requests, notifications, etc.
- Runs for configured `DURATION`

### Phase 3: Rate Limit Stress
- Fires 100 rapid requests
- Tests rate limiting effectiveness
- Expects 429 responses (rate limited)

## Output

```
🚀 Karmyq Load Testing Tool
============================================================
Configuration:
  Concurrent Users: 10
  Duration:         30s
  Ramp-up:          5s
============================================================

📝 Phase 1: Creating test users...
  ✓ User 1 created
  ✓ User 2 created
  ...

✅ Created 10 test users

🔄 Phase 2: Running concurrent activity for 30s...

📊 Running rate limit stress test...

============================================================
                    LOAD TEST RESULTS
============================================================

📈 Request Statistics:
   Total Requests:     1,234
   Successful:         1,180 (95.6%)
   Failed:             54 (4.4%)

⏱️  Latency Statistics:
   Average:            145ms
   Min:                23ms
   Max:                892ms

📊 Status Code Distribution:
   200: 1,100 (89.1%)
   201: 80 (6.5%)
   429: 54 (4.4%)

✅ PASSED: System performing well under load
📋 Rate limiting triggered 54 times (expected behavior)
============================================================
```

## Performance Benchmarks

### Acceptable Performance

| Metric | Target | Warning | Failure |
|--------|--------|---------|---------|
| Success Rate | > 95% | 80-95% | < 80% |
| Avg Latency | < 200ms | 200-500ms | > 500ms |
| Max Latency | < 2s | 2-5s | > 5s |
| Rate Limit Hits | Expected | High | Very High |

### Rate Limiting

Rate limiting is expected behavior:
- Default: 100 requests per minute per user
- 429 responses indicate rate limiting is working
- For unlimited testing, disable rate limits:

```bash
# Via docker-compose test overlay
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d

# Or via environment variable (if services support it)
RATE_LIMIT_DISABLED=true
```

## Troubleshooting

### All requests failing
- Check if services are running: `docker ps`
- Verify API URLs in `.env`
- Check service logs: `docker logs karmyq-auth-service`

### High latency
- Check database connections
- Monitor Redis queue depth
- Review service logs for slow queries

### Too many rate limit hits
- Normal for stress tests
- Reduce `LOAD_TEST_USERS` for baseline testing
- Consider increasing rate limits for testing

## Integration with CI/CD

Add to GitHub Actions:

```yaml
load-tests:
  runs-on: ubuntu-latest
  needs: [integration-tests]
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18

    - name: Start services
      run: bash scripts/dev/start.sh &

    - name: Wait for services
      run: sleep 60

    - name: Run load tests
      working-directory: tests/load
      run: |
        npm install
        npm run test:light  # Use light test for CI
```

## Related Documentation

- [Testing Guide](../../docs/development/testing-guide.md)
- [Environment Variables](../../docs/ENVIRONMENT_VARIABLES.md)
- [Integration Tests](../README.md)
- [E2E Tests](../e2e/README.md)
