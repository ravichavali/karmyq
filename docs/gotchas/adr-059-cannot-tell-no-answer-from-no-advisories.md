Sprint 128 fixes BUG-038: unavailable or invalid audit evidence fails before exemption matching,
for both empty and populated registries. The CLI reports an unavailable-evidence error, without
stale-exemption removal advice or raw upstream stderr. Valid zero-finding reports and valid
reports with unmatched entries still follow ADR-059 policy; critical findings always block.

The regression `tests/regression/sprint-128-audit-response-contract.test.ts` exercises malformed
reports, severity graphs, process exit/signal/timeout handling and the actual CLI. Its real-child
stderr fixture proves the sanitized handler is not bypassed by subprocess output.

Historical failure, retained to explain the rule:

| Registry | Result |
|---|---|
| Shipped (has exemptions) | The stale-exemption check trips → `ADR-059 gate FAILED`. Fails **closed**, for the wrong reason. |
| Empty | No advisories seen → nothing to block → exit 0. Fails **OPEN**. |

During an outage the gate prints `upstream may be fixed; remove it` for every shipped exemption.
**Following that instruction empties the registry**, moving the gate from fail-closed to fail-open
exactly when it cannot tell you so. Do not act on that output while the endpoint is degraded.

Tracked as BUG-038. The earlier fix pattern was:
`tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts` — "ADR-060 gate — refuses to fail
open on API errors".
