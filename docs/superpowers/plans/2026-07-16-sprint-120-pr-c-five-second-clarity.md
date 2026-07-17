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
| (determined by the Task 4 checkpoint) | Selected fixes only |
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
   element answered it. Audit as TWO personas: a newcomer (sparse account) and maria.reyes
   (established).
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

- [ ] For each surface × {1440px, 375px} × {newcomer persona, maria.reyes}: screenshot cold,
  apply the protocol (note 4), record findings with severity (blocker / friction / polish)
- [ ] Record console errors / broken states seen in passing (log bugs via `docs/BUGS.md`, do not
  fix inline)
- [ ] **Verification:** audit doc has an entry per surface×viewport with screenshots referenced

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
- [ ] **Verification:** explicit selection recorded; File Map updated with the concrete files.
  **Do not proceed past this line without it.**

## Task 5: TDD tests for selected fixes (before implementation)

- [ ] Per selected fix, tests per the UI coverage table (renders, role/state gates, API-call
  payloads, fetch fallbacks) in `apps/frontend/tests/tdd/sprint-120-five-second-fixes.test.tsx`
- [ ] **Verification:** tests exist and fail against current code

## Task 6: Implement selected fixes

- [ ] Implement each selected fix; run `/simplify` after each substantial one
- [ ] **Verification:**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-120-five-second-fixes --no-coverage  # green
npx jest tests/regression --no-coverage && npx tsc --noEmit
```

## Task 7: Docs — guides, onboarding, landing

- [ ] Update the user guide + landing guide JSON for every visible change; onboarding workflows
  if a flow changed; capture deferred structural findings in `docs/IDEAS.md`
- [ ] **Verification:** `npm run feedback:check` clean; grep-verify nav.json; doc-context drift
  gate direct run green

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
