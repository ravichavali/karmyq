# Error Observability

## Overview

Karmyq ships structured JSON logs from all 11 services to Loki (via Promtail), visualized in Grafana. Every request gets a `requestId`; every error response includes an `X-Request-Id` header users can reference.

## Error Types

Every log entry for a failed request includes an `error_type` field:

- **`system_error`** — 5xx responses: unexpected crashes, DB failures, downstream timeouts.
- **`user_error`** — 4xx responses: bad input, auth failures, not-found.

This field is set automatically by `requestLoggingMiddleware` in `packages/shared/utils/logger.ts` based on the HTTP status code. No per-endpoint instrumentation is needed.

## Grafana Dashboard

The **Error Visibility** dashboard provides:

- Error counts by service (last 24h)
- Error rate over time per service
- Recent system errors (5xx) with full context
- Recent user errors (4xx)
- Errors indexed by request ID

## Support Reference IDs

When a 5xx error occurs, the response includes `X-Request-Id`. The frontend surfaces this as a reference code. Users can include this when reporting issues.

## LogQL Queries

```logql
# All system errors
{level="error"} | json | error_type="system_error"

# All user errors (4xx)
{level="warn"} | json | error_type="user_error"

# Errors with a specific request ID
{level="error"} | json | requestId="req_1234567890_abc"
```

## Related

- ADR-049: Error Visibility — `error_type` discriminator and `X-Request-Id` convention
- ADR-015: Observability Stack (Grafana/Loki/Prometheus)
