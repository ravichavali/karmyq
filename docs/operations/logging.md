# Karmyq Observability Stack

This document explains how to use the logging and monitoring setup for Karmyq.

## Stack Overview

- **Grafana Loki**: Log aggregation and storage
- **Promtail**: Collects logs from Docker containers and service files
- **Grafana**: Visualization and dashboards
- **Prometheus**: Metrics collection (for future use)

## Quick Start

### 1. Start the Observability Stack

```bash
docker-compose -f docker-compose.observability.yml up -d
```

### 2. Access the Tools

- **Grafana**: http://localhost:3007
  - Username: `admin`
  - Password: `admin`

- **Loki**: http://localhost:3100 (API only)
- **Prometheus**: http://localhost:9090

### 3. View Logs in Grafana

1. Open Grafana at http://localhost:3001
2. Go to **Explore** (compass icon in left sidebar)
3. Select **Loki** as the data source
4. Use LogQL queries to filter logs:

#### Example Queries

**All logs from a specific service:**
```logql
{service="auth-service"}
```

**Error logs only:**
```logql
{level="error"}
```

**Logs from a specific container:**
```logql
{container="karmyq-auth-service"}
```

**Search for specific text:**
```logql
{service="auth-service"} |= "error"
```

**Filter by time range:**
```logql
{service="auth-service"} | json | level="error" | line_format "{{.timestamp}} {{.message}}"
```

## Current Logging Setup

### Application Logs

Each service logs to:
- **Console**: Colorized, human-readable format
- **Files**: JSON format in `services/[service-name]/logs/`
  - `[service]-YYYY-MM-DD.log` - All logs
  - `[service]-error-YYYY-MM-DD.log` - Errors only

**Retention:**
- Regular logs: 14 days
- Error logs: 30 days
- Loki retention: 7 days (configurable in `infrastructure/loki/loki-config.yml`)

### Log Levels

- `error`: Application errors, exceptions
- `warn`: Warning conditions
- `info`: General informational messages
- `debug`: Detailed debugging information (only in development)

### Log Format

Logs are written in JSON format with the following structure:

```json
{
  "timestamp": "2025-01-05 14:30:45",
  "level": "info",
  "message": "User logged in",
  "service": "auth-service",
  "environment": "development",
  "userId": "123",
  "ip": "192.168.1.1"
}
```

## Viewing Logs

### Option 1: Grafana (Recommended)

Best for searching, filtering, and visualizing logs across all services.

1. Open Grafana
2. Use Explore or create dashboards
3. Query with LogQL

### Option 2: Direct File Access

```bash
# View all logs from auth service
tail -f services/auth-service/logs/auth-service-2025-01-05.log

# View error logs
tail -f services/auth-service/logs/auth-service-error-2025-01-05.log
```

### Option 3: Docker Logs (Real-time)

```bash
# View logs from a specific container
docker logs -f karmyq-auth-service

# View logs from all services
docker-compose logs -f
```

## Creating Dashboards

### Pre-built Dashboard (Coming Soon)

We'll add pre-configured dashboards for:
- Request rates by service
- Error rates
- Response times
- Authentication events
- Database queries

### Custom Dashboards

1. In Grafana, click **+ → Dashboard**
2. Add a panel
3. Use Loki as data source
4. Write LogQL queries
5. Choose visualization (time series, logs, table, etc.)

## Troubleshooting

### Loki not receiving logs

```bash
# Check Promtail logs
docker logs karmyq-promtail

# Check Loki logs
docker logs karmyq-loki

# Verify Promtail can reach Loki
docker exec karmyq-promtail wget -O- http://loki:3100/ready
```

### Logs not appearing in Grafana

1. Check data source connection: Configuration → Data Sources → Loki → Test
2. Verify time range in Grafana (top right)
3. Check if services are actually logging

### High disk usage

Adjust retention in `infrastructure/loki/loki-config.yml`:

```yaml
limits_config:
  retention_period: 72h  # Reduce to 3 days
```

Then restart:
```bash
docker-compose -f docker-compose.observability.yml restart loki
```

## Advanced Configuration

### Adding Alerts

Edit `infrastructure/loki/loki-config.yml` to add alerting rules.

### Integrating with External Systems

Loki can push logs to:
- Slack
- PagerDuty
- Email
- Webhooks

Configure in `infrastructure/loki/loki-config.yml` under `ruler.alertmanager_url`.

### Production Recommendations

For production environments:

1. **Use external storage** (S3, GCS) instead of local filesystem
2. **Enable authentication** on Grafana
3. **Set up proper retention** based on compliance requirements
4. **Add resource limits** in docker-compose
5. **Set up backups** for Grafana dashboards
6. **Enable HTTPS** for Grafana
7. **Use proper secrets management** instead of hardcoded passwords

## Environment Variables

Control logging behavior:

```bash
# Set in docker-compose.yml or .env
LOG_LEVEL=debug    # debug, info, warn, error
NODE_ENV=production
```

## Cost Considerations

This setup is **free and open-source**, but consider:

- **Disk space**: Logs can grow quickly. Monitor disk usage.
- **CPU/Memory**: Loki is lightweight, but heavy querying can impact performance.
- **Network**: Promtail streams logs to Loki constantly.

For large-scale deployments, consider:
- Managed services (Grafana Cloud, Datadog, etc.)
- Kubernetes with Loki scaling
- Object storage (S3) for long-term retention

## Next Steps

1. ✅ Basic logging with Winston (done for auth-service)
2. ⬜ Add logging to other services
3. ⬜ Create Grafana dashboards
4. ⬜ Set up alerts for critical errors
5. ⬜ Add metrics with Prometheus
6. ⬜ Implement distributed tracing (Jaeger/Tempo)
