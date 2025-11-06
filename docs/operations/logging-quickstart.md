# Logging Quick Start Guide

## 🚀 Start Observability Stack

```bash
docker-compose -f docker-compose.observability.yml up -d
```

## 📊 Access Dashboards

| Tool | URL | Credentials |
|------|-----|-------------|
| **Grafana** | http://localhost:3007 | admin / admin |
| **Prometheus** | http://localhost:9090 | - |
| **Loki API** | http://localhost:3100 | - |

## 🔍 Quick Log Queries (in Grafana Explore)

```logql
# All logs from auth service
{service="auth-service"}

# Only errors
{level="error"}

# Specific container
{container="karmyq-auth-service"}

# Search for text
{service="auth-service"} |= "login"

# Count errors per service
sum by (service) (count_over_time({level="error"}[5m]))
```

## 📁 View Log Files Directly

```bash
# Auth service logs
tail -f services/auth-service/logs/auth-service-$(date +%Y-%m-%d).log

# All services
tail -f services/*/logs/*.log

# Only errors
tail -f services/*/logs/*-error-*.log
```

## 🐳 Docker Logs (Real-time)

```bash
# Single service
docker logs -f karmyq-auth-service

# All services
docker-compose logs -f

# With timestamps
docker-compose logs -f --timestamps
```

## 🛠️ Using the Logger in Code

```typescript
import logger from './utils/logger'

// Info
logger.info('User logged in', { userId: '123', ip: req.ip })

// Error
logger.error('Database connection failed', { error: err.message })

// Warning
logger.warn('Rate limit exceeded', { userId, attempts: 5 })

// Debug (only in development)
logger.debug('Processing request', { body: req.body })
```

## ⚠️ Troubleshooting

**Grafana not showing logs?**
```bash
# Check if Loki is running
docker ps | grep loki

# Check Promtail logs
docker logs karmyq-promtail

# Restart observability stack
docker-compose -f docker-compose.observability.yml restart
```

**Logs not being created?**
```bash
# Check if logs directory exists
ls -la services/auth-service/logs/

# Check service is running
docker-compose ps
```

## 📖 Full Documentation

See [OBSERVABILITY.md](./OBSERVABILITY.md) for complete documentation.
