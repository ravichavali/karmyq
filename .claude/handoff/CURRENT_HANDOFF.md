# Sprint 124 — PLANNING (not yet scoped)

> ## State as of 2026-08-10
>
> **Sprint 123 is SHIPPED, DEPLOYED and ARCHIVED at v11.43.0** (`9dd080af`). Working tree is clean,
> `master` is deployed and healthy, and there is **no work in flight**. This file exists to carry
> the debt forward and to name the one dated obligation below; the sprint itself is **not scoped
> yet** — run the `sprint-planning` skill in a fresh chat to do that.
>
> Branch: `docs/sprint-124-planning`, cut from `origin/master` `9dd080af`.

---

## ⏰ THE DATED ONE — read this first

**The `image-size` audit exemption expires `2026-08-17`.** On that date
`scripts/audit-exemptions.js` starts failing, which fails `Security Audit` **and**
`tests/regression/sprint-75-security-gate.test.ts`, which blocks **every PR and every push**.

That is the mechanism working as designed — an exemption buys review time, never permanence — but
it means **Sprint 124 has a deadline whether or not anyone plans one.** On or before 2026-08-17,
someone must do one of:

1. **Remove it** — if `image-size` has shipped a fix. Check `npm view image-size version`; anything
   **> 2.0.2** clears the advisory range `<=2.0.2`. Note the gate *already* fails on an exemption
   that matches nothing, so a fixed upstream breaks the build until the entry is deleted. That is
   intentional.
2. **Renew it** — a *fresh* decision with a new `created`/`expires` pair (≤ 7 days) and a rationale
   that says what changed. Renewing by reflex is the failure mode the expiry exists to prevent.
3. **Remove the need** — `metro` is the only consumer; `apps/mobile` is not deployed.

**Do not** widen the exemption, drop the gate to `critical`, or `--no-verify` past it.

Registry: `security/audit-exemptions.json` · evaluator: `scripts/audit-exemptions.js` ·
proofs: `tests/regression/sprint-123-audit-exemption-gate.test.ts` (36 tests, almost all asserting
refusals) · decision: **ADR-059 amendment**.

---

## Carried debt (none of it blocking, all of it real)

| Item | Detail |
|---|---|
| **ADR-092 / ADR-093 → `Implemented`** | Both are still `Accepted`. They shipped in #198, so flip them **on Sprint 124's PR** — never a docs-only master push |
| **BUG-035** | The `Expo SDK drift` workflow is permanently red with no exemption mechanism, refiles issue **#196** on every run, and buries 5 genuine Expo patch releases. `validateRegistry()` in `scripts/audit-exemptions.js` was written audit-independent **specifically so this can reuse it** — schema + expiry rules, no audit coupling. That reuse is asserted, **not yet demonstrated** |
| **`redisClient.publish` UNPROVEN** | Needs a seeded conversation; `maria.reyes@` has zero. Targeted at S125 |
| **`mark-read` has no implementation** | `markMessagesAsRead` exists in `messageService.ts`, is imported by `messageHandler.ts`, and is never called — nothing transitions a message to `'read'` |
| **`README.md:2` version badge** | Hardcoded `version-10.11.0`. The drift gate only guards CLAUDE.md's version line |
| **ADR-028's Dockerfile template** | Still shows `node:18-alpine`; the runtime-floor gate will fail any new service that copies it |
| **`@types/node` floor** | `messaging-service` declares `^20.10.5` against a Node 24 runtime |
| **Claim-scan precision trade** | Two paths allowlisted where *"Internal use only"* annotates endpoint visibility, not a license (`notification-service` `CONTEXT.md`, `routes/push.ts`). A real claim added to those two files would be missed |
| **Open Dependabot PRs** | **#199** production-deps group (11 updates) and **#200** dev-deps group (9 updates), both regenerated on 2026-08-10. Neither triaged. ⚠️ These were #190/#197 hours earlier — **the numbers churn every regeneration; match on what a PR bumps** |

---

## Candidate scopes for Sprint 124

Not decided — the planning chat picks. In rough order of how well-evidenced they are:

1. **The platform-floor arc**, already unblocked by ADR-090's Node 24 floor, in dependency order:
   **`@types/node` 26 → TypeScript 7 → ESLint 10**. Previously closed with written rationale and
   no ignore rule, precisely so it could be taken deliberately.
2. **BUG-035** — give the Expo drift workflow the exemption/expiry mechanism it needs, reusing
   `validateRegistry()`. This also *proves* the reuse claim above rather than asserting it.
3. **Manifesto-alignment arc, step 2** — S123 was step 1 of four. See
   `docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`.

---

## Quick Start

1. Fresh chat, run the **`sprint-planning`** skill.
2. Branch off **`origin/master`** (`9dd080af`) — never local master.
3. **Check the image-size expiry first** (above). If planning lands after 2026-08-17, it is not a
   carried item, it is the first task.
4. Re-list Dependabot PRs (`gh pr list`) — **numbers churn; match on what a PR bumps**, never the
   number.

---

## Standing mechanics (carried forward, unchanged)

- **Branch off `origin/master`, never local master.** Never force-push; never direct-push to master.
- **Every merge needs EXPLICIT authorization**, every time. The Bash `gh pr merge` form is blocked
  by the permission classifier — use the GitHub MCP `merge_pull_request` tool.
- **No docs-only master pushes** — every master push is a full deploy → demo 502s. This is why this
  file was reconciled here rather than on `master`.
- **Land the handoff BEFORE requesting merge authorization**, or put it on the follow-up branch. A
  handoff pushed after the merge lands is stranded on a closed branch — that happened on #194.
- Surgical in-place lockfile edits only; never `npm dedupe`, never a scratch regen on Windows.
  **Assert the resolved version after every command** — npm prints "up to date" while leaving a
  vulnerable pin in place, and an open-ended override range (`>=x`) will happily cross a major.
- **`npm test` under Turbo is red on this Windows box** with `Exceeded timeout of 5000 ms` on
  suites taking 230–285 s. Confirm any suspect workspace by running it directly before believing it.
  Never `| tail` the run — it masks the exit code.
- **`curl` and `jq` are unusable here** (`curl` returns 000 with a libcurl error even against
  api.github.com). Use `node -e` with `fetch`.
- **Check `#!/bin/sh` scripts with `dash -n` and run them under real `dash`.** `[[ ]]` is *"not
  found"* there, and inside an `if` that is not fatal even under `set -e` — it silently takes the
  else branch. That shipped a bug that tests could not see.
- **CodeQL: remove the sink, don't guard it.** A resolve-plus-prefix-check on an env-provided path
  was rejected; an allowlist of constant paths keyed by the env var cleared it.
