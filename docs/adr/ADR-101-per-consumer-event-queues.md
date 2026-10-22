# ADR-101: Per-Consumer Event Queues

**Status**: Implemented (Sprint 133 PR Q v11.88.0 `36a9972f`, deployed 2026-10-16, CI/CD 38948723833); amended Sprint 134 PR L (legacy handlers removed, reputation no longer a consumer)
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
- any reference to `karmyq-events` outside the three legacy subscribers (since Sprint 134 PR L: any
  reference at all; see the amendment below);
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
  read-only check shows the demo's `karmyq-events` has nothing waiting or delayed. **Done in Sprint 134
  PR L** (see the amendment below).

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

## Amendment (Sprint 134, 2026-10-22): legacy handlers removed; reputation is no longer a consumer

**The drain check passed.** The maintainer ran the read-only check on the demo host on 2026-10-20, after
#310 deployed: the legacy `bull:karmyq-events` had `wait`, `active`, `paused` and `delayed` all 0, and each
`karmyq-events-<consumer>` queue was served only by its own consumer's container. Nothing has published to
`karmyq-events` since this ADR deployed, so the result holds until the removal ships.

**Legacy handlers removed.** notification, reputation and social-graph no longer open `karmyq-events`.
`match_completed` arrives only on each service's completion queue (ADR-099). `startConsumerQueue` loses its
optional `legacyQueue` parameter, and the unused `export default eventQueue` in each subscriber goes too.

**Reputation is no longer a consumer.** Its one routed event, `interaction_feedback_submitted`, was published
only by request-service `POST /matches/:matchId/feedback`. That route always failed (BUG-068) and no client
called it, so the route, the event and the reputation handler are retired together. `EVENT_CONSUMERS` is now
`['notification']`, and reputation no longer starts `karmyq-events-reputation`. It keeps its dedicated queues:
`karmyq-completion-reputation` and `karmyq-community-evolution`. The alternative, an empty consumer queue kept
for future events, would be a queue with no purpose; the next routed reputation event adds it back
(maintainer, 2026-10-20). The `requests.interaction_feedback` table and the always-0 average columns are
dropped separately in Sprint 134 PR L2.

**The gate tightens.** `tests/regression/sprint-133-pr-q-event-routes.test.ts` now fails on **any**
`karmyq-events` reference in `services/*/src`, and on `register(...)` calls in a service that is not in
`EVENT_CONSUMERS` (otherwise a dropped consumer's handlers would go unchecked). Both rules have negative
fixtures. The BUG-060 integration test keeps only its mechanism half (a scratch queue); the PR Q integration
test narrows to notification and asserts that no container attaches a worker to `karmyq-events` or to
`karmyq-events-reputation`.

**After deploy.** A read-only check confirms that no container lists a `karmyq-events` or
`karmyq-events-reputation` worker and that neither queue receives new jobs. The keys left in Redis are inert;
deleting them is not part of this change.
