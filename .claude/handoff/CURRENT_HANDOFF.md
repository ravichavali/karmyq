# NEXT: Sprint 123 — Publish AGPL, reconcile every license claim, record the audit

> **Sprint 122 is CLOSED and SHIPPED at v11.42.0.** Nothing is in flight; master is deployed and
> verified. Detail:
> [`archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md`](archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md).
>
> **Sprint 123 is planned and ready to execute.** Spec and plan are written; every open decision
> is closed (D7–D13 below). This file carries what surrounds them.

## Quick Start

1. Read this handoff
2. ⚠️ **Branch from the planning branch, NOT `origin/master`** — the spec and plan exist only on
   `docs/sprint-123-planning` at **local** HEAD. They are on neither `origin/master` nor the pushed
   planning branch (`origin/docs/sprint-123-planning` is at `9a88cc96`, behind local).

   ```bash
   git rev-parse --abbrev-ref HEAD    # expect: docs/sprint-123-planning
   git checkout -b feature/sprint-123-licensing-and-audit
   ls docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md   # must exist
   ```
3. Open plan: [`docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md`](../../docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Sprint goal:** Publish AGPL-3.0-or-later, reconcile all thirteen contradictory license claim sites
plus twenty silent manifests, record the manifesto audit as ADR-092 and the `federation` fossil as
ADR-093, and add a regression gate that fails when any two license sources disagree.

**Version:** v11.42.0 → v11.43.0 · **Branch:** `feature/sprint-123-licensing-and-audit`

| Document | Path |
|---|---|
| Design spec | [`specs/2026-08-07-sprint-123-licensing-and-audit-design.md`](../../docs/superpowers/specs/2026-08-07-sprint-123-licensing-and-audit-design.md) |
| Implementation plan | [`plans/2026-08-07-sprint-123-licensing-and-audit.md`](../../docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md) |
| Four-sprint arc (input) | [`specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](../../docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) |

---

## Decisions closed in planning (2026-08-07) — do NOT re-litigate

| # | Decision |
|---|---|
| D7 | The project is **AGPL** |
| D8 | SPDX id is **`AGPL-3.0-or-later`** (FSF's recommended "or any later version" form) |
| D9 | Copyright line is **`Copyright (C) 2025-2026 Ravi Chavali`**, placed in **`README.md`**, not `LICENSE` |
| D10 | **All 20 tracked manifests** get the `license` field, discovered via `git ls-files` |
| D11 | **Sole authorship.** Every commit is the maintainer's own, across five git identities. No third-party contribution exists — no consent needed, relicensing unproblematic |
| D13 | The 7 UNVERIFIED §2.4 claims are **recorded as follow-up in ADR-092**, not checked this sprint |

**D11 supersedes the earlier consent/provenance apparatus entirely.** The maintainer attested
2026-08-07 that `Pallavi Ravi <kompella.chavali@gmail.com>` and
`Karmyq Developer <karmyq@example.com>` are both their own addresses. ADR-092 records this **as a
maintainer attestation** — the repo cannot prove address ownership, the maintainer can, and naming
the source of the fact is accuracy, not hedging.

---

## ⚠️ The one thing not to get wrong in S123

**The gate, not the LICENSE file.** The `LICENSE` is fifteen minutes; a gate that checks presence
instead of agreement would have passed straight through the contradiction this sprint exists to end.
It must fail on disagreement, on a null extraction, and on any new unallowlisted claim — and every
extractor must be **observed red**, not just the first one.

**The claim inventory is 13 sites, not 6.** The first version of this spec missed seven because its
scan was piped through `| head -60`:

- `CONTRIBUTING.md:52` — MIT, the live contributor agreement
- `apps/mobile/README.md:363` — AGPL-3.0, links to the nonexistent `LICENSE`
- **7 service READMEs** — `auth`, `cleanup`, `community`, `messaging`, `notification`, `reputation`,
  `request` all say **MIT**

And **20 manifests, not 18** — a scratchpad script double-counted `packages/shared`, and a directory
glob never reached `tests/e2e`, `tests/load`, `tests/performance`. Both numbers are now derived from
`git ls-files`, the live arbiter.

**Repository is PUBLIC** (`isPrivate: false`, verified 2026-08-07) — the contradictory claims have
been publicly readable. That is reason enough to fix them; ADR-092 should claim nothing stronger.
Zero forks/stars/watchers does **not** prove nobody cloned it.

---

## Critical Implementation Notes (verbatim from the spec)

1. **Branch from the planning branch, not `origin/master`** — see Quick Start. The plan exists only
   on `docs/sprint-123-planning` at local HEAD.
2. **The AGPL text is copied verbatim and left byte-exact.** Fetch
   `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch` (`curl` is unreliable here —
   spurious status 000). **Do not append a copyright block to `LICENSE`** — GitHub's detection is
   similarity-based and `licenseInfo != null` is a Definition-of-Done item. The D9 notice goes in
   `README.md`, per GNU's `gpl-howto`. If the fetch fails, stop and ask — do not approximate.
3. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`), so a gate
   left there blocks nothing. See `tests/CLAUDE.md`.
4. **Write extractors against committed fixtures, never speculation.** Task 4 lands the final
   wording *before* Task 5 finalizes the extractors. The first version's `CONTRIBUTING` regex used
   a character class excluding periods, so it returned `null` for `AGPL-3.0-or-later` — the very
   string it was written to accept.
5. **A null extraction must fail the gate, not skip it.** Presence-instead-of-blocking is this
   repo's recurring gate defect.
6. **Prove each extractor can fail, not just one.** Table-driven MIT-flip across all 13 sites, plus
   one real on-disk flip. **Restore the flip with a targeted revert** — `git checkout README.md`
   discards Task 4's uncommitted reconciliation of the same file.
7. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs.
8. **`nav.json` is generated and hand-edits silently revert.** Source is `scripts/generate-docs.ts`:
   `ADR_GROUPS` (~line 520); the concept page needs **both** `CONCEPT_ORDER` (~245) and `whyKarmyq`
   (line 578). All 89 ADRs are curated there, and `doc-context-drift-gate.test.ts` fails on any
   concept page missing from nav.
9. **`npm test` regenerates the landing docs** — commit the intended additions, revert incidental
   timestamp/HEAD-sha churn.
10. **The manifest list is discovered via `git ls-files`, never hand-written.** There are **20**.
    A directory glob missed `tests/e2e`, `tests/load`, `tests/performance` in the first version.
11. **The version bump touches the lockfile.** `e5dc24ce` proves the shape: `package.json` x1 and
    `package-lock.json` x2 (`.version`, `.packages[""].version`). "Lockfile untouched" is **wrong**
    — the correct assertion is *only those lines change*.
12. **The shields.io badge escapes hyphens** — `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue`. The normalizer un-escapes `--` before comparing.
13. **`git add` CLAUDE.md carefully on Windows** — tracked lowercase as `claude.md`.
14. **No docs-only push to master.**

---

## Multi-sprint arc context

Four sprints, one topic each (D6). S123 is the first.

| Sprint | Topic | State |
|---|---|---|
| **S123** | Licensing decision + record the audit | **Planned, ready to execute** |
| S124 | Provider standing — enforce `provider_services_enabled` + `provider_min_personal_trust_score` at the **community surface**. ADR for the two open semantic questions | Not planned |
| S125 | Demo data backfill. **First task is fixing `TimeTravelFactory`** — it inserts into `reputation.karma_records` directly with caller-supplied points, violating the replay constraint it appears to satisfy | Not planned |
| S126 | Live simulation across all users — remove the protected-core exclusion from `buildActorPoolPredicate()`; verify `reset:demo`'s real path | Not planned |

**Two traps the arc design records, worth carrying in your head:**

1. **Separate "thin seed data" from "missing implementation".** `mark-read` looks like a data gap
   and is absent code — `markMessagesAsRead` exists and is never called.
2. **`TimeTravelFactory` violates the replay constraint** it appears to satisfy. Fixing it is S125's
   **first** task, not a prerequisite it already meets.

**S124's two open product questions are genuinely undecided** and belong to that sprint's planning:
(a) does standing gate *global registration* as well as community reach, or only reach? (b) what
happens to the unauthenticated global provider directory (`providers.ts:27`, ranked
`trust_score DESC`) — leave public, require auth, restrict to shared communities, or retire it?

---

## Standing state

- **Version:** v11.42.0 on master, deployed and smoke-tested (landing 200 · bodyless login 400
  `VALIDATION_ERROR` · wrong password 401 `UNAUTHORIZED`).
- **Branch:** `docs/sprint-123-planning`, cut from `origin/master` `e5dc24ce`. Carries the S122
  closeout, the arc design, and the S123 spec + plan. ⚠️ **`origin/docs/sprint-123-planning` is at
  `9a88cc96` — the planning commits are LOCAL ONLY.** Push before relying on the remote, and branch
  the feature work from local HEAD (Quick Start). `fix/adr-060-gate-pr-head-ref` is merged and can
  be deleted; `docs/sprint-122-closeout` was closed (local + remote).
- **ADR-060 gate now genuinely gates.** Verified live on both paths. Before touching it, read
  ADR-060 §6/§6b/§6c — it reported success while inert **four** separate ways, and each was caught
  by review or CI, never by inspection. **A green gate run proves nothing; watch it go red.**
- **ADR-091 is `Implemented`** — its four verification rules are enforced in `CLAUDE.md`
  Discipline 5, the `/review-response` skill, and two regression suites.
- **Highest ADR is 091** (verified 2026-08-07). 092 and 093 are free.

### Carried debt (none blocks S123)

- `redisClient.publish` UNPROVEN — needs a seeded conversation (S125).
- `mark-read` unimplemented — needs a bug entry.
- `Expo SDK drift` workflow failing on master (pre-dates v11.42.0).
- **#190** regenerated Expo held bumps · **#192** dev-deps (`tsx`, `@types/pg`, `@types/semver`).
- ADR-028's new-service Dockerfile template still shows `node:18-alpine`; the runtime-floor gate
  (ADR-090) will fail any new service that copies it.
- `.npmrc` `engine-strict` still unset.
- **Untracked and unrelated:** `.github/copilot-instructions.md` and `.github/instructions/`
  (mermaid tooling, 2026-07-29). Leave out of the S123 PR.

### Process notes worth keeping

- `/code-review` is **maintainer-invoked only** — the agent cannot run it. Don't record it as done.
- One force-push was authorised on 2026-08-06 to drop an empty commit. **Standing rule is still
  never force-push**; that was a one-off.
- `gh pr merge --admin` via Bash is blocked by the permission classifier; the GitHub MCP
  `merge_pull_request` tool works. Admin merge needs **explicit authorization each time**.
- `curl` and `jq` are unusable on this host — use `node -e` with `fetch`. `/health` 404s through
  nginx; smoke tests must hit `POST /api/auth/login`.
- Land the handoff **in the PR, before** asking for merge authorization — a separately-merged
  handoff gets stranded.
