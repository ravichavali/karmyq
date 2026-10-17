# Sprint 133 — Skills Depth — Handoff

**Date**: 2026-10-17 (**PR V SHIPPED and LIVE**, v11.89.0; **PR D next**)
**PR V SHIPPED (2026-10-17).** The maintainer authorized the admin merge ("Approve admin merge"). Claude merged
[#306](https://github.com/ravichavali/karmyq/pull/306) as `05d29d28` with `gh pr merge --squash --admin` (CI green on `f03550fe`,
version 11.89.0). [CI/CD 38985813305](https://github.com/ravichavali/karmyq/actions/runs/38985813305) passed on attempt 1: tests,
Integration Tests, Code Scanning Gate (no CodeQL re-raise; `api.ts` untouched), Security Audit, all images, Deploy to Demo:
DEPLOYMENT SUCCESSFUL, all services healthy, no rollback. **BUG-065 met its 2026-10-17 deadline; no risk acceptance was needed.**
**Read-only smoke as maria.reyes: 15/15 PASS**, plus a non-vacuous member control. Across the 6 communities takeshi.osei6315
is in and maria is not, takeshi lists 993 community-scope asks and maria lists 0. A member community lists rows. Pulse and
community-health are 403 for a non-member and 200 for a member, and a malformed id is 403. **Not smoke-covered live:** the
demo has **no standing offers**, so BUG-064 rests on CI's real-SQL test until PR D seeds some. This doc flip rides the new PR D
branch `agent/claude/sprint-133-pr-d-curated-seed`, cut from `05d29d28` (no docs-only master push).
**Old PR D branch** `agent/claude/sprint-133-pr-d-demo-seed`: its only commit `d5276e2c` is fully on master (checked 2026-10-17:
of its files, only the handoff and BUGS.md differ, and PR V's later edits supersede both). It is not reused, because re-cutting
the same name would need a force-push. The maintainer may delete it.
**PR V follow-ups (logged in #306, unassigned):** request owner-write 403/404 oracle; the detail route moved onto
`requestReadableSql`; one `isActiveMember` (two helpers, opposite argument order); list query performance (CTE +
`matches(request_id, responder_id)` index, which needs a migration); retire or honor `help_offers.is_public`; BUG-069.

**PR V CODEX REVIEW (2026-10-16, `8ddefbf2`): no blocking code findings.** Checked the list/detail boundary,
SQL parameter binding, private own-list branch, all five live-membership gates, offer reads and owner-write lookups.
The documented rulings are acceptable within this plan's scope. In particular, the detail route still combines the
boundary in JS (`services/request-service/src/routes/requests.ts:1674`); it does not call `requestReadableSql`.
The real-database parity matrix guards that duplication. Request owner-write oracles, the two membership-helper
signatures, query performance, inert offer privacy fields, and BUG-069 remain the PR's documented follow-ups.
The previously supplied `/security-review` reported no findings; this review does not replace it.

**Live evidence (2026-10-16):** [#306](https://github.com/ravichavali/karmyq/pull/306) is open, draft and mergeable,
published/local head `8ddefbf2`, base `36a9972f`. Its [Validation ledger](https://github.com/ravichavali/karmyq/pull/306)
has been refreshed. Tests, PR Contract and [CI/CD 38977111975](https://github.com/ravichavali/karmyq/actions/runs/38977111975)
are successful on that head. Integration job `117230250413` logs a PASS for
`sprint-133-pr-v-read-boundary.integration.test.ts` and 164/164 integration tests. Deploy is skipped for the PR.
Fresh Codex local checks on `8ddefbf2`: request-service `tsc --noEmit` exit 0; direct Jest unit/regression exit 0,
61 suites / 568 pass / 1 skip. The local root-regression rerun was not completed: its first attempt selected WSL
and hit sandbox Git ownership failures; the Git-Bash-PATH retry was stopped without a final result. No fresh local
root/full-suite pass is asserted; use the CI evidence and author ledger above. The doc/context drift gate was
run separately with this handoff update: 41/41 pass, exit 0. `git diff --check` passed; only this handoff changed.

**MERGE AUTHORIZED (2026-10-16):** the maintainer approved the admin merge of #306 ("Approve admin merge"). Claude
re-read master (`36a9972f`, 11.88.0), stamped **11.89.0** (root `package.json` + the lockfile's two root entries, nothing
else), committed this handoff with it, and merges with `gh pr merge 306 --squash --admin` once CI is green on that head.
**After merge:** wait for deploy + health verify, read-only smoke as maria.reyes (plan V11), then on the re-cut PR D
branch: BUG-064/065 merge SHA, handoff → PR V shipped, PR D next. If the merge or deploy did not happen, check
`gh pr view 306` and the master CI/CD run before acting on this line.

**Merge preparation (history; superseded by the line above):** live master remains `36a9972f`, v11.88.0; its latest deploy
[38948723833](https://github.com/ravichavali/karmyq/actions/runs/38948723833) is successful, and #306 is the only open PR.
Claude should re-read master, stamp root `package.json` and the lockfile's root versions to 11.89.0 if still next,
commit this reconciled handoff with the version preparation, push through normal checks, and wait for CI on the new
head. Then mark #306 ready and ask the maintainer "admin merge, yes/no?". **This review supplies no admin merge
authorization.** BUG-065 is due 2026-10-17; Task V0's proposed risk acceptance applies if it is not merged by then.
After merge, wait for deploy/health verification and perform V11's read-only smoke before PR D.

**Dependabot checked (2026-10-16):** the two open high alerts are
[#168 node-forge](https://github.com/ravichavali/karmyq/security/dependabot/168) (`GHSA-86w9-cpqp-85rv`) and
[#169 braces](https://github.com/ravichavali/karmyq/security/dependabot/169) (`GHSA-vfj7-8cjw-p6xm`). Both match
`security/audit-exemptions.json:5-22`, expiring 2026-10-21. Upstream fix availability was not rechecked this session;
the existing pre-expiry recheck obligation remains. No dependency changes or exemption renewal were made.
Claude retains branch ownership; this Codex follow-up changes only this handoff and leaves it for Claude to commit.

**PR V SCOPE (2026-10-16 planning chat).** The maintainer chose to bundle the open request-service visibility bugs into one
PR **before PR D**: BUG-065 (list = detail boundary, one SQL fragment) and BUG-064 (offers: owner + live members). The planning
inventory added four claim-gated community reads (`routes/requests.ts:1336,1422,1467,1553`), fixed in the same PR under BUG-065.
**BUG-068 is out:** its route has no client (the web app rates through reputation-service `/reputation/feedback`), so the
maintainer chose to **retire it in the ADR-101 legacy-handler removal PR**, before 2026-10-29. New **BUG-069** logged
(admin writes trust the JWT claim; 5 services; unassigned). Plan:
[`docs/superpowers/plans/2026-10-16-sprint-133-pr-v-visibility.md`](../../docs/superpowers/plans/2026-10-16-sprint-133-pr-v-visibility.md).
Branch `agent/claude/sprint-133-pr-v-visibility` (cut from `d5276e2c`, i.e. `origin/master` `36a9972f` + the PR Q doc flips;
it now carries this handoff). **BUG-065's deadline is 2026-10-17:** if PR V isn't merged by then, Task V0 proposes a dated
risk acceptance (to 2026-10-20) for the maintainer to sign.
**The old PR D branch** `agent/claude/sprint-133-pr-d-demo-seed` holds only `d5276e2c`, which PR V now contains. After PR V
merges, re-cut PR D from the new `origin/master` and delete the old branch only after `git diff origin/master
origin/agent/claude/sprint-133-pr-d-demo-seed` shows nothing beyond what PR V carried.
**PR Q SHIPPED (2026-10-16).** Branch protection requires one approving GitHub review, so the agent merge was blocked (auto-merge is disabled
for this repo), and the maintainer merged [#305](https://github.com/ravichavali/karmyq/pull/305) as `36a9972f` (v11.88.0) at 18:37 UTC.
[CI/CD 38948723833](https://github.com/ravichavali/karmyq/actions/runs/38948723833) passed on attempt 1: tests, Integration Tests, Code Scanning Gate (no
CodeQL re-raise), Security Audit, all images, Deploy to Demo: DEPLOYMENT SUCCESSFUL, all 9 services healthy, no rollback. **Post-deploy doc
flips (ADR-101 -> Implemented; BUG-060/066/067 -> fixed in v11.88.0) are committed on the PR D branch** `agent/claude/sprint-133-pr-d-demo-seed`
(cut from `origin/master` `36a9972f`), which now carries this handoff (no docs-only master push).
**Still owed for PR Q:** (1) a read-only demo check that `bull:karmyq-events:wait` and `:delayed` drain, and that each
`karmyq-events-<consumer>` queue has a worker only from its own container. It runs on the shared demo server, so **ask first** and name this lane.
(2) Once (1) shows the legacy queue empty, the legacy-handler removal follow-up in `docs/IDEAS.md`.
(3) No live event round trip was run: that is a demo write and needs per-operation authorization.
**Merge preparation (2026-10-15, history):** the maintainer gave explicit merge authorization; version stamped 11.88.0 from `aded1986`; deferred-review
reasons copied into the PR description (Codex follow-up).
**Codex review (2026-10-15):** no blocking code findings; ready for version stamping, then explicit maintainer merge authorization.
Fresh local verification on `32cad5a5`: shared events 21 pass; notification unit/regression 110 pass; reputation unit/regression
298 pass + 3 todo; cleanup unit/regression 42 pass + 7 existing skips; routing + docs drift gates 50 pass. Commands used the
workspace's Jest binary directly (`--runInBand`; services selected with `--testPathPatterns 'tests/(unit|regression)'`).
`tsc --noEmit -p <workspace>/tsconfig.json` passed for shared, notification, reputation and cleanup. No full local suite or
local container integration rerun: live GitHub CI and the integration job log were checked for this head via the connector
(shell GitHub access was network-blocked). [CI run 38801559625](https://github.com/ravichavali/karmyq/actions/runs/38801559625)
passed; integration logged 80/80 completed, zero failed attempts, 155/155 tests. GitHub confirms #305 open, non-draft,
mergeable, head `32cad5a5`, base `aded1986` (also local `origin/master`). BUG-067's bounded fix, the mock changes, and the
documented legacy-drain/rollback tradeoffs are acceptable. Nonblocking author follow-up: copy deferred-review reasons into
the PR description; the linked `.superpowers/sdd/.../progress.md` ledger is local and uncommitted. This review changed only
the handoff locally; Claude retains branch ownership and should commit it with the merge-preparation work.
**PR Q (2026-10-15): implemented, CI green, Codex review complete.** [#305](https://github.com/ravichavali/karmyq/pull/305), branch
`agent/claude/sprint-133-pr-q-queue-migration`. All CI checks pass. [Integration run 38797421203](https://github.com/ravichavali/karmyq/actions/runs/38797421203)
on `ca97b521` logged `PR Q EVIDENCE {"published":80,"completed":80,"failedAttempts":0}`. The B1 control, which still publishes to the legacy queue
directly, loses 15/60 there, as expected. ADR-101 is **Accepted**. Also fixed in this PR: **BUG-066** (offer/on-duty pushes never sent) and **BUG-067**
(reputation feedback handler set a nonexistent `trust_scores.updated_at` and never succeeded; found by the integration test). Logged, not fixed: **BUG-068**
(`POST /requests/matches/:matchId/feedback` selects a nonexistent `help_requests.community_id`, so no real feedback event is ever published; the
maintainer must decide which community a feedback credits; due 2026-10-29). Gates: /simplify (4 agents, applied); /code-review high (10 findings: 5 fixed
RED->GREEN, BUG-068 logged, 4 ruled); /security-review (no findings). Every ruling is in `.superpowers/sdd/2026-10-15-sprint-133-pr-q-queue-migration/progress.md`.
**Before merge:** DONE 2026-10-15: review result and deferred-review reasons in the PR, version 11.88.0, maintainer merge authorization.
**After deploy:** ADR-101 -> Implemented, BUG-060/066/067 -> fixed with the version (rides the PR D branch); read-only check that the demo's
`bull:karmyq-events:wait`/`:delayed` drain (ask first: shared demo server); then the legacy-handler removal follow-up in `docs/IDEAS.md`.
**#304 SHIPPED and LIVE (2026-10-15 03:31 UTC).** The maintainer merged [#304](https://github.com/ravichavali/karmyq/pull/304)
as `aded1986` (v11.87.0). [CI/CD 38676752463](https://github.com/ravichavali/karmyq/actions/runs/38676752463) passed on
attempt 1: Security Audit, Code Scanning Gate (no CodeQL re-raise, since `api.ts` was untouched) and Deploy to Demo all green.
`node-forge` and `braces` exemptions now expire **2026-10-21**. PR Q re-bumps its version from master (now 11.87.0) at merge.
**PR B SHIPPED and LIVE (2026-10-14).** [#303](https://github.com/ravichavali/karmyq/pull/303) merged as `1291b1d4` by
`gh pr merge --squash --admin` (explicit maintainer authorization "I authorize admin merge", 2026-10-14). The master Code
Scanning Gate first failed on CodeQL #612/#613: line-shift re-raises of the dismissed `js/request-forgery` FP class on
`api.ts:1063,1078`. The maintainer dismissed them; [CI/CD 38579973619](https://github.com/ravichavali/karmyq/actions/runs/38579973619)
attempt 2 built and deployed: DEPLOYMENT SUCCESSFUL, all services healthy, no rollback. **Read-only smoke as maria.reyes: 7/7 PASS**
(login; own skills 200 with vouch fields; co-member skills 200; anonymous POST /endorsements 401; invalid tag_id 400;
absent tag 404). **Not smoke-covered on live data:** demo users still have zero skill tags (n=0), so the field-shape checks ran on
empty lists and no live vouch was exercised (a live endorse/withdraw is a demo write needing authorization). That rests on CI
real-Postgres evidence (`sprint-133-endorsement-trust`: (a)–(g), unlocked control, fractional weights, backfill) until PR D
seeds skills; re-run the smoke after PR D. ADR-100 flipped to **Implemented** on this branch.
This handoff now rides on the **PR Q** branch `agent/claude/sprint-133-pr-q-queue-migration`, cut from `origin/master`
`1291b1d4` (no docs-only master push).

**History (PR B review, 2026-10-13):** draft [#303](https://github.com/ravichavali/karmyq/pull/303)
**PR B status (2026-10-13, Claude executing, Codex reviewing):** B1–B9 done on `agent/claude/sprint-133-pr-b-endorsements`.
**BUG-060 CONFIRMED** (CI run 38465333100: 15 of 60 `request_created` jobs permanently lost on the shared queue; mechanism
traced to `bull/lib/queue.js:1203-1208,1246`), so endorsements use the dedicated queue `karmyq-skill-endorsement-social-graph`.
Gates: /simplify (4 agents, applied), /code-review high (6 fixed RED→GREEN, rest ruled), /security-review (no findings).
Ledger with every ruling: `.superpowers/sdd/2026-10-08-sprint-133-skills-depth/progress.md`.
**Review round 1 (Codex, relayed 2026-10-13):** CodeQL #610/#611 **dismissed** by the maintainer; all checks on `219a45ff`
passed. Codex did **not** recommend merging yet: (P2) endorsement path-cache invalidation was not retry-safe (cleared after
COMMIT, so a retry with matching counts skipped it) → **fixed**: the clear now runs inside the reconcile transaction, with a
fault-injection regression; ADR-100 had two malformed headings → **fixed**; the backfill dry-run description claimed
write-then-rollback → **corrected** (it returns the plan before any write). **BUG-060 is HIGH** (decided in the #303 review):
a separate urgent **queue-migration PR** goes right after PR B and **before PR D**, target **2026-10-15** (SLA 2026-10-20).
**Codex re-review (2026-10-14, `219a45ff → 12820e51`): no remaining code blockers; all four findings addressed;** recommended
version stamping and merge (fresh verification: social-graph 12 unit + 172 regression, tsc, drift 41/41, CI 38512441049 green on
`12820e51`). Real-Postgres fault injection for the cache clear would strengthen coverage but is not a blocker. **Maintainer
authorized the admin merge 2026-10-14.** Version stamped **11.86.0** (master was 11.85.0). **Note for PR D:** reconcile rewrites `raw_weight` by formula, so seeded edges must carry formula-consistent weights.
**Previous status: PR S and PR A SHIPPED and LIVE.** [#302](https://github.com/ravichavali/karmyq/pull/302)
merged as `e7ff481d` on 2026-10-13 (the maintainer ran the merge). The master Code Scanning Gate first failed on
CodeQL #607–609: line-shift re-raises of already-dismissed `js/request-forgery` FPs on unchanged fixed-path calls in
`api.ts` (521, 830, 1063). The maintainer dismissed them; a `--failed` rerun of [CI/CD 38410709880](https://github.com/ravichavali/karmyq/actions/runs/38410709880)
(attempt 2) built the images and deployed. All 9 services healthy, no rollback. **Read-only smoke as maria.reyes: 10/10 PASS**
(settings expose `share_skills_with_communities`; own skills 200; directory 200 for all 6 member communities; absent
community 404; absent user 404; anonymous 401; invalid id 400; empty search 400; retired `/requests/matched/for-user`
no longer 200 (403)). **Not smoke-covered on live data:** demo users have zero skill tags, so every directory is empty and
search/co-member visibility could not be exercised live. That rests on CI real-Postgres evidence (6/6 visibility cases) until
PR D seeds skills; re-run the smoke after PR D. PR S shipped earlier as `278d3306` (v11.84.0, smoke 11/11).
This handoff rides on the PR B branch `agent/claude/sprint-133-pr-b-endorsements`, cut from `origin/master`
`e7ff481d` (no docs-only master push).

> **Merge-conflict rule for this file.** The Sprint 132 closeout branch carries a newer Sprint 132
> handoff. The closeout **archives** it to `.claude/handoff/archive/` before or with its last PR. When
> this branch later merges `origin/master` (merge commit, no rebase), resolve `CURRENT_HANDOFF.md` by
> keeping **this** Sprint 133 file and confirming the Sprint 132 archive exists on master.

> **No parallel lanes are active.** Git and PR state (`gh pr list`, `git log origin/master`) outrank
> anything written here.

## Quick Start

1. Read this handoff.
2. **Check the precondition first (plan Task S0):** the Sprint 132 closeout PRs (the `shell-quote`/`sharp` + `node-forge`-decision
   advisory fix and BUG-061, commit `4c709023`) are MERGED and deployed, and the Sprint 132 handoff is
   archived. If not, switch to `agent/claude/sprint-132-closeout` and follow its handoff instead.
3. **PR V is SHIPPED** (v11.89.0, `05d29d28`); PR S, A, B, Q, V and #304 are shipped. Never commit on their branches.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no `/execute-plan`
   slash command: superpowers removed it as a deprecated stub.
5. **Start PR D** in a fresh chat on `agent/claude/sprint-133-pr-d-curated-seed` (cut from `05d29d28`; it carries this handoff), from
   [`docs/superpowers/plans/2026-10-16-sprint-133-pr-d-demo-seed.md`](../../docs/superpowers/plans/2026-10-16-sprint-133-pr-d-demo-seed.md)
   (it supersedes the sketch in the sprint plan), starting at Task D0. Re-run the PR B / PR A skill smokes and a live offer read after PR D seeds data.
   The demo apply is a **full curated reset**: it deletes all simulated activity since July and needs its own explicit
   authorization at the time; a live endorse/withdraw smoke afterwards is a second, separate authorization.
6. GitHub merges need explicit maintainer merge authorization (the maintainer's approval would be self-approval; ask
   "admin merge, yes/no?"); repo auto-merge is disabled.

## Sprint goal

Members can see the skills of people they share a community with, search their community for a skill,
and vouch for a skill of someone they completed a match with; vouches feed the trust graph. A
security PR first closes BUG-056, BUG-062 and BUG-058.

## Links

- Spec: [`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`](../../docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md)
- Plan: [`docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md`](../../docs/superpowers/plans/2026-10-08-sprint-133-skills-depth.md)
- ADR: **ADR-100**, allocated by the maintainer 2026-10-08 (`docs/adr/ADR-100-skill-visibility-and-endorsements.md`, written in PR A Task A7).

## PR table

| PR | Scope | Branch | State |
|---|---|---|---|
| **S** | BUG-056 (`GET /requests/:id` gate + drop `requester_email`, directed rules unchanged), BUG-062 (member email: `/users/:userId` auth + self-only; community detail/members admin-only), BUG-058 (cap → 7, monitor retired, #236) | `agent/claude/sprint-133-pr-s-security` | **SHIPPED v11.84.0** ([#301](https://github.com/ravichavali/karmyq/pull/301), `278d3306`, deploy 38302920724, smoke 11/11). Also fixed in review: preferred-provider read, admin-notes gate, `join_request_message` on active rows, `GET /offers/:id` `helper_email`, gate ordering in `audit-exemptions.js`. Logged BUG-063/064/065 |
| A | Opt-out skill visibility to co-members, `/auth/skills` directory + search, skills setting on `/users/me/settings` (no route-order bug: withdrawn 2026-10-11), drop `auth.user_skills`, retire `/requests/matched/for-user` | `agent/claude/sprint-133-pr-a-skill-visibility` | **SHIPPED v11.85.0** ([#302](https://github.com/ravichavali/karmyq/pull/302), `e7ff481d`, deploy 38410709880 attempt 2, smoke 10/10). CodeQL #603–605 (PR) and #607–609 (master line-shift) dismissed by the maintainer as false positives |
| B | BUG-060 reproduction → transport choice; `auth.skill_endorsements`; reconcile-not-increment `endorsement_count`; vouch UI | `agent/claude/sprint-133-pr-b-endorsements` | **SHIPPED v11.86.0** ([#303](https://github.com/ravichavali/karmyq/pull/303), `1291b1d4`, deploy 38579973619 attempt 2 after maintainer dismissed CodeQL #612/#613, smoke 7/7 read-only). Codex review round 1 fixed, re-review clean. ADR-100 → Implemented on the PR Q branch |
| Q | **BUG-060 (HIGH)**: move the remaining shared-queue events off `karmyq-events` to per-consumer queues (completionEvents pattern); re-run the B1 reproduction expecting 0 lost jobs | `agent/claude/sprint-133-pr-q-queue-migration` (cut 2026-10-14 from `1291b1d4`; live PR base `aded1986`) | **SHIPPED v11.88.0** ([#305](https://github.com/ravichavali/karmyq/pull/305), `36a9972f`, deploy 38948723833 attempt 1, all 9 healthy; integration 80/80, 0 failed attempts). Also fixed BUG-066 and BUG-067; logged BUG-068. Owed: read-only demo drain check (ask first), then legacy-handler removal |
| V | **BUG-065 (HIGH)**: request-list boundary + five live-membership read gates (including community-health); **BUG-064**: owner/live-member offer reads + uniform owner-write 404 | `agent/claude/sprint-133-pr-v-visibility` | **SHIPPED v11.89.0** ([#306](https://github.com/ravichavali/karmyq/pull/306), `05d29d28`, deploy 38985813305 attempt 1, all healthy; smoke 15/15 + member control 993 vs 0). Met the BUG-065 deadline. Follow-ups in the header |
| D | Curated demo seed: skills (+ one opt-out), 7 story-shaped vouches (1 withdrawn), personal + Tool Library items; counts derived and proven by social-graph's reconcile dry-run in the CI reset step | `agent/claude/sprint-133-pr-d-curated-seed` (cut 2026-10-17 from `05d29d28`; the old `-demo-seed` branch is superseded, deletable) | **NEXT**; **planned 2026-10-16**: [plan](../../docs/superpowers/plans/2026-10-16-sprint-133-pr-d-demo-seed.md). Demo apply = full curated reset, separately authorized |
| L | ADR-101 legacy-handler removal **+ BUG-068 retirement** (dead feedback route, event, handler, sim call) | not cut | needs the read-only demo drain check first (ask); **due 2026-10-29** (BUG-068) |

Versions: each PR bumps the minor from `origin/master` at merge time. Nothing is reserved.

## Maintainer decisions (planning chat, 2026-10-08)

1. **Theme:** skills depth (endorsements + discovery + drop `auth.user_skills`).
2. **Dated obligations** (BUG-056 by 2026-10-14, BUG-058 by 2026-10-15) fold in as **PR S**, first.
3. **BUG-056 policy:** gate (own ∨ match participant ∨ reachable) **and drop `requester_email`**.
   **Preserve the stricter directed-request audience rules** when adding general visibility.
4. **BUG-062** (found in planning: anonymous `GET /users/:userId` returns email; community detail and
   members list return every member's email to any viewer) **folds into PR S**.
5. **BUG-058:** option **(b)**, revert the cap to 7 and retire the image-size monitor.
6. **Who may endorse:** completed-match partners only.
7. **Trust graph:** endorsements feed `endorsement_count` via an event. **Withdrawal reverses the
   contribution; retries and re-endorsement cannot inflate the count** (reconcile, not increment).
   **Reproduce BUG-060 before choosing the transport.**
8. **Visibility:** co-members, opt-out. **Opting out hides skills from both co-member views and
   community search.**
9. **Extras:** curated demo seed (PR D), BUG-060 reproduction (PR B Task B1), retire `/matched/for-user` (PR A).
10. **Demo writes** stay subject to per-operation authorization (PR D and any live smoke write).
11. **Order:** S → A → B → D; the **Sprint 132 closeout finishes first**.
12. **Plan review rev 1 (same day):** the 0–2 pair count and per-change job ids are confirmed. Fixes:
    monotonic `revision` job ids (no millisecond collision; retries reuse the change id); a pair advisory
    lock that serializes reconcile with the `match_completed` edge path, with an in-statement `raw_weight`
    and concurrency tests; and a BUG-060 reproduction that uses `request_created` (a handled event), where one clean
    run cannot refute competition.
13. **ADR-100 allocated.**

## Critical implementation notes (verbatim from the spec)

1. **Sprint 132 closeout is a hard precondition.** Do not cut any Sprint 133 PR branch until the
   closeout PRs (advisories, BUG-061) are merged and deployed. Then cut each PR branch from fresh
   `origin/master`. This planning branch merges `origin/master` (merge commit, no rebase) before its
   docs ride along with PR S.
2. **BUG-056 must not loosen directed requests.** `GET /requests/:id` already filters with
   `directedAudienceSql('r', '$2')` (`requests.ts:1717`). Keep that predicate in the SQL. Add the
   non-directed gate on top: own ∨ any-status match responder ∨ `getRequestReachability(...).reachable`.
   `getRequestReachability` already returns `exists:false` for a directed request outside its
   audience (`services/request-service/src/db/eligibility.ts:69-79`). Tests: a directed ask stays
   404 for a same-community non-audience member even though that member is "reachable" for ordinary
   requests; a completed-match helper still gets 200 after leaving the community; an outsider gets
   404 for a `community`-scope request; anyone authenticated gets 200 for a `platform`-scope request.
3. **Strip email everywhere it now leaks (BUG-062), and grep for others.** Known sites:
   `requests.ts:1699` (removed outright), `auth-service routes/users.ts:21` (self only),
   `community-service routes/communities.ts:344` and `routes/members.ts:28` (live admin or self only).
   `matches.ts:99` (`GET /matches/:id`) is participant-scoped since PR S of Sprint 132 and stays.
   Before PR S, re-run `grep -rn "\.email" services/*/src` untruncated and classify every hit in the
   PR description. Messaging participants' emails (`ChatWindow.tsx:153`) are out of scope; log any
   new class found.
4. **One visibility predicate.** Create `services/auth-service/src/db/skillVisibility.ts` exporting
   a SQL fragment `skillVisibleToSql(ownerAlias, viewerParam)` = owner is viewer **or** (sharing on
   **and** an active co-membership exists). Every PR A/B read and the endorsement eligibility check
   use it. Tests prove both halves for every endpoint: a co-member sees it; a non-co-member, a
   member of a *different* community, a pending member and an opted-out member's co-member get 404
   or absence. **Opting out hides the member from co-member views AND from community search and the
   directory counts.** A test opts a member out and asserts all three surfaces.
5. **Live membership only.** Co-membership, community-search membership, admin email visibility and
   endorsement eligibility all query `communities.members` (`status='active'`, `role='admin'` where
   relevant). Never read `req.user.communities` for a decision (CLAUDE.md *Authentication*).
6. **Endorsements reconcile; they never increment.** The social-graph handler recomputes, for the
   pair, `endorsement_count` per community = number of distinct endorsers (0–2) with an active
   endorsement whose `match_id`'s request is in that community (`requests.request_communities`). It
   must **not** call `upsertTrustEdge` (which does `+ 1` and grows `stability`). Reconcile does not
   change `stability`; it sets `last_interaction_at = now()` only when the count increased; it inserts
   an edge only when the count is > 0 and the edge is missing. The pair count (0–2) measures mutual
   vouching; per-skill counts on the profile keep the detail. Proofs: (a) the same event delivered 3×
   leaves the count at 1; (b) endorse → withdraw → re-endorse gives 1, 0, 1; (c) five skills vouched
   by one endorser give 1; (d) both directions give 2; (e) deleting the endorsed tag (cascade)
   followed by its event gives 0 and `raw_weight` drops by exactly the endorsement weight.

   **Serialization (maintainer review, 2026-10-08).** Each reconcile runs in **one transaction** that
   (1) takes `pg_advisory_xact_lock` on a key derived from the normalized pair
   (`hashtextextended('trust-pair:' || user_id_a || ':' || user_id_b, 0)`), (2) reads the source rows,
   (3) `SELECT … FOR UPDATE`s the pair's edge rows, and (4) writes them. The `match_completed` edge
   path (`upsertTrustEdge`, `trustEdgeDb.ts:117-181`) takes the **same** pair lock in its own
   transaction. **`raw_weight` is computed inside the `UPDATE` statement from the row's current
   columns** (`SET raw_weight = match_completed_count * $w1 + endorsement_count * $w2 + …`), on both
   paths. Today `upsertTrustEdge` reads the counts and writes `raw_weight` in separate statements, so
   a reconcile that commits between them would be overwritten with the stale endorsement count.
   Weights still come from `getInteractionWeightsForCommunity` (`trustEdgeDb.ts:106`).
   `upsertTrustEdge` keeps its observable result: its existing tests stay green. **Concurrency tests
   (real Postgres, two clients, a barrier hook between read and write):**
   (f) an **older** reconcile reads "active", a withdrawal commits and its reconcile starts, then the
   older one is released; the final count is 0, never 1; (g) a `match_completed` edge update runs
   while a reconcile holds the lock; the final row has the incremented `match_completed_count`, the
   reconciled `endorsement_count`, and `raw_weight` equal to the formula over the final columns.
7. **Reproduce BUG-060 before choosing the transport (Task B1).** Use an event that **is** handled,
   by exactly one service: **`request_created`**, which only notification-service processes
   (`services/notification-service/src/events/subscriber.ts:176`). Reputation-service
   (`subscriber.ts:137-141`) and social-graph-service (`subscriber.ts:84`) attach workers to the same
   `karmyq-events` queue without that name. (`user_joined_community` has no handler anywhere in the
   checked source, so it cannot show competition.) The root integration test runs the real
   subscribers of all three services, asserts that each queue worker is attached before publishing
   (`queue.getWorkers()` / client list), publishes **N ≥ 50** jobs, and records each job's final state
   and the error text. **Decision rule:** any job that fails with a missing-handler error, or never
   reaches the notification handler, **confirms** competition. Successful delivery in one run
   **cannot refute** it. "Not reproduced" is possible only together with a mechanism trace from the
   installed Bull source (`node_modules/bull/lib`, not docs or changelogs) showing that a worker with
   named processors cannot take a job of another name. Without both, treat competition as possible.
   **Transport:** a dedicated queue (`karmyq-skill-endorsement-social-graph`, following
   `services/request-service/src/events/completionEvents.ts`) unless B1 produces that mechanism proof.
   Update BUG-060 with the evidence either way and record it in ADR-100. No other event's transport
   changes in this sprint.
8. **Job IDs are per change and collision-free.** Completion uses a stable `jobId` per match
   (`completionEvents.ts:28-31`) with `removeOnComplete: { age: 86400 }`, so a second add with the
   same id inside 24 h is silently dropped. A pair-stable id would drop a withdrawal's reconcile, and a
   timestamp-based id can collide when two changes share a millisecond. **Use a monotonic revision.**
   `auth.skill_endorsements.revision bigint NOT NULL DEFAULT 1` is incremented
   (`revision = revision + 1`) by the same `UPDATE`/upsert that changes state, under that row's lock.
   The id comes from `RETURNING`: `endorsement-<row id>-r<revision>`. A tag-deletion cascade uses
   `endorsement-<row id>-deleted` (a row is deleted once). **A retry of the same change reuses that
   change's id**, so Bull dedupes retries and never distinct changes. Test: two changes in one
   millisecond (frozen clock) produce two distinct ids; re-publishing one change reuses its id.
9. **Publish after commit; the lost-enqueue gap is accepted and documented.** If the enqueue fails
   after the DB commit, the API still returns success (the endorsement is real), logs an error
   carrying both user ids (operator-legible; feedback memory "opaque to the client, legible to the
   operator"), and the pair heals on its next endorsement change. Ship
   `scripts/reconcile-endorsement-edges.js` (dry-run by default) for an operator backfill. The ADR
   states this gap; no outbox this sprint.
10. **Tag deletion is an endorsement change.** `DELETE /auth/profile/tags/:tagId`
    (`profileTags.ts:67-78`) cascades endorsements. Select the distinct active endorsers in the same
    transaction before deleting, then publish one event per pair after commit. Hiding skills
    (opt-out) does **not** delete endorsements and does **not** change the trust graph: visibility is
    a display rule, the vouch remains a fact. Say so in the ADR and the guide.
11. **Endorsement eligibility is checked at write time only.** A completed match is permanent, so an
    endorser keeps their vouch even after leaving the community; the PR A predicate decides only who
    can *see* it. Ineligible POSTs return the same 404 whether the tag is hidden, missing or the
    caller has no completed match (no existence oracle).
12. **`init.sql` regeneration needs Docker.** There is none on the Windows box. Use the manual
    `Regenerate init.sql` workflow dispatch (as Sprint 132 PR B/C did) or the Mac checkout, review
    the artifact diff (only the PR's migration objects + one ledger line), promote it, and never
    hand-edit. A disposable demo-host container needs separate maintainer authorization.
13. **Dropping `auth.user_skills` is rollback-safe only because nothing reads it.** Before merging PR
    A, re-run `grep -rn "user_skills" services apps packages infrastructure/postgres/seed-data.sql scripts`
    untruncated. Only the migration, the generated `init.sql` and history docs may remain. A failed
    deploy rolls back images, not schema; the previous image (≥ v11.78.0) does not read the table.
14. **Route order — corrected 2026-10-11.** `/me/settings` is **not** shadowed: a real-router probe returned 200 from the settings handler on both the base and PR S heads (2026-10-11): `/:userId` matches one path segment, so it cannot capture `/me/settings`. Do
    not present a reorder as a fix. Keep a real-router test that `GET /users/me/settings` reaches the
    settings handler, as a guard only. New skills routes are mounted at `/auth/skills` in
    `services/auth-service/src/index.ts`, beside `/auth/profile/tags` (`:61`), with `authMiddleware`.
15. **No `packages/shared` change this sprint.** Matching already reads `user_tags`; endorsements do
    not change scoring yet (Sprint 134 candidate).
16. **Integration tests live in ROOT `tests/integration/*.integration.test.ts`** (the only place
    CI's Integration Tests job looks) and must fail, not skip, under `CI=true` without a database.
    Confirm from the job log that the sprint-133 files ran. Workspace TDD tests start in the changed
    workspace's `tests/tdd/`.
17. **BUG-058 removal is a security-gate change: prove it can still fail.** After the cap returns to
    7, the regression must show an 8-day exemption is rejected and a 7-day one accepted, deriving the
    span from `MAX_EXEMPTION_DAYS` (as `tests/regression/sprint-124-registry-core-parity.test.ts:177-189`
    already does). Remove the "unwatched package ≤ 7 days" special case from
    `sprint-125-image-size-monitor.test.ts` together with the monitor; the general cap now enforces
    it. Delete only after `grep -rn "image-size-advisory-watch\|check-image-size-upstream"` is
    classified; the landing docs copy is regenerated, never edited. Read
    `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md` first.
18. **Demo data (PR D).** Skills, items and endorsements are added to the curated manifest
    (`curatedDemo/manifest.ts`, types in `types.ts`, writer `baselineWriter.ts`, verifier
    `verifier.ts`). The writer sets `endorsement_count` on seeded `trust_edges` using exactly the
    reconcile rule (distinct endorsers per community), and a regression proves seeded counts equal a
    reconcile over the seeded rows. **Every demo write (curated reset/apply on karmyq.com) requires its
    own explicit maintainer authorization at the time of the operation**; the plan never pre-authorizes
    one, and a deploy does not imply one.
19. **Version and merges.** Each PR bumps the minor from `origin/master`'s `package.json` at merge
    time (root `package.json` + `package-lock.json` root version). One merge at a time; wait for
    deploy and health verify. Each merge needs explicit maintainer authorization.

## Carry-forward and open items

- **Sprint 132 closeout: COMPLETE (2026-10-10).** #299 (advisories + renewals, v11.82.0, `dfe52c03`) and #300 (BUG-061 + ADR-099
  Implemented, v11.83.0, `aa6352e8`) are both deployed and smoke-tested. Branches `agent/claude/sprint-132-advisories` and
  `agent/claude/sprint-132-closeout` are merged; never commit on them.
- **Exemptions RENEWED again (maintainer, 2026-10-14, #304):** `node-forge` and `braces` run 2026-10-14 → **2026-10-21**. #304 merged as `aded1986` and deployed green (CI/CD 38676752463).
- **Earlier renewal (maintainer, 2026-10-08, shipped in #299):** `node-forge` and `braces` ran 2026-10-08 → 2026-10-15.
  Re-check both before then (`npm view`, the GHSA page, `npm ls --all`); remove each if upstream ships a fix.
  History of the ordering decision follows.
- **Exemptions (closeout ordering, maintainer review 2026-10-08):** `node-forge` is **already invalid**
  (`expires: 2026-10-08` is the first invalid day; `expires <= today`, `scripts/audit-exemptions.js:126`),
  so every push and deploy fails the gate until it is decided. **Its decision (renew with explicit
  maintainer authorization, or remove if upstream fixed) must ship in the same PR as the
  `shell-quote`/`sharp` advisory fix**, before any closeout push is expected to pass. `braces` becomes
  invalid **2026-10-09**; decide it in the same PR if it lands on or after that day.
- **BUG-062** (HIGH, member email disclosure) logged in `docs/BUGS.md` on this branch; deadline
  **2026-10-15**, with BUG-056 (2026-10-14) and BUG-058 (2026-10-15). If PR S cannot merge by then,
  write dated risk acceptances for the maintainer (plan Task S0). `docs/BUGS.md` conflicts with the
  closeout branch's BUG-061 entry on merge: keep both, 061 before 062.
- **BUG-060: CONFIRMED and HIGH** (PR B Task B1: 15/60 and 16/60 `request_created` jobs lost live; severity decided in the #303 review).
  Fix = the queue-migration PR **Q**, right after PR B and before PR D, target 2026-10-15, SLA 2026-10-20.
- **New finding for IDEAS (PR B Task B7):** `match_completed` trust-edge increments are not idempotent
  (`upsertTrustEdge` `+ 1`); a redelivered completion over-counts.
- **Directed-notify lookup `expires_at > NOW()`** and the standing rollback policy (fix-forward once
  directed rows exist) remain open from Sprint 132.
- **Sprint-number collision:** `origin/lane/lanes-provenance` (`557bb547`) still says "Sprint 132";
  it renumbers when scheduled.

## Ownership and base

| Field | Value |
|---|---|
| **Planning branch** | `feature/sprint-133-skills-depth`, base `origin/master` `6041c92c` (docs only) |
| **Active editor** | **Claude** shipped PR V (2026-10-17); PR D is next, in a fresh chat, on `agent/claude/sprint-133-pr-d-curated-seed`. |
| **Reviewer role** | A non-author reviews each completed diff |
| **Shared resources** | ADR-100 and ADR-101 allocated to this sprint. Re-read `origin/master` for PR V's version stamp at merge time; no version is reserved. No dependency upgrades, merge, deploy or demo data operation are authorized by this review. |

## Persistent obligations (carried from Sprint 132, unchanged)

- Demo stories expire **2026-11-12**; BUG-041 recheck is due **2026-11-14**.
- GitHub posts a notice on every CI run: the `ubuntu-latest` label migrates to Ubuntu 26 from **2026-10-19**.
  Watch the first CI runs after that date, especially the Docker, Node and Postgres jobs.
- No docs-only master push.
- CodeQL PR scans are incremental; master rescans establish closure of existing master alerts.
- Windows: use Node for JSON/HTTP probes; no local Docker. Demo data operations require separate
  explicit authorization.
- Root tests can promote unrelated TDD files and regenerate landing timestamps; inspect the tree
  after verification and preserve only intended changes.
- Contributor agents never self-merge; only Claude marks the sprint complete after actual delivery.

## Next unchecked action

1. ~~Merge and deploy #299~~: DONE 2026-10-10 (`dfe52c03`, deploy 38076041625 green).
2. ~~Ship the BUG-061 PR~~: DONE 2026-10-10 (#300, `aa6352e8`, deploy 38078595371 green, smoke passed).
3. ~~Start Sprint 133 PR S (S0–S6)~~: DONE 2026-10-10/11 on `agent/claude/sprint-133-pr-s-security`.
4. ~~PR S Task S8~~: DONE 2026-10-12 (#301 merged `278d3306`, deploy 38302920724, smoke 11/11, #236 linked).
5. ~~Maintainer decisions owed on BUG-068, BUG-065, BUG-064~~: DECIDED 2026-10-16 (see 7b). Still unassigned: BUG-063 (export reads a
   nonexistent schema, due 2026-10-24) and BUG-069 (due 2026-10-30).
6. ~~PR A~~: DONE 2026-10-13 (#302 merged `e7ff481d`, v11.85.0, deploy 38410709880 attempt 2, smoke 10/10).
   Deferred minor: the skills directory shows its empty message while the first fetch is loading.
   Ledger: `.superpowers/sdd/2026-10-08-sprint-133-skills-depth/progress.md`. Known tooling gaps: root `test:tdd` is
   missing from Turbo, yet the pre-push hook prints "TDD tests passed" anyway, and on Windows the test process needs
   Git Bash first in PATH (the default `bash` resolves to WSL with no distribution installed).
   **Expect a master CodeQL line-shift re-raise whenever a PR edits `api.ts`**: the dismissal is per line, so a merge
   needs a maintainer dismissal plus a `--failed` rerun before it deploys.
7. ~~PR B~~: DONE 2026-10-14 (#303 merged `1291b1d4`, v11.86.0, deploy 38579973619 attempt 2, smoke 7/7 read-only). Expect the CodeQL
   line-shift re-raise on every merge that shifts `api.ts` lines.
7c. **PR D planned (2026-10-16, second planning chat).** Maintainer decisions: (1) apply by the **full curated reset**
   (`reset:demo --apply --publish-config`, Sprint 117 runbook; also clears maria.reyes's drift, 6 live memberships vs 2 in the
   manifest, cause UNVERIFIED, and refreshes stories expiring 2026-11-12); (2) skills for every exchange helper (2–4), about
   half the ambient people (1–2), **one opt-out** (`person.ambient-09`); (3) **story-shaped vouches**: Sophia↔Maria, Wei→Maria,
   Elena↔Fatima, Amina→Noah, and James→Maria withdrawn; (4) **personal items + 4 Tool Library items, no borrows**. Counts are
   derived by the writer and proven by running social-graph's `reconcileEndorsementPairLocked` in dry-run (zero planned
   writes) inside the CI-gated `tests/tdd/sprint-117-demo-reset.integration.test.ts`. No migration, no shared change, no ADR.
   **The reset also deletes `auth.founding_circle_submissions`** (real karmyq.org/join notes, classified `reset`). The
   maintainer confirmed 2026-10-16 that there are none and the reset may proceed. Task D11 re-checks the count right before
   `--apply` and stops if it isn't 0. This is not authorization to run the reset: ask again at D11.
7b. **CURRENT: PR V** (reviewed and CI green at `8ddefbf2`; draft #306; V11 version preparation next, see header). Maintainer decisions, 2026-10-16 planning chat:
   (1) bundle BUG-065 + BUG-064 into one request-service PR **before PR D**;
   (2) **BUG-065:** list = the detail route's boundary (reviewer recommendation), directed asks excluded from browse;
   (3) **BUG-064:** owner + live members of the offer's community (`is_public` ignored);
   (4) **BUG-068:** first answer was "credit every shared community". After planning showed the route has no client, the
   maintainer chose **retire it with the legacy-handler removal (PR L)**, still due 2026-10-29.
   Planning also found the claim-gated community reads (folded into PR V under BUG-065) and logged **BUG-069** (admin writes on
   the JWT claim, cross-service, unassigned, proposed MEDIUM, due 2026-10-30). Order: **V → D → L**, but L must land by
   2026-10-29, so if D slips, L goes first. L needs the read-only demo drain check (ask first).
7a. ~~PR Q~~: DONE 2026-10-16 (#305 merged by the maintainer as `36a9972f`, v11.88.0, deploy 38948723833 attempt 1, all 9 healthy). Owed: the read-only drain check and legacy removal in the header. Original brief: on `agent/claude/sprint-133-pr-q-queue-migration`, plan in a fresh chat (which events, which
   consumers, the `completionEvents.ts` per-consumer pattern, legacy-handler retention for queued jobs), then implement; the B1
   reproduction test must show 0 lost jobs for migrated events. Target 2026-10-15. A live endorse/withdraw smoke is a demo write: ask first. **Then the BUG-060 queue-migration PR (Q), then PR D.**
   **PR Q planning decisions (maintainer, 2026-10-15):** (1) **ADR-101 allocated** for per-consumer event queues.
   (2) **BUG-066 fixed in PR Q**: the `offer_submitted`, `offer_accepted`, `offer_declined` and `provider_went_on_duty` handlers
   read `job.data.<field>` but the publisher wraps fields in `job.data.payload`, so those pushes never fire.
   (3) **Unconsumed events stop being enqueued**: they're classified in the routing table, `publishEvent` skips Redis for them,
   and an unclassified name throws. Plan: [`docs/superpowers/plans/2026-10-15-sprint-133-pr-q-queue-migration.md`](../../docs/superpowers/plans/2026-10-15-sprint-133-pr-q-queue-migration.md).
8. ~~Re-check `node-forge` and `braces` before 2026-10-15~~: DONE 2026-10-14. There is still no upstream fix (node-forge 1.4.0, braces 3.0.3, both
   `first_patched_version` null; @expo/cli 57.0.30 still needs `^1.3.3`). The maintainer explicitly authorized renewal to **2026-10-21**.
   Renewal PR [#304](https://github.com/ravichavali/karmyq/pull/304) (v11.87.0) merged by the maintainer as `aded1986`
   (2026-10-15 03:31 UTC) and deployed green on attempt 1 (CI/CD 38676752463). Branch `agent/claude/sprint-133-exemption-renewal`
   is merged; never commit on it. PR Q re-bumps its version from master (11.87.0) at its own merge.
9. **Re-check `node-forge` and `braces` before 2026-10-21** (`npm view`, the GHSA page, `npm ls --all`). Remove each exemption if
   upstream ships a fix. Renewing needs explicit maintainer authorization again.
