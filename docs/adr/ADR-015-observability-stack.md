# ADR-015: Observability Stack (Grafana/Loki/Prometheus)

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: infrastructure/docker/docker-compose.yml

## Context

With 9 distributed microservices, we needed:
- Centralized logging (debug across services)
- Metrics collection (performance monitoring)
- Visualization (dashboards)
- Alerting (production issues)

## Decision

**Full observability stack: Grafana + Loki + Prometheus + Promtail.**

### Architecture

```
┌─────────────────────────────────────────────┐
│            Grafana (Port 3011)              │
│         (Visualization + Dashboards)        │
└─────────────┬───────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼─────┐      ┌──────▼──────┐
│  Loki   │      │ Prometheus  │
│ (Logs)  │      │  (Metrics)  │
│  3100   │      │    9090     │
└───▲─────┘      └──────▲──────┘
    │                   │
┌───┴─────┐      ┌──────┴──────┐
│Promtail │      │Service /    │
│(Shipper)│      │metrics      │
└─────────┘      └─────────────┘
```

### Components

**1. Loki (Port 3100)** - Log Aggregation
- Collects logs from all services
- Indexed by labels (service, level, request_id)
- Query with LogQL

**2. Promtail** - Log Shipper
- Scrapes Docker container logs
- Adds labels and metadata
- Ships to Loki

**3. Prometheus (Port 9090)** - Metrics
- Scrapes /metrics endpoints
- Time-series database
- Query with PromQL

**4. Grafana (Port 3011)** - Visualization
- Dashboards for logs + metrics
- Alerts and notifications
- Explore mode for ad-hoc queries

### Service Instrumentation

**Logging:**
```typescript
import { logger } from '@karmyq/shared/utils/logger';

logger.info('Request processed', {
  requestId: req.id,
  userId: req.user.id,
  duration: Date.now() - startTime
});
```

**Metrics:**
```typescript
// Prometheus client
import prometheus from 'prom-client';

const requestDuration = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});
```

### Access

- **Grafana UI**: http://localhost:3011
- **Prometheus UI**: http://localhost:9090
- **Loki API**: http://localhost:3100

## Consequences

### Positive

- **Centralized Logs**: See all services in one place
- **Correlation**: Trace requests across services via requestId
- **Performance Monitoring**: Identify slow endpoints
- **Production Ready**: Alert on errors, high latency
- **Historical Analysis**: Query past metrics and logs

### Negative

- **Resource Overhead**: 3 additional containers
- **Storage**: Logs and metrics consume disk
- **Learning Curve**: PromQL, LogQL syntax
- **Configuration**: Initial dashboard setup takes time

## Alternatives Considered

### Alternative 1: Cloud Services (Datadog, New Relic)

- **Why rejected**: Cost prohibitive, vendor lock-in

### Alternative 2: ELK Stack (Elasticsearch, Logstash, Kibana)

- **Why rejected**: Heavy resource usage, complex setup

### Alternative 3: No Observability

- **Why rejected**: Debugging distributed systems impossible

## References

- Docker compose: `infrastructure/docker/docker-compose.yml`
- Grafana: http://localhost:3011
- Prometheus: http://localhost:9090
- Loki docs: https://grafana.com/docs/loki/
- Prometheus docs: https://prometheus.io/docs/
