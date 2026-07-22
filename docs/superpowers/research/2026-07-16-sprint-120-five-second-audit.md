# Sprint 120 PR C — Five-Second Clarity Audit

**Status:** SCAFFOLD (Task 1 complete; Task 2 findings pending)
**Sprint:** 120 · **PR:** C · **Branch:** `feature/sprint-120-five-second-clarity`
**Plan:** [`docs/superpowers/plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md`](../plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md)
**Spec:** [`docs/superpowers/specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md`](../specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md)

---

## Protocol

For each **surface × viewport × applicable state**: screenshot cold, then answer, timing each —

- **(a) What is this page?**
- **(b) What can I do here?**
- **(c) What should I do next?**

Record, per answer: time-to-answer and **which visual element answered it, named in words** (this
doc must stand alone; screenshots are session-scratchpad evidence, never committed and never
something a finding depends on). Severity per finding: **blocker** (a of the three unanswerable) /
**friction** (answerable but slow or ambiguous) / **polish**.

**Viewports:** 1440px desktop and 375px mobile.

### Rules of engagement (non-negotiable)

- **Read-only on demo.** No signups, no writes, no mutation of protected personas
  (`maria.reyes`, `elena.torres`, `noah.williams`, `marcus.lee@test.karmyq.com`).
- **Never manufacture a state.** First-arrival is audited only if a read-only DB check finds an
  existing sim account already in it; otherwise the surface is marked *not auditable this pass*.
- **Demo graph is sparse** (avg ~4.6 connections). Check a DB degree query before calling a graph
  surface broken. `maria.reyes` is the rich view.
- **Don't re-litigate shipped work.** `kq-topnav` is xl-only by design (BUG-016);
  `--measure-chrome: 72rem` is S119 header lever 1. S115/S118/S119 graph contracts (ring
  rotation/anchor, decayTier bands, `new > caller > focused`, fail-closed `active_recently`,
  truthful legend colors) are pinned — a finding against them is a *proposal*, not a defect.
- Console errors / broken states seen in passing get logged to `docs/BUGS.md`; never fixed inline.

## States

| # | State | How it is obtained (read-only) |
|---|-------|-------------------------------|
| S0 | **Unauthenticated** | Cold browser, no session |
| S1 | **First-arrival** | Existing sim account still in arrival state, found via read-only DB check — TBD Task 2; if none, states-not-auditable is recorded |
| S2 | **Sparse established member** | Low-degree sim account picked by read-only psql degree query — account recorded here at Task 2 |
| S3 | **Rich established member** | `maria.reyes` |

## Surface × State applicability matrix

Legend: ✅ audit · — not reachable in that state · ❔ conditional (resolve at Task 2).

| # | Surface | Route / entry | S0 | S1 | S2 | S3 |
|---|---------|---------------|----|----|----|----|
| 1 | Landing site home | `apps/landing` `/` | ✅ | — | — | — |
| 2 | Login | `/login` | ✅ | — | — | — |
| 3 | Register | `/register` | ✅ | — | — | — |
| 4 | Invite arrival | `/invite/[code]` | ❔ (needs a live unconsumed code) | — | — | — |
| 5 | Welcome / arrival | `/welcome` | — | ✅ | ❔ | ❔ |
| 6 | Demo tour | `/demo` | ✅ | ❔ | ❔ | ❔ |
| 7 | Dashboard home | `/dashboard` | — | ✅ | ✅ | ✅ |
| 8 | Feed | `/requests` | — | ✅ | ✅ | ✅ |
| 9 | Request detail | `/requests/[id]` | — | ❔ | ✅ | ✅ |
| 10 | Create request | `RequestWizard` (modal from `/dashboard`) | — | ✅ | ✅ | ✅ |
| 11 | Communities list | `/communities` | — | ✅ | ✅ | ✅ |
| 12 | Community detail (Browse / steward tabs) | `/communities/[id]` | — | ❔ | ✅ | ✅ |
| 13 | My Network — ego / community ring / hub | `/network` | — | ✅ (sparse-by-definition) | ✅ | ✅ |
| 14 | Profile | `/profile` | — | ✅ | ✅ | ✅ |
| 15 | Match / messaging thread | `/matches/[id]` | — | — | ❔ | ✅ |
| 16 | Notifications | `/notifications` | — | ✅ | ✅ | ✅ |
| 17 | Topbar + overflow menu (md → xl rhythm) | global chrome | ✅ | ✅ | ✅ | ✅ |

Conditionals resolve at Task 2 and the resolution is recorded in-line with the finding entry.

## Findings

> Task 2 fills this section. One self-contained entry per surface × viewport × state, each naming
> the visual element behind its finding. Nothing below the checkpoint is implemented until the
> maintainer selects the fix list (Task 4).

_(pending)_

## Reference comparison

> Task 3: 2–3 reference community products (Nextdoor, a Buy Nothing / Facebook-group flow, Discord
> community home, TimeBanks) — what answers their five-second test that ours does not.

_(pending)_

## Ranked recommendations

> Task 3: ranked table (quick wins for this PR / structural → `docs/IDEAS.md` / out of scope) with
> effort estimates and a recommendation.

_(pending)_

## Maintainer selection (Task 4 checkpoint)

> Task 4: the explicit selection + rationale, mirrored into `CURRENT_HANDOFF.md`, before the plan
> file's Tasks 5–7 are rewritten with concrete files and tests.

_(pending)_
