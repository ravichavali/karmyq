During a 2026-09-03 outage, `POST` to both `/-/npm/v1/security/audits/quick` and
`/-/npm/v1/security/advisories/bulk` hung or returned 503 — in two independent networks (a dev
machine and GitHub-hosted runners) — while `GET /-/ping` returned 200 and
<https://status.npmjs.org/> reported "All Systems Operational" with 100% Security Audit uptime over
90 days.

A single-dependency throwaway project reproduced the 503, so it was not payload size.

Diagnose advisory-endpoint health with a direct probe. Never from the status page.
