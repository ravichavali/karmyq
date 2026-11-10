# Error Observability

## Overview

Karmyq ships structured JSON logs from every service in [`services/registry.json`](../../services/registry.json) to Loki (via Promtail), visualized in Grafana. Every request gets a `requestId`; every error response includes an `X-Request-Id` header users can reference.

## Log Levels and Routine Database Queries

The database wrappers (`src/database/db.ts`) in auth, community, request, reputation, notification and cleanup log through the shared logger (`createLogger` in `packages/shared/utils/logger.ts`), which emits a record only at or above `LOG_LEVEL` — `info` unless set. (Much other service code still writes with `console.*`, which `LOG_LEVEL` does not filter.) A successful SQL query is **routine**: those wrappers log it at `debug` as `Executed query` with the SQL text, duration and row count (never the parameter values), so it is silent by default and appears only with `LOG_LEVEL=debug`. Until Sprint 139 five services printed one such line for every query whatever the level, which buried the lines that matter (BUG-082). Failures are not routine and are unaffected: a failing query still rejects with its original error, which the request handler logs at `error`, and connection and rollback failures are still logged as errors.

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
