# Sprint 134 PR L — ADR-101 Legacy Handlers + BUG-068 Retirement Implementation Plan

> ## ⛔ PROVISIONAL — DO NOT EXECUTE PAST TASK L0
> The maintainer has not yet reported the read-only demo queue drain check (as of 2026-10-20). Task L0 records the result.
> If the check is not clean, this plan is replaced by a drain step + dated risk acceptance; do not "work around" it.
> Finalize this plan (remove this banner, settle the *Open decisions*) in the PR L chat once L0 has a result.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove every `karmyq-events` legacy registration and the dead BUG-068 feedback path, so the event gate allows no
`karmyq-events` reference at all, by 2026-10-29. No migration (maintainer, 2026-10-20; the data drop is PR L2).

**Architecture:** The three subscribers stop opening the legacy shared queue; `startConsumerQueue` loses its optional
`legacyQueue` parameter; `interaction_feedback_submitted` leaves the route table, which leaves reputation with no routed event.
The ADR-101 gate tightens from "only the three legacy subscribers may name `karmyq-events`" to "nothing may".

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** `docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md` → *PR L*.
**Branch:** `agent/claude/sprint-134-pr-l-legacy-handlers`, cut from `origin/master` at its turn.
**Deadline:** **2026-10-29** (BUG-068 SLA).

---

## Open decisions (settle with the maintainer before Task L2)

1. **Reputation's consumer queue.** `interaction_feedback_submitted` is reputation's only routed event
   (`packages/shared/src/events/__tests__/routes.test.ts:21`). **Recommendation:** remove `reputation` from `EVENT_CONSUMERS`
   (`packages/shared/events/routes.ts:7`) and the `startConsumerQueue('reputation', …)` call (`reputation-service subscriber.ts:207`).
   Reputation keeps its dedicated `match_completed` completion queue (`:147`) and `communityEvolutionQueue` (`:47`). Recorded as an
   **ADR-101 amendment** (no new number). The alternative is to keep an empty consumer queue for future events, which is a queue
   with no purpose.
2. **PR Q integration test's reputation probe.** `tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts:63-69`
   proves reputation delivery with `interaction_feedback_submitted`. With decision 1, narrow it to notification delivery and keep its
   "no failed attempt" assertion.

## File Map (provisional; re-inventory untruncated in Task L1)

### Existing files to modify
| File | Change |
|------|--------|
| `services/notification-service/src/events/subscriber.ts` | Drop `karmyq-events` queue (`:10`), legacy `match_completed` (`:118`), the legacy arg to `startConsumerQueue`, comments `:17-20` |
| `services/reputation-service/src/events/subscriber.ts` | Drop `karmyq-events` (`:33`), legacy `match_completed` (`:146`), the `interaction_feedback_submitted` handler (`:150-…`), the consumer-queue start (`:207`, per decision 1), and the unused `export default eventQueue` (`:216`) |
| `services/social-graph-service/src/events/subscriber.ts` | Drop `karmyq-events` (`:11`), legacy `match_completed` (`:106`), and the unused `export default` (`:119`) |
| `packages/shared/events/consumer.ts` | Remove the `legacyQueue` parameter (`:17`) and its use |
| `packages/shared/events/routes.ts` | Remove `interaction_feedback_submitted` (`:28`); `EVENT_CONSUMERS` per decision 1 |
| `packages/shared/src/events/__tests__/{consumer,publisher,routes}.test.ts` | Retarget off `interaction_feedback_submitted` / the legacy queue |
| `services/request-service/src/routes/feedback.ts` + its mount in `src/index.ts` | **Delete** the dead route (BUG-068), including the publisher at `:148` |
| `services/request-service/tests/**` feedback tests | Delete the tests of the deleted route (they mock the failing query) |
| `services/reputation-service/src/routes/health.ts` | Stop reading `trust_scores` averages (`:39-41`, `:77-78`); the columns stay until L2 |
| `services/reputation-service/tests/regression/sprint-133-pr-q-consumer-queue.test.ts` | Remove the `interaction_feedback_submitted` cases (`:32-76`) and keep the BUG-067 column check only if a writer remains (none will) |
| `services/simulation-service/src/api-client.ts` | Delete the feedback call (`:505`; it was `:461`) and its callers |
| `tests/regression/sprint-133-pr-q-event-routes.test.ts` | Delete `LEGACY_SUBSCRIBERS` (`:11-15`); any `karmyq-events` reference fails; keep the negative fixtures and add one that plants a `karmyq-events` reference in a subscriber |
| `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts` | Retire the live half (`:46-…`); keep the mechanism half (`:30`) only if it still proves something without the legacy queue, else delete the file |
| `tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts` | Per decision 2 |
| `services/registry.json` | Remove `interaction_feedback_submitted` (`:633`, `:727`); remove the route; `npm run analyze:services` |
| `docs/adr/ADR-101-per-consumer-event-queues.md` | Amendment: legacy handlers removed (date, PR), reputation consumer status |
| notification/reputation/social-graph/request-service `CONTEXT.md` | Events and endpoints |
| `docs/BUGS.md` | BUG-068 → fixed (code); note L2 for data |

---

## ⚠️ Critical Implementation Notes (read before Task L2)

1. **L0 gates everything.** No code change before the maintainer reports a clean drain check.
2. **`packages/shared` changes; every consumer rebuilds.** Build shared first (`npm run build --workspace=@karmyq/shared`) and run each
   consumer's tests; Turbo's cache misses cross-workspace inputs, so re-run directly with `--force`.
3. **Grep untruncated, never `| head`**, for `karmyq-events`, `interaction_feedback_submitted`, `/feedback`, `legacyQueue`,
   `submitFeedback` across services, apps, packages, simulation, tests and docs (memory: inventory scans must not be truncated).
4. **Expect the CodeQL `js/request-forgery` re-raise** on master from the `api-client.ts` line shift. Ask before dismissing.
5. **No migration here.** `requests.interaction_feedback` and the seven average columns stay until PR L2. Readers that remain
   (feed composer, milestone detector, health metrics) keep reading always-0 values until L2.
6. **Event registry parity is gated**: `tests/regression/sprint-133-pr-q-event-routes.test.ts` holds `services/registry.json` events
   to the source, so the registry edit is required for green.

---

## Task L0: Drain-check gate (maintainer)

- [ ] Ask the maintainer for the result of the read-only check, or for permission to run it (a demo-host operation, per-operation
  authorization; the classifier may still refuse, and then the maintainer runs it). Pass criteria: legacy `bull:karmyq-events`
  `wait`, `active`, `delayed`, `paused` all 0, and each `karmyq-events-<consumer>` queue served only by its own consumer's container.
  A command the maintainer can paste (Redis in the demo stack; the container name is verified on the host):

```bash
R="docker exec <redis-container> redis-cli"   # container name: verify with `docker ps` on the host
for k in wait active paused; do echo "$k $($R LLEN bull:karmyq-events:$k)"; done   # Bull 3: lists
echo "delayed $($R ZCARD bull:karmyq-events:delayed)"                                # Bull 3: sorted set
$R CLIENT LIST    # map each worker's addr to a container IP (docker network inspect) for the per-consumer half
```

  (Key types are Bull 3's layout; if `TYPE bull:karmyq-events:<k>` disagrees on the host, the host wins and the command is adjusted.)
- [ ] Record the numbers verbatim in the handoff and in this plan. **Not clean → stop**, and propose a drain step (let the legacy handlers
  run until zero, then re-check) plus a dated risk acceptance for BUG-068 if 2026-10-29 is at risk.

## Task L1: Branch + untruncated inventory

- [ ] `git fetch origin && git switch -c agent/claude/sprint-134-pr-l-legacy-handlers origin/master`
- [ ] Run the Note 3 greps and reconcile the File Map with them; every hit is either in the map or justified as staying.

## Task L2: Tighten the gate first (TDD)

- [ ] In `tests/regression/sprint-133-pr-q-event-routes.test.ts`, delete `LEGACY_SUBSCRIBERS` and add the negative fixture. Run it
  and confirm it **fails** on the three subscribers today.

## Task L3: Shared package

- [ ] Remove `legacyQueue` from `startConsumerQueue`; remove the route entry; set `EVENT_CONSUMERS` per decision 1. Update the shared
  tests to assert the new exact sets (`eventsFor('notification')` unchanged; `reputation` absent).
- [ ] `npm run build --workspace=@karmyq/shared && npm test --workspace=@karmyq/shared`

## Task L4: Subscribers

- [ ] notification, reputation, social-graph per the File Map. Each service's tests and `npx tsc --noEmit`.

## Task L5: BUG-068 route and callers

- [ ] Delete the request-service route, its mount and its tests; delete the simulation call; update the reputation health route.
  request-service, reputation-service and simulation-service tests and `tsc`.

## Task L6: Integration tests

- [ ] Retire the BUG-060 live half; narrow the PR Q integration test per decision 2. Type-check `tests/`. They run in CI.

## Task L7: Docs, ADR amendment, registry

- [ ] ADR-101 amendment (*Migration* → "Legacy handlers removed in Sprint 134 PR L (#<n>), after a clean drain check on <date>";
  reputation consumer per decision 1). `docs/adr/README.md` index line if the status text changes. Regenerate landing docs.
- [ ] `services/registry.json`, `npm run analyze:services`, the four `CONTEXT.md` files, `docs/BUGS.md` BUG-068.
- [ ] `docs/IDEAS.md` 2026-10-13: mark the legacy-handler bullet done (append-only: add a dated note, don't delete).

## Task L8: SDLC quality gates

- [ ] `/simplify`: one pass per substantial task (L3, L4). Verification: noted per task.
- [ ] `/code-review` at **high** (6 workspaces, a shared API change, a deleted route). Verification: no open correctness finding.
- [ ] `/security-review`: a removed route must not leave an unauthenticated remnant; no queue is left open with no consumer.
  Verification: written result.

## Task L9: Final verification + PR

- [ ] Root `npm test`; `npm test --workspace=tests`; each touched workspace with `--force`; revert landing churn; restore TDD-promoter
  sweeps. Version re-derived. Push, open PR; CI integration job green, with the run link quoted.

## Task L10: Merge + deploy (maintainer-authorized)

- [ ] Handoff landed first; "admin merge, yes/no?" After merge, watch CI/CD; CodeQL re-raise → ask before dismissing →
  `gh run rerun <id> --failed`.
- [ ] Post-deploy (maintainer, or Claude with per-operation authorization): the legacy `bull:karmyq-events` keys show no new jobs, and
  no container lists a `karmyq-events` worker. Then hand off to PR L2.
