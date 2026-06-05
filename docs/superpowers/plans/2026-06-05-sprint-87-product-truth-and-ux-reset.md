# Product Truth & UX Reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish Karmyq's new manifesto-first presentation direction — ship low-risk source-of-truth
& landing quick wins, clean demo data, and produce a product-polish scorecard + screenshot UX audit +
visual research + throwaway HTML mockups (5 surfaces) + a written presentation-rules system — so
Sprint 88 executes the help-loop redesign from an approved direction.

**Architecture:** Mostly a research/design sprint. Production code changes are limited to two quick wins
(`apps/landing/src/components/sections/CommunityStories.tsx`, `apps/frontend/CONTEXT.md`) plus
source-of-truth metadata. All design output is standalone artifacts under `docs/design/sprint-87/` and
changes no production UI. No DB schema, no API, no new ADR.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue. Mockups: static
HTML/CSS via the `frontend-design` skill. UX audit: Playwright MCP against demo.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/design/sprint-87/scorecard.md` | Product-polish scorecard (5 promises × current/target). |
| `docs/design/sprint-87/visual-research.md` | Warm-commons/calm reference research; borrow/avoid notes. |
| `docs/design/sprint-87/ux-audit.md` | Screenshot-based audit notes per surface. |
| `docs/design/sprint-87/screenshots/*.png` | Playwright captures backing the audit. |
| `docs/design/sprint-87/mockups/index.html` | Contact sheet linking the 5 surface mockups. |
| `docs/design/sprint-87/mockups/dashboard-home.html` | Throwaway Dashboard Home mockup. |
| `docs/design/sprint-87/mockups/community-home.html` | Throwaway Community Home mockup. |
| `docs/design/sprint-87/mockups/request-card.html` | Throwaway Request Card mockup (relationship-led). |
| `docs/design/sprint-87/mockups/profile-trust.html` | Throwaway Profile/Trust mockup (meaning-not-points). |
| `docs/design/sprint-87/mockups/governance-fission-fusion.html` | Throwaway governance/split/fusion mockup. |
| `docs/design/sprint-87/presentation-rules.md` | The new design language (shells/type/spacing/color/cards/status/score/privacy/a11y/responsive/mobile). |
| `docs/design/sprint-87/sprint-88-recommendation.md` | `minScore` decision + score-vs-relationship taxonomy applied + S88 shell-first recommendation. |

### Existing files to modify (quick wins only)
| File | Change |
|------|--------|
| `CLAUDE.md` | Version header `9.1.0` → `10.11.0`. |
| `README.md` | Version/update metadata → v10.11.0 + S86/87 state. |
| `docs/README.md` | Version/update metadata refresh. |
| `docs/ARCHITECTURE.md` | Version/update metadata + note request-service is feed source-of-truth (ADR-066). |
| `apps/frontend/CONTEXT.md` | Replace retired-`BrowseFeed` (S34) architecture with unified-feed reality. |
| `apps/landing/src/components/sections/CommunityStories.tsx` | Remove/replace placeholder stories. |
| `package.json` | Version `10.10.0` → `10.11.0`. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **No production UI rewrite this sprint.** Only the two quick wins touch production code
   (`CommunityStories.tsx`, `apps/frontend/CONTEXT.md`) + metadata. Everything else is
   `docs/design/sprint-87/` artifacts. Resist scope creep into S88 card/shell work.
2. **`KarmaBadge` is NOT removed this sprint** (Decision 3 folds it into the S88 card redesign). Document
   the taxonomy rule; do not edit `RequestCard`.
3. **Clean/seed demo data BEFORE the screenshot audit** — an audit on stale-sim data judges noise.
   Order: data cleanup → audit → mockups.
4. **Drive the audit via Playwright with a real MEMBER login** (JWT field is `communities`). Capture
   each surface as a member, not just admin. If demo looks wrong, confirm the latest "Deploy to Demo"
   run succeeded first (deploy-drift watch).
5. **Mockups are throwaway & standalone** — static HTML/CSS, not wired into `apps/frontend`. Build with
   `frontend-design` against warm-commons/calm.
6. **Landing docs dir is gitignored** (`apps/landing/src/data/docs/`) → `git add -f`. **`docs/design/`
   is NOT gitignored.** Run `generate-docs` from `apps/landing/`; **grep-verify nav.json after**.
7. **`git add` CLAUDE.md** is lowercase `claude.md` on Windows.
8. **Optimize deliverables for the maintainer's approval decision**, not for completeness — the mockups +
   presentation rules are the gate to S88.

---

## Task 1: Feature branch + source-of-truth metadata quick wins

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `package.json`

- [ ] Create branch: `git checkout -b feature/sprint-87-product-truth-and-ux-reset`
- [ ] Bump `package.json` version `10.10.0` → `10.11.0`
- [ ] Fix `CLAUDE.md` version header `9.1.0` → `10.11.0`
- [ ] Refresh version/update metadata in `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`; note in `ARCHITECTURE.md` that request-service is the feed source-of-truth (ADR-066) and feed-service is a consolidation candidate (S92)
- [ ] **Verification** — grep shows no remaining pre-10.11 version strings in those files:

```bash
git grep -nE "9\.1\.0|10\.10\.0" -- CLAUDE.md README.md docs/README.md docs/ARCHITECTURE.md
```

## Task 2: Fix `apps/frontend/CONTEXT.md` BrowseFeed drift

**Files:**
- Modify: `apps/frontend/CONTEXT.md`

- [ ] Read `apps/frontend/CONTEXT.md`; locate the Sprint-34 `BrowseFeed` architecture section
- [ ] Replace it with the unified-feed reality: `UnifiedFeed` (`view=home` / `view=community`), `RequestCard`/`DecisionBand`, `GET /requests/curated`, the texture layer (ADR-066/067). Note the legacy `BrowseFeed`/`Feed.tsx`/`FeedItem.tsx`/`FeedFilterPanel` were retired in S86.
- [ ] **Verification** — no stale BrowseFeed-as-live references remain:

```bash
git grep -n "BrowseFeed" -- apps/frontend/CONTEXT.md
```

- [ ] Run `/simplify` on the diff so far (metadata + CONTEXT prose)

## Task 3: Replace landing placeholder stories

**Files:**
- Modify: `apps/landing/src/components/sections/CommunityStories.tsx`

- [ ] Read `CommunityStories.tsx` + where it's rendered (`apps/landing/src/app/page.tsx`)
- [ ] Replace fabricated stories with either (a) the section hidden until real founding-circle stories exist, or (b) honest "stories coming from the founding circle" placeholder copy that doesn't fabricate communities. Choose (b) if it keeps page rhythm; (a) if empty reads cleaner.
- [ ] **Verification** — landing builds and no fabricated story names remain:

```bash
cd apps/landing && npm run build
```

- [ ] Run `/simplify` on the `CommunityStories.tsx` diff

## Task 4: Clean/seed representative demo data (BEFORE audit)

**Files:**
- Reference: simulation-service flows; demo DB

- [ ] Confirm the latest "Deploy to Demo" GitHub Actions run succeeded and demo content matches master (deploy-drift watch)
- [ ] Inventory stale/orphaned/test data on the demo DB (old sim runs, orphaned requests/matches). Document what's removed in `docs/design/sprint-87/ux-audit.md` "Data prep" section
- [ ] Clean + reseed representative data via existing simulation-service flows so each audited surface has honest, non-noisy content
- [ ] **Verification** — demo shows a coherent member experience (open requests, a community with members/activity, a profile with history). Capture the seed summary in the audit doc.

## Task 5: Product-polish scorecard

**Files:**
- Create: `docs/design/sprint-87/scorecard.md`

- [ ] Write the scorecard: five promises (community sovereignty, help-loop clarity, privacy/forgetting, meaning-not-points, local trust) × {current surface state, gap, target state, which sprint owns the fix}
- [ ] **Verification** — every promise has a current + target + owning-sprint cell; arc rows map to Sprints 88–92

## Task 6: Screenshot UX audit via Playwright

**Files:**
- Create: `docs/design/sprint-87/ux-audit.md`, `docs/design/sprint-87/screenshots/*.png`

- [ ] Log into demo via Playwright MCP as a **member** (JWT field `communities`); capture: Dashboard Home, Request Wizard, Community page (member view), Profile/Reputation, Governance, Fission/Fusion, mobile Feed (or note mobile-from-code if no device)
- [ ] Write audit notes per surface against warm-commons/calm + the five promises: what violates "one screen, one job", where accounting outranks meaning, where privacy/forgetting is invisible, raw-styling/technical-language spots
- [ ] **Verification** — each of the 7 surfaces has a screenshot + dated audit note; findings cross-reference the scorecard rows

## Task 7: Visual reference research

**Files:**
- Create: `docs/design/sprint-87/visual-research.md`

- [ ] Research concrete references for warm-commons/calm (quiet density, editorial warmth, no engagement-feed posture, no SaaS chrome); for each, note what to borrow and what to avoid
- [ ] Derive a starting palette/type/spacing direction the mockups will use
- [ ] **Verification** — at least 4–6 references with explicit borrow/avoid notes; a concrete starting visual direction stated

## Task 8: Throwaway HTML mockups — all five surfaces

**Files:**
- Create: `docs/design/sprint-87/mockups/{index,dashboard-home,community-home,request-card,profile-trust,governance-fission-fusion}.html`

- [ ] REQUIRED SUB-SKILL: use `frontend-design` to build standalone HTML/CSS mockups (no app wiring) for each surface, applying visual-research direction + the score-vs-relationship taxonomy (relationship reason leads; no `KarmaBadge`; de-emphasized %)
- [ ] Request Card mockup explicitly shows the S88 target hierarchy (relationship/task/scope/action above score)
- [ ] Profile/Trust mockup shows contribution history + living/fading trust + privacy posture (no "grow your score" nudge)
- [ ] Governance/Fission-Fusion mockup uses canonical-feel tokens + staged consent cards + a community *picker* (not a UUID field)
- [ ] Build `index.html` contact sheet linking all five
- [ ] **Verification** — open each mockup in a browser (or Playwright screenshot); all five render standalone; none import from `apps/frontend`
- [ ] Run `/simplify` on the mockup markup (dedupe shared CSS into the index/shared block)

## Task 9: Presentation-rules system

**Files:**
- Create: `docs/design/sprint-87/presentation-rules.md`

- [ ] Document the design language extracted from the approved mockup direction: page shells, type scale, spacing, color use, card hierarchy, status language, **score treatment** (relationship-led, no per-person scores, % de-emphasized), privacy/decay affordances, **accessibility** rules, **responsive** rules, and mobile-translation notes
- [ ] **Verification** — every category above has at least one concrete rule (not a placeholder heading)

## Task 10: Sprint 88 recommendation + minScore decision

**Files:**
- Create: `docs/design/sprint-87/sprint-88-recommendation.md`

- [ ] Record the community feed `minScore` decision: curated-first default (`minScore≥30`) + low-altitude "show more open requests" affordance + admin all-status list (#64) — never a firehose
- [ ] Apply the score-vs-relationship taxonomy to the RequestCard: KarmaBadge removal folds into S88; keep TrustPathBadge
- [ ] Recommend S88 build a shared design-system shell + Dashboard Home together (the help loop is the proof point)
- [ ] **Verification** — the doc states an explicit S88 first-implementation target the next sprint plan can execute from

## Task 11: Verify public docs freshness + nav integrity

**Files:**
- Reference/Modify: `apps/landing/src/data/docs/**`, `apps/landing` nav.json

- [ ] Run `generate-docs` from `apps/landing/`; confirm the unified-feed guide + ADR-066/067 concept pages are present and in nav.json
- [ ] **grep-verify nav.json after generation** (it silently reverts); re-apply if needed; `git add -f` any landing docs changes
- [ ] **Verification** — newest unified-feed docs appear in nav.json:

```bash
git grep -n "unified-feed\|adr-066\|adr-067" -- apps/landing/src/data/docs/nav.json
```

## Task 12: SDLC quality gates

- [ ] **`/simplify`** — final pass on the whole branch diff (quick-win code + design markdown/HTML)
- [ ] **`/code-review`** — on the branch diff; resolve correctness findings in the touched production code (`CommunityStories.tsx`); design docs reviewed for internal consistency
- [ ] **`/security-review`** — on the branch diff; the request-forgery FP on `api.ts` baseURL is not relevant here (no client calls added), but run it and justify any dismissal in the PR body
- [ ] **Verification** — each gate run with output captured; real findings resolved; dismissals justified in PR body

```bash
npm audit --package-lock-only --audit-level=high
```

## Task 13: Final verification + pre-push

- [ ] `cd apps/landing && npm run build` (quick-win landing change builds)
- [ ] `npm test` (unit + regression — must pass; no production logic changed, so confirm baseline green)
- [ ] `npm run feedback:check` (docs complete)
- [ ] **Verification** — all three green; TDD baseline unchanged (the pre-existing failures list in the handoff is the baseline — zero NEW failures)

## Task 14: Merge + Deploy (quick wins)

> Quick wins deploy; design artifacts ride along in the same PR but change no production UI.

- [ ] Use the `/deploy` skill: open PR with the cross-agent contract body (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane); on maintainer authorization, merge to master
- [ ] Monitor "Deploy to Demo" GitHub Actions run to green
- [ ] **Verification** — demo shows the corrected landing (no fabricated stories), version metadata consistent; per-service health green post-deploy
- [ ] **Maintainer approval gate** — present the mockup contact sheet + presentation rules; **Sprint 88 implementation plan is written only after the maintainer approves the direction**
