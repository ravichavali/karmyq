# Sprint 133 PR Q — Per-Consumer Event Queues (BUG-060) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **One PR.** Branch `agent/claude/sprint-133-pr-q-queue-migration` (already cut from `origin/master`; it carries the
> handoff and ADR-100 → Implemented). PR B (#303) and the exemption renewal (#304) are shipped. PR D starts only after this PR
> deploys green. Target 2026-10-15, **SLA 2026-10-20** (BUG-060 is HIGH).

**Goal:** No event published through `@karmyq/shared` can be taken and failed by a worker from a service that doesn't handle it. Each event goes to the one queue that only its consumer's workers attach to, so the BUG-060 loss (15 of 60 `request_created` jobs) drops to 0.

**Architecture:** A routing table in `packages/shared/events/routes.ts` classifies every event name in one of three ways: *routed* to exactly one consumer, *dedicated* (it already has its own transport), or *unconsumed* (no handler anywhere). `createPublisher().publishEvent` enqueues a routed event on `karmyq-events-<consumer>` and skips Redis for an unconsumed one. It throws for a dedicated or unclassified name. Consumers attach through `startConsumerQueue(consumer, handlers)`, which refuses to start unless the handler names equal the table's routes for that consumer exactly. The legacy `karmyq-events` workers stay registered for one release, to drain jobs published before the deploy. This follows the ADR-099 completion-queue precedent.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Bull is the installed `bull@4.16.5` (`node_modules/bull/package.json`), a single hoisted copy with no nested `services/*/node_modules/bull` or `packages/shared/node_modules/bull`, so one `jest.mock('bull')` in a service test also replaces the Bull used by `@karmyq/shared`.

**Spec:** there is no separate spec document. This plan argues from:
- [`docs/BUGS.md`](../../BUGS.md) **BUG-060**: confirmed mechanism (`bull/lib/queue.js:1203-1208,1246`) and live evidence (CI run 38465333100);
- [`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`](../specs/2026-10-08-sprint-133-skills-depth-design.md) Critical Note 7;
- the maintainer decisions of 2026-10-15, recorded in `.claude/handoff/CURRENT_HANDOFF.md` (*Next unchecked action* 7a):
  1. **ADR-101 is allocated** for per-consumer event queues.
  2. **BUG-066 is fixed in this PR** (four push handlers read the wrong field; see the inventory).
  3. **Unconsumed events stop being enqueued.** An unclassified name throws.

## Global Constraints

- **No dependency edits.** Don't touch `package.json` / `package-lock.json` in any workspace, even where a declaration becomes unused (`services/cleanup-service` keeps its `bull` declaration). The dependency lane is not part of this PR.
- **Job options are unchanged** for routed events: `attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`, `removeOnComplete: 100`, `removeOnFail: false` (`packages/shared/events/publisher.ts:11-16` today).
- **Payload envelope is unchanged:** `{ eventType, payload, timestamp, source }`.
- **The dedicated transports are not modified:** `karmyq-completion-*` (`services/request-service/src/events/completionEvents.ts`), `karmyq-directed-notifications` (`directedNotifications.ts`), `karmyq-skill-endorsement-social-graph` (`services/auth-service/src/events/endorsementEvents.ts`).
- **Legacy `karmyq-events` handlers stay registered** in notification, reputation and social-graph. Nothing may *publish* to `karmyq-events` after this PR.
- **One consumer per routed event.** Any event that needs two or more consumers must use the dispatch pattern of `completionEvents.ts` (one dispatch job fanned out idempotently), never two plain `add` calls.
- **New sprint tests start in the changed workspace's `tests/tdd/`** (root gate: `tests/tdd/`); promote when green and restore any unrelated file the promoter sweeps (memory: *TDD promoter sweeps unrelated files*).
- **Demo operations:** the post-deploy Redis inspection is read-only, but it runs on the shared demo server. Ask the maintainer first and name this lane (PR Q). Any smoke that publishes an event is a demo write and needs per-operation authorization.
- Version bump: the minor from `origin/master` **at merge time** (11.87.0 today, so 11.88.0 unless something else merges first).

## Review Focus

These are failure modes the BUG-060 fix implies but a unit suite won't exercise. Each one has its test in the owning task:

1. **A routed event whose consumer lacks a handler** fails every job with `Missing process handler`: BUG-060 again, now deterministic. `startConsumerQueue` throws at startup (Task 1 unit test), each consumer's test asserts the exact registered set (Tasks 2, 3), and the root gate cross-checks the source (Task 5).
2. **A publisher left on the shared queue.** Cleanup-service writes `dibs_expired` and `match_reminder` straight to `karmyq-events` with **no** job options (`attempts` defaults to 1): `services/cleanup-service/src/jobs/expireDibs.ts:9,66` and `matchReminderJob.ts:9,52`. The root gate fails if any file outside the three legacy subscribers constructs `karmyq-events` (Task 5, with a negative fixture). Task 4 migrates cleanup.
3. **A typo'd or new event name silently dropped.** `publishEvent` throws for unclassified names (Task 1). The root gate requires every literal publish site to be classified (Task 5, negative fixture).
4. **Delivery under the real containers.** All N jobs must complete with no failed attempt, and each must write exactly one row. Worker identity: only the consumer's container is attached to its queue, and the legacy queue's job counts don't change (Task 6).
5. **Deploy and rollback window.** An old publisher writes to `karmyq-events` while new consumers run, so legacy handlers drain it. A new publisher writes to the new queues while an old consumer runs, so those jobs wait in Redis and nothing is lost. After a rollback, jobs on the new queues wait until the next successful deploy. ADR-101 and the post-deploy check cover this (Tasks 7, 10). No automated test simulates it.

---

## Event inventory (verified 2026-10-15 by `grep -rn "publishEvent(\|\.add('" services/*/src`)

The arbiter at execution time is the Task 5 gate, not this table. If the gate and this table disagree, the source wins; fix the table in the PR.

**Routed → `notification`** (each one has a handler on `karmyq-events` today in `services/notification-service/src/events/subscriber.ts`):

| Event | Publisher (file:line) |
|---|---|
| `match_created` | request `routes/matches.ts:255` |
| `karma_awarded` | **none** (the handler exists; nothing publishes it) |
| `request_created` | request `routes/requests.ts:1924` |
| `join_request_created` | community `routes/members.ts:151` |
| `match_reminder` | cleanup `jobs/matchReminderJob.ts:52` (direct `karmyq-events` add) |
| `preferred_provider_selected` | request `routes/requests.ts:1944` |
| `provider_review_received` | reputation `routes/providerReviews.ts:47` |
| `provider_went_on_duty` | request `routes/providers.ts:572` (**BUG-066**) |
| `offer_submitted` | request `routes/providerOffers.ts:62` (**BUG-066**) |
| `offer_accepted` | request `routes/requesterOffers.ts:50` (**BUG-066**) |
| `offer_declined` | request `routes/requesterOffers.ts:90` (**BUG-066**) |
| `dibs_submitted` / `dibs_accepted` / `dibs_declined` | request `routes/dibs.ts:245,351,434` |
| `dibs_expired` | request `routes/dibs.ts:487`; cleanup `jobs/expireDibs.ts:66` (direct add) |
| `split_vote_started` | community `routes/splits.ts:166` |
| `fusion_vote_started` | community `routes/fusions.ts:169` |

**Routed → `reputation`:** `interaction_feedback_submitted` (request `routes/feedback.ts:148`).

**Dedicated (own transport, never through the router):** `match_completed` (request-service's publisher intercepts it, `src/events/publisher.ts:14`), `directed_request_created` (intercepted at `:13`), `skill_endorsement_changed` (auth `events/endorsementEvents.ts:59`).

**Unconsumed (21 names; published, no handler anywhere):** `user_created` (auth `routes/auth.ts:119`), `activity_joined`, `community_created`, `community.config.created`, `community_archived`, `community.config.updated`, `user_joined_community`, `user_left_community`, `norm_proposed`, `norm_established` (community), `health_metrics_calculated`, `milestone_achieved` (reputation), `match_proposed_by_admin`, `match_accepted`, `match_rejected`, `match_cancelled`, `offer_created`, `offer_withdrawn`, `privacy_settings_updated`, `request_completed`, `request_cancelled` (request). Today each one fails `Missing process handler` 3 times and stays parked in Redis (`removeOnFail: false`).

**BUG-066 (new, found in this planning):** the handlers for `provider_went_on_duty`, `offer_submitted`, `offer_accepted` and `offer_declined` destructure `job.data.providerUserId` / `requesterUserId` / `communityIds` / `price`. The publisher puts those fields under `job.data.payload`, so `sendPushToUsers([undefined], …)` finds no token (`services/notification-service/src/lib/expoPush.ts:28-35`) and no push is ever sent. `provider_went_on_duty` returns even earlier, at `if (!communityIds?.length)`. No test covers any of the four.

**Stale docs this PR corrects:** `services/registry.json` lists `user_joined_community` as a notification subscription (no handler exists), and `karma_awarded`/`badge_earned` as reputation publishes (neither is published). It also omits most real publishes. `claude.md:216-218` (*Events*) describes the single shared queue.

## File map

**Create**
- `packages/shared/events/routes.ts`: the routing table and its helpers (single source of truth).
- `packages/shared/events/consumer.ts`: `startConsumerQueue`.
- `packages/shared/src/events/__tests__/routes.test.ts`, `consumer.test.ts`.
- `services/notification-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`
- `services/reputation-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`
  (Gate regexes verified 2026-10-15: no `register('…')` and no named Bull `.add('…')` exists in `services/*/src` outside
  the inventory above, so the Task 5 scan starts from a known baseline.)
- `services/cleanup-service/src/events/publisher.ts`
- `services/cleanup-service/tests/tdd/sprint-133-pr-q-cleanup-publish.test.ts`
- `tests/tdd/sprint-133-pr-q-event-routes.test.ts`: the root gate.
- `tests/integration/queueHelpers.ts`: `settle` and `containerIps`, extracted from the B1 test.
- `tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts`
- `docs/adr/ADR-101-per-consumer-event-queues.md`

**Modify**
- `packages/shared/events/publisher.ts`: route; drop `getEventQueue`.
- `packages/shared/index.ts`: export the routes and consumer helpers.
- `packages/shared/src/events/__tests__/publisher.test.ts`
- `services/{auth,community,reputation,request}-service/src/events/publisher.ts`: drop the `getEventQueue` re-export.
- `services/notification-service/src/events/subscriber.ts`: `register` shim, consumer queue, BUG-066.
- `services/reputation-service/src/events/subscriber.ts`: `register` shim, consumer queue.
- `services/cleanup-service/src/jobs/expireDibs.ts`, `matchReminderJob.ts`, `src/index.ts`
- `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts`: import the extracted helpers.
- `services/registry.json`; `CONTEXT.md` of shared, notification, reputation, cleanup and request; `claude.md` *Events*;
  `docs/ARCHITECTURE.md` (queue section); `docs/BUGS.md` (BUG-060 fixed, BUG-066 new + fixed); `docs/IDEAS.md`
  (legacy-handler removal follow-up); `docs/adr/README.md`; `scripts/generate-docs.ts` (`ADR_GROUPS`);
  `docs/guides/managing-notifications-guide.md`; `.claude/handoff/CURRENT_HANDOFF.md`; `package.json` version (at merge).

---

### Task 0: Precondition check

- [ ] **Step 1:** Confirm the starting state.

```bash
git fetch origin
git status -sb                      # on agent/claude/sprint-133-pr-q-queue-migration, clean
git log --oneline -1 origin/master  # aded1986 or later
gh pr list --state open             # nothing that touches packages/shared or the subscribers
git merge-base --is-ancestor origin/master HEAD && echo "up to date with master" || echo "MERGE origin/master FIRST (merge commit, no rebase)"
```

Expected: clean tree, branch contains `origin/master`. If master moved, `git merge origin/master` (merge commit) before Task 1.

- [ ] **Step 2:** Read the gotchas for the touched paths.

```bash
node scripts/gotcha-check.js --for packages/shared/events/publisher.ts services/notification-service/src/events/subscriber.ts services/reputation-service/src/events/subscriber.ts services/cleanup-service/src/jobs/expireDibs.ts tests/tdd/x.test.ts tests/integration/x.integration.test.ts
```

Expected today: the dotenv `quiet: true` gotcha and the `:(glob)` pathspec gotcha. Neither changes this plan. Use `:(glob)` if you write a `git` pathspec with `**`.

---

### Task 1: Routing table, routed publisher, consumer helper (`@karmyq/shared`)

**Files:**
- Create: `packages/shared/events/routes.ts`, `packages/shared/events/consumer.ts`
- Create: `packages/shared/src/events/__tests__/routes.test.ts`, `packages/shared/src/events/__tests__/consumer.test.ts`
- Modify: `packages/shared/events/publisher.ts`, `packages/shared/index.ts:13`, `packages/shared/src/events/__tests__/publisher.test.ts`
- Modify: `services/auth-service/src/events/publisher.ts`, `services/community-service/src/events/publisher.ts`, `services/reputation-service/src/events/publisher.ts`, `services/request-service/src/events/publisher.ts` (drop `getEventQueue`)

**Interfaces:**
- Produces (exported from `@karmyq/shared` root):
  - `type EventConsumer = 'notification' | 'reputation'`
  - `EVENT_CONSUMERS: readonly EventConsumer[]`
  - `EVENT_ROUTES: Readonly<Record<string, EventConsumer>>`
  - `UNCONSUMED_EVENTS: ReadonlySet<string>`
  - `DEDICATED_EVENTS: Readonly<Record<string, { queue: string; consumers: readonly string[] }>>`
  - `consumerQueueName(consumer: EventConsumer): string` → `` `karmyq-events-${consumer}` ``
  - `eventsFor(consumer: EventConsumer): string[]` (sorted)
  - `type EventHandler = (job: Queue.Job) => Promise<void>`
  - `startConsumerQueue(consumer: EventConsumer, handlers: Readonly<Record<string, EventHandler>>, redisUrl: string): Queue.Queue`
  - `createPublisher(source)` → `{ initEventPublisher(): Promise<void>; publishEvent(eventType: string, payload: any): Promise<Queue.Job | null> }` (**`getEventQueue` removed**; zero callers outside the four re-exports, verified by `grep -rn getEventQueue services/*/src`)

- [ ] **Step 1: Write the failing tests**

`packages/shared/src/events/__tests__/routes.test.ts`:

```ts
import {
  DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, UNCONSUMED_EVENTS, consumerQueueName, eventsFor,
} from '../../../events/routes';

describe('event routing table (ADR-101)', () => {
  it('classifies every name exactly once', () => {
    const routed = Object.keys(EVENT_ROUTES);
    const dedicated = Object.keys(DEDICATED_EVENTS);
    const unconsumed = [...UNCONSUMED_EVENTS];
    const all = [...routed, ...dedicated, ...unconsumed];
    expect(new Set(all).size).toBe(all.length);
  });

  it('partitions the routed events across the consumers, each sorted', () => {
    const union = EVENT_CONSUMERS.flatMap((c) => eventsFor(c));
    expect(union.sort()).toEqual(Object.keys(EVENT_ROUTES).sort());
    for (const c of EVENT_CONSUMERS) {
      expect(eventsFor(c).length).toBeGreaterThan(0);
      expect(eventsFor(c)).toEqual([...eventsFor(c)].sort());
    }
  });

  it('pins the exact routes', () => {
    expect(eventsFor('reputation')).toEqual(['interaction_feedback_submitted']);
    expect(eventsFor('notification')).toEqual([
      'dibs_accepted', 'dibs_declined', 'dibs_expired', 'dibs_submitted', 'fusion_vote_started',
      'join_request_created', 'karma_awarded', 'match_created', 'match_reminder', 'offer_accepted',
      'offer_declined', 'offer_submitted', 'preferred_provider_selected', 'provider_review_received',
      'provider_went_on_duty', 'request_created', 'split_vote_started',
    ]);
    expect(Object.keys(DEDICATED_EVENTS).sort()).toEqual(['directed_request_created', 'match_completed', 'skill_endorsement_changed']);
    expect(UNCONSUMED_EVENTS.size).toBe(21);
  });

  it('never names the shared legacy queue', () => {
    for (const c of EVENT_CONSUMERS) expect(consumerQueueName(c)).not.toBe('karmyq-events');
    expect(consumerQueueName('notification')).toBe('karmyq-events-notification');
    expect(consumerQueueName('reputation')).toBe('karmyq-events-reputation');
  });
});
```

`packages/shared/src/events/__tests__/consumer.test.ts`:

```ts
const mockQueues: Record<string, { processed: string[]; on: jest.Mock }> = {};
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  const q = { processed: [] as string[], on: jest.fn(), process: (n: string) => { q.processed.push(n); } };
  mockQueues[name] = q;
  return q;
}));
import { startConsumerQueue } from '../../../events/consumer';
import { eventsFor } from '../../../events/routes';

const handlerFor = (names: string[]) => Object.fromEntries(names.map((n) => [n, async () => undefined]));

describe('startConsumerQueue', () => {
  it('attaches exactly the routed names to the consumer queue', () => {
    startConsumerQueue('reputation', handlerFor(['interaction_feedback_submitted']), 'redis://x');
    expect(mockQueues['karmyq-events-reputation'].processed).toEqual(['interaction_feedback_submitted']);
    expect(mockQueues['karmyq-events-reputation'].on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('refuses to start with a missing handler and names it', () => {
    const names = eventsFor('notification').filter((n) => n !== 'request_created');
    expect(() => startConsumerQueue('notification', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-notification handlers do not match EVENT_ROUTES: missing [request_created], unrouted []');
  });

  it('refuses to start with an unrouted handler and names it', () => {
    const names = [...eventsFor('reputation'), 'match_completed'];
    expect(() => startConsumerQueue('reputation', handlerFor(names), 'redis://x'))
      .toThrow('karmyq-events-reputation handlers do not match EVENT_ROUTES: missing [], unrouted [match_completed]');
  });
});
```

Replace `packages/shared/src/events/__tests__/publisher.test.ts` with:

```ts
const mockAdds: Record<string, jest.Mock> = {};
const mockConstructed: string[] = [];
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockConstructed.push(name);
  mockAdds[name] = jest.fn().mockResolvedValue({ id: `${name}-job` });
  return { on: jest.fn(), add: mockAdds[name] };
}));
import { createPublisher } from '../../../events/publisher';

describe('createPublisher (ADR-101 routed)', () => {
  beforeEach(() => { mockConstructed.length = 0; });

  it('exposes only initEventPublisher and publishEvent', () => {
    expect(Object.keys(createPublisher('svc')).sort()).toEqual(['initEventPublisher', 'publishEvent']);
  });

  it('throws if not initialized', async () => {
    await expect(createPublisher('svc').publishEvent('request_created', {})).rejects.toThrow('Event queue not initialized');
  });

  it('creates one queue per consumer and never the shared karmyq-events queue', async () => {
    await createPublisher('svc').initEventPublisher();
    expect(mockConstructed.sort()).toEqual(['karmyq-events-notification', 'karmyq-events-reputation']);
  });

  it('routes a notification event to the notification queue only, in the unchanged envelope', async () => {
    const p = createPublisher('request-service');
    await p.initEventPublisher();
    const job = await p.publishEvent('request_created', { request_id: 'r1' });
    expect(job).toEqual({ id: 'karmyq-events-notification-job' });
    expect(mockAdds['karmyq-events-notification']).toHaveBeenCalledTimes(1);
    expect(mockAdds['karmyq-events-notification']).toHaveBeenCalledWith('request_created', {
      eventType: 'request_created', payload: { request_id: 'r1' }, timestamp: expect.any(String), source: 'request-service',
    });
    expect(mockAdds['karmyq-events-reputation']).not.toHaveBeenCalled();
  });

  it('routes interaction_feedback_submitted to the reputation queue only', async () => {
    const p = createPublisher('request-service');
    await p.initEventPublisher();
    await p.publishEvent('interaction_feedback_submitted', { to_user_id: 'u' });
    expect(mockAdds['karmyq-events-reputation']).toHaveBeenCalledTimes(1);
    expect(mockAdds['karmyq-events-notification']).not.toHaveBeenCalled();
  });

  it('skips Redis for an unconsumed event and resolves null', async () => {
    const p = createPublisher('auth-service');
    await p.initEventPublisher();
    await expect(p.publishEvent('user_created', { userId: 'u' })).resolves.toBeNull();
    expect(mockAdds['karmyq-events-notification']).not.toHaveBeenCalled();
    expect(mockAdds['karmyq-events-reputation']).not.toHaveBeenCalled();
  });

  it('throws for a dedicated event and names its transport', async () => {
    const p = createPublisher('svc');
    await p.initEventPublisher();
    await expect(p.publishEvent('match_completed', {})).rejects.toThrow('Event match_completed has a dedicated transport: karmyq-completion-dispatch');
  });

  it('throws for an unclassified event', async () => {
    const p = createPublisher('svc');
    await p.initEventPublisher();
    await expect(p.publishEvent('not_a_real_event', {})).rejects.toThrow('Event not_a_real_event is not classified in packages/shared/events/routes.ts');
  });
});
```

- [ ] **Step 2: Run them and verify they fail**

Run: `npx jest --config packages/shared/jest.config.js --rootDir packages/shared src/events`
Expected: FAIL. `routes.test.ts` and `consumer.test.ts` fail with "Cannot find module '../../../events/routes'" (and `consumer`). In the publisher tests, the `exposes only…`, `creates one queue…` and routing cases fail.

- [ ] **Step 3: Implement `packages/shared/events/routes.ts`**

```ts
/**
 * ADR-101 / BUG-060: an event published through createPublisher goes to the ONE consumer that
 * handles it, on a queue only that consumer's workers attach to. Bull lets any worker on a queue take
 * any waiting job and fails a job whose name it never registered (bull/lib/queue.js:1203-1208,1246),
 * so no queue may have workers from two services. Every published name must appear exactly once below.
 */
export type EventConsumer = 'notification' | 'reputation';

export const EVENT_CONSUMERS: readonly EventConsumer[] = Object.freeze(['notification', 'reputation'] as const);

export const EVENT_ROUTES: Readonly<Record<string, EventConsumer>> = Object.freeze({
  dibs_accepted: 'notification',
  dibs_declined: 'notification',
  dibs_expired: 'notification',
  dibs_submitted: 'notification',
  fusion_vote_started: 'notification',
  join_request_created: 'notification',
  karma_awarded: 'notification',
  match_created: 'notification',
  match_reminder: 'notification',
  offer_accepted: 'notification',
  offer_declined: 'notification',
  offer_submitted: 'notification',
  preferred_provider_selected: 'notification',
  provider_review_received: 'notification',
  provider_went_on_duty: 'notification',
  request_created: 'notification',
  split_vote_started: 'notification',
  interaction_feedback_submitted: 'reputation',
});

/**
 * Events with their own transport. Publishing one through createPublisher is a bug. An event needing
 * more than one consumer belongs here, following completionEvents.ts's dispatch-and-fan-out pattern.
 */
export const DEDICATED_EVENTS: Readonly<Record<string, { queue: string; consumers: readonly string[] }>> = Object.freeze({
  match_completed: { queue: 'karmyq-completion-dispatch', consumers: ['notification', 'reputation', 'social-graph'] },
  directed_request_created: { queue: 'karmyq-directed-notifications', consumers: ['notification'] },
  skill_endorsement_changed: { queue: 'karmyq-skill-endorsement-social-graph', consumers: ['social-graph'] },
});

/**
 * Published, handled by no service. publishEvent never enqueues these: a job nobody can process
 * fails three times and stays parked in Redis. Give one a consumer by moving it to EVENT_ROUTES.
 */
export const UNCONSUMED_EVENTS: ReadonlySet<string> = new Set([
  'activity_joined', 'community.config.created', 'community.config.updated', 'community_archived',
  'community_created', 'health_metrics_calculated', 'match_accepted', 'match_cancelled',
  'match_proposed_by_admin', 'match_rejected', 'milestone_achieved', 'norm_established', 'norm_proposed',
  'offer_created', 'offer_withdrawn', 'privacy_settings_updated', 'request_cancelled', 'request_completed',
  'user_created', 'user_joined_community', 'user_left_community',
]);

export const consumerQueueName = (consumer: EventConsumer): string => `karmyq-events-${consumer}`;

export function eventsFor(consumer: EventConsumer): string[] {
  return Object.keys(EVENT_ROUTES).filter((name) => EVENT_ROUTES[name] === consumer).sort();
}
```

- [ ] **Step 4: Implement `packages/shared/events/consumer.ts`**

```ts
import Queue from 'bull';
import { consumerQueueName, eventsFor, EventConsumer } from './routes';

export type EventHandler = (job: Queue.Job) => Promise<void>;

/**
 * Attach a service's handlers to its own queue (ADR-101). Refuses to start unless the handler names
 * equal the routing table's events for `consumer` exactly: a missing handler would fail every routed
 * job, and an unrouted one is dead code on a queue that never receives it.
 */
export function startConsumerQueue(
  consumer: EventConsumer,
  handlers: Readonly<Record<string, EventHandler>>,
  redisUrl: string,
): Queue.Queue {
  const name = consumerQueueName(consumer);
  const expected = eventsFor(consumer);
  const actual = Object.keys(handlers).sort();
  const missing = expected.filter((n) => !actual.includes(n));
  const unrouted = actual.filter((n) => !expected.includes(n));
  if (missing.length || unrouted.length) {
    throw new Error(`${name} handlers do not match EVENT_ROUTES: missing [${missing.join(', ')}], unrouted [${unrouted.join(', ')}]`);
  }
  const queue = new Queue(name, redisUrl);
  queue.on('error', (error) => console.error(`${name} queue error:`, error));
  for (const event of expected) queue.process(event, handlers[event]);
  return queue;
}
```

- [ ] **Step 5: Rewrite `packages/shared/events/publisher.ts`**

```ts
import Queue from 'bull';
import { consumerQueueName, DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, EventConsumer, UNCONSUMED_EVENTS } from './routes';

const JOB_OPTIONS: Queue.JobOptions = {
  removeOnComplete: 100,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

export function createPublisher(source: string) {
  let queues: Map<EventConsumer, Queue.Queue> | undefined;

  async function initEventPublisher() {
    const redis = process.env.REDIS_URL || 'redis://localhost:6379';
    queues = new Map(EVENT_CONSUMERS.map((consumer) => {
      const queue = new Queue(consumerQueueName(consumer), redis, { defaultJobOptions: JOB_OPTIONS });
      queue.on('error', (error) => console.error(`Event queue ${consumerQueueName(consumer)} error:`, error));
      return [consumer, queue] as const;
    }));
    console.log('✅ Event publisher connected to Redis');
  }

  /** Enqueue on the one consumer queue that handles `eventType` (ADR-101); null for an unconsumed event. */
  async function publishEvent(eventType: string, payload: any): Promise<Queue.Job | null> {
    if (!queues) throw new Error('Event queue not initialized');
    const consumer = EVENT_ROUTES[eventType];
    if (!consumer) {
      if (UNCONSUMED_EVENTS.has(eventType)) return null;
      const dedicated = DEDICATED_EVENTS[eventType];
      if (dedicated) throw new Error(`Event ${eventType} has a dedicated transport: ${dedicated.queue}`);
      throw new Error(`Event ${eventType} is not classified in packages/shared/events/routes.ts`);
    }
    const job = await queues.get(consumer)!.add(eventType, {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      source,
    });
    console.log(`📤 Published event: ${eventType} → ${consumerQueueName(consumer)}`, payload);
    return job;
  }

  return { initEventPublisher, publishEvent };
}
```

- [ ] **Step 6: Export from `packages/shared/index.ts`** (replace line 13):

```ts
export { createPublisher } from './events/publisher';
export { startConsumerQueue } from './events/consumer';
export type { EventHandler } from './events/consumer';
export {
  EVENT_CONSUMERS, EVENT_ROUTES, DEDICATED_EVENTS, UNCONSUMED_EVENTS, consumerQueueName, eventsFor,
} from './events/routes';
export type { EventConsumer } from './events/routes';
```

No new subpath export: the root entry is enough. The `exports`/`typesVersions` parity test stays green because nothing in `package.json` changes.

- [ ] **Step 7: Drop the `getEventQueue` re-exports**

First run `grep -rn "getEventQueue" services/*/src apps packages --include=*.ts --include=*.tsx`. Expected: only the four lines below. If anything else turns up, stop and report it. Then:
- `services/auth-service/src/events/publisher.ts`, `community-service`, `reputation-service`: change the destructure/export to `const { initEventPublisher, publishEvent } = createPublisher('<svc>'); export { initEventPublisher, publishEvent };`
- `services/request-service/src/events/publisher.ts`: delete `export const getEventQueue = shared.getEventQueue;` (line 6).

- [ ] **Step 8: Run tests, build, type-check**

```bash
npx jest --config packages/shared/jest.config.js --rootDir packages/shared; echo "exit=$?"
npx tsc -p packages/shared; echo "exit=$?"          # emits dist/events/routes.js + consumer.js (consumer tests resolve dist)
ls packages/shared/dist/events/
for p in services/auth-service services/community-service services/reputation-service services/request-service; do npx tsc --noEmit -p $p || echo "TSC FAIL $p"; done
```

Expected: all shared tests PASS; `dist/events/` lists `consumer.js publisher.js routes.js`; no `TSC FAIL`.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/events packages/shared/index.ts packages/shared/src/events/__tests__ services/auth-service/src/events/publisher.ts services/community-service/src/events/publisher.ts services/reputation-service/src/events/publisher.ts services/request-service/src/events/publisher.ts
git commit -m "feat(shared): route events to per-consumer queues (ADR-101, BUG-060)"
```

(Add the `Co-Authored-By` trailer the session's attribution reminder specifies to every commit in this plan.)

---

### Task 2: notification-service consumer queue + BUG-066

**Files:**
- Modify: `services/notification-service/src/events/subscriber.ts`
- Test: `services/notification-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`

**Interfaces:**
- Consumes: `startConsumerQueue`, `eventsFor`, `EventHandler` from `@karmyq/shared` (Task 1, **resolved from `packages/shared/dist`** in this workspace: its jest config has no `@karmyq/shared` mapper, so rebuild shared after any Task 1 change).
- Produces: notification-service attaches workers to `karmyq-events-notification` with exactly `eventsFor('notification')`, and keeps the same handler functions on `karmyq-events`.

- [ ] **Step 1: Write the failing test**

Notification's jest config clears no mocks between tests (memory: *Jest mock config asymmetry*), so reset counts in `beforeEach`.

```ts
const mockQueues: Record<string, Record<string, (job: any) => Promise<void>>> = {};
const mockQuery = jest.fn();
const mockPush = jest.fn();
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockQueues[name] ??= {};
  return { process: (type: string, handler: any) => { mockQueues[name][type] = handler; }, on: jest.fn() };
}));
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a), getClient: async () => ({ query: (...a: any[]) => mockQuery(...a), release: jest.fn() }) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: (...a: any[]) => mockPush(...a) }));
import { eventsFor } from '@karmyq/shared';
import { initEventSubscriber } from '../../src/events/subscriber';

const envelope = (eventType: string, payload: Record<string, unknown>) => ({ data: { eventType, payload, timestamp: 't', source: 'request-service' } });

beforeAll(async () => { await initEventSubscriber(); });
beforeEach(() => { mockQuery.mockReset(); mockPush.mockReset(); });

describe('ADR-101: notification consumes its own queue', () => {
  it('attaches exactly the routed notification events to karmyq-events-notification', () => {
    expect(Object.keys(mockQueues['karmyq-events-notification']).sort()).toEqual(eventsFor('notification'));
  });

  it('keeps the same handler on the legacy queue for every routed event (drain)', () => {
    for (const name of eventsFor('notification')) {
      expect({ name, same: mockQueues['karmyq-events'][name] === mockQueues['karmyq-events-notification'][name] }).toEqual({ name, same: true });
    }
    expect(typeof mockQueues['karmyq-events'].match_completed).toBe('function');
  });
});

describe('BUG-066: push handlers read the published envelope', () => {
  const handler = (name: string) => mockQueues['karmyq-events-notification'][name];

  it('provider_went_on_duty pushes the open-request count to the provider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'r1', title: 'a' }, { id: 'r2', title: 'b' }] });
    await handler('provider_went_on_duty')(envelope('provider_went_on_duty', { providerId: 'prov', providerUserId: 'P', communityIds: ['C'] }));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM requests.help_requests'), [['C']]);
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Requests waiting in your community', '2 open requests match your services. Tap to view.', { type: 'provider_on_duty', count: 2 });
  });

  it('offer_submitted pushes the requester with the price', async () => {
    await handler('offer_submitted')(envelope('offer_submitted', { offerId: 'o', requestId: 'r', requesterUserId: 'R', providerName: 'x', price: 40 }));
    expect(mockPush).toHaveBeenCalledWith(['R'], 'Someone offered to help', 'You received an offer for $40. Tap to review.', { type: 'offer_received' });
  });

  it('offer_accepted pushes the provider', async () => {
    await handler('offer_accepted')(envelope('offer_accepted', { offerId: 'o', providerUserId: 'P', requesterName: 'x' }));
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Offer accepted!', 'Your offer was accepted. Check your commitments.', { type: 'offer_accepted' });
  });

  it('offer_declined pushes the provider', async () => {
    await handler('offer_declined')(envelope('offer_declined', { offerId: 'o', providerUserId: 'P' }));
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Offer declined', 'Your offer was not accepted this time.', { type: 'offer_declined' });
  });

  it.each([
    ['provider_went_on_duty', { communityIds: ['C'] }],
    ['offer_submitted', { price: 40 }],
    ['offer_accepted', {}],
    ['offer_declined', {}],
  ])('%s without its recipient sends nothing', async (name, payload) => {
    await handler(name)(envelope(name, payload));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npm exec --workspace=services/notification-service -- jest tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`
Expected: FAIL. `mockQueues['karmyq-events-notification']` is undefined, so `Object.keys` throws. Once the queue exists, the BUG-066 cases still fail: the push is called with `[undefined]`, or not called at all for `provider_went_on_duty`.

- [ ] **Step 3: Add the `register` shim and the consumer queue**

At the top of `subscriber.ts`, change the import and add the shim after the `directedQueue` lines:

```ts
import Queue from 'bull';
import { startConsumerQueue, EventHandler } from '@karmyq/shared';
...
// ADR-101 / BUG-060: every routed handler is registered twice: on this service's own queue, which no
// other service's workers attach to, and on the legacy shared queue so jobs published before this
// deploy still drain. Nothing publishes to karmyq-events any more.
const handlers: Record<string, EventHandler> = {};
const register = (name: string, handler: EventHandler) => {
  handlers[name] = handler;
  eventQueue.process(name, handler);
};
```

Then, inside `initEventSubscriber`, replace `eventQueue.process('<name>',` with `register('<name>',` for **all 17** routed names (every `eventQueue.process` except `match_completed`, which stays as is):

```bash
grep -c "register('" services/notification-service/src/events/subscriber.ts                # expected 17
grep -n "eventQueue.process(" services/notification-service/src/events/subscriber.ts       # expected: only the register body + match_completed
```

Just before `console.log('✅ Event subscriber initialized');`, add:

```ts
    startConsumerQueue('notification', handlers, REDIS_URL);
```

- [ ] **Step 4: Fix BUG-066 in the four handlers**

`provider_went_on_duty`: replace `const { providerUserId, communityIds } = job.data;` and the early return with:

```ts
      // BUG-066: the publisher wraps every event as { eventType, payload, timestamp, source }.
      const { providerUserId, communityIds } = job.data.payload ?? {};
      if (!providerUserId || !communityIds?.length) return;
```

`offer_submitted`:

```ts
      // BUG-066: fields live under job.data.payload.
      const { requesterUserId, price } = job.data.payload ?? {};
      if (!requesterUserId) {
        console.warn('⚠️  offer_submitted: missing requesterUserId, skipping push');
        return;
      }
```

`offer_accepted` and `offer_declined` (same shape for each, with its own event name in the warning):

```ts
      // BUG-066: fields live under job.data.payload.
      const { providerUserId } = job.data.payload ?? {};
      if (!providerUserId) {
        console.warn('⚠️  offer_accepted: missing providerUserId, skipping push');
        return;
      }
```

- [ ] **Step 5: Run the new test and the existing suite**

```bash
npx tsc -p packages/shared
npm exec --workspace=services/notification-service -- jest tests/tdd/sprint-133-pr-q-consumer-queue.test.ts; echo "exit=$?"
npm exec --workspace=services/notification-service -- jest tests/unit tests/regression; echo "exit=$?"
npx tsc --noEmit -p services/notification-service; echo "exit=$?"
```

Expected: the new file passes (all 9 cases), and the existing unit and regression suites pass, including both `sprint-132-*` subscriber tests (they still find `match_completed` on both queues). No type errors.

- [ ] **Step 6: Commit**

```bash
git add services/notification-service/src/events/subscriber.ts services/notification-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts
git commit -m "fix(notification): consume karmyq-events-notification; read push fields from payload (BUG-060, BUG-066)"
```

---

### Task 3: reputation-service consumer queue

**Files:**
- Modify: `services/reputation-service/src/events/subscriber.ts`
- Test: `services/reputation-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`

**Interfaces:**
- Consumes: `startConsumerQueue`, `eventsFor`, `EventHandler` from `@karmyq/shared` (mapped to **source** in this workspace, `services/reputation-service/jest.config.js:36`).
- Produces: workers on `karmyq-events-reputation` for exactly `['interaction_feedback_submitted']`.

- [ ] **Step 1: Write the failing test**

Mock the same modules as `services/reputation-service/tests/regression/sprint-126-subscriber-boundary.test.ts:19-64`, recording handlers **per queue name**:

```ts
const mockQueues: Record<string, Record<string, (job: any) => Promise<unknown>>> = {};
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockQueues[name] ??= {};
  return {
    process: (nameOrFn: unknown, fn?: any) => { if (typeof nameOrFn === 'string' && fn) mockQueues[name][nameOrFn] = fn; },
    on: jest.fn(), add: jest.fn(), close: jest.fn(),
  };
}));
const mockQuery = jest.fn();
jest.mock('../../src/services/standingProjector', () => ({ awardKarmaForCompletedMatch: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ checkAndAwardBadges: jest.fn() }));
jest.mock('../../src/services/providerTrustService', () => ({ updateProviderCompletionRate: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({ evaluateUserEvolution: jest.fn(), EVOLUTION_SIGNALS: {} }));
jest.mock('../../src/database/trustEvolutionDb', () => ({ isCrossCommunityParticipant: jest.fn(), getDiverseCommunityCount: jest.fn() }));
jest.mock('../../src/services/communityEvolutionService', () => ({ applyCommunityEvolution: jest.fn() }));
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));
import { eventsFor } from '@karmyq/shared';
import { initEventSubscriber } from '../../src/events/subscriber';

beforeAll(async () => { await initEventSubscriber(); });

it('attaches exactly the routed reputation events to karmyq-events-reputation', () => {
  expect(Object.keys(mockQueues['karmyq-events-reputation']).sort()).toEqual(eventsFor('reputation'));
});

it('keeps the same feedback handler on the legacy queue and leaves completion on its own queues', () => {
  expect(mockQueues['karmyq-events'].interaction_feedback_submitted).toBe(mockQueues['karmyq-events-reputation'].interaction_feedback_submitted);
  expect(mockQueues['karmyq-events'].match_completed).toBe(mockQueues['karmyq-completion-reputation'].match_completed);
  expect(mockQueues['karmyq-events-reputation'].match_completed).toBeUndefined();
});

it('the routed handler updates the trust score from the envelope payload', async () => {
  mockQuery.mockReset();
  mockQuery
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ts', avg_helpfulness: 4, avg_responsiveness: 4, avg_clarity: 4, total_feedback_received: 1 }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [] });
  await mockQueues['karmyq-events-reputation'].interaction_feedback_submitted({
    data: { eventType: 'interaction_feedback_submitted', payload: { to_user_id: 'u', community_id: 'c', helpfulness: 5, responsiveness: 5, clarity: 5 } },
  });
  expect(mockQuery.mock.calls[1][1]).toEqual([4.5, 4.5, 4.5, 2, 'ts']);
});
```

Reputation inherits nothing from root `resetMocks` (it has its own config). If a mock looks reset between tests, check `services/reputation-service/jest.config.js` before adding workarounds.

- [ ] **Step 2: Run it and verify it fails**

Run: `npm exec --workspace=services/reputation-service -- jest tests/tdd/sprint-133-pr-q-consumer-queue.test.ts`
Expected: FAIL at `Object.keys(undefined)` (`karmyq-events-reputation` is never constructed).

- [ ] **Step 3: Implement**

In `subscriber.ts`: import `{ startConsumerQueue, EventHandler } from '@karmyq/shared'`, and add the same `handlers` / `register` shim as Task 2 Step 3 (same comment) after the `completionQueue` lines. Change `eventQueue.process('interaction_feedback_submitted', async (job) => {` to `register('interaction_feedback_submitted', async (job) => {`. Before `console.log('✅ Event subscriber initialized');` add `startConsumerQueue('reputation', handlers, REDIS_URL);`. The `match_completed` lines are unchanged.

- [ ] **Step 4: Run tests and type-check**

```bash
npm exec --workspace=services/reputation-service -- jest tests/tdd/sprint-133-pr-q-consumer-queue.test.ts; echo "exit=$?"
npm exec --workspace=services/reputation-service -- jest tests/unit tests/regression; echo "exit=$?"
npx tsc --noEmit -p services/reputation-service; echo "exit=$?"
```

Expected: all PASS (including `sprint-126-subscriber-boundary`).

- [ ] **Step 5: Commit**

```bash
git add services/reputation-service/src/events/subscriber.ts services/reputation-service/tests/tdd/sprint-133-pr-q-consumer-queue.test.ts
git commit -m "fix(reputation): consume karmyq-events-reputation (BUG-060)"
```

---

### Task 4: cleanup-service publishes through the router

**Files:**
- Create: `services/cleanup-service/src/events/publisher.ts`
- Modify: `services/cleanup-service/src/jobs/expireDibs.ts`, `services/cleanup-service/src/jobs/matchReminderJob.ts`, `services/cleanup-service/src/index.ts` (`startServer`)
- Test: `services/cleanup-service/tests/tdd/sprint-133-pr-q-cleanup-publish.test.ts`

**Interfaces:**
- Consumes: `createPublisher` (Task 1).
- Produces: `initEventPublisher(): Promise<void>`, `publishEvent(type, payload)` in `src/events/publisher.ts`, the same shape as the other services.

- [ ] **Step 1: Write the failing test**

Cleanup's jest config spreads the **root** config, which sets `resetMocks: true` (memory: *Jest mock config asymmetry*). Factory-scope `jest.fn(impl)` implementations are wiped before each test, so set every implementation inside the test.

```ts
const mockPublish = jest.fn();
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...a: unknown[]) => mockPublish(...a) }));
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => mockPoolQuery(...a), connect: async () => ({ query: (...a: unknown[]) => mockClientQuery(...a), release: () => undefined }) },
  query: (...a: unknown[]) => mockPoolQuery(...a),
}));
jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } }));
jest.mock('bull', () => { throw new Error('cleanup-service must not construct a Bull queue directly (ADR-101)'); });
import { expireDibs } from '../../src/jobs/expireDibs';
import { sendMatchReminders } from '../../src/jobs/matchReminderJob';

it('expireDibs publishes dibs_expired through the router after commit', async () => {
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'd1', request_id: 'r1', provider_user_id: 'p1' }] });
  mockClientQuery.mockResolvedValue({ rows: [] });
  mockPublish.mockResolvedValue({ id: 'job' });
  await expect(expireDibs()).resolves.toBe(1);
  expect(mockPublish).toHaveBeenCalledTimes(1);
  expect(mockPublish).toHaveBeenCalledWith('dibs_expired', { dibs_id: 'd1', request_id: 'r1', provider_user_id: 'p1' });
  const commitOrder = mockClientQuery.mock.invocationCallOrder[mockClientQuery.mock.calls.findIndex(([sql]) => sql === 'COMMIT')];
  expect(commitOrder).toBeLessThan(mockPublish.mock.invocationCallOrder[0]);
});

it('sendMatchReminders publishes match_reminder through the router', async () => {
  const at = new Date('2026-10-15T10:00:00Z');
  mockPoolQuery.mockResolvedValue({ rows: [{ id: 'm1', responder_id: 'h', requester_id: 'q', scheduled_at: at, travel_time_minutes: 10, title: 'T', request_type: 'ride', payload: { a: 1 } }] });
  mockPublish.mockResolvedValue({ id: 'job' });
  await sendMatchReminders();
  expect(mockPublish).toHaveBeenCalledWith('match_reminder', {
    match_id: 'm1', responder_id: 'h', requester_id: 'q', request_title: 'T', request_type: 'ride',
    scheduled_at: at, travel_time_minutes: 10, payload: { a: 1 },
  });
});
```

`services/cleanup-service/src/database/db.ts:28` is `export default pool;`, plus a named `query`. The jobs use `import pool from '../database/db'`, which the `__esModule`/`default` mock above matches.

- [ ] **Step 2: Run it and verify it fails**

Run: `npm exec --workspace=services/cleanup-service -- jest tests/tdd/sprint-133-pr-q-cleanup-publish.test.ts`
Expected: FAIL. First "Cannot find module '../../src/events/publisher'". Once that file exists, the `bull` mock throws `cleanup-service must not construct a Bull queue directly` on import of the jobs.

- [ ] **Step 3: Implement**

`services/cleanup-service/src/events/publisher.ts`:

```ts
import { createPublisher } from '@karmyq/shared';

// ADR-101: cleanup publishes through the shared router like every other service; it used to write
// straight to the shared karmyq-events queue with no retry options.
const { initEventPublisher, publishEvent } = createPublisher('cleanup-service');
export { initEventPublisher, publishEvent };
```

`expireDibs.ts`: delete `import Queue from 'bull';`, the `eventQueue` variable, `getQueue()` and `const queue = getQueue();`. Import `{ publishEvent } from '../events/publisher'`, and replace the `queue.add('dibs_expired', {…})` call with:

```ts
        await publishEvent('dibs_expired', {
          dibs_id: dibs.id,
          request_id: dibs.request_id,
          provider_user_id: dibs.provider_user_id,
        });
```

`matchReminderJob.ts`: make the same removal, and replace `queue.add('match_reminder', {…})` with `await publishEvent('match_reminder', { match_id: match.id, responder_id: match.responder_id, requester_id: match.requester_id, request_title: match.title, request_type: match.request_type, scheduled_at: match.scheduled_at, travel_time_minutes: match.travel_time_minutes, payload: match.payload });`.

`src/index.ts` `startServer()`: import `{ initEventPublisher } from './events/publisher'`, and after `logger.info('Database connection established');` add `await initEventPublisher();`. (A cron tick that fires before init throws "Event queue not initialized" inside the job's own `try/catch` and is logged. The first tick is at least a minute away, so the window is theoretical.)

- [ ] **Step 4: Run tests and type-check**

```bash
npm exec --workspace=services/cleanup-service -- jest tests/tdd/sprint-133-pr-q-cleanup-publish.test.ts; echo "exit=$?"
npm exec --workspace=services/cleanup-service -- jest tests/unit tests/regression; echo "exit=$?"
npx tsc --noEmit -p services/cleanup-service; echo "exit=$?"
grep -rn "from 'bull'" services/cleanup-service/src   # expected: no output
```

Expected: PASS, no type errors, no direct Bull import left. Leave `bull` declared in `services/cleanup-service/package.json` (Global Constraints: no dependency edits).

- [ ] **Step 5: Commit**

```bash
git add services/cleanup-service/src services/cleanup-service/tests/tdd/sprint-133-pr-q-cleanup-publish.test.ts
git commit -m "fix(cleanup): publish dibs_expired and match_reminder through the router (BUG-060)"
```

---

### Task 5: Root gate (source ↔ routing table ↔ registry) + registry truth

**Files:**
- Create: `tests/tdd/sprint-133-pr-q-event-routes.test.ts`
- Modify: `services/registry.json` (`services.*.events`)

**Interfaces:**
- Consumes: `EVENT_ROUTES`, `UNCONSUMED_EVENTS`, `DEDICATED_EVENTS`, `EVENT_CONSUMERS`, `eventsFor` from `@karmyq/shared` (mapped to source by `tests/jest.config.js:38`).
- Produces: a gate that fails when a publish site is unclassified, a non-legacy file touches `karmyq-events`, a consumer's `register(...)` set differs from its routes, or `registry.json` events differ from the source.

The arbiters here are the live source files and the live routing table. The gate never compares one hand-written list with another, and each rule has a negative fixture proving it can fail (memory: *Gates that assert weaker than they claim*).

- [ ] **Step 1: Write the gate**

```ts
/**
 * Sprint 133 PR Q (ADR-101, BUG-060). The routing table in packages/shared/events/routes.ts is the
 * single source of truth; this gate holds the source and services/registry.json to it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, UNCONSUMED_EVENTS, eventsFor } from '@karmyq/shared';

type SourceFile = { path: string; text: string };
const ROOT = join(__dirname, '..', '..');
const LEGACY_SUBSCRIBERS = [
  'services/notification-service/src/events/subscriber.ts',
  'services/reputation-service/src/events/subscriber.ts',
  'services/social-graph-service/src/events/subscriber.ts',
];
const INTERCEPTOR = 'services/request-service/src/events/publisher.ts';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}
function loadServiceSources(): SourceFile[] {
  const services = readdirSync(join(ROOT, 'services')).filter((s) => {
    try { return statSync(join(ROOT, 'services', s, 'src')).isDirectory(); } catch { return false; }
  });
  return services.flatMap((s) => walk(join(ROOT, 'services', s, 'src')))
    .map((full) => ({ path: relative(ROOT, full).split(sep).join('/'), text: readFileSync(full, 'utf8') }));
}
const serviceOf = (path: string) => path.split('/')[1];
const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);

export function scan(files: SourceFile[]) {
  const published: Array<{ service: string; path: string; name: string; via: 'router' | 'direct' }> = [];
  const dynamic: string[] = [];
  const legacyTouches: string[] = [];
  const registered: Record<string, string[]> = {};
  const intercepted = new Set<string>();
  for (const f of files) {
    for (const name of matches(f.text, /\bpublishEvent\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'router' });
    if (/from 'bull'/.test(f.text)) {
      for (const name of matches(f.text, /\.add\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'direct' });
    }
    if (/\bpublishEvent\(\s*(?!['"])[^\s)]/.test(f.text.replace(/function publishEvent\(/g, ''))) dynamic.push(f.path);
    if (/['"]karmyq-events['"]/.test(f.text)) legacyTouches.push(f.path);
    const regs = matches(f.text, /\bregister\(\s*['"]([^'"]+)['"]/g);
    if (regs.length) registered[serviceOf(f.path)] = regs.sort();
    if (f.path === INTERCEPTOR) for (const name of matches(f.text, /type === ['"]([^'"]+)['"]/g)) intercepted.add(name);
  }
  return { published, dynamic, legacyTouches, registered, intercepted };
}

export function violations(files: SourceFile[], registry: any): string[] {
  const out: string[] = [];
  const s = scan(files);
  for (const p of s.published) {
    const dedicated = p.name in DEDICATED_EVENTS;
    if (p.via === 'direct' && !dedicated) out.push(`direct queue add of non-dedicated ${p.name} in ${p.path}`);
    if (p.via === 'router' && !(p.name in EVENT_ROUTES) && !UNCONSUMED_EVENTS.has(p.name)) {
      if (!(dedicated && p.service === 'request-service' && s.intercepted.has(p.name))) out.push(`unclassified ${p.name} in ${p.path}`);
    }
  }
  for (const name of s.intercepted) if (!(name in DEDICATED_EVENTS)) out.push(`interceptor routes non-dedicated ${name}`);
  for (const path of s.dynamic) if (path !== INTERCEPTOR) out.push(`dynamic publishEvent name in ${path}`);
  for (const path of s.legacyTouches) if (!LEGACY_SUBSCRIBERS.includes(path)) out.push(`karmyq-events referenced outside the legacy subscribers: ${path}`);
  for (const c of EVENT_CONSUMERS) {
    const got = JSON.stringify(s.registered[`${c}-service`] ?? []);
    if (got !== JSON.stringify(eventsFor(c))) out.push(`${c}-service registers ${got}, routes say ${JSON.stringify(eventsFor(c))}`);
  }
  for (const [service, def] of Object.entries<any>(registry.services)) {
    const pubs = [...new Set(s.published.filter((p) => p.service === service).map((p) => p.name))].sort();
    const consumer = service.replace(/-service$/, '');
    const subs = [
      ...((EVENT_CONSUMERS as readonly string[]).includes(consumer) ? eventsFor(consumer as any) : []),
      ...Object.entries(DEDICATED_EVENTS).filter(([, d]) => d.consumers.includes(consumer)).map(([n]) => n),
    ].sort();
    const want = { publishes: pubs, subscribes: subs };
    const have = { publishes: [...(def.events?.publishes ?? [])].sort(), subscribes: [...(def.events?.subscribes ?? [])].sort() };
    if (JSON.stringify(want) !== JSON.stringify(have)) out.push(`registry ${service}.events ${JSON.stringify(have)} != source ${JSON.stringify(want)}`);
  }
  return out;
}

const registry = JSON.parse(readFileSync(join(ROOT, 'services', 'registry.json'), 'utf8'));

describe('Sprint 133 PR Q: event routing gate (ADR-101)', () => {
  it('the live source and registry have no violations', () => {
    expect(violations(loadServiceSources(), registry)).toEqual([]);
  });

  it('scans enough to mean something', () => {
    const s = scan(loadServiceSources());
    expect(new Set(s.published.map((p) => p.service)).size).toBeGreaterThanOrEqual(5);
    expect(s.published.length).toBeGreaterThanOrEqual(40); // 46 sites on 2026-10-15; a floor, not a count, so new publishes don't break it
    expect([...s.intercepted].sort()).toEqual(['directed_request_created', 'match_completed']);
  });

  describe('negative fixtures: each rule can fail', () => {
    const live = loadServiceSources();
    const withFile = (f: SourceFile) => [...live, f];
    it('flags an unclassified publish', () => {
      expect(violations(withFile({ path: 'services/request-service/src/x.ts', text: "await publishEvent('not_a_real_event', {})" }), registry))
        .toContain('unclassified not_a_real_event in services/request-service/src/x.ts');
    });
    it('flags a new karmyq-events user', () => {
      expect(violations(withFile({ path: 'services/cleanup-service/src/x.ts', text: "new Queue('karmyq-events')" }), registry))
        .toContain('karmyq-events referenced outside the legacy subscribers: services/cleanup-service/src/x.ts');
    });
    it('flags a direct add of a routed event', () => {
      expect(violations(withFile({ path: 'services/cleanup-service/src/y.ts', text: "import Queue from 'bull';\nq.add('dibs_expired', {})" }), registry))
        .toContain('direct queue add of non-dedicated dibs_expired in services/cleanup-service/src/y.ts');
    });
    it('flags a consumer whose registrations drift from the routes', () => {
      const drifted = live.map((f) => f.path.startsWith('services/reputation-service/src/events/subscriber.ts')
        ? { ...f, text: f.text.replace("register('interaction_feedback_submitted'", "register('typo_event'") } : f);
      expect(violations(drifted, registry).some((v) => v.startsWith('reputation-service registers ["typo_event"]'))).toBe(true);
    });
    it('flags a registry that disagrees with the source', () => {
      const stale = JSON.parse(JSON.stringify(registry));
      stale.services['notification-service'].events.subscribes.push('user_joined_community');
      expect(violations(live, stale).some((v) => v.startsWith('registry notification-service.events'))).toBe(true);
    });
    it('flags a dynamic event name', () => {
      expect(violations(withFile({ path: 'services/community-service/src/z.ts', text: 'await publishEvent(name, {})' }), registry))
        .toContain('dynamic publishEvent name in services/community-service/src/z.ts');
    });
  });
});
```

- [ ] **Step 2: Run it and verify the live case fails on the registry only**

Run: `npm exec --workspace=tests -- jest --runTestsByPath tdd/sprint-133-pr-q-event-routes.test.ts`
(memory: *Turbo cache hides cross-workspace failures*: run it by path from the `tests` workspace, never `npx jest tests/...` from the root.)
Expected: the six negative fixtures PASS, and `the live source and registry have no violations` FAILS. The only violations should be `registry <service>.events …` lines; Tasks 1–4 already removed the source violations. Any other violation is a missed source fix: return to the owning task.

- [ ] **Step 3: Make `services/registry.json` true**

For each service, set `events.publishes` and `events.subscribes` to the sorted `want` the failure prints. Use the printed values, not the inventory table above. Services without an `events` key that publish nothing need no change. A service the scan says publishes but that lacks an `events` key gets one. Bump `updated` to `2026-10-15`.

- [ ] **Step 4: Re-run, verify green**

Same command. Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/tdd/sprint-133-pr-q-event-routes.test.ts services/registry.json
git commit -m "test(events): gate publish sites, consumers and registry against the routing table (ADR-101)"
```

---

### Task 6: Integration proof against the real containers

**Files:**
- Create: `tests/integration/queueHelpers.ts`
- Create: `tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts`
- Modify: `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts` (import the helpers; behavior unchanged)

**Interfaces:**
- Consumes: `createPublisher`, `consumerQueueName` from `@karmyq/shared` (source-mapped, `tests/jest.integration.config.js:24`); `createPool` from `tests/fixtures`.
- Produces: `settle(jobs, timeoutMs)` and `containerIps(name)` in `queueHelpers.ts`.

This runs only in CI's `test-integration` job: there is no local Docker on the Windows box. CI builds every subscriber container from this branch (`tests/docker-compose.test.yml:169-201`).

- [ ] **Step 1: Extract the helpers**

Move `containerIps` and `settle` verbatim from `sprint-133-bug-060-shared-queue.integration.test.ts:26-39` into `tests/integration/queueHelpers.ts` as named exports (with `import Queue from 'bull'; import { execFileSync } from 'child_process';`). Replace them in the B1 file with `import { containerIps, settle } from './queueHelpers';`. The file name doesn't match `testMatch: ['**/*.integration.test.ts']` (`tests/jest.integration.config.js:38`), so Jest won't run it as a suite.

The B1 live test stays valid: legacy workers are still attached to `karmyq-events`, and the test publishes there directly. It must be retired with the legacy handlers (see the IDEAS follow-up in Task 7).

- [ ] **Step 2: Write the integration test**

```ts
/**
 * Sprint 133 PR Q (ADR-101): BUG-060 fixed. Events go through the REAL routed publisher to
 * per-consumer queues that only the consumer's container attaches to. Expect zero lost jobs.
 * Missing infrastructure is a failure, never a skip.
 */
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { consumerQueueName, createPublisher } from '@karmyq/shared';
import { createPool } from '../fixtures';
import { containerIps, settle } from './queueHelpers';

process.env.REDIS_URL ??= 'redis://localhost:6380'; // createPublisher reads it at init; its own default is 6379
const REDIS_URL = process.env.REDIS_URL;
const N = 60;
const M = 20;

async function workerIps(queue: Queue.Queue): Promise<string[]> {
  const workers: Array<{ addr?: string }> = (await queue.getWorkers()) ?? [];
  return workers.map((w) => (w.addr ?? '').replace(/:\d+$/, ''));
}
// Match on this test's own jobs, never on queue totals: containers can still emit events left over from earlier suites.
async function jobsWhere(queue: Queue.Queue, pred: (data: any) => boolean): Promise<string[]> {
  const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
  return jobs.filter((j) => j && pred(j.data)).map((j) => String(j.id));
}

describe('Sprint 133 PR Q: per-consumer queues deliver every job', () => {
  jest.setTimeout(120000);
  const pool = createPool();
  const publisher = createPublisher('sprint-133-pr-q-test');
  const notificationQ = new Queue(consumerQueueName('notification'), REDIS_URL);
  const reputationQ = new Queue(consumerQueueName('reputation'), REDIS_URL);
  const legacy = new Queue('karmyq-events', REDIS_URL);
  const requester = randomUUID(), member = randomUUID(), community = randomUUID();
  const published: Queue.Job[] = [];

  beforeAll(async () => {
    await publisher.initEventPublisher();
    for (const id of [requester, member]) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'PR Q fixture', `${id}@prq.test`, 'not-a-login']);
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [community, `PR Q ${community}`, 'Fixture', requester]);
    for (const id of [requester, member]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, community]);
    await pool.query('INSERT INTO reputation.trust_scores(user_id,community_id,total_feedback_received) VALUES ($1,$2,0)', [member, community]);
  });
  afterAll(async () => {
    try {
      for (const j of published) await j.remove().catch(() => undefined);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id=$1', [member]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id=$1', [member]);
      await pool.query('DELETE FROM communities.communities WHERE id=$1', [community]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [[requester, member]]);
    } finally {
      const publisherQueues = new Set(published.map((j) => j.queue)); // the publisher has no close(); its queues are reachable from its jobs
      await Promise.all([...publisherQueues, notificationQ, reputationQ, legacy].map((q) => q.close()));
      await pool.end();
    }
  });

  it('attaches only the consumer container to each consumer queue', async () => {
    const notifIps = new Set(containerIps('karmyq-notification-service-test'));
    const repIps = new Set(containerIps('karmyq-reputation-service-test'));
    const onNotif = await workerIps(notificationQ);
    const onRep = await workerIps(reputationQ);
    expect(onNotif.length).toBeGreaterThan(0);
    expect(onRep.length).toBeGreaterThan(0);
    expect(onNotif.filter((ip) => !notifIps.has(ip))).toEqual([]);
    expect(onRep.filter((ip) => !repIps.has(ip))).toEqual([]);
  });

  it(`delivers all ${N} request_created and all ${M} interaction_feedback_submitted with no failed attempt, never touching karmyq-events`, async () => {
    const requestIds = Array.from({ length: N }, () => randomUUID());
    for (const request_id of requestIds) {
      published.push((await publisher.publishEvent('request_created', { request_id, community_id: community, requester_id: requester, title: 'PR Q probe' }))!);
    }
    for (let i = 0; i < M; i++) {
      published.push((await publisher.publishEvent('interaction_feedback_submitted', { to_user_id: member, community_id: community, helpfulness: 5, responsiveness: 4, clarity: 3 }))!);
    }
    const outcomes = await settle(published, 90000);

    const failedAttempts = outcomes.flatMap(({ job, state }) => (job.stacktrace ?? []).map((s) => `${job.name}:${state}:${s.split('\n')[0]}`));
    console.warn(`PR Q EVIDENCE ${JSON.stringify({ published: outcomes.length, completed: outcomes.filter((o) => o.state === 'completed').length, failedAttempts: failedAttempts.length })}`);
    expect(failedAttempts).toEqual([]);
    expect(outcomes.map((o) => o.state)).toEqual(Array(N + M).fill('completed'));

    const rows = await pool.query("SELECT data->>'request_id' AS request_id, count(*)::int AS n FROM notifications.notifications WHERE user_id=$1 AND type='new_request' GROUP BY 1", [member]);
    const delivered = new Map<string, number>(rows.rows.map((r) => [r.request_id, r.n]));
    expect(requestIds.map((id) => delivered.get(id) ?? 0)).toEqual(Array(N).fill(1));

    const ts = await pool.query('SELECT total_feedback_received, avg_helpfulness::float AS h, avg_responsiveness::float AS r, avg_clarity::float AS c FROM reputation.trust_scores WHERE user_id=$1 AND community_id=$2', [member, community]);
    expect(ts.rows[0]).toEqual({ total_feedback_received: M, h: 5, r: 4, c: 3 });

    expect(await jobsWhere(legacy, (d) => d?.source === 'sprint-133-pr-q-test')).toEqual([]);
  });

  it('an unconsumed event never reaches Redis', async () => {
    const marker = randomUUID();
    await expect(publisher.publishEvent('user_created', { userId: marker })).resolves.toBeNull();
    for (const q of [notificationQ, reputationQ, legacy]) {
      expect({ queue: q.name, jobs: await jobsWhere(q, (d) => d?.payload?.userId === marker) }).toEqual({ queue: q.name, jobs: [] });
    }
  });
});
```

Check the arithmetic of the trust-score assertion. The handler computes `((avg × total) + x) / (total + 1)` from 0 for `M` identical ratings, so it lands on exactly 5 / 4 / 3. The reputation queue has one named processor, so Bull runs it with concurrency 1 and the read-modify-write never races in this test.

- [ ] **Step 3: Push and read the CI job log**

```bash
git add tests/integration/queueHelpers.ts tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts
git commit -m "test(integration): per-consumer queues deliver every job (BUG-060, ADR-101)"
git push -u origin agent/claude/sprint-133-pr-q-queue-migration
```

Then find the run and read the `Integration Tests` job log: `gh run list --branch agent/claude/sprint-133-pr-q-queue-migration --limit 3`, then `gh run view <id> --log | grep -E "PR Q EVIDENCE|BUG-060 EVIDENCE|Tests:"`.
Expected: `PR Q EVIDENCE {"published":80,"completed":80,"failedAttempts":0}`, all three cases pass, and the B1 file still passes. Watch for a silent, instant push (no hook output): that means the hooks aren't installed (CLAUDE.md Discipline 3).

---

### Task 7: Docs, ADR-101, bugs, guide, landing

**Files:** listed under *Modify* in the file map, plus `docs/adr/ADR-101-per-consumer-event-queues.md`.

- [ ] **Step 1: ADR-101** (`docs/adr/ADR-101-per-consumer-event-queues.md`, status **Accepted**; flip it to Implemented after deploy in Task 10). Copy the shape from `docs/adr/template.md`. It covers:
  - **Context:** the BUG-060 mechanism (`bull/lib/queue.js:1203-1208,1246`) and evidence (CI 38465333100: 15/60 lost; 38 jobs had at least one missing-handler attempt).
  - **Decision:** the routing table and its three classes; one queue per consumer, `karmyq-events-<consumer>`; `startConsumerQueue`'s exact-set rule; unconsumed events are not enqueued; unclassified names throw; multi-consumer events use the dispatch pattern (ADR-099).
  - **Precedents:** ADR-099 (completion and directed queues), ADR-100 (endorsement queue).
  - **Migration:** legacy `karmyq-events` handlers stay for one release. The deploy/rollback analysis is Review Focus item 5. Parked failed jobs on the demo's `karmyq-events` are **not** redriven: they're stale notifications.
  - **Consequences:** five publishing services each open two Bull queues (about six Redis connections each). Registry `events` are now gated.
  - **Follow-up:** remove the legacy handlers and retire the B1 live test, once a read-only check shows the demo's `karmyq-events` has nothing waiting or delayed.
- [ ] **Step 2:** Index ADR-101 in `docs/adr/README.md`. Add `'adr-101-per-consumer-event-queues'` to the `ADR_GROUPS` group holding `'adr-100-skill-visibility-and-endorsements'` (`scripts/generate-docs.ts:454`).
- [ ] **Step 3: `docs/BUGS.md`**
  - **BUG-060** → `fixed (Sprint 133 PR Q, pending deploy)`, with the PR Q evidence line from Task 6.
  - Append **BUG-066** (`[2026-10-15] · fixed (Sprint 133 PR Q, pending deploy) · MEDIUM`): the four handlers, the `job.data` vs `job.data.payload` mechanism, and the fact that no test covered it. Also record that these pushes have never fired since the handlers were written. Find the introducing commit with `git log -S "job.data;" -- services/notification-service/src/events/subscriber.ts` and cite it, or mark it **UNVERIFIED** if the search is inconclusive.
- [ ] **Step 4: `docs/IDEAS.md`** (append at the end): "Remove legacy `karmyq-events` handlers (notification, reputation, social-graph incl. the S132 `match_completed` ones) and retire the B1 live test once the demo's `karmyq-events` waiting+delayed = 0 (read-only check, ask first)". Also note: "`karma_awarded` has a handler and a route but no publisher".
- [ ] **Step 5: CONTEXT.md**
  - `packages/shared/CONTEXT.md`: the routing exports, `publishEvent` returning `Job | null`, and `getEventQueue` removed.
  - `services/notification-service/CONTEXT.md:18` and `services/reputation-service/CONTEXT.md:10`: the consumer queue plus legacy drain. Fix the troubleshooting snippets that say `redis-cli LLEN karmyq-events` (notification `:787,839`; reputation `:1261,1295,1329`). Bull keys are `bull:<queue>:wait`, so the commands become `redis-cli LLEN bull:karmyq-events-notification:wait` (and `-reputation`).
  - `services/cleanup-service/CONTEXT.md`: publishes through the router.
  - `services/request-service/CONTEXT.md:215,2124-2131`: queue = routed per consumer, with unconsumed names marked.
  - Add a "Recent Fixes" entry where the service has a Known Issues section.
- [ ] **Step 6: `claude.md` *Events*** (tracked lowercase; memory: *git add CLAUDE.md on Windows*), replacing lines 216-218:

```markdown
### Events
Every event is routed by `packages/shared/events/routes.ts` (ADR-101): to its ONE consumer's queue
`karmyq-events-<consumer>` (`notification`, `reputation`), to a dedicated transport (`match_completed`,
`directed_request_created`, `skill_endorsement_changed`), or nowhere (unconsumed: not enqueued).
**Never attach two services' workers to one Bull queue** — Bull fails a job whose name the taking
worker never registered (BUG-060). `tests/tdd/sprint-133-pr-q-event-routes.test.ts` gates it, and
[services/registry.json](services/registry.json) events are held to the source.
```

`AGENTS.md` doesn't mention the queue (grep confirms nothing to sync). Re-check that with `grep -n "karmyq-events" AGENTS.md`.
- [ ] **Step 7:** In `docs/ARCHITECTURE.md:84,279`, update the diagram label and the *Queue Name* line to the per-consumer queues.
- [ ] **Step 8: Guide** (`docs/guides/managing-notifications-guide.md`): add a **Mobile push alerts** section listing the four pushes and when they fire: an offer on your request; your offer accepted or declined; going on duty with open requests in your communities. Then check `apps/frontend/src/lib/onboarding/workflows.ts` for notification copy that should change. If none needs to, say so in the PR body.
- [ ] **Step 9: Regenerate the landing docs**: `npx tsx scripts/generate-docs.ts`. Then `git add -f` the generated ADR-101 page and the updated `nav.json` under `apps/landing/src/data/docs/`, and revert unrelated timestamp/HEAD-sha churn (memory: *npm test regenerates landing docs*).
- [ ] **Step 10: Commit**

```bash
git add docs/adr docs/BUGS.md docs/IDEAS.md docs/ARCHITECTURE.md docs/guides/managing-notifications-guide.md claude.md scripts/generate-docs.ts packages/shared/CONTEXT.md services/*/CONTEXT.md
git add -f apps/landing/src/data/docs/<the generated files>
git commit -m "docs: ADR-101 per-consumer event queues; BUG-060 fixed, BUG-066 logged and fixed"
```

---

### Task 8: Promotion and SDLC gates

- [ ] **Step 1:** Promote the green TDD files (`node scripts/promote-tdd-tests.js`). Then `git status` and **restore every promoted file that isn't one of PR Q's four**. Commit the four promotions.
- [ ] **Step 2:** `/simplify` once on the PR diff. **Verify:** each finding is applied or dismissed with a written reason in the ledger.
- [ ] **Step 3:** `/code-review` **high** (a cross-service transport change). Focus areas:
  - every routed name has a handler on its consumer queue;
  - nothing publishes to `karmyq-events`;
  - the BUG-066 guards;
  - cleanup init ordering;
  - the gate's regexes can't be bypassed by formatting (e.g. `publishEvent(\n'x'`). The regex allows whitespace; prove it with a fixture if a reviewer doubts it.

  Resolve findings RED → GREEN or rule on them in writing.
- [ ] **Step 4:** `/security-review`. Focus: no payload logging was added beyond what existed. **Note:** `publishEvent` still logs `payload`, and `user_created` no longer reaches the log because unconsumed events return early. Either way, record the ruling.
- [ ] **Step 5:** Record every ruling in `.superpowers/sdd/2026-10-08-sprint-133-skills-depth/progress.md` under a `PR Q` heading.

### Task 9: Final verification

```bash
npx tsc -p packages/shared; echo "shared build exit=$?"
npm test; echo "exit=$?"
for p in packages/shared services/auth-service services/community-service services/reputation-service services/request-service services/notification-service services/cleanup-service services/social-graph-service; do npx tsc --noEmit -p $p || echo "TSC FAIL $p"; done
npm run feedback:check
npm run analyze:services
git status --short     # only intended files; revert landing timestamp churn
```

Expected: `npm test` exit 0, no `TSC FAIL`, and `feedback:check` has no unaddressed item. That check reads only the staged diff, so it's clean on a committed branch: read its advice against `git diff origin/master...HEAD --stat` yourself (memory: *feedback:check is a false-green*). If a Turbo failure names one package, read the failing suite's name out of the raw output, and re-run that workspace alone before concluding anything.

### Task 10: PR, merge, deploy, post-deploy check, handoff

- [ ] **Step 1:** Land the handoff update **before** asking for merge authorization (memory: *Handoff stranded by the merge*). Mark PR Q "ready to merge", record the evidence line, and set PR D as next.
- [ ] **Step 2:** Bump the version from `origin/master` at merge time (`node -e "console.log(require('./package.json').version)"` after `git fetch` and `git show origin/master:package.json`). Use a merge commit if master moved.
- [ ] **Step 3:** Open the PR with the `pr-contract.yml` headers. Include the event inventory, the BUG-066 note, the B1 and PR Q evidence lines, and the deploy/rollback analysis. CI must be green, including both sprint-133 integration files in the job log.
- [ ] **Step 4:** **Maintainer merge authorization**, then `/deploy`. One merge at a time: check `gh pr list` and the latest deploy run first. This PR doesn't touch `api.ts`, so no CodeQL line-shift re-raise is expected. If one appears, surface it.
- [ ] **Step 5: Post-deploy check (read-only; ask before SSHing to the shared demo server, naming lane PR Q):**
  - every `/health` is green through the deploy's own verification;
  - `bull:karmyq-events-notification` and `bull:karmyq-events-reputation` each have one worker from their own container (`CLIENT LIST` or the Bull `getWorkers()` equivalent);
  - `LLEN bull:karmyq-events:wait` and `ZCARD bull:karmyq-events:delayed` show the legacy drain heading to 0.

  A live event round trip (e.g. a request that triggers `request_created`) is a demo write. Do it only with per-operation authorization, and record the outcome.
- [ ] **Step 6:** Flip ADR-101 → **Implemented**. Move BUG-060 and BUG-066 to `fixed (Sprint 133 PR Q, v<x>)`. These doc edits ride the **PR D** branch (no docs-only master push). Update the handoff: PR Q shipped; next is PR D; the legacy-removal follow-up is queued.

---

## Self-review (run 2026-10-15)

- **Coverage:**
  - BUG-060 fix → Tasks 1–4; proof → Task 6.
  - Maintainer decisions → ADR-101 (Task 7), BUG-066 (Task 2), unconsumed events (Task 1 + the Task 6 last case).
  - Legacy retention → Tasks 2 and 3 (tests assert the legacy handler is the same function).
  - Registry truth → Task 5.
  - Docs loop → Task 7.
- **Placeholders:** only `<the generated files>` in Task 7 Step 10 and `<x>`/`<id>`, which are run-time values.
- **Names:** `startConsumerQueue`, `eventsFor`, `consumerQueueName`, `EVENT_ROUTES`, `UNCONSUMED_EVENTS`, `DEDICATED_EVENTS`, `EVENT_CONSUMERS`, `EventHandler`, `EventConsumer`, `register`, `settle`, `containerIps` are used consistently across Tasks 1–6.
- **Review Focus:** each of items 1–4 has a test (Tasks 1, 2, 3, 5, 6). Item 5 (deploy window) is documented and covered by the post-deploy check, because no CI test can simulate a rolling deploy.
