# ADR-101: Per-Consumer Event Queues

**Status**: Accepted (Sprint 133 PR Q; flips to Implemented after deploy)
**Date**: 2026-10-15
**Sprint**: 133 — PR Q (BUG-060, HIGH)
**Deciders**: Maintainer (ADR number allocated, BUG-066 and unconsumed-event policy decided 2026-10-15); Claude (implementation)
**Related**: [ADR-099](ADR-099-inventories-and-directed-requests.md) (completion and directed-notification queues),
[ADR-100](ADR-100-skill-visibility-and-endorsements.md) (endorsement queue), BUG-060, BUG-066

## Context

Before this decision, every service published to one Bull queue, `karmyq-events`, and three services
(notification, reputation, social-graph) attached workers to it. Each worker registered only the job
names its service handles.

Bull does not route by job name. A worker takes **any** waiting job: `getNextJob` moves it to
active with `brpoplpush` (`node_modules/bull/lib/queue.js:1246`, `bull@4.16.5`), and the
`moveToActive` Lua script has no name filter. `processJob` then fails a job whose name the worker
never registered with `Missing process handler for job type <name>` (`queue.js:1203-1208`). So any
event handled by only some of the attached services was lost whenever one of the others took it.
Retries reduce the loss but cannot remove it, because each attempt is a fresh draw.

Sprint 133 PR B Task B1 measured it against the real containers (CI run 38465333100): of 60
`request_created` jobs, **15 were permanently lost (25%)**, and 38 jobs had at least one failed
attempt. Sprint 132 had already moved `match_completed` to per-consumer queues (ADR-099) and Sprint
133 PR B gave `skill_endorsement_changed` its own queue (ADR-100). Every other event still used the
shared queue.

Two more defects surfaced while mapping the events:

- cleanup-service wrote `dibs_expired` and `match_reminder` straight to `karmyq-events` with default
  job options, which means a single attempt;
- 21 published event names had no handler anywhere. Each one failed three times and stayed parked
  in Redis forever (`removeOnFail: false`).

## Decision

**One routing table.** `packages/shared/events/routes.ts` classifies every event name exactly once:

| Class | Meaning | Publisher behavior |
|---|---|---|
| Routed (`EVENT_ROUTES`) | exactly one consumer handles it | enqueue on `karmyq-events-<consumer>` |
| Dedicated (`DEDICATED_EVENTS`) | it has its own transport (`match_completed`, `directed_request_created`, `skill_endorsement_changed`) | `publishEvent` throws; publish through the dedicated module |
| Unconsumed (`UNCONSUMED_EVENTS`) | no service handles it | not enqueued; `publishEvent` resolves `null` |

Any other name makes `publishEvent` throw.

**One queue per consumer, one consumer per queue.** Today the consumers are `notification` (17 events)
and `reputation` (`interaction_feedback_submitted`). A consumer attaches through
`startConsumerQueue(consumer, handlers, redisUrl)`, which **refuses to start** unless the handler
names equal the routed events for that consumer exactly. A missing handler would recreate BUG-060
deterministically, and an extra one is dead code. A startup failure makes the service unhealthy and
the deploy rolls back.

**An event needing two or more consumers is dedicated.** It follows the dispatch-and-fan-out pattern of
`services/request-service/src/events/completionEvents.ts` (one dispatch job that adds an idempotent
job to each consumer's queue), never two plain `add` calls.

**Everyone publishes through the router.** cleanup-service now uses `createPublisher` like the other
services, so its events get the standard retries.

**Enforced by a gate, not by convention.** `tests/regression/sprint-133-pr-q-event-routes.test.ts`
scans `services/*/src` and fails on any of these:
- an unclassified publish site, or a dynamic event name;
- a direct Bull `add` of a non-dedicated event;
- any reference to `karmyq-events` outside the three legacy subscribers;
- a consumer whose `register(...)` set differs from its routes;
- `services/registry.json` events that differ from the source.

Each rule has a negative fixture proving it can fail.

## Migration

- **Legacy handlers stay for one release.** notification and reputation register every routed
  handler on both their own queue and `karmyq-events`, so jobs published by an old publisher during
  the rolling deploy still drain. social-graph keeps its Sprint 132 legacy `match_completed` handler.
  Nothing publishes to `karmyq-events` after this deploy.
- **Deploy window.** An old publisher writing to `karmyq-events` while the new consumers are up is
  drained by the legacy handlers (with the old competition, for those stragglers only). A new
  publisher writing to the new queues while an old consumer is still up leaves jobs waiting in
  Redis until the new consumer starts; none are lost. After a rollback, jobs already on the new
  queues wait until the next successful deploy.
- **No redrive.** Failed jobs parked on the demo's `karmyq-events` are not replayed: they are
  stale notifications, and replaying them would notify people about old activity.
- **Follow-up.** Remove the legacy handlers and retire the B1 live reproduction test once a
  read-only check shows the demo's `karmyq-events` has nothing waiting or delayed.

## Consequences

### Positive

- BUG-060 is closed for every routed event. The PR Q integration test delivers 80 of 80 jobs
  with no failed attempt against the real containers.
- Unconsumed events no longer accumulate as parked failed jobs in Redis.
- A new event cannot ship unclassified, and `services/registry.json` events are now true and stay
  true.

### Negative

- A publishing service opens a consumer's Bull queue on its first publish to that consumer, so it
  holds at most one queue per consumer it actually uses. In practice only request-service uses both today.
- Adding a consumer to an existing event means moving it to `DEDICATED_EVENTS` and writing a
  dispatch module, which is deliberate friction.
- `publishEvent` now throws for an unclassified name. The gate makes that unreachable for literal
  call sites, and the publish sites that matter are wrapped in try/catch.

### Neutral

- Job options and the `{ eventType, payload, timestamp, source }` envelope are unchanged.
- `getEventQueue` is removed from `createPublisher` (it had no callers).

## Alternatives Considered

### Detach the non-notification workers from `karmyq-events`

- Leave notification as the only worker on the shared queue and give reputation its own queue
  for `interaction_feedback_submitted`.
- This is smaller, but the next service to attach a worker reintroduces BUG-060 silently.
  Rejected in favor of a structural rule the gate can enforce.

### One queue per event

- This would also remove the competition, but it multiplies queues and connections for no
  benefit: competition is between services, not between event names within one service.

### Keep enqueuing unconsumed events to an archive queue

- Rejected by the maintainer (2026-10-15). It's a queue that only grows, and it records nothing a
  consumer could use.
