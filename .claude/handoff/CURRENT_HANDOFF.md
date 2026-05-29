# Sprint 72: Simulation Engine Overhaul — Ready to Execute

## Handoff Document

**Date**: 2026-05-29
**Current Version**: v10.0.0 → v10.1.0 (this sprint)
**Status**: Sprint 71 + karmyq.org content complete. Sprint 72 planned and ready to execute.

---

## Quick Start

1. Read this handoff
2. Create branch: `git checkout -b feature/sprint-72-simulation-overhaul`
3. Open plan: `docs/superpowers/plans/2026-05-29-sprint-72-simulation-overhaul.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 72 Goal

*Replace the single-loop simulation engine with 10 concurrent async workers running 24/7, so the Karmyq demo looks like a living mutual aid network — not a test fixture.*

---

## Public Launch Polish Arc

Sprint 72 is the start of a multi-sprint arc targeting a **June 19th public launch**. Each sprint polishes one service with all five tracks: functional, tests, docs, mission alignment, UI consistency.

| Sprint | Service | Status |
|--------|---------|--------|
| **72** | Simulation Engine | Ready to execute |
| **73** | Request Service | TBD |
| **74** | Community / Governance | TBD |
| **75** | Feed + Discovery | TBD |
| **76+** | Final pass + launch prep | TBD |

---

## What's Wrong With the Current Simulation

- **Single-loop architecture**: one async loop, 5-20 sessions scheduled sequentially per tick
- **Business hours only**: 09:00–21:00 PT — simulator sleeps 12 hours/day
- **Almost no trust edges**: trust edges are built via `match_completed` Bull event, but so few matches complete that the trust graph is nearly empty
- **Small user set**: `@test.karmyq.com` users grow slowly (12/day) and new envs start cold

---

## The Fix (Sprint 72)

| Change | Detail |
|--------|--------|
| `WorkerPool` class | 10 concurrent async workers via `Promise.all`, each independently sampling users |
| 24/7 operation | Business hours gate removed from `simulator.ts` entirely |
| Bootstrap guard | `bootstrapMinUsers()` ensures ≥30 users exist before workers start |
| Growth engine | Moves to standalone `setInterval(3min)`, decoupled from workers |
| Session affinity | Workers prefer to advance open requests over creating new ones (probability weight, not state) |
| Mission-aligned content | Request templates expanded to 20+/type, Portland neighborhood anchors, authentic voice |
| User guide | "Understanding the Demo" added to landing site |

---

## ⚠️ Critical Implementation Notes

1. **Trust edges are built via Bull queue, not API**: `match_completed` event → social-graph subscriber → `upsertTrustEdge()`. No direct trust API call needed.
2. **Workers are async, not OS threads**: `Promise.all` over 10 async loops is correct — Node.js event loop handles I/O concurrency.
3. **Business hours gate must be removed from code**: Remove the `isBusinessHours()` conditional in `simulator.ts` — don't just set `enabled: false` in config.
4. **Worker errors must not propagate**: Each worker loop needs `try/catch` that logs and continues, not re-throws.
5. **`bootstrapMinUsers` runs before WorkerPool.start()**: Workers must not start until DB has ≥30 users.
6. **Session affinity = probability weight only**: If sampled user has open requests, weight toward `acceptOffer`/`completeMatch` — no stateful session tracking.
7. **nav.json revert bug**: After editing `nav.json`, always `grep "demo-data" apps/landing/src/data/docs/nav.json` to verify it persisted — if not, re-apply and add slug to the hardcoded list in `scripts/generate-docs.ts`.

---

## Key Files for Sprint 72

| File | Change |
|------|--------|
| `services/simulation-service/src/worker-pool.ts` | **NEW** — WorkerPool class |
| `services/simulation-service/src/simulator.ts` | Wire WorkerPool, extract growth to setInterval, remove business hours gate |
| `services/simulation-service/src/config/default.json` | Add workers config, disable business hours, add bootstrapMinUsers |
| `services/simulation-service/src/profiles/index.ts` | Session affinity weight adjustment |
| `services/simulation-service/src/data/realistic-data.ts` | Expand request templates, add neighborhood anchors |
| `apps/landing/src/data/docs/guides/demo-data.json` | **NEW** — "Understanding the Demo" user guide |
| `apps/landing/src/data/docs/nav.json` | Add demo-data to User Guides section |
| `services/simulation-service/CONTEXT.md` | Architecture update |
| `services/simulation-service/tests/tdd/sprint-72-simulation-engine.test.ts` | **NEW** — WorkerPool + invariant tests |

---

## Per-Sprint Polish Checklist (applies to Sprint 72 and all future polish sprints)

Every sprint in this arc must complete all five tracks:

| Track | Sprint 72 scope |
|-------|----------------|
| **Functional** | WorkerPool, 24/7 operation, bootstrap guard, workflow follow-through |
| **Tests** | WorkerPool unit tests, behavioral invariants, content quality assertions |
| **Docs** | CONTEXT.md updated, user guide created |
| **Mission alignment** | Request templates rewritten to authentic mutual aid voice |
| **UI consistency** | N/A (simulation is backend-only) |

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **059**
- **ADR-057 and ADR-058**: Already `implemented` in both source `.md` and landing `.json`
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`; simulation tests in `services/simulation-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build — always add new slugs to the hardcoded list in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **`trust_edges_live` column**: exposes `current_weight` (not `effective_weight`) — use `current_weight AS effective_weight` alias when querying
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
- **trust_edges normalized constraint**: `social_graph.trust_edges` requires `user_id_a::text < user_id_b::text` — always sort: `const [a, b] = [uid1, uid2].sort()`
- **community_links UNIQUE**: fusion_origin links must be (merged↔A) and (merged↔B), NOT (A↔B)
- **TrustGraph fission mode ref**: `fgRef.current.d3Force(...)` is only callable after mount — always guard with `if (!fgRef.current) return`
- **Root package.json version**: 10.0.0 (bump to 10.1.0 in this sprint)

---

## Pre-existing TDD Failures (do NOT fix)

- `sprint-39-provider-ux` (7 fail)
- `sprint-43-feed-ranking` (crashes)
- `sprint-68-halflife` (6 DB connection tests)
- `sprint-67-governance` (DB connection tests)
