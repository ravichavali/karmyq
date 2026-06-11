# ADR-074: Canonical Error Response Contract

**Status:** Accepted
**Date:** 2026-06-11
**Sprint:** 94

## Context

Karmyq's root API contract specifies errors as a string code plus a human-readable message:

```json
{
  "success": false,
  "message": "Human-readable error",
  "error": "ERROR_CODE"
}
```

Most route handlers already follow that shape, either exactly or with a top-level `message` and
best-effort string `error`. The outlier was the shared response helper in
`packages/shared/utils/response.ts`, which emitted:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error"
  }
}
```

Sprint 93 exposed the practical failure mode: when a client rendered `data.error` directly, React
received an object child and threw React #31. Sprint 93 defended the web read side with a tolerant
error display helper; Sprint 94 fixes the emit side at the shared source.

## Decision

The canonical HTTP API error envelope is:

```json
{
  "success": false,
  "message": "Human-readable error",
  "error": "ERROR_CODE",
  "details": {},
  "meta": {
    "timestamp": "2026-06-11T00:00:00.000Z",
    "requestId": "uuid-v4"
  }
}
```

`message` is the display string. `error` is a stable string code for programmatic handling.
`details` is optional and carries validation details, conflict details, or development-only stack
metadata. The `error` field must not contain objects.

Sprint 94 updates:

- `sendError`, typed helper wrappers, and `sendInternalError` in `@karmyq/shared`.
- Shared validation, tenant, and rate-limit middleware.
- Blocking tests that asserted the old object shape.
- Web client comments and tests so legacy object envelopes remain tolerated, but are not described
  as the ongoing contract.

## Migration Boundary

This ADR does **not** claim that every direct route literal in every service now emits a fully
canonical envelope. Direct route literals are not swept in Sprint 94. Known drift remains:

- Some direct route literals already emit `{ success:false, message, error:"CODE" }`.
- Some direct route literals emit `{ success:false, message }` without an `error` code.
- `cleanup-service` has local object-shaped helper responses and a rate-limit object literal; this
  is catalogued direct-route drift, not part of the shared helper/middleware fix.
- Mobile error-read tolerance is deferred with mobile parity. The demo priority for Sprint 94 is
  web, whose client remains dual-read tolerant.

After Sprint 94, the enforced boundary is: shared helpers and shared middleware emit the canonical
shape. Direct service routes should migrate opportunistically when touched or in a later route-sweep
sprint.

## Consequences

- New shared-helper errors match the root API contract and cannot put an object in `data.error`.
- Existing web clients can still display old object-shaped responses during the compatibility
  window.
- Tests now lock the shared helper and middleware contract.
- ADR-006's older object-shaped example is superseded for errors by this ADR.
- Services with direct response literals remain a documented cleanup surface.

## Alternatives Considered

- **Keep the object envelope and update the root contract.** Rejected because most route literals
  and the global `CLAUDE.md` contract already use the string-code shape.
- **Sweep every direct route in all services now.** Rejected as too broad for Sprint 94; the highest
  risk and observed bug came from the shared helper and middleware emitters.
- **Client-only tolerance.** Rejected as a workaround. Sprint 93 already did the client defense; the
  shared emitter needed to be fixed forward.

## Related

- ADR-006: Standardized API Response Format
- ADR-049: Error Visibility — `error_type` Discriminator and `X-Request-Id` Convention
- Sprint 93 login-401 React #31 guard (`apps/frontend/src/lib/errors.ts`)
