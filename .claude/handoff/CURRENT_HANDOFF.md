# NEXT: Sprint 123 — Licensing decision (AGPL) + record the audit

> **Sprint 122 is CLOSED and SHIPPED at v11.42.0.** Nothing is in flight; master is deployed and
> verified. Detail:
> [`archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md`](archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md).
>
> **The diagnosis review is DONE.** It produced
> [`docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](../../docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md)
> — a bidirectional audit of the published manifesto against the code, and a four-sprint arc
> (S123 licensing · S124 provider standing · S125 demo backfill · S126 live simulation).
> **Read that document first; this file only carries what surrounds it.**

## Quick Start

1. Read `CLAUDE.md`, this file, then the **arc design** above.
2. **S123 is next.** It is a *licensing decision*, not a documentation cleanup — see the ⚠️ in its
   section. The maintainer has chosen **AGPL** (D7, 2026-08-07); the two provenance actions remain
   **blocking** before any `LICENSE` file is published.
3. Use the `sprint-planning` skill to turn S123 into a spec + plan. The arc design is the input,
   not the plan.

## ⚠️ The one thing not to get wrong in S123

Adding a `LICENSE` is a **new legal grant**, not a record of an existing one — there is no license
file today, so default copyright applies, and `README.md` currently claims **MIT** while the landing
footer claims **AGPLv3**. Two contributors other than the maintainer have surviving code
(`Pallavi Ravi` — 36% of `infrastructure/nginx/nginx.conf`; `Karmyq Developer <karmyq@example.com>`
— the initial commit and ~180 surviving lines). **Their status must be resolved before publishing.**
Nobody has forked or starred the repo, so no third party has relied on the MIT claim — that part is
clear. The maintainer flagged this as the thing they are least confident about, and they are right.

---

## What the maintainer asked for (2026-08-06)

> *"I want an architecture/product review to make sure we are on the right path. I also want to look
> at our seeding process. I am not too happy with the data so far."*

### Where each thread landed

Both are answered in the arc design — **do not re-derive them here.**

| Thread | Outcome |
|---|---|
| *'Are we on the right path?'* | **Yes, with one exception.** Nine manifesto claims hold, several implemented more rigorously than advertised. Every failure clusters on the **paid-provider surface** (arc design §2.1–2.2). |
| *'Not happy with the data'* | **Root cause traced.** The nine richest personas are exactly the nine the simulation is forbidden to act as — ADR-087's determinism guarantee working as designed. That is why `maria.reyes@` has zero conversations (arc design §5). |

⚠️ **Two traps the arc design records, worth carrying in your head:**

1. **Separate "thin seed data" from "missing implementation".** `mark-read` looks like a data gap
   and is absent code — `markMessagesAsRead` exists and is never called.
2. **`TimeTravelFactory` violates the replay constraint** it appears to satisfy: it inserts into
   `reputation.karma_records` directly with caller-supplied points. Fixing it is S125's **first**
   task, not a prerequisite it already meets.

## Standing state

- **Version:** v11.42.0 on master, deployed and smoke-tested (landing 200 · bodyless login 400
  `VALIDATION_ERROR` · wrong password 401 `UNAUTHORIZED`).
- **Branch:** `docs/sprint-123-planning`, cut from `origin/master` `e5dc24ce`. It carries the S122
  closeout **and** the arc design. `fix/adr-060-gate-pr-head-ref` is merged and can be deleted;
  `docs/sprint-122-closeout` was closed (local + remote) — its content lives here instead.
- **ADR-060 gate now genuinely gates.** Verified live on both paths. Before touching it, read
  ADR-060 §6/§6b/§6c — it reported success while inert **four** separate ways, and each was caught
  by review or CI, never by inspection. **A green gate run proves nothing; watch it go red.**
- **ADR-091 is `Implemented`** — the four verification rules it adopts are now enforced in
  `CLAUDE.md` Discipline 5, the `/review-response` skill, and two regression suites.

### Carried debt (none blocks the review)

- `redisClient.publish` UNPROVEN — needs a seeded conversation (ties directly to the seeding review).
- `mark-read` unimplemented — needs a bug entry.
- `Expo SDK drift` workflow failing on master (pre-dates v11.42.0).
- **#190** regenerated Expo held bumps · **#192** dev-deps (`tsx`, `@types/pg`, `@types/semver`).
- ADR-028's new-service Dockerfile template still shows `node:18-alpine`; the runtime-floor gate
  (ADR-090) will fail any new service that copies it.
- `.npmrc` `engine-strict` still unset.

### Process notes worth keeping

- `/code-review` is **maintainer-invoked only** — the agent cannot run it. Don't record it as done.
- One force-push was authorised on 2026-08-06 to drop an empty commit. **Standing rule is still
  never force-push**; that was a one-off.
- `gh pr merge --admin` via Bash is blocked by the permission classifier; the GitHub MCP
  `merge_pull_request` tool works.
- `curl` and `jq` are unusable on this host — use `node -e` with `fetch`. `/health` 404s through
  nginx; smoke tests must hit `POST /api/auth/login`.
