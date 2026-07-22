# Sprint 120 PR C: Five-Second Clarity (UX Pass) — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; work inline except for genuinely
> large independent tasks (maintainer token-efficiency decision, 2026-07-16). Gate calibration:
> `/code-review` at MEDIUM effort unless the selected fix list turns out large; one `/simplify`
> pass on the branch diff (plus per-task only on substantial fixes).
> **This PR is research-FIRST: Tasks 1–3 produce an audit; NO implementation happens before the
> maintainer selects the fix list at the Task 4 checkpoint.**

**Goal:** Audit every primary surface with the five-second test (desktop + 375px), rank findings
against reference community products, and implement only the maintainer-selected fixes.

**Architecture:** Nothing new until the checkpoint; selected fixes are expected to be
presentation/copy/hierarchy changes inside existing pages and components. Anything needing schema
or new endpoints goes back through planning.

**Tech Stack:** Next.js 14 (Pages Router), Playwright (MCP) for the audit.

**Version:** v11.31.0 → v11.32.0 · **Branch:** `feature/sprint-120-five-second-clarity` (off
`origin/master`, after PR B merges)

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md` | The audit deliverable: per-surface findings, ranked |
| `apps/frontend/tests/tdd/sprint-120-five-second-fixes.test.tsx` | Tests for the selected fixes (written at Task 5, before implementing) |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/lib/jwt.ts` (NEW) | R-1: shared UTF-8-safe base64url JWT payload decoder |
| `apps/frontend/src/lib/api.ts` | R-1: `decodeJwtPayload` delegates to the shared helper |
| `apps/frontend/src/pages/communities/index.tsx` | R-1: two `atob` sites → shared helper |
| `apps/frontend/src/pages/communities/[id].tsx` | R-1: one `atob` site → shared helper |
| `apps/frontend/src/pages/demo.tsx` | R-1: one `atob` site → shared helper |
| `apps/frontend/src/pages/dashboard.tsx` | R-2: constrain the community `<select>`; R-6: pass the welcome-modal suppression flag to `useOnboarding` |
| `apps/frontend/src/pages/index.tsx` | R-3: third CTA linking `/demo` |
| `apps/frontend/src/pages/login.tsx`, `register.tsx` | R-4: wordmark + one-line product statement above the card |
| `apps/frontend/src/components/SpeedDialFab.tsx` | R-5: visible label on the create action |
| `apps/frontend/src/hooks/useOnboarding.ts` | R-6: mount-time `suppressed` option (no stacked overlays) |
| `apps/frontend/src/pages/network.tsx` | R-7: CTA in the sparse/zero-connection state; R-8: green active mode pill |
| `docs/guides/` + landing guide JSON | Guide updates for every shipped visible change (mandatory) |
| `apps/frontend/src/lib/onboarding/workflows.ts` | If any audited flow changes |
| `package.json` | v11.32.0 |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress + selection record |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied from the spec — items 10–11 apply, plus audit mechanics:

1. **Research first (standing rule)**: no implementation before the audit doc exists and the
   maintainer has selected fixes. The checkpoint is a real gate, not a formality.
2. **Demo audit is READ-ONLY**: never sign up new users or mutate protected personas
   (maria.reyes / elena.torres / noah.williams / marcus.lee@test.karmyq.com). maria.reyes is the
   rich view; the demo trust graph is sparse (avg ~4.6 connections) — check DB degree before
   judging a graph surface "broken"; sim persona password per server env (never commit).
3. **Audit BOTH viewports**: 1440px desktop AND 375px mobile; `kq-topnav` is xl-only (BUG-016);
   `--measure-chrome: 72rem` shipped as header lever 1 — don't re-litigate S119's header work.
4. **Five-second protocol per surface**: screenshot cold, then answer (a) what is this page?
   (b) what can I do here? (c) what should I do next? — noting time-to-answer and what visual
   element answered it. Audit by STATE, not a blanket persona cross-product — each surface is
   audited only in the states where it is actually reachable:
   - **Unauthenticated**: login, register, landing site home (logged out, cold).
   - **First-arrival**: only if a read-only DB check finds an existing sim account still in the
     arrival state — NEVER sign up a new user to manufacture one; if none exists, mark the
     surface "not auditable this pass" in the doc and move on.
   - **Sparse established member**: pick a low-degree sim account via a read-only psql degree
     query (demo avg ~4.6 connections; record WHICH account in the audit doc). This is the
     "newcomer-ish" view.
   - **Rich established member**: maria.reyes.
   The audit doc opens with the surface × state applicability matrix. Screenshots live in the
   session scratchpad (not committed); the audit doc must stand alone textually — findings name
   the visual element, not just the screenshot file.
5. **Standing mechanics**: branch off `origin/master` after PR B merges; admin-authorized squash
   merge (explicit, every time); TDD in `apps/frontend/tests/tdd/`; grep-verify `nav.json` after
   landing regen; `getMyCommunities` returns `{communities,count,total}`; jsdom/D3 gotchas if a
   graph surface is touched.

---

## Task 1: Branch + audit scaffold

- [ ] `git fetch origin && git checkout -b feature/sprint-120-five-second-clarity origin/master`
- [ ] Create the audit doc skeleton with the surface inventory: login/register, welcome/arrival,
  dashboard home, communities list + community detail (Browse/steward tabs), feed, request
  detail + create-request, `/network` (ego / community ring / hub modes), profile, messaging,
  notifications, topnav/overflow (md–xl), landing site home
- [ ] **Verification:** doc skeleton committed; surface list confirmed against the live nav

## Task 2: Run the five-second audit (Playwright, demo, read-only)

- [ ] For each surface × {1440px, 375px} × each APPLICABLE state (note 4's matrix): screenshot
  cold, apply the protocol, record findings with severity (blocker / friction / polish)
- [ ] Record console errors / broken states seen in passing (log bugs via `docs/BUGS.md`, do not
  fix inline)
- [ ] **Verification:** audit doc has a self-contained entry per surface × viewport × state —
  each names the visual element behind its finding in words (screenshots are inspected session
  evidence in the scratchpad, not durable references the doc depends on)

## Task 3: Reference comparison + ranked recommendations

- [ ] Compare against 2–3 reference community products (e.g. Nextdoor, a Buy Nothing/Facebook
  group flow, Discord community home, TimeBanks): what answers their five-second test that ours
  doesn't?
- [ ] Rank findings into: top quick wins (this PR), structural (defer to a future sprint,
  capture in `docs/IDEAS.md`), out of scope
- [ ] **Verification:** audit doc final: ranked table with effort estimates + recommendation

## Task 4: ⛔ CHECKPOINT — maintainer selects the fix list

- [ ] Present the ranked findings (AskUserQuestion): which quick wins ship in this PR?
- [ ] Record the selection + rationale in the audit doc and `CURRENT_HANDOFF.md`
- [ ] **Amend THIS plan file**: rewrite Tasks 5–7 with the exact files, test cases, expected
  behavior, and verification steps for each selected fix (Tasks 5–7 below are templates, not an
  executable plan, until this amendment is committed)
- [ ] **Verification:** explicit selection recorded; File Map + Tasks 5–7 updated with the
  concrete files and committed. **Do not proceed past this line without it.**

## Task 4 result — MAINTAINER SELECTION (2026-07-22)

Selected: **R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8** (everything ranked as a quick win).
Deferred to `docs/IDEAS.md`: R-9 (fold hierarchy), R-10 (sparse-member first-run path), R-12
(graph label contrast). Out of scope, logged as bugs: R-11 (`BUG-031`). `BUG-032` is the bug
record for the R-1 fix.
Coverage decision: **proceed on the audited surfaces**; the seven unaudited surfaces (request
detail, create-request wizard, community detail + steward tabs, profile, notifications, messaging
thread, md→lg topbar) are recorded in the audit doc and carried to a future pass.

## Task 5: TDD tests for selected fixes (before implementation)

All in `apps/frontend/tests/tdd/sprint-120-five-second-fixes.test.tsx` unless noted.

- [ ] **R-1** `decodeJwtPayload` on a token whose payload contains `Southeast PDX Helpers — Group B`
  (em dash, UTF-8) returns the exact string — the current `atob` path yields `â€"`. Also: base64url
  (`-`/`_`) input decodes; malformed token returns `null`.
- [ ] **R-2** the dashboard community `<select>` carries width-constraining classes
  (`max-w-full` + a `min-w-0` flex parent) so a long option cannot set page width.
- [ ] **R-3** `/` (logged out) renders a link to `/demo`; it is absent when logged in.
- [ ] **R-4** `/login` and `/register` each render the Karmyq wordmark linking `/` plus the product
  line, above the form.
- [ ] **R-5** the single-action FAB and the speed-dial trigger expose a visible text label (not just
  `aria-label`) naming the action.
- [ ] **R-6** `useOnboarding(id, { suppressed: true })` never sets `shouldShow`, even when the flag
  flips to false after mount; with `suppressed: false` and no stored seen-flag it shows.
  Dashboard-level: with an un-onboarded user, `OnboardingOverlay` is NOT rendered alongside
  `WelcomeModal`.
- [ ] **R-7** in ego mode with 0 connections the empty state renders a link to `/dashboard`; with
  exactly 1 connection the graph still renders AND the same CTA appears; with ≥2 it does not.
- [ ] **R-8** the active mode tab uses the green primary class, not `bg-indigo-600`.
- [ ] **Verification:** `cd apps/frontend && npx jest tests/tdd/sprint-120-five-second-fixes
  --no-coverage` fails on every assertion above before implementation.

## Task 6: Implement selected fixes

- [ ] R-1 `apps/frontend/src/lib/jwt.ts`: `decodeJwtPayload(token)` — base64url normalize →
  `atob` → byte array → `TextDecoder('utf-8')` → `JSON.parse`; returns `null` on any failure.
  Adopt at all five call sites (`lib/api.ts:47`, `communities/index.tsx:233` + `:341`,
  `communities/[id].tsx:103`, `demo.tsx:35`).
- [ ] R-2 `dashboard.tsx:154` — wrap the select in `min-w-0` and give it `max-w-full` (truncation
  comes from the intrinsic `<select>` behaviour once width is capped).
- [ ] R-3 `index.tsx` — third CTA "See how it works" → `/demo` in the logged-out CTA row.
- [ ] R-4 `login.tsx` / `register.tsx` — wordmark (linking `/`) + one-line product statement above
  the card.
- [ ] R-5 `SpeedDialFab.tsx` — visible label on both the single-action FAB and the trigger.
- [ ] R-6 `useOnboarding.ts` — second `suppressed` argument read once at mount; `dashboard.tsx`
  passes "the welcome modal is about to show for this user".
- [ ] R-7 `network.tsx` — CTA link into `/dashboard` in the `egoIsSparse` block, plus the same
  prompt when `peopleInScope === 1`.
- [ ] R-8 `network.tsx` — active mode tab → green primary (also the two other `indigo` accents on
  the page if they read as the same control family).
- [ ] **Verification:**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-120-five-second-fixes --no-coverage  # green
npx jest tests/regression --no-coverage && npx tsc --noEmit
```

## Task 7: Docs — guides, onboarding, landing

- [ ] User guide: note the `/demo` tour entry point and the create-action label change; regenerate
  landing guide JSON
- [ ] `apps/frontend/src/lib/onboarding/workflows.ts` — only if R-6 changes what a tour says (the
  fix changes WHEN it shows, not its content; expect no edit)
- [ ] `docs/IDEAS.md` — capture deferred R-9, R-10, R-12 with a pointer to the audit doc
- [ ] **Verification:** `npm run feedback:check`; grep-verify nav.json; doc-context drift gate
  direct run green

## Task 8: Version bump + SDLC quality gates

- [ ] v11.32.0; promote green TDD suite to regression
- [ ] `/simplify` — the ONE pass for this PR, on branch diff → **Verification:** applied/dismissed with note
- [ ] `/code-review` at MEDIUM effort (raise to HIGH only if the fix list grew large) — branch
  diff → **Verification:** zero unresolved confirmed findings
- [ ] `/security-review` — branch diff → **Verification:** zero unresolved findings; dismissals
  justified

## Task 9: Final verification + Merge + Deploy + Sprint close

- [ ] `npm test` green; `pre-commit-check`; handoff updated
- [ ] Open PR; checks green; **PAUSE for explicit Admin merge authorization** —
  `gh pr merge --squash --admin`; monitor deploy; demo health check
- [ ] **HUMAN validation (sprint validation checklist):** maintainer eyeballs the shipped fixes
  live at desktop + 375px; API smoke (BUG-030 pair still 200); DB check only if any fix touched
  data reads
- [ ] Sprint 120 close-out: handoff → status COMPLETE; ADR-087 → Implemented rides the NEXT
  sprint's first commit along with the handoff archive (no docs-only push)
