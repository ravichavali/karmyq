# Sprint 131 — Maintenance Backlog — Handoff

**Date**: 2026-09-23

> ⚠️ **Bootstrap: `git switch agent/claude/sprint-131-bug-051-push-auth` BEFORE reading further.**
> `master`'s copy of this file is stale — it still says #257 is open, because the copy that merged
> with #257 was written before that PR merged. This branch, cut from the deployed `96ffa619`, is the
> current one. Do not push the reconciliation to `master`: every master push is a full deploy, and a
> docs-only push would restart services and 502 the demo. It rides on this branch's PR instead.

> ✅ **BUG-051 is IMPLEMENTED as [#258](https://github.com/ravichavali/karmyq/pull/258) (v11.65.0), CI green (20 pass / 1 expected skip), awaiting merge authorization.** All
> gates green: Turbo 27/27 exit 0, notification-service 67/67 (the new gate ran fresh, not cached),
> `@karmyq/tests` 866/866 + 101/101, `tsc --noEmit` clean, declarations/drift/license gates green.
> **Read the "BUG-051 — SHIPPED TO PR" block below before touching notification-service**: fixing
> it surfaced a second, more dangerous defect that is easy to reintroduce.

**Outcome**: PR A **shipped v11.56.0** ([#249](https://github.com/ravichavali/karmyq/pull/249), `d35a3fad`). PR B **shipped v11.57.0** —
[#250](https://github.com/ravichavali/karmyq/pull/250) merged as `d2edb286` (2026-09-17T13:00:59Z, admin merge on explicit
maintainer authorization), deployed, health-verified and smoke-checked. PR B2 **shipped v11.58.0** —
[#251](https://github.com/ravichavali/karmyq/pull/251) merged as `1e1916ee` (2026-09-18T01:55:41Z, maintainer merged),
deployed, health-verified and smoke-checked. PR B3 **shipped v11.59.0** — [#252](https://github.com/ravichavali/karmyq/pull/252)
merged as `238c9009` (2026-09-19), deployed, health-verified and smoke-checked; issue #248 closed. PR D1 **shipped v11.60.0**
— [#253](https://github.com/ravichavali/karmyq/pull/253) merged as `0ce160b5` (2026-09-21T15:59:10Z), deployed, health-verified
and smoke-checked. PR D2 **shipped v11.61.0** — [#254](https://github.com/ravichavali/karmyq/pull/254) merged as `b7539896` (2026-09-21T20:51:13Z), deployed, health-verified and smoke-checked; #228 closed. PR D3 **shipped v11.62.0** — [#255](https://github.com/ravichavali/karmyq/pull/255) merged as `b7588509` (2026-09-21T23:25:42Z), deployed on a CI re-run, health-verified and smoke-checked; #224 closed. BUG-050 fix **shipped v11.63.0** — [#256](https://github.com/ravichavali/karmyq/pull/256) merged as `e5f7d8e1` (2026-09-22T04:20:36Z), [CI/CD run 35686522868](https://github.com/ravichavali/karmyq/actions/runs/35686522868) every job success, deployed, health-verified, smoke-checked (login, `/api/requests`, `/api/conversations`, `/api/reputation/karma/:userId` all 200). BUG-049 fix **shipped v11.64.0** — [#257](https://github.com/ravichavali/karmyq/pull/257) merged as `96ffa619` (2026-09-22T23:54:04Z, maintainer merged), [CI/CD run 35799597789](https://github.com/ravichavali/karmyq/actions/runs/35799597789) every job success, deployed, all 9 services healthy, `DEPLOYMENT SUCCESSFUL`, no rollback; smoke 2026-09-23: login 200, `/api/requests` 200, `/api/conversations` 200, `/api/reputation/karma/:userId` 200. **BUG-051 fix is IMPLEMENTED as v11.65.0 on `agent/claude/sprint-131-bug-051-push-auth`, all gates green, awaiting merge authorization.** **Then: D4 (expo-server-sdk #230).**

✅ **BUG-051 — SHIPPED TO PR (v11.65.0), branch `agent/claude/sprint-131-bug-051-push-auth`.** Both
halves landed together: a fail-closed `services/notification-service/src/middleware/internalAuth.ts`
(503 unconfigured, 403 mismatch, `timingSafeEqual` over SHA-256, neither secret logged) and
`INTERNAL_SECRET` wired to notification-service in **both** compose files.

**The demo host was checked read-only first, on maintainer authorization (2026-09-22):**
`~/karmyq/.env.demo` defines `INTERNAL_SECRET` **once**, non-empty — no duplicate assignment to
shadow it, unlike `RATE_LIMIT_DISABLED`. So the deployed route will authenticate, not 503. Only
presence/count/length were read; the value was never printed.

⚠️⚠️ **A SECOND defect surfaced during the fix, and it is the more dangerous one. Do not undo it.**
The original guard used `router.use(internalAuth)` on a router mounted at **`/notifications`**, not
`/notifications/push` — so it gated **every** sibling route under that prefix, including the
authenticated list, unread-count and preferences routes meant to fall through to the next mount.
That was inert only because `INTERNAL_SECRET` was never set for this service; **wiring the secret in
— the other half of this fix — is precisely what arms it.** Measured on the real app before
correction: with the secret configured, `GET /notifications/:userId` and
`GET /notifications/preferences` both returned **403**; with it unset, **503**. Shipping the two
halves as first written would have taken the **entire notifications API down for every user** on
deploy. The guard is now attached to the **single route**
(`router.post('/push/send', internalAuth, …)`); those routes now return 401 from `authMiddleware`,
and six assertions in the gate hold the line in both the configured and unconfigured states.

**Generalise it: a fail-open guard hides its own blast radius.** Nothing about the `router.use`
mount looked wrong while the condition could never fire, and the full suite passed both before and
after arming it. It was found by probing sibling routes on the real app — no existing assertion
covered them. If you add a second internal route here, give each its own `internalAuth` argument,
or mount a separate router at `/notifications/push`.

Also in this PR: `src/index.ts` starts only under `require.main === module` and exports `app`
(mirroring social-graph) so the route is testable end-to-end — verified against the emitted
`dist/index.js` and the container's `CMD ["node", "dist/index.js"]`, so production boot is
unaffected. `supertest`/`@types/supertest` declared in notification-service with the lockfile
spliced in place at social-graph's exact ranges. `package-lock.json`'s root version was also
**11.63.0 while `package.json` was 11.64.0** (#257 bumped one and not the other) — both are now
11.65.0. Docs: `docs/BUGS.md` BUG-051 marked fixed with full mechanism, `CONTEXT.md` (which also
documented a `{ sent, failed }` response the code has never returned and a nonexistent
`src/services/pushNotificationService.ts`), and `services/registry.json`.

New gotcha `docs/gotchas/git-pathspec-double-star-needs-glob-magic.md` (maintainer approved for this
PR): `git ls-files 'services/*/src/**/*.ts'` returns **184 files and 0 `src/index.ts`**, while
`:(glob)services/*/src/**/*.ts` returns **200 and all 9** — the trap behind one of #257's four
discovery defects. `gotcha-check` clean at 11 entries.

**Left for a future sprint, deliberately:** `docker-compose.qa.yml`, `.staging.yml` and `.test.yml`
still omit `INTERNAL_SECRET` for this service (referenced only by archived scripts, not the live
deploy path; qa already omits social-graph's too). And unrelated drift, NOT caused here:
`services/impact-analysis.md` computes auth-service at **6** dependents while CLAUDE.md's table and
all ten `.claude/README.md` files (dated 2026-03-03) say **7**; regenerating churns all ten, so it
was reverted rather than buried in a security diff.

<details><summary>Original BUG-051 report (kept for the record)</summary>

🔴 **BUG-051 — `POST /api/notifications/push/send` is unauthenticated (HIGH, own PR, maintainer decision 2026-09-22).**
Found by this sprint's `/security-review`; full evidence in `docs/BUGS.md` BUG-051. Four verified facts:
the guard at `services/notification-service/src/routes/push.ts:7-12` is `if (secret && ...)`, so it **fails open**;
`INTERNAL_SECRET` is wired only to request-service and social-graph-service (`docker-compose.yml:162,318`,
`docker-compose.prod.yml:68,180`) and **never to notification-service**; the router mounts at
`services/notification-service/src/index.ts:68`, *ahead* of the `authMiddleware`-protected one at `:70`; and nginx
forwards the path publicly (`nginx.conf:227`). Net effect: anyone can push an arbitrary notification to arbitrary
`user_ids` — a phishing surface on users' devices.

**Scope for that PR:** fail-closed middleware (copy the shape of `social-graph-service/src/middleware/internalAuth.ts`
— `timingSafeEqual` over SHA-256, 503 when unconfigured) **plus** `INTERNAL_SECRET` wiring for notification-service in
both compose files. The two halves must land together: failing closed without the secret turns the endpoint into a 503.
⚠️ **Before deploying it, confirm `~/karmyq/.env.demo` defines `INTERNAL_SECRET`** — a read-only demo check needing its
own authorization. No in-repo caller invokes `/push/send` (verified), so failing closed breaks no existing flow.

</details>

Also noted, unverified and NOT a claim about the live site: `docker-compose.prod.yml:239` defaults
`GRAFANA_ADMIN_PASSWORD` to `admin` and Grafana is proxied at `/grafana/`. The config alone does not establish that the
deployed dashboard accepts default credentials; that needs a demo check nobody has run. PR C rollout approval deferred.

The maintainer handed these planning files to Codex and authorized edits. This handoff carries
session state, not reservations inferred from branch-local text.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-131-bug-051-push-auth`, cut from the deployed `96ffa619` (v11.64.0); ships v11.65.0. The BUG-049 branch `agent/claude/sprint-131-bug-049-rate-limit-key` is **merged** — do not commit on it. **D4 is re-cut fresh from `origin/master` only after BUG-051 merges and deploys.** ⚠️ A branch `agent/claude/sprint-131-d4-expo-server-sdk` exists from an earlier chat carrying only a handoff commit (`c4ce2733`), whose content is superseded here — delete it rather than build on it. The BUG-050 branch `agent/claude/sprint-131-postgres-readiness` is merged. PR A (#249), PR B (#250), PR B2 (#251), PR B3 (#252), PR D1 (#253), PR D2 (#254) and PR D3 (#255) branches are merged — do not commit on them |
| **Base** | `origin/master` at `96ffa619` (BUG-049 / #257 merge), fetched 2026-09-23; v11.64.0 |
| **Active editor** | Claude executed PR A (2026-09-16); planning was authored by Codex under maintainer transfer |
| **Reviewer role** | A non-author reviews the completed diff; reviewers do not co-edit |
| **Owned paths now** | Sprint 131 spec/plan, CURRENT_HANDOFF, preserved Sprint 130 archive |
| **Owned implementation paths** | Per-PR file map in the plan; no implementation in this planning session |
| **Shared resources needed** | Dependency/lockfile lane held by **Claude** since 2026-09-16 (was Codex from 2026-09-15), including messaging declarations. No ADR allocation or demo data operation planned. Version comes from master at merge time; merges need per-PR maintainer authorization. |

## Goal and arc

Sprint 130 shipped v11.55.0. Sprint 131 addresses BUG-045/034/036 and the seven major proposals
#224–#230, and prepares BUG-033 for a separately approved rollout. There are **nine planned PRs
plus one conditional promoter PR**, not ten preallocated version slots.

| PR | Scope | State / next action |
|---|---|---|
| A | BUG-045 expected missing config + planning/archive | **Shipped** — #249 merged `d35a3fad`, v11.56.0, deployed + live-verified 2026-09-16 |
| B | BUG-034 messaging coverage + PR B runtime declarations (spec scope) + BUG-036 Docker readiness | **Shipped** — #250 merged `d2edb286`, v11.57.0, deployed + smoke-checked 2026-09-17 |
| B2 | BUG-046 declare missing imports in 8 services + generalize the declarations gate | **Shipped** — #251 merged `1e1916ee`, v11.58.0, deployed + smoke-checked 2026-09-18. Repo-wide declarations gate is live and blocking |
| B3 | Expo SDK drift catch-up (#248): align `apps/mobile` to Expo's live SDK 57 patch pins | **Shipped** — #252 merged `238c9009`, v11.59.0, deployed + smoke-checked 2026-09-19; **#248 closed**. 7 declared packages moved, not the 4 originally scoped: Expo published a coordinated patch wave mid-PR (see *Expo's map is a moving target* below) |
| D1 | dotenv 16.6.1 → 17.4.2 (#226) | **Shipped** — #253 merged `0ce160b5`, v11.60.0, deployed + smoke-checked 2026-09-21. Took Dependabot #226 (closed as superseded) plus `{ quiet: true }` at all 14 call sites; new blocking gate `sprint-131-dotenv-quiet` (10 tests) after three review rounds |
| D2 | node-cron 3.0.3 → 4.6.0 (#228) | **Shipped** — #254 merged `b7539896`, v11.61.0, deployed + smoke-checked 2026-09-21; #228 closed (GitHub auto-closed it 1s after the merge). Took Dependabot #228 plus: `@types/node-cron` removed (v4 bundles types), `cron.setLogger(logger)` in cleanup-service so v4's new `missed execution` warning reaches winston, and a real-scheduler **blocking regression** test for reputation's two jobs (`tests/regression/sprint-131-node-cron-v4.test.ts`; moved out of `tdd/` on review, since reputation's `npm test` never runs `tdd/`) |
| D3 | express-rate-limit → 8.7.0 (#224) | **Shipped** — #255 merged `b7588509`, v11.62.0, deployed + smoke-checked 2026-09-22; #224 closed (auto-closed on merge). shared/geocoding 7.5.1→8.7.0, root/cleanup 8.5.2→8.7.0; two stale `DIVERGENCE_ALLOWLIST` entries removed. First master run **failed Integration Tests on a postgres readiness race** (not D3 code — see below); deployed on `gh run rerun --failed`. Logged **BUG-049**, not fixed |
| **D4** | **expo-server-sdk 6.1.0 → 7.2.0 (#230)** | **LAST of the three — after BUG-049 (#257) merges and deploys AND after the BUG-051 PR ships.** Do not start it while BUG-051 is outstanding; that endpoint is unauthenticated today. Then cut `agent/claude/sprint-131-d4-expo-server-sdk` fresh from the newly deployed `origin/master` (delete the stale branch of that name first). No focused plan yet. Re-check #230 against the new master (it auto-rebases), inventory importers, verify v7 behavior against installed `node_modules` |
| D5–D7 | node-fetch, zod, next | One major per PR, after D4 |
| C | BUG-033 discovery and approved promotions | Task 8 inventory allowed; Tasks 10–13 blocked on rollout approval |

Do not hold the other nine PRs while waiting for C. If C resumes after the upgrades, repeat its
inventory against the then-current base. BUG-033 remains open until actually delivered.

## Links

- **Spec**: [Sprint 131 design](../../docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md)
- **Plan**: [Sprint 131 implementation](../../docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md)
- **PR B2 focused plan**: [Every workspace declares what it imports (BUG-046)](../../docs/superpowers/plans/2026-09-17-sprint-131-pr-b2-undeclared-imports.md)
- **PR B focused plan**: [Messaging coverage + Docker readiness (BUG-034, BUG-036)](../../docs/superpowers/plans/2026-09-16-sprint-131-pr-b-test-readiness.md)
- **PR A focused plan**: [Expected missing community config (BUG-045)](../../docs/superpowers/plans/2026-09-15-sprint-131-pr-a-community-config.md)
- **Sprint 131 PR A**: [#249](https://github.com/ravichavali/karmyq/pull/249) (merged `d35a3fad` 2026-09-16; [CI/CD run 35134858026](https://github.com/ravichavali/karmyq/actions/runs/35134858026)).
- **Sprint 130 archive**: [v11.55.0](archive/2026-09-15-sprint-130-maintenance-SHIPPED-v11.55.0.md)

## Quick Start

1. Confirm current branch, clean handoff and live state with `git status --short`, `gh pr list`
   and `git log --oneline origin/master -3`.
2. BUG-049 is **merged and deployed** (#257, `96ffa619`, v11.64.0); its branch is finished — do not commit on it. **BUG-051 is on `agent/claude/sprint-131-bug-051-push-auth`, cut from the deployed `96ffa619`.** D4 cuts `agent/claude/sprint-131-d4-expo-server-sdk` fresh from master after BUG-051 ships (delete the stale branch of that name before re-cutting).
   The PR A (#249), PR B (#250), PR B2 (#251), PR B3 (#252), PR D1 (#253), PR D2 (#254) and PR D3 (#255) branches are merged; never commit on them.
3. Read the linked spec and sprint plan. **PR A, B, B2, B3, D1, D2 and D3 are shipped — do not reopen or re-execute their plans.**
4. Order decided 2026-09-22: **(1) BUG-049 — SHIPPED v11.64.0; (2) BUG-051 — IMPLEMENTED on this branch (v11.65.0), awaiting merge authorization; (3) D4 (expo-server-sdk #230).** Scope for each: the BUG-051 block below, the BUG-049 notes below, and the D4 row above.
5. For each later PR, create its focused plan and branch from newly deployed `origin/master`.
   One merge/deploy/health verification at a time.

**B2 and B3 SHIPPED** — #251 merged `1e1916ee` (v11.58.0) and #252 merged `238c9009` (v11.59.0), both deployed with all
services healthy, no rollback, smoke-checked live. The repo-wide declarations gate is blocking on every push, and #248 is
closed.

**D1 SHIPPED** — #253 merged `0ce160b5` (v11.60.0) on explicit maintainer authorization, 2026-09-21T15:59:10Z.
[CI/CD run 35622621477](https://github.com/ravichavali/karmyq/actions/runs/35622621477): every job success including all 7
image builds and **Deploy to Demo** (`✅ All services healthy`, `🎉 Demo Deployment Successful`, no rollback). Smoke:
login 200, `/api/conversations` 200, `/api/requests` 200. Not yet verified: that the deployed service boot logs contain
**no** `◇ injected env` line — CI proves `quiet: true` works, but checking the live logs needs SSH to the demo host,
which is a demo operation requiring per-operation maintainer approval.

**D2 SHIPPED** — #254 merged `b7539896` (v11.61.0), 2026-09-21T20:51:13Z. [CI/CD run 35653652621](https://github.com/ravichavali/karmyq/actions/runs/35653652621): every job success incl. all 7 image builds and **Deploy to Demo** (`✅ All services healthy`, `🎉 Demo Deployment Successful`, no rollback). Smoke: login 200, `/api/requests` 200, `/api/conversations` 200, `/api/reputation/karma/:userId` 200. Not verified live: a `missed execution` line reaching cleanup's winston log (proven locally by probe; needs SSH = per-operation approval).

**D3 SHIPPED** — #255 merged `b7588509` (v11.62.0), 2026-09-21T23:25:42Z. [CI/CD run 35667512603](https://github.com/ravichavali/karmyq/actions/runs/35667512603): the first attempt **failed Integration Tests** (every service `ECONNREFUSED 172.18.0.3:5432`); re-run of the failed jobs on maintainer approval → every job success, **Deploy to Demo** `✅ All services healthy`, `🎉 Demo Deployment Successful`, no rollback. Smoke 2026-09-22: login 200, `/api/requests` 200, `/api/conversations` 200, `/api/reputation/karma/:userId` 200.

✅ **The postgres readiness race that failed that first attempt is BUG-050 — SHIPPED v11.63.0** ([#256](https://github.com/ravichavali/karmyq/pull/256), `e5f7d8e1`; [CI/CD run 35686522868](https://github.com/ravichavali/karmyq/actions/runs/35686522868) every job success, `✅ All services healthy`, no rollback; smoke login/requests/conversations/reputation all 200). A review round on #256 added `start_period: 60s` to the base compose stack too. Mechanism and proof: `docs/BUGS.md` BUG-050.

**Next unchecked action: merge authorization for the BUG-051 PR (v11.65.0).** Implementation,
docs, gates and handoff are all on `agent/claude/sprint-131-bug-051-push-auth`; the demo
`INTERNAL_SECRET` check is done (present, once, non-empty). On authorization:
`gh pr merge 258 --squash --admin`, watch **Deploy to Demo**, then smoke login + `/api/requests`
+ `/api/conversations` + `/api/reputation/karma/:userId`.

**Post-deploy smoke for this fix specifically:** an unauthenticated
`POST /api/notifications/push/send` must return **403**, not 200 — that is the whole bug, and it is
safe to probe because a rejected call sends no notification. Do **not** verify the success path
against the demo: a 200 delivers a real push to real devices. Also confirm an ordinary
authenticated notifications read still works (**not** 403/503) — that is the blast-radius
regression, and it is the one that would hurt every user rather than none.

After BUG-051 deploys: D4 (expo-server-sdk, #230).

✅ **BUG-049 — SHIPPED v11.64.0**, merged as `96ffa619` (#257) and deployed 2026-09-22; this branch is cut from it. Found in D3. Three claims in the original report were wrong and are corrected in `docs/BUGS.md` and [ADR-098](../../docs/adr/ADR-098-trusted-proxy-and-rate-limit-keys.md):

- **Not auth-only.** `globalRateLimiter` is mounted app-level in **seven** services; `cleanup-service` builds its own, and geocoding-service mounts two in plain JS. **Nine** services were affected. geocoding was found only during `/simplify` — the first gate scanned `.ts` only and could not see it.
- **The `user:<userId>` branch is reached in one service only** (review correction — an earlier claim of "unreachable repo-wide" was wrong): social-graph-service calls `app.use(authMiddleware)` at `src/index.ts:135` ahead of six route limiters, which key by user. In the other eight every limiter sits ahead of `authMiddleware`, so `rateLimiters.standard` gave request-service's ~12 route groups **one** 60/min bucket for the entire user base: enabling limiting would have throttled the whole site, not just risked an `/auth/*` lockout. That is the likeliest reason `RATE_LIMIT_DISABLED=true` was set.
- **nginx needed no change.** Every `location` block includes `/etc/nginx/proxy_params`, which is not in the repo and does set `X-Forwarded-For` and `X-Real-IP` (read read-only on the host, 2026-09-22, and confirmed in all 25 blocks by `nginx -T`).

The fix is two layers: `ipKeyGenerator(req.ip)` in the shared key generator, and `app.set('trust proxy', 1)` in the eight services nginx proxies (cleanup-service mounts a limiter but is not proxied, so it sets nothing — `/code-review high` caught that trusting an absent hop there would have made `req.ip` forgeable). `1` is the only safe value — `true` lets a client spoof `req.ip`, `'loopback'` does not match the Docker gateway. Because nginx uses `$proxy_add_x_forwarded_for` (real client appended **last**), one trusted hop is spoof-proof; probed against the installed express 5.2.1 / proxy-addr 2.0.7 with forged chains of one, two and four entries. Gated by `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts` (topology-derived from nginx upstreams × registry, AST over tracked `.ts` **and** `.js`, asserts both directions, 7 injection proofs) and `packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts` (behavioural). ⚠️ Limits are **per-IP in eight of the nine** limiter-mounting services; social-graph-service's six post-auth limiters key per user. Making per-user keying live in the rest needs a mount-order redesign, logged in `docs/IDEAS.md` [2026-09-22].

⚠️ **The demo still runs `RATE_LIMIT_DISABLED=true` — the fix does NOT re-enable it.** **BUG-049 live observation (2026-09-22, VERIFIED on host by read-only SSH):** live `POST /api/auth/login` responses carry helmet headers but **no `RateLimit-*` headers**, although both auth limiters set `standardHeaders: true` and `nginx.conf` strips nothing. The likeliest cause is `RATE_LIMIT_DISABLED=true` in the demo host `.env` — `docker-compose.prod.yml` reads `${RATE_LIMIT_DISABLED:-false}`, and the archived `scripts/archive/seeding/seed-production-*.sh` append that line and only remove it on a clean finish. If so, the BUG-049 lockout is latent on the demo **and login has no brute-force limit at all**. **Verified:** `docker exec karmyq-auth-service env` → `RATE_LIMIT_DISABLED=true`. Source: `~/karmyq/.env.demo` sets it twice — line 31 `RATE_LIMIT_DISABLED=false`, line 58 `RATE_LIMIT_DISABLED=true` (the seed-script append); `deploy.sh` does `set -a; source .env.demo`, so the later line wins. (`~/karmyq/.env` does not exist.) **So the demo has NO rate limiting on login today.** ⚠️ **Do NOT just delete line 58:** with limiting on, BUG-049 makes all `/auth/*` share one 10-per-15-min bucket, so 10 requests from anyone would lock every user out. Re-enable rate limiting **together with** the BUG-049 fix, as one demo operation with its own approval.

**Local test-run note (D3):** full `npm test` at default Turbo concurrency timed out twice on this Windows box (suites at 158–402 s; auth/social-graph/community); `npx turbo run test --concurrency=2` was 27/27 green. Machine load, not code — prefer `--concurrency=2` for the local proof run.

D2 follow-ups (not blocking): reputation-service leaves node-cron's logger on `console` (shared `Logger.error` takes only a string; needs an adapter); cleanup-service's 9 top-level schedules have no real-scheduler unit test (an exported `initSchedules()` would make them testable).

**What B2 and D1 taught about the remaining Dependabot majors (D2–D7):**
- **Check whether Dependabot already did the manifest work.** B2's declarations gate makes a root-only bump red, so
  Dependabot now bumps root *and* every declaring workspace itself — #226 did, three minutes after B2 merged. Before
  hand-building a D-PR, re-read the Dependabot PR's file list against the new master; the manifest mechanics may already
  be correct and green. It will auto-rebase after each merge, so re-check it at the time you start.
- **What Dependabot cannot do is the behavior change.** A major can flip a default the repo relies on without failing a
  single test (dotenv 17 made `config()` noisy). Verify behavior against the installed `node_modules` source and by
  running both versions, never from the changelog.
- **Any gate written for a D-PR: enumerate what the assertion ADMITS, not what it was meant to reject.** #253's gate
  needed three review rounds because each fix closed one spelling and left the next (`quiet: false`, a later spread, a
  computed key). Unreadable input must invalidate, never be skipped; a "precise" prefilter in front of a parser is a
  second, weaker parser.
- **If a D-PR contains a Dependabot commit, close that Dependabot PR as superseded** — merging both double-applies it.

Review history on #253, three rounds, all findings fixed and each proven closed by injection rather than asserted:

1. Round 1 (`ebb06407`, 4 findings): `{ quiet: false }` passed a gate named "is quiet" (dotenv runs the value through
   `parseBoolean`, so `0`/`undefined`/`null`/`'false'` are all falsy and all still print); three binding forms were
   discovered but unresolvable (`require('dotenv').config()`, `import dotenv = require(...)`, block-scoped require); the
   identity pin covered only `services/`; a "four files" miscount.
2. Round 2 (`38b2848a`, 2 findings): a **trailing spread** could override `quiet: true`, because the check took the FIRST
   `quiet` and JS is last-one-wins; and the discovery **prefilter was a second, weaker parser** in front of the AST,
   skipping `from\n'dotenv'` and `require( 'dotenv' )`. It now matches the bare word and lets the AST decide.
3. Round 3 (2026-09-20, 1 finding): **computed property keys were skipped entirely**, so
   `dotenv.config({ quiet: true, ['qui' + 'et']: false })` passed all nine assertions while dotenv 17.4.2 logs — verified
   both halves. An unresolvable computed key now invalidates the proof exactly as a spread does; a statically-readable
   `['quiet']` is treated as the plain name, and a later explicit `quiet: true` restores it. Injected into the real
   auth-service call site: gate goes red on that exact line. Gate is now **10/10**.

Codex reviewed `38b2848a`: 20 checks pass / 1 skipped (Deploy to Demo), Test Docker Build included — the earlier
frontend-install `ECONNRESET` was a network abort, not a regression, and passed on re-run.
Codex re-reviewed `b5670cef` on 2026-09-20: **no remaining code findings**. Fresh dotenv + declarations
suites passed **20/20** (dotenv gate **10/10**); ten independent option-order probes passed, covering computed
keys, spreads, getters, methods and shorthand. The round-3 computed-key finding is closed
(`tests/regression/sprint-131-dotenv-quiet.test.ts:171-187`). GitHub CI was still running on that exact head
at review time; #226 was confirmed CLOSED. Recommendation: merge after that head's CI passes and the
maintainer authorizes it. **No merge performed; CI completion remains pending.**
**#226 CLOSED as superseded on 2026-09-20**, by Codex on the maintainer's explicit request (GitHub closedAt
`2026-09-20T22:50:40Z`). No merge or deployment was performed. After D1 review/merge/deploy/smoke, continue D2–D7.

⚠️ **Expo's map is a moving target — re-check at merge time on any future Expo PR.** Mid-PR, Expo published a coordinated
SDK 57 patch wave: all four originally-scoped pins went one patch further behind *and* three more packages
(`expo-router`, `expo-constants`, `@expo/metro-runtime`) joined the drift, ~10h after the first check. Measured cadence is a
**median ~70–100h between releases per package**, so there is roughly a 3-day window to land a catch-up PR — it is not a
minutes-scale treadmill, but a PR left open for days WILL go stale. If `expo install --check` is red again at merge time,
re-run the splice against the then-current versions rather than merging a stale one. This is the same "remote mutable
authority" trap ADR-094 exists for.

⚠️ **D1 (dotenv 16→17, #226) now behaves differently because of B2.** A root-only bump will turn the declarations gate **red**
in all eight services that declare `dotenv ^16.3.1`, plus `tests` and `simulation-service` (`^16.3.0`). That is intended: bump
root **and** every declaring workspace in the same PR. The same applies to any later root major (ioredis, bcryptjs, zod, next).
Claude holds the dependency lane. (The gate uses a TypeScript **AST walk**, not `ts.preProcessFile` — an earlier line here
misattributed it; `preProcessFile` was rejected in plan review round 2 because it misses `require()` in a template interpolation.)

## Blockers and decisions

- **Dependency lane → Claude (2026-09-16):** “yes and you own this lane now. The execute plan command
  implicitly gives ownership of the lane. review doesn't” (maintainer). Rule: executing a plan transfers the lane to the executor; reviewing does not. Covers B's
  runtime/test declarations and D1–D7 while Claude executes them. Superseded: “Codex holds the
  implementation dependency lane” (maintainer, 2026-09-15). Codex's #249 review did not hold the lane.
- **Promoter approval deferred:** “Plan the fix, but defer rollout approval” (maintainer,
  2026-09-15). Do not broaden the matcher or trigger mass moves until the actual inventory and
  proposed move list are approved. Root `posttest` makes a matcher-only commit a rollout risk.
- **Expo reporting deferred:** no standalone Expo PR in Sprint 131. Existing emitted report/close
  states are mutually exclusive; the follow-up concerns failures before outputs are available.
  This is not the resolved BUG-035. The spec preserves the observation for later scheduling.
- **BUG-045 boundary:** suppress the application log on expected 404 and clear config; the browser's
  HTTP failure diagnostic can remain. No API contract change and no blanket console-silence claim.
- **Risk split:** messaging/CI readiness ship before major upgrades; mass promotion has its own PR.
  Major upgrades stay separate because their runtime and migration risks differ.
- **BUG-036 approach changed (maintainer, 2026-09-16):** "I am okay with your recommendations". The `/simplify`
  altitude finding replaced PR B's Node polling script (`scripts/wait-for-http.js`) with compose healthchecks
  (`auth-service`, `frontend` probing `$(hostname)`) plus `docker compose up -d --wait --wait-timeout 300 <named>`.
  It covers both `test.yml` Test Docker Build and `ci.yml` Integration Tests (the same `sleep 30` race). Proof comes
  from the PR's own CI runs, not local tests (no Docker on this box). Healthcheck interval is 30s because the base
  compose also runs on the demo host (disk 88% full).
- **B2 scope widened (maintainer, 2026-09-17, planning chat):** re-measured with `ts.preProcessFile` over every
  tracked JS/TS file (64 gaps; BUGS.md's 8-service table confirmed exactly). Two questions answered:
  (1) "Include in B2" — `packages/shared` compiled runtime also declares `jsonwebtoken`/`bull` (deps) and `pg`
  (peer: type-only `Pool`, same contract as Express); its build-excluded `api/` files (ADR-028) are the only
  allowlist entries. (2) "Gate it and fix all now" — test/tooling imports must be declared too (deps or
  devDeps), and B2 fixes today's test-scope gaps (notification/reputation/social-graph, frontend, tests workspace).
- **BUG-046 scheduled (maintainer, 2026-09-16):** 8 services also import undeclared packages. One dependency PR
  (B2) fixes all of them before D1; PR B stays messaging-only. **BUG-047** (pre-existing `npm ls` picomatch
  ELSPROBLEMS) logged for triage.
- **Lanes/stages/provenance work is Sprint 132 (maintainer, 2026-09-16):** its spec, plan and handoff live on the
  pushed branch `lane/lanes-provenance` (`.claude/handoff/lane-lanes-provenance.md`). The execute stage is available.
- **Dependabot majors not rolled into B (maintainer, 2026-09-16):** asked whether the ~10 open Dependabot PRs
  should join PR B; answered no — all are majors, 0 open Dependabot security alerts; one major per PR after B and B2.
  #243 (bcryptjs 2→3, auth password hashing) **deferred to Sprint 132** ("Let's defer #243 to sprint 132", maintainer, 2026-09-17).
- **Expo SDK drift (observed 2026-09-17, not scheduled):** the daily `expo-sdk-drift.yml` run is red and issue #248 is open.
  Cause is patch lag only: expo 57.0.22→~57.0.23, expo-image-picker/expo-location 57.0.17→~57.0.18,
  expo-notifications 57.0.18→~57.0.19 (jest/@types/jest 30 are registered divergences). 0 open Dependabot alerts;
  changelogs not read, so "no security content" is UNVERIFIED. **Decided (maintainer, 2026-09-17):** "I also want to get
  the expo drift handled in a small PR after b2" → PR B3.
- **New proposals triaged (2026-09-16):** #244 (`@eslint/js` 9→10) and #245 (ioredis 5→6) are
  **deferred to Sprint 132** by maintainer decision — they are majors that appeared after Sprint 131's
  scope was approved. #243 (bcryptjs, a major) joined them on 2026-09-17. Recorded in `docs/IDEAS.md` [2026-09-16] so
  the decision outlives this handoff's archival. Sprint 131's D-series is unchanged: #224, #225, #226,
  #228, #230, plus #247/#246 which superseded the closed #227/#229.
- **No rollout or merge authorization is implied by planning ownership.**

## Review corrections applied

- All root-regression probes use the tests workspace and verify actual discovery.
- Messaging's TDD run and nonzero case count precede promotion; blocking discovery is asserted.
- Every B manifest change includes a surgical lock update and strict install.
- All missing direct messaging runtime imports are declared before D1; future importer audits
  distinguish actual source imports from current manifest declarers.
- The branch was created before committing; the staged Sprint 130 archive was preserved.
- Numeric version reservations were removed, and the release count reflects deferred C.
- BUG-033 counts were remeasured as 74 .tsx + 2 .ts; current green counts remain unverified.
- ADR-088 and BUG-033 are the suffix-documentation targets; scripts/claude.md does not contain the
  claimed .ts-only wording.
- The tier gate has a generic empty-workspace allowance, not a named messaging exemption.
- The handoff now names ownership, base, shared-resource allocation, next task and verification.

## Verification references

PR B2 merge, deploy and smoke, 2026-09-18 (maintainer merged; Claude verified):

- [#251](https://github.com/ravichavali/karmyq/pull/251) **MERGED** as `1e1916ee` at 2026-09-18T01:55:41Z; `origin/master`
  now `1e1916ee`, version **11.58.0**.
- [CI/CD run 35297292440](https://github.com/ravichavali/karmyq/actions/runs/35297292440): conclusion **success**, every job
  success including Code Scanning Gate, Security Audit, Integration Tests, all 7 image builds and **Deploy to Demo**.
  Deploy log: each of the 9 services `✅ … is healthy`, `✅ All services healthy`, `🎉 Demo Deployment Successful`, **no rollback**.
- Smoke (Node fetch, Windows): `POST https://karmyq.com/api/auth/login` as maria.reyes → **200, success true**, token issued;
  `GET /api/conversations` → **200, success true** (0 conversations); `GET /api/requests?limit=5&offset=0` → **200, success true**.
  Two authenticated reads, no demo data written. ⚠️ The sim password is **`password123`** — a wrong guess returns a 401 with a
  correct ADR-074 envelope, which looks like a routing pass but proves nothing.

PR B2 CI evidence, 2026-09-17 — [#251](https://github.com/ravichavali/karmyq/pull/251), head `371cd375`
([run 35268575872](https://github.com/ravichavali/karmyq/actions/runs/35268575872)). **20 checks pass, 1 skipping**
(Deploy to Demo, skipped on PRs). Confirmed from job logs, not ticks:

- **Strict lock acceptance on Linux:** `npm ci` → `added 1703 packages, and audited 1722 packages in 26s`, no npm error.
  The hand-spliced lockfile is accepted on a clean Linux install, not just on this Windows box.
- **The gate runs and passes in CI:** `PASS regression/sprint-131-workspace-declarations.test.ts (20.859 s)`; root regression
  totals 37 suites / 343 tests. No reference to the deleted messaging gate anywhere in the run.
- **Lint & Type Check**, **Integration Tests**, **Test Frontend**, **Test Auth Service**, **Test Docker Build** — all pass.
- **Images build against the changed manifests:** all 7 `Build Docker Images` jobs pass (auth-service `DONE`, no npm error),
  plus Build Landing Page. This is the real proof that `--omit=dev` images still resolve every runtime declaration.
- **Security Audit (ADR-059)** and **Code Scanning Gate (ADR-060)** pass; **CodeQL** pass; **pr-contract** pass. No new
  advisory, as expected — no resolved version changed.

**Next: merge authorization.** Per CLAUDE.md the agent cannot self-merge; ask the maintainer, confirm no master deploy is in
flight, then `gh pr merge 251 --squash --admin`, watch the master run through Deploy to Demo, smoke
`POST https://karmyq.com/api/auth/login`, and update this handoff. After that: **B3** (Expo drift #248 — re-run
`npx expo install --check` first), then **D1**.

PR B2 execution, 2026-09-17 (Claude, `superpowers:executing-plans`; 8 commits, `0edd49ad`…`98c911b0`, base `d2edb286`):

- **Gate red then green.** Red at the planned counts exactly: 2 failed / 6 passed, **95 runtime + 94 dev** violations, with
  `simulation-service: bcryptjs` correctly in the runtime list and no `@/` alias leaking. After the 8 services: **3 runtime / 14 dev**.
  After shared/frontend/tests: **8/8 green**. Final gate is **10/10** (two checks added mid-PR, below).
- **Every assertion proven able to fail.** 12 injections, each reverted: runtime scope, type-query, dev scope, devDep≠runtime,
  range, stale allowlist, discovery, root-bump stranding, realistic de-hoist, stale divergence allowlist, lock/manifest drift,
  and a service satisfying a runtime import with a peer.
- **Lockfile.** 1845 nodes before and after; **0 added, 0 removed, 0 version/resolved/integrity changes**; every host
  `registry.npmjs.org`. Diff confined to the 11 workspace nodes. Strict `npx -y npm@11.19.0 ci` **exit 0 twice**, lock untouched
  both times. `npm ls --all` dependency problems **unchanged** from the BUG-047 baseline (3 invalid + 1 missing).
- **Turbo** now orders `@karmyq/tests#build <- ["@karmyq/shared#build"]` (was `[]`).
- **Full suite** `npm test -- --concurrency=1 --force`: **exit 0, 27/27 tasks**. Landing churn was timestamp/HEAD-sha only
  (verified by normalizing before discarding) and was reverted; only content JSONs committed. No promoter moves.

**Mid-PR correction (process review, and the most important thing in this PR).** The first draft claimed range satisfaction
would force a D-series root bump. It does not: when a root bump strands a workspace range, npm nests a satisfying older copy,
so the check reads the nested node and stays green. The repo already held the counterexample — root hoists
`express-rate-limit@8.5.2` while `packages/shared` and `services/geocoding-service` run a nested `7.5.1`, gate green. A second
check was added (root's **hoisted** version must satisfy every range a workspace declares) with a 3-entry
`DIVERGENCE_ALLOWLIST` and a stale-entry test. Proven by injection: with `dotenv@17.4.2` hoisted and `16.6.1` nested under all
nine declarers, **the satisfaction check stays green and only the new check goes red**. All nine doc sites were corrected.

**SDLC gates (all four, calibrated high):**

- **`/simplify`** (4 agents): found the root cause — `scripts/update-service-deps.js` deleted a hardcoded `HOISTED_DEPS` list
  from every service manifest, i.e. the machine that produced BUG-046. Deleted (nothing invoked it). Gate cleanups: 30
  `git ls-files` spawns → 1 (~1.2s, independently verified to select the same 987 files), visitor simplified, diagnostic
  mirror-drift message, two corrected comments. Three deeper findings **deferred with reasons** to `docs/IDEAS.md` [2026-09-17]:
  `scripts/` is outside root `workspaces` so the gate cannot see it; the three dead `packages/shared/api/` files whose deletion
  would remove the `ALLOWLIST`; and root's now-mostly-importer-free `dependencies` block. Each breaks a B2 invariant.
- **`/code-review high`**: 6 findings. Fixed 2 in the gate — a `peerDependency` no longer satisfies runtime for a service or app
  (with `legacy-peer-deps=true` npm installs no peer, so that was BUG-046 again; peers count only for `packages/*`), and
  `DEV_ONLY` widened to the 7 build-tooling configs. 2 were the version bump and stale handoff, both fixed here. 2 are recorded
  in the gate header as deliberate limits (type-only imports count as runtime; only static specifiers are seen).
- **`/security-review`**: **0 findings**, independently re-verified (no new lock nodes or artifacts, `@karmyq/shared "*"`
  resolves to the local `link: true` workspace and is `private`, the gate only parses and never evaluates scanned content,
  `tracked()` uses `execFileSync` with no attacker-influenceable argument).
- **Version**: `origin/master` `d2edb286` = 11.57.0 → root `package.json` **11.58.0**. The lockfile's root `version` is stale at
  11.52.0 repo-wide and was deliberately not touched (PR B set the same precedent).


PR B2 plan review round 3, 2026-09-17 (reviewer; one P2 finding, CONFIRMED and fixed):

- **Type queries bypassed the walker.** `ts.isImportTypeNode` was unhandled, so `type T = import('pkg').X`,
  `typeof import('pkg')` and a type query nested in a generic all returned nothing (reproduced). The gate now handles
  it, with three added regression cases. Repo impact today is nil — no tracked file uses a type-position `import()` —
  so the counts are unchanged: **95 runtime / 94 dev** red, **2 failed / 6 passed of 8**. Injecting
  `type Leak = import("left-pad").Foo;` into messaging `src/index.ts` now yields exactly
  `services/messaging-service: left-pad (src/index.ts)`; reverted.
- Reviewer re-verified the plan end to end: 95/94 before declarations, 8/8 after (in memory), template-require injection
  fails correctly, and the normalized `npm ls` comparison keeps new dependency problems while ignoring log timestamps.
- Cleanup applied: stale `7/7` in a commit template, and two descriptions still crediting the pre-processor.
- **Counts note:** the three type-query cases joined the existing import-forms test, so the suite is still **8 tests**.

PR B2 plan review round 2, 2026-09-17 (reviewer; two P2 findings, both CONFIRMED and fixed):

- **Scanner could miss imports.** `ts.preProcessFile` returns `[]` for `require()` inside a template interpolation
  (reproduced). Repo-wide impact today is nil — only 4 missed literals, all aliases, relative paths or builtins — but the
  gate is now a real AST walk (`ts.createSourceFile` + `forEachChild`), a strict superset over this repo (1021 files,
  ~1.4s). Added a regression test with 10 import forms, including the template and JSX cases and two negatives.
  Re-ran the gate: **2 failed / 6 passed**, still 95 runtime / 94 dev; the template-require injection is now caught.
- **`npm ls` comparison was self-inconsistent.** Two consecutive runs on the unchanged tree differed only in the
  timestamped `…-debug-0.log` path. The plan now compares normalized dependency problems
  (`code|invalid|missing|extraneous|peer dep`). Also corrected: the BUG-047 baseline is **not** picomatch alone — it is
  3 `invalid` (picomatch, color-string, ms) + 1 `missing` (@react-native/metro-config, required by react-native-worklets).
- Reviewer confirmed the planned declarations clear the scanner's violations in memory; strict install is still unverified.

PR B2 plan review, 2026-09-17 (non-author reviewer; no branch edits):

- Verdict: **approve with minor corrections**. Independently verified root ranges and all 13 lock resolutions, shared's import
  sites (publisher.ts:10, auth.ts:103, type-only `Pool` at dbContext.ts:2), `legacy-peer-deps`, discovery anchors, splice
  arithmetic (42 + 7 declarations), subsumption of the messaging gate, base `d2edb286`. Did not re-run the red gate.
- Applied (Claude, each re-measured first): (1) drift count: "eleven" is correct on the basis deps+devDeps vs root
  deps+devDeps; twelve counting shared's `peerDependencies.express`. Basis now stated. (2) shared's tsconfig excludes
  **three** `api/` files (`tsconfig.json:25-27`), two allowlisted; fixed in scope section, commit text and CONTEXT template.
  (3) testing-guide section now says the range check covers every existing declaration. (4) `pg` peer covers the runtime
  package only; `Pool` types come from `@types/pg`. Stated in scope section and shared CONTEXT template.
- **Next:** execute the plan in a fresh chat from Task 1.

PR B merge, deploy and smoke, 2026-09-17 (Claude; focused plan Task 7 Step 7):

- Before merge: no master run in flight, `origin/master` `d35a3fad`, #250 the only open non-Dependabot PR; checks 20 pass /
  1 skipping on head `7cbad640`. Maintainer: "I authorize merge". `gh pr merge 250 --squash --admin` → MERGED `d2edb286`.
- [CI/CD run 35224474048](https://github.com/ravichavali/karmyq/actions/runs/35224474048): conclusion **success**, every job
  success including Code Scanning Gate and **Deploy to Demo** ("All critical services healthy", `DEPLOYMENT SUCCESSFUL`,
  no rollback); post-deploy health step: all 9 services healthy.
- Smoke (Node fetch, Windows): `POST https://karmyq.com/api/auth/login` as maria.reyes → 200; `GET /api/conversations`
  with that token → **200, success true**, 0 conversations (route/auth path proven; no conversation data exercised).
  No demo data read or modified beyond the member's own session.

PR B Task 7 gates and close-out, 2026-09-16 (Claude, executing-plans):

- `/simplify`: committed `ace904bd`; its altitude finding (maintainer-approved) replaced the polling script with compose
  healthchecks + `up --wait` (`ae2024a7`).
- `/code-review high`: one finding (in-container healthchecks can't see a broken `ports:` mapping) fixed in `4f5591b8`
  (runner-side curls after the wait; gate 8/8 with both breakage proofs). Re-run on the final diff: **0 findings**.
- `/security-review`: **0 findings** (no new triggers/untrusted expressions in workflows; no `ports:` change; `$(hostname)`
  not attacker-controlled; the eight messaging declarations already resolve from registry.npmjs.org in the lock, no new nodes).
- Full `npm test -- --concurrency=1 --force`: **exit 0, Tasks 27/27**; `karmyq-messaging-service:test` ran
  `tests/regression/messageService.test.ts` — **6 passed / 6**. No promoter moves. Landing churn was timestamp/sha only
  (`architecture.json` generated time, `build.json` sha/dates) and was reverted.
- `npm run type-check --workspace=services/messaging-service`: exit 0.
- Version: `origin/master` `d35a3fad` = 11.56.0 → root `package.json` **11.57.0**.
- Pushed `ead6d983` (pre-push hook ran, 128s, exit 0); opened [#250](https://github.com/ravichavali/karmyq/pull/250).
  All checks pass on that head (Deploy to Demo skipped on PR). Confirmed from logs, not ticks:
  - [CI run 35186279944](https://github.com/ravichavali/karmyq/actions/runs/35186279944) Test Backend Services:
    `PASS messaging-service tests/regression/messageService.test.ts`, **6 passed / 6**.
  - [Tests run 35186279956](https://github.com/ravichavali/karmyq/actions/runs/35186279956) Test Docker Build, **run attempt 1**:
    `up -d --wait --wait-timeout 300 auth-service frontend` → frontend Healthy 05:38:13Z, auth-service Healthy 05:38:17Z;
    "Check published ports from the runner" (curl :3001/health, :3000/) succeeded, no `##[error]`.
  - Integration Tests: the wait on the 8 healthchecked test services reached request-service Healthy 05:42:21Z;
    integration tests ran and the job passed. No `##[error]` in either Docker job.

PR B plan review, 2026-09-16 (Kimi, reviewer role; no branch edits):

- Verdict: approve with two minor corrections. It fact-checked the plan's load-bearing claims
  (messageService SQL/params, the 8-line lock splice, root range overlap, Sprint 122 gate lines,
  test.yml docker-build lines 108-139, compose 127.0.0.1 ports, BUGS.md:560/615).
- Applied: (1) swapped `scripts/generate-docs.ts` citation (`GUIDE_ORDER` is :315, service CONTEXT read is :120);
  (2) the runtime declarations are no longer attributed to BUG-034, whose report covers only zero tests.
  They are labelled Sprint 131 PR B spec scope in the test, the commit and the close-out.
- Also applied (Claude, not raised by either reviewer): Task 1 timing tests hardened for Turbo
  parallel load in CI. Non-hang cases use a 5000ms timeout; the hang case keeps a 1000ms floor with no
  ceiling and asserts at least one hit rather than an exact count.

PR A merge, deploy and live check, 2026-09-16 (Claude; focused plan Task 3 Step 7):

- `gh pr view 249`: state MERGED, merge commit `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd`,
  mergedAt 2026-09-16T18:30:39Z. `origin/master` `package.json` = 11.56.0.
- [CI/CD run 35134858026](https://github.com/ravichavali/karmyq/actions/runs/35134858026) on
  `d35a3fad`: completed / **success**; all 14 jobs success, including Code Scanning Gate (ADR-060)
  and **Deploy to Demo**. Deploy log: `DEPLOYMENT SUCCESSFUL`, "All critical services healthy",
  no rollback; post-deploy health step reported all 9 services healthy (3001–3006, 3008–3010).
  Observed in the same log: demo root filesystem **88.2% of 44.07GB** used, and "System restart
  required" — not acted on; worth watching before the D-series image builds.
- Live, Playwright at 1440×900, logged in as `maria.reyes@test.karmyq.com` via `POST /api/auth/login`,
  `/communities/7f48de77-e6cc-5eba-819b-cb6f50d3c662` (title "Portland Mutual Aid Network"):
  `GET …/config` → **404** (the community still has no config row, so the fixture still proves the
  absence case); norms/settings/curated/pulse → 200. Console (debug level): 4 messages, 1 error —
  the browser's own `Failed to load resource … 404 … /config`. **No `Failed to load configuration`
  entry.** Because the 404 still occurs, the missing log proves the deployed bundle is the new code.
  The page rendered normally (headings: community name, "This week in the neighbourhood", "Ways
  neighbours can help here", "No open requests right now"); snapshot contained no error text.
  No demo data was read or modified outside the member's own UI session.

Codex review, 2026-09-16, PR [#249](https://github.com/ravichavali/karmyq/pull/249), head `de7aacc35f2e0640181d80d43bf6ed695454c17c`:

- No actionable correctness or security findings in PR A. Checked the hook, config route,
  interceptor, config consumers, five-case regression, documentation and focused plan.
- Fresh frontend Jest unit + regression run: **42 suites / 405 tests passed**, exit 0.
  Separate uncached BUG-045 regression run: **5 tests passed**, exit 0. That run emitted a
  nonblocking duplicate-package warning from the existing `.next/standalone` build output.
- Frontend `tsc --noEmit --incremental false`: exit 0. Branch whitespace check passed;
  scoped gotcha check found none. Application files remained unchanged during review.
- Live PR checks passed on the reviewed head; deployment is skipped on the PR run.
  GitHub reports `REVIEW_REQUIRED`, with no submitted reviews; master protection requires one
  approving review. This local assessment does not satisfy that GitHub gate.
- At review time, `gh pr list`, PR state and local git log showed #249 open and `origin/master`
  at `9fae79f4`. **Superseded:** #249 merged afterwards as `d35a3fad` with no submitted GitHub
  review (merge under maintainer authorization), then deployed — see *PR A merge, deploy and live check*.

PR A execution, 2026-09-16 (Claude, superpowers:subagent-driven-development then executing-plans):

- TDD red against the unchanged hook: `tests/tdd/sprint-131-community-config-empty-state.test.tsx`
  discovered (1 path); **2 failed / 3 passed** — "treats an expected 404…" failed on
  `consoleError` not-called, "clears a previously loaded config…" failed on `config` toBeNull.
  Green after the `fetchConfig` 404 branch: **5 passed**. Moved by hand to `tests/regression/`;
  listing names the regression path; frontend `test:regression` 37 suites / 343 tests.
- Drift gate 41/41; staged `feedback:check` clean; scoped gotcha check: none; process-reviewer PASS;
  task review spec ✅ / quality Approved. Doc coverage: no guide, onboarding, landing, registry or
  ADR change needed (no endpoint/schema/event/dependency change).
- Gates on the branch diff: `/simplify` (4 angles) — one minor (inert mock entries in the test,
  plan-mandated) left as-is; `/code-review medium` 0 findings (noted: a proxy-level 404 would also
  be silenced — misconfiguration only); `/security-review` 0 findings (404 is only the no-row path;
  401/403 untouched; `config` consumers are display-only).
- Frontend `npx tsc --noEmit` exit 0. Pre-push hook ran the suite on push (exit 0, ~79s).
- Full `npm test -- --concurrency=1` exit 0 twice (26/26 Turbo tasks; frontend a cache miss on
  the first run); git status identical before/after — no promoter moves, no landing churn.
- Version: `origin/master` still `9fae79f4` at 11.55.0 → root `package.json` 11.56.0. The lockfile's
  root `version` field (11.52.0) was already stale and is left untouched (dependency-lane rules).

Plan review, 2026-09-16:

- Reviewed focused plan commit `e2c03a56`; prior sprint planning is committed as `b47c0fe6`.
  Extracted its literal five-case test into a temporary review file and ran it against the unchanged
  hook: 2 failed / 3 passed. The initial 404 case fails on logging; the stale-config case first
  fails on `config` still holding the old object. Corrected the plan's assertion-level red expectations.
- Reproduced `git mv` rejecting that untracked test. The plan now uses a checked filesystem move;
  the temporary review test was removed. No application implementation was made.
- Corrected pre-commit sequencing, restoration of unintended promotions, attribution, and handoff
  ordering. A remains the next task until review, merge, deployment and health verification finish;
  no future PR number or verification date is invented. BUG-045 retains its caller-only boundary.
- Live `gh pr list` / `git log origin/master` reconciliation: master remains `9fae79f4`, no Sprint 131
  implementation PR exists. #227 and #229 are closed; current zod/next proposals are #247/#246.
  #224/#225/#226/#228/#230 remain open. New #243–#245 proposals are outside the approved sprint
  scope pending triage; their existence does not transfer the Codex dependency lane. D plans must
  refresh proposal IDs before execution; the sprint tables retain their dated baseline IDs.
- Corrected-plan verification passed: local links, temporary-probe cleanup and staged whitespace;
  required process review and `feedback:check`; full `npm test -- --concurrency=1` exited 0
  (26/26 Turbo tasks successful, 25 cached; fresh tests-workspace run: 41 suites / 908 tests).
  Existing worker-teardown warning was nonblocking. No generated changes or promotions occurred.

Observed 2026-09-15:

- GitHub [#242](https://github.com/ravichavali/karmyq/pull/242): merged as `9fae79f4`.
  [CI run 35029504300](https://github.com/ravichavali/karmyq/actions/runs/35029504300):
  success, including **Deploy to Demo**. Open code-scanning alerts = 0; open Dependabot security
  alerts = 0; #239 closed. Seven major dependency PRs #224–#230 remain open.
- `git diff HEAD origin/master --stat` was empty before the branch switch; the staged rename and
  planning files survived intact. New branch base is `9fae79f4`.
- Root Jest probe for `tests/regression/sprint-122-tier-parity.test.ts`: discovery `[]`;
  actual run exits 1 with “No tests found”. Running discovery from `tests/` finds exactly that file.
- Read-only frontend TDD inventory: 76 files, 74 .tsx + 2 .ts. No bulk test promotion performed.
- Scoped gotcha check for the planning/handoff files: no scoped gotchas.
- Document checks passed: local links resolve, all 13 critical notes match across spec/plan/handoff,
  task numbering is consistent, and `git diff --cached --check` passes.
- Required process review and `npm run feedback:check` passed. Full `npm test -- --concurrency=1`
  exited 0: Turbo 26/26 tasks successful (25 cached). Fresh tests-workspace execution passed
  10 unit suites / 101 tests and 31 regression suites / 807 tests. Other task results were cached.
  A nonblocking Jest worker-teardown warning remained; no test-generated file changes or promotions occurred.
- The initial sandbox run failed on Git ownership, shell and network restrictions. The successful
  run used elevation and a process-local PATH with Git `usr/bin` before Git `bin`, preserving shell
  fixture stubs. No global Git configuration, test code or application behavior changed.

## Persistent obligations

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- No docs-only master push; preserve the Sprint 130 archive in PR A.
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization, and none are planned here.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## Critical Implementation Notes

1. Planning and PR A lived on `agent/codex/sprint-131-maintenance` (merged as #249), created from `origin/master` before committing the carried WIP and Sprint 130 archive. Never commit Sprint 131 work on the merged Sprint 130 branch.
2. Codex held the implementation dependency/lockfile lane by the maintainer's 2026-09-15 decision, including messaging declarations. **Amended 2026-09-16:** Claude holds it now; executing a plan transfers the lane to the executor; reviewing does not (maintainer). The spec and sprint plan keep the original wording as history.
3. BUG-033 rollout approval is **deferred**. Inventory is read-only. Do not enable the wider matcher, run a mass promotion, or merge PR C before the maintainer approves the freshly measured promotion set.
4. Root `package.json:17` runs the promoter as `posttest`. A matcher-only change can therefore trigger mass moves through `npm test`; a separate commit alone does not isolate rollout.
5. Root regression commands must use the tests workspace: `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`. Prove discovery and an assertion failure; a configuration error or zero-test exit is not TDD red.
6. Messaging tests run explicitly in `tests/tdd/` before promotion. Verify at least the four specified cases executed, then move them to `regression/` and prove the blocking command discovers the file.
7. BUG-045 acceptance is no application `Failed to load configuration` log for HTTP 404, with `config === null`. The browser may still report the preserved HTTP 404; do not claim a silent Network/Console panel.
8. Do not edit `apps/frontend/src/lib/api.ts` or change the config endpoint's 404 contract. Keep non-404 failures observable.
9. Fix messaging's undeclared runtime imports before D1. All manifest edits include a surgical lockfile update and strict `npx -y npm@11.19.0 ci`; never workspace install, dedupe, or scratch lockfile regeneration.
10. A and B precede D1-D7. PR C is independent and can ship after its approval; it does not block the major upgrades. There are nine planned deploys plus one conditional promoter deploy. No numeric release slots are reserved: derive each version from current `origin/master` at merge time.
11. Every PR runs tests, `/simplify`, `/code-review`, and `/security-review`, then waits for explicit maintainer merge authorization and the preceding deploy's health verification.
12. Expo workflow reporting is deferred outside Sprint 131. Its existing report/close outputs are mutually exclusive; the follow-up concerns failures before outputs are produced. Do not reopen the resolved BUG-035.
13. Use the machine's shell correctly. On this Windows checkout use Node for JSON/HTTP probes, preserve exit codes, and keep every test command anchored to its workspace.
