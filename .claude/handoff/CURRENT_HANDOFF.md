# NEXT: Sprint 123 — Publish AGPL, reconcile every license claim, record the audit

> **Sprint 122 is CLOSED and SHIPPED at v11.42.0.** Nothing is in flight; master is deployed and
> verified. Detail:
> [`archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md`](archive/2026-08-06-sprint-122-dependency-wave-test-truth-SHIPPED-v11.42.0.md).
>
> **Sprint 123 is planned and ready to execute.** Spec and plan are written; every open decision
> is closed (D7–D13 below). This file carries what surrounds them.

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-123-licensing-and-audit origin/master`
3. Open plan: [`docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md`](../../docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md)
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Sprint goal:** Publish AGPL-3.0-or-later, reconcile all six contradictory license claim sites plus
eighteen silent manifests, record the manifesto audit as ADR-092 and the `federation` fossil as
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
| D9 | Copyright line is **`Copyright (C) 2025-2026 Ravi Chavali`** |
| D10 | **All 18 manifests** get the `license` field, not just root |
| D11 | Pallavi Ravi's consent is **verbal, no written artifact, no follow-up task** |
| D12 | `Karmyq Developer <karmyq@example.com>` **is the maintainer's own** pre-config identity |
| D13 | The 7 UNVERIFIED §2.4 claims are **recorded as follow-up in ADR-092**, not checked this sprint |

⚠️ **D11 is the sprint's one accepted risk, taken knowingly.** A written-confirmation-first option
and an in-sprint email task were both offered and declined. The mitigating facts are measured:
`forkCount: 0`, `stargazerCount: 0`, `watchers: 0` — **no third party has ever received the code
under the README's MIT claim.** ADR-092 must state the consent is verbal and undocumented, plainly,
so a future reader is not misled about the strength of the record.

---

## ⚠️ The one thing not to get wrong in S123

Adding a `LICENSE` is a **new legal grant**, not a record of an existing one. There is no license
file today, so default copyright applies — the landing page's "open source" claim is currently false
as a matter of law. Both provenance actions are now **resolved** (D11, D12), so the sprint is
unblocked end-to-end.

**Two claim sites the arc design missed, found during planning. Both are in scope:**

- **`CONTRIBUTING.md:52`** — "By contributing, you agree your contributions are licensed under the
  **MIT** License." This is the live contributor agreement and the most legally consequential MIT
  statement in the repository.
- **`apps/mobile/README.md:363`** — claims **AGPL-3.0** and links to the nonexistent `LICENSE`.

Full inventory: 6 prose sites + 18 manifests. See the spec's *License Claim Inventory*.

---

## Critical Implementation Notes (verbatim from the spec)

1. **The AGPL text is copied verbatim from a canonical source, never hand-typed or reconstructed
   from memory.** Fetch `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch`
   (`curl` is unreliable on this host — spurious status 000) and verify before committing: the file
   must contain `GNU AFFERO GENERAL PUBLIC LICENSE`, `Version 3, 19 November 2007`, the closing
   `<https://www.gnu.org/licenses/>`, and be ~660 lines. **A license file with typos is a real
   defect, not a cosmetic one.** If the fetch fails, stop and ask — do not approximate.
2. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`), so a gate
   left there blocks nothing. See `tests/CLAUDE.md`.
3. **A null extraction must fail the gate, not skip it.** The recurring defect in this repo is gates
   that assert weaker than they claim — presence instead of blocking, count instead of identity.
   If a site's extractor returns `null`, that is a red test.
4. **Prove each extractor can fail, not just one.** Table-driven MIT-flip per source, plus one real
   on-disk flip of `README.md:4` with both red and green outputs pasted into the PR.
5. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs — a `tests/regression/*` file reading `apps/landing` and
   `apps/mobile` will cache a stale pass while CI fails.
6. **`nav.json` is generated and hand-edits silently revert.** The source is `scripts/generate-docs.ts`.
   ADR-092/093 go in `ADR_GROUPS` ("— Infrastructure —", line ~520); the new concept page goes in
   **both** `CONCEPT_ORDER` (line ~245) and the `whyKarmyq` array (line 578). All 89 ADRs are
   currently curated there, and `doc-context-drift-gate.test.ts` fails on any concept page missing
   from nav — so skipping this step breaks an existing gate.
7. **`npm test` regenerates the landing docs.** The prebuild runs `generate-docs`, which rewrites
   `apps/landing/src/data/docs/`. Expect timestamp/HEAD-sha churn; commit the intended ADR/concept
   additions and revert the incidental churn.
8. **The manifest list is discovered, not hand-written.** Globbing `services/*`, `apps/*`,
   `packages/*` plus the four root manifests means a new workspace cannot appear unlicensed and pass.
   A hand-written shadow list is exactly the false-green pattern CLAUDE.md Discipline 5 forbids.
9. **`CONTRIBUTING.md:52` and `apps/mobile/README.md:363` are not in the arc design.** They were
   found during planning. `CONTRIBUTING.md` is the live contributor agreement and is the most
   legally consequential MIT statement in the repository — it is not optional scope.
10. **The shields.io badge escapes hyphens.** `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue` in the badge URL. The gate must un-escape before comparing,
    and the rendered badge should be eyeballed once.
11. **`git add` CLAUDE.md carefully on Windows** — it is tracked lowercase as `claude.md`.
12. **No docs-only push to master.** Everything lands in the one PR; a post-merge docs push triggers
    a second deploy and 502s the demo.

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
  closeout, the arc design, and the S123 spec + plan. `fix/adr-060-gate-pr-head-ref` is merged and
  can be deleted; `docs/sprint-122-closeout` was closed (local + remote).
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
