# Sprint 92 — Matching & Dibs Repair + Bug Sweep — 📋 READY TO EXECUTE (v11.0.0 → v11.1.0)

> **▶ STATUS (2026-06-08):** Sprint 92 **planned, not started.** Spec + plan written; this handoff
> is the execution entry point. Sprint 91 (service consolidation, v11.0.0) is complete and live.

**Sprint goal (one sentence):** Root-cause and fix the matching/dibs/completion seam (BUG-007,
BUG-008, BUG-005) and sweep the remaining open bug backlog (BUG-002, BUG-001, BUG-003, BUG-004),
each proven by a test.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-92-matching-repair`
3. Open plan: `docs/superpowers/plans/2026-06-08-sprint-92-matching-repair.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Spec:** `docs/superpowers/specs/2026-06-08-sprint-92-matching-repair-design.md`

---

## ⚠️ FIRST COMMIT must fold the S91 doc tail (do NOT push docs to master standalone)

A standalone docs-only master push triggers a redundant deploy that transiently breaks the demo
(`feedback_no_docs_push_to_master`). Fold these working-tree changes into Sprint 92's first commit:
- `.claude/handoff/CURRENT_HANDOFF.md` (this file)
- `docs/BUGS.md` (BUG-007, BUG-008)
- `docs/IDEAS.md` (analytics-section + community/provider link-up captures)

(`.playwright-mcp/` is a stray local artifact — leave it untracked.)

---

## Scope (confirmed with maintainer)

- **Theme:** matching/dibs deep-fix as centerpiece, sweeping the full open bug backlog.
- **Bugs committed:** BUG-007, BUG-008, BUG-005, BUG-002, BUG-001, BUG-003, BUG-004. (BUG-006 was
  fixed in Sprint 91.)
- **BUG-007 framing fork (Option A reframe vs B disable):** maintainer chose **decide in-sprint** —
  the diagnosis task traces the flow, recommends **Option A (reframe neighbor first-ask)**, and the
  maintainer ratifies before implementation. Recorded in ADR-072.

## Diagnosis findings (root-cause, from planning — start fixes here, don't re-derive)

- **BUG-007:** `RequestWizard.tsx:167` fetches a dibs candidate for EVERY request type; non-service
  requests get a mutual-aid community member but `DibsPrompt.tsx` hardcodes provider framing → a
  neighbor is shown as a "provider." Decide A (reframe) vs B (disable) in-sprint.
- **BUG-008:** vague ("matching broken") — **diagnosis-first** (systematic-debugging): reproduce →
  failing test → root-cause statement → fix. Suspects: mutual-aid 0-interaction candidate admission
  (`dibsDb.ts:195`); offer/match/accept/reject reopen logic (`matches.ts`); matched requests still
  browsable.
- **BUG-005:** `DecisionBand.tsx:51` `mark_done` calls completeMatch then drops the row — no rating
  prompt (Dashboard path). `CommitmentsTab.tsx:225/245` sets `pendingRatingId` but shows the prompt
  on one-sided done. Fix: rating fires on `fully_completed` from BOTH surfaces (one source of
  truth). Backend already returns `{ fully_completed, waiting_for }`.
- **BUG-002:** feed query doesn't exclude already-offered or non-open requests → they reappear on
  reload when nothing is open. Server-side fix in `unifiedFeed.ts`/`feedComposer.ts`.
- **BUG-001:** create path ALREADY inserts creator as admin (communities.ts:617) — root cause is
  data/last-admin-departure, not creation. Fix = backfill migration + last-admin guard (confirm the
  reported community's cause first). Dated migration `20260608-backfill-community-admins.sql`.
- **BUG-003:** "Offer service" in PROVIDER CONTEXT ONLY — don't blanket-replace the shared
  RequestCard.tsx:152 "Offer to Help" button (mutual-aid uses it too); branch on service/provider.
- **BUG-004:** REPRODUCE FIRST — Layout.tsx:116 already renders the wordmark; find the surface where
  only the dot shows, or mark cannot-reproduce.

## Critical implementation notes (copied from spec)

1. BUG-008 is diagnosis-first — failing test before any fix.
2. Fix at the correct layer; no client filters for server bugs.
3. Find ALL instances (frontend + mobile + sim + services) before editing.
4. One help-loop, one source of truth — DecisionBand and CommitmentsTab share lifecycle + rating
   logic.
5. Dibs framing A-vs-B is the maintainer's call, made in-sprint (recommend A); record in ADR-072.
6. Migration: idempotent, `NOT EXISTS` guards, cross-schema safe, adminless-only; run
   migration-validator.
7. Schema `communities.communities`; JWT field `communities`; API unwrap `res.data`.
8. Feed exclusion covers non-open statuses (matched/dibs_pending must not be browsable).
9. Landing docs are generated — edit sources, never JSON; verify nav.json after editing. Regenerate
   with `cd apps/landing && npm run generate-docs` (NOT `ts-node scripts/...`).
10. Next free ADR = 072.
11. **TEST COMMANDS (codex review):** in request-service `npm test` = unit+regression ONLY; a
    `tests/tdd/` file needs `npm run test:tdd -- <name>`, a `tests/unit/` file `npm run test:unit --
    <name>`. Verifying a tdd file with `npm test` false-greens.
12. **BUG-007 submit-path (codex review):** if Option A (neighbor first-ask), `POST /requests/:id/dibs`
    at dibs.ts:148 validates via provider-only `getEligibleCandidates` → a neighbor 403s
    (`NO_PRIOR_INTERACTION`). Update the submit validation + payload/pending-dibs language, not just
    the candidate shape + DibsPrompt copy.

> **Cross-agent review (codex, 2026-06-08):** plan reviewed pre-execution; 2 High + 3 Medium
> findings (false-green test commands, BUG-007 submit-path, BUG-001 root cause, generate-docs +
> migration-naming, BUG-003/004 repro-targeting) all verified against code and patched into the
> spec + plan. Directionally approved.

## Success criteria

- [ ] BUG-001..008 (minus 006) each fixed at the correct layer, with a passing test.
- [ ] BUG-008 has a written root-cause statement + regression test.
- [ ] ADR-072 records the dibs-scope decision; user guide + concept page updated; landing
      regenerated.
- [ ] All four SDLC gates run (testing, /simplify, /code-review, /security-review).
- [ ] `npm test`, `npm run test:tdd`, `npm run feedback:check`, `npm audit` clean.
- [ ] Merged + deployed; root `package.json` bumped 11.0.0 → 11.1.0; post-deploy smoke passed.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- master branch protection: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; agents merge only on Admin "pull it in" (then `gh pr merge --admin --squash --delete-branch`). Never self-merge.
- Deliberate empty marker commit `90b9067` on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
Comment `@dependabot rebase` to pick up `pr-contract.yml`, then review per dependabot merge discipline
(inspect grouped PRs for MAJOR bumps; don't rapid-merge). Major bumps: tailwindcss 3→4 #41,
typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo
8→56 #36, eslint-config-next 15→16 #35.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is gitignored — `git add -f`. Generated by
  `scripts/generate-docs.ts` (wipes the dir each run); edit SOURCES (CONTEXT.md / ADR md / generate-docs.ts), never the JSON.
- **ADR numbering**: ADR-071 created in S91; **next free = 072.**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name)
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **11.0.0** (Sprint 91) → bump to 11.1.0 in Sprint 92.
- **Request-type config**: `enabled_request_types` may hold legacy names; backend gates only on the
  5 built-ins (`generic|ride|service|event|borrow`) — see BUG-006 fix in `requests.ts`.
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-service serves the feed** now (`/requests/feed`) + already calls social-graph via `SOCIAL_GRAPH_API_URL`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. Confirm the latest "Deploy to Demo"
run succeeded and live content matches `master` before judging by live content.
