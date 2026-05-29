# Sprint 72: Simulation Engine Overhaul — Design Spec

**Date**: 2026-05-29
**Status**: Approved
**Version**: v10.0.0 → v10.1.0
**Sprint Branch**: `feature/sprint-72-simulation-overhaul`

---

## Overview

The Karmyq demo runs on a synthetic data engine that is supposed to make the platform feel like a living mutual aid network. In practice, it looks like a test fixture: a handful of users, thin activity, and nearly empty trust graphs. The root cause is structural — the simulator is a single async loop that spawns 5-20 "sessions" sequentially, restricts itself to business hours, and doesn't complete enough matches to build meaningful trust relationships.

This sprint replaces the single-loop architecture with a **WorkerPool of 10 concurrent async workers** running 24/7. Each worker independently samples a real sim user from the database, executes a full workflow (including follow-through on open requests), and loops continuously with a short delay. Because trust edges are created via the `match_completed` Bull queue event — which is already wired — simply completing more matches at higher concurrency will naturally populate the trust graph. No new trust endpoints are needed.

The second half of the sprint applies the full 5-track polish checklist: tests that lock in behavioral invariants, documentation that accurately describes the simulation, and a mission alignment pass to ensure every simulated scenario feels like real mutual aid — not synthetic test data.

### Core Principle: Throughput As Data Quality

The demo data problem is not a content problem — it is a throughput problem. More concurrent workers completing more lifecycle events produces a richer, more believable social graph automatically. Content improvements compound on top of this structural fix.

---

## Multi-Sprint Arc

| Sprint | Service | Status |
|--------|---------|--------|
| **72** | Simulation Engine | This sprint |
| **73** | Request Service | Upcoming |
| **74** | Community / Governance | Upcoming |
| **75** | Feed + Discovery | Upcoming |
| **76+** | Final pass + launch prep | Upcoming |

**June 19th public launch target.**

---

## Architecture Change: WorkerPool

### Current (broken)

```
Simulator.start()
  └── while (true) [single loop, 1-5 min ticks]
        ├── isBusinessHours() check → sleeps 09:00–21:00 PT only
        ├── maybeRegisterNewUser()
        └── for each session slot (5-20 sequential):
              createSimulatedUser() → startUserSession()
```

Sessions are scheduled sequentially in one loop tick. On a slow API, this means 1-3 actions per minute total.

### New (WorkerPool)

```
Simulator.start()
  ├── bootstrapMinUsers()      ← ensure ≥30 users before workers start
  ├── WorkerPool.start(10)     ← 10 concurrent workers, Promise.all
  │     Worker 0: getRandomUser → token → selectWorkflow → execute → delay(5-30s) → repeat
  │     Worker 1: same, independent
  │     ...
  │     Worker 9: same, independent
  └── growthTick()             ← separate setInterval every 3 min
        maybeRegisterNewUser()
```

**No business hours gate.** Workers run 24/7.

Each worker is a `while (true)` async loop. Errors are caught per-worker — a single workflow failure does not crash any other worker. Workers restart automatically after a 10-second backoff.

---

## Bootstrap Guard

If `getUserCount() < bootstrapMinUsers` (default: 30) on startup, the simulator registers users in parallel (5 at a time) until the threshold is reached before starting workers. This ensures new demo environments are never empty.

---

## Workflow Follow-Through

The current simulation creates many requests but few completions because the same user who creates a request rarely gets picked again to accept an offer and complete it. Workers will be given **session affinity**: a worker that creates a request will, on its next iteration, check that user's open requests first and prefer to advance them (accept an offer or complete a match) before picking a new action. This is a simple priority weight adjustment in the workflow selector, not a stateful session system.

---

## Data Model

No schema changes.

---

## API Endpoints

No new endpoints.

---

## Config Changes

`services/simulation-service/src/config/default.json`:

| Field | Old | New |
|-------|-----|-----|
| `schedule.businessHours.enabled` | `true` | `false` |
| `users.concurrentSessions.min/max` | `5 / 20` | removed |
| `workers.count` | (new) | `10` |
| `workers.delayMs.min` | (new) | `5000` |
| `workers.delayMs.max` | (new) | `30000` |
| `growth.bootstrapMinUsers` | (new) | `30` |
| `growth.newUsersPerDay` | `12` | `15` |

---

## Mission Alignment Audit

The `realistic-data.ts` file will be reviewed against the karmyq mission voice on the landing page. Every request template should:
- Sound like a real person asking a real neighbor for help
- Reflect the kinds of mutual aid that real communities practice: food, transportation, childcare, skills, emotional support, tools
- Use natural, warm language — not technical or generic placeholders

Specific improvements:
- Expand request templates from current set to 20+ variants per type
- Add urgency variation: some urgent, most routine
- Add geographic anchoring: Portland neighborhood names (Hawthorne, Alberta, Buckman, Sellwood)
- Community descriptions reviewed for mission resonance

---

## Frontend Changes

None — simulation is a standalone backend service.

---

## User Guide & Doc Updates

**New user guide**: `apps/landing/src/data/docs/guides/demo-data.json`

Title: "Understanding the Demo"
Content: Explains that karmyq.com runs a live simulation of a mutual aid network. Describes the communities, what the simulated users are doing, and how the trust graph builds over time. Helps evaluators understand what they're looking at and why it feels realistic.

**Update**: `apps/landing/src/data/docs/nav.json` — add "Understanding the Demo" to User Guides section.

---

## Critical Implementation Notes

1. **Trust edges are built via Bull queue, not API**: The `match_completed` event fires when `completeMatch()` succeeds. The social-graph service subscriber creates the trust edge. No direct trust API call needed from the simulation.

2. **Workers are I/O-bound, not CPU-bound**: No actual OS threads needed. `Promise.all` over 10 async loops is correct — Node.js handles the concurrency via the event loop.

3. **Business hours gate must be fully removed, not just disabled**: The config flag exists but the guard is in `simulator.ts` — remove both the config check and the conditional sleep.

4. **`getRandomUser()` queries the DB on every call** — with 10 workers each looping every 5-30s, this is ~20-120 DB queries per minute. Acceptable for a dev/demo environment; add a brief in-memory user cache if query rate becomes a concern.

5. **Worker errors must not crash sibling workers**: Each worker's `while (true)` must have a `try/catch` that logs the error and continues. The pool's `Promise.all` will only reject if a worker throws uncaught — guard against this.

6. **Growth engine moves to `setInterval`**: The current growth logic is embedded in the main loop tick. Extract it to a standalone `setInterval(growthTick, 3 * 60 * 1000)` so it runs independently of workers.

7. **Session affinity is a priority weight only**: Do not build a stateful session system. A worker picks the "advance open request" workflow with higher probability when the sampled user has one. Simple probability tweak, not architecture.

8. **`bootstrapMinUsers` runs before `WorkerPool.start()`**: Workers must not start until the DB has enough users, or they will spin in empty-result loops.
