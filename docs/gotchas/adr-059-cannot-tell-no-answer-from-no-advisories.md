Behaviour depends on the exemption registry, which is the dangerous part:

| Registry | Result |
|---|---|
| Shipped (has exemptions) | The stale-exemption check trips → `ADR-059 gate FAILED`. Fails **closed**, for the wrong reason. |
| Empty | No advisories seen → nothing to block → exit 0. Fails **OPEN**. |

During an outage the gate prints `upstream may be fixed; remove it` for every shipped exemption.
**Following that instruction empties the registry**, moving the gate from fail-closed to fail-open
exactly when it cannot tell you so. Do not act on that output while the endpoint is degraded.

Tracked as BUG-038. The fix pattern already exists in this repo:
`tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts` — "ADR-060 gate — refuses to fail
open on API errors".
