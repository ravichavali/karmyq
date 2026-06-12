# karmyq.org Multi-Route Relaunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `karmyq.org` into five static routes using the supplied v5 HTML files as content/organization source of truth, while preserving the current landing design system and preparing `/join` for Sprint 96 backend intake.

**Architecture:** The landing app remains a static Next export with App Router pages under `apps/landing/src/app`. Public route content becomes componentized and route-aware; `/docs` remains untouched; backend submission is deferred to Sprint 96 because static export cannot host Next API routes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 15 static export, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `apps/landing/src/app/principles/page.tsx` | `/principles` route |
| `apps/landing/src/app/how-it-works/page.tsx` | `/how-it-works` route |
| `apps/landing/src/app/research/page.tsx` | `/research` route |
| `apps/landing/src/app/join/page.tsx` | `/join` route |
| `apps/landing/src/lib/landingRoutes.ts` | Route/nav metadata contract used by pages and tests |
| `apps/landing/src/lib/landingContent.ts` | Route copy/content contract used by pages and tests |
| `apps/landing/src/components/sections/landing-v5/*` | Shared v5 route sections, if useful |
| `apps/landing/tests/regression/sprint-95-routes.test.ts` | Pure route/nav/copy regression coverage |
| `docs/adr/ADR-075-karmyq-org-multi-route-relaunch.md` | Public-site routing decision and Sprint 96 intake boundary |

### Existing files to modify

| File | Change |
|---|---|
| `apps/landing/src/app/page.tsx` | Make home story-only |
| `apps/landing/src/app/layout.tsx` | Update base metadata only if still too join-specific |
| `apps/landing/src/components/Header.tsx` | Route-aware nav, desktop/mobile loop, join button |
| `apps/landing/src/components/Footer.tsx` | Keep route-safe footer links |
| `apps/landing/src/app/globals.css` | Add shared prose, star-line, details, and page-shell utilities as needed |
| `apps/landing/src/lib/buildSubscribeMailto.ts` | Keep encoded fallback helper; adjust subject/body if `/join` needs it |
| `apps/frontend/src/styles/karmyq-shell.css` | Preserve queued logo fix using `/brand/karmyq-mark.svg` |
| `package.json` | Bump root version to `11.4.0` |
| `package-lock.json` | Reflect root version bump |
| `docs/ARCHITECTURE.md` | Public-site/static-export notes |
| `docs/adr/README.md` | ADR-075 index |
| `apps/landing/src/data/docs/nav.json` | Generated docs nav must include ADR-075 if generated docs are committed |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress/next sprint state |

---

## Critical Implementation Notes

1. The five supplied HTML files are the content and organization source of truth, but the live landing design system remains the visual source of truth. Do not paste their standalone CSS wholesale.
2. `/docs` must remain unchanged and reachable from every page.
3. `apps/landing` is a static export (`output: 'export'`), so Sprint 95 cannot use Next API routes for join submission.
4. Sprint 96 owns backend-backed founding-circle intake. Sprint 95 keeps mailto/contact fallback and should not create database/API surface.
5. Use each source file's meta description exactly for its corresponding route.
6. Never imply: acts broadcast to the community; karma carrying to daughter communities after fission; automatic splitting at the Dunbar threshold; a founder group; moderation features; governance templates; user-level questionnaires; Bayesian updating; federation; or a community-of-communities layer.
7. Copy voice test: any sentence touched should feel like it could appear in a long-form magazine essay. Avoid body-copy spec language such as "executes atomically," "in parallel," "algorithm," and similar implementation phrasing.
8. "The Problem with Stars" is the single merged reputation essay. "In Defense of Gossip" may appear as an internal section heading inside that essay only if it reads naturally, but not as a separate essay/card.
9. `.star-line` text should be styled as isolated emphasis lines, not visually treated as body paragraphs.
10. Mobile nav validation is mandatory after deployment because five pages make the hamburger menu a real primary navigation surface.
11. Preserve the existing unstaged logo fix in `apps/frontend/src/styles/karmyq-shell.css`; do not revert it while editing landing files.
12. `apps/landing` currently has a pure TypeScript Jest harness only (`**/tests/**/*.test.ts`, no `.tsx`, no jsdom). Do not create `.test.tsx` component-rendering tests unless the harness is explicitly upgraded. Prefer pure `.test.ts` tests against extracted route/nav/content modules.

---

## Task 1: Branch and Baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Create the sprint branch from current `master`.

```bash
git checkout -b feature/sprint-95-karmyq-org-routes
```

- [ ] Bump the root version from `11.3.0` to `11.4.0`.

```bash
npm version 11.4.0 --no-git-tag-version
```

- [ ] Confirm the existing queued logo fix is present and do not revert it.

```bash
git diff -- apps/frontend/src/styles/karmyq-shell.css
```

- [ ] Confirm the landing app is a static export.

```bash
Get-Content apps\landing\next.config.js
```

## Task 2: Write Failing Pure Route/Nav/Copy Tests First

**Files:**
- Create: `apps/landing/tests/regression/sprint-95-routes.test.ts`

- [ ] Add pure `.test.ts` tests, matching the existing landing Jest harness, that describe the target public IA before implementation:
  - route contract contains `/`, `/principles`, `/how-it-works`, `/research`, `/join`, and `/docs`;
  - the five public routes carry the exact source-file meta descriptions;
  - home content contract is story-only and excludes mechanics/principles/research/join page blocks;
  - nav contract includes Story, Principles, How it works, Research, Docs, and a CTA button for Join the circle;
  - `Join the circle` links to `/join` and is marked as the CTA button;
  - forbidden strings are absent: `LinkedIn`, `Roy`, standalone `In Defense of Gossip`;
  - star-line emphasis entries are marked as isolated emphasis, not body paragraphs.

- [ ] Run the new test by explicit path and confirm it fails for the expected reasons.

```bash
npm test --workspace=karmyq-landing -- --runTestsByPath tests/regression/sprint-95-routes.test.ts
```

- [ ] Guard against false-green no-test runs by confirming Jest lists the new `.test.ts` file.

```bash
npm test --workspace=karmyq-landing -- --listTests
```

## Task 3: Build Shared Landing Data and Page Primitives

**Files:**
- Create: `apps/landing/src/lib/landingRoutes.ts`
- Create: `apps/landing/src/lib/landingContent.ts`
- Modify: `apps/landing/src/app/globals.css`
- Modify/Create: `apps/landing/src/components/sections/landing-v5/*`

- [ ] Create pure TypeScript route/nav/content modules consumed by both tests and pages:
  - `landingRoutes.ts` exports nav links, CTA link, route metadata, and route paths;
  - `landingContent.ts` exports route copy blocks, star-line entries, essay titles, and forbidden-copy-safe page structure.

- [ ] Add or reuse shared landing primitives for:
  - narrow essay page shell;
  - layer label;
  - CTA links;
  - feature box;
  - detail/summary essay blocks;
  - star-line emphasis;
  - route-local footer spacing.

- [ ] Keep styling aligned with the current Tailwind tokens and components. Do not paste the standalone HTML files' CSS wholesale.

- [ ] Run landing tests.

```bash
npm test --workspace=karmyq-landing
```

## Task 4: Implement the Five Static Routes

**Files:**
- Modify: `apps/landing/src/app/page.tsx`
- Create: `apps/landing/src/app/principles/page.tsx`
- Create: `apps/landing/src/app/how-it-works/page.tsx`
- Create: `apps/landing/src/app/research/page.tsx`
- Create: `apps/landing/src/app/join/page.tsx`

- [ ] Map the five HTML sources into five App Router pages:
  - `karmyq-v5-home.html` -> `/`;
  - `karmyq-v5-principles.html` -> `/principles`;
  - `karmyq-v5-how-it-works.html` -> `/how-it-works`;
  - `karmyq-v5-research.html` -> `/research`;
  - `karmyq-v5-join.html` -> `/join`.

- [ ] Use each source file's meta description exactly in route metadata.

- [ ] Replace the current homepage composition explicitly:
  - stop rendering `TheThinking`, `Principles`, `HowItWorks`, `FadingTimeline`, `CommunityStories`, `Movement`, `CTAs`, and `DeeperSections` directly on `/`;
  - keep `/` focused on the v5 home/story content, including the founder note and story narrative;
  - move principles to `/principles`, mechanics and design essays to `/how-it-works`, research/thinkers to `/research`, and the invitation/specialist lanes to `/join`.

- [ ] Keep `/docs` unchanged.

- [ ] Run the route tests.

```bash
npm test --workspace=karmyq-landing -- --runTestsByPath tests/regression/sprint-95-routes.test.ts
```

## Task 5: Update Header, Footer, and Mobile Nav

**Files:**
- Modify: `apps/landing/src/components/Header.tsx`
- Modify: `apps/landing/src/components/Footer.tsx`

- [ ] Replace anchor-based nav with route nav:
  - Story -> `/`;
  - Principles -> `/principles`;
  - How it works -> `/how-it-works`;
  - Research -> `/research`;
  - Join the circle -> `/join`;
  - Docs -> `/docs`.

- [ ] Make `Join the circle` the nav button and avoid duplicating it as a plain text nav item.

- [ ] Ensure the mobile hamburger contains the full loop and closes after clicking a route.

- [ ] Keep the wordmark route-safe and logo asset consistent with the landing brand assets.

- [ ] Run route/nav tests.

```bash
npm test --workspace=karmyq-landing -- --runTestsByPath tests/regression/sprint-95-routes.test.ts
```

## Task 6: Harden `/join` as Mailto Now, Backend Later

**Files:**
- Modify: `apps/landing/src/app/join/page.tsx`
- Modify: `apps/landing/src/lib/buildSubscribeMailto.ts`
- Modify/Create: `apps/landing/tests/*mailto*.test.ts`

- [ ] Keep the active submission path as encoded `mailto:contact@karmyq.org`.

- [ ] Keep visible copyable fallback text: `contact@karmyq.org`.

- [ ] Make the page layout form-shaped enough that Sprint 96 can wire the same fields to the backend:
  - lens;
  - contribution;
  - concern;
  - optional email if the helper still uses structured fields.

- [ ] Add/keep exact mailto encoding tests so user-provided field content cannot reintroduce CodeQL request-forgery/DOM-XSS risks.

- [ ] Run landing tests.

```bash
npm test --workspace=karmyq-landing
```

## Task 7: Perform Copy Accuracy Audit

**Files:**
- Modify: route content files as needed

- [ ] Search for forbidden or misleading copy.

```bash
rg -n "LinkedIn|Roy|In Defense of Gossip|founder group|founding group|moderation|governance templates|questionnaires|Bayesian|federation|community-of-communities|automatic|broadcast" apps/landing/src
```

- [ ] Verify how-it-works copy does not imply:
  - acts broadcast to the community;
  - karma carries to daughter communities after fission;
  - splitting happens automatically at Dunbar threshold;
  - a founder group;
  - moderation features;
  - governance templates;
  - user-level questionnaires;
  - Bayesian updating;
  - federation or community-of-communities layer.

- [ ] Verify "The Problem with Stars" is the single merged reputation essay.

- [ ] Verify "Why No Role Is Permanent" exists.

- [ ] Verify star lines are isolated emphasis lines.

## Task 8: Fold in the Queued Logo Fix

**Files:**
- Modify: `apps/frontend/src/styles/karmyq-shell.css`
- Review: `apps/frontend/src/components/Layout.tsx`
- Review: `apps/frontend/tests/tdd/sprint-88-shell-fidelity.test.tsx`

- [ ] Preserve the existing `.kq-wordmark-seed` change to use `/brand/karmyq-mark.svg`.

- [ ] Confirm no landing changes accidentally overwrite frontend shell styling.

- [ ] Run the existing frontend shell fidelity test if still present.

```bash
npx jest --runTestsByPath apps/frontend/tests/tdd/sprint-88-shell-fidelity.test.tsx
```

## Task 9: Static Export and Visual Verification

**Files:**
- Modify: route files as needed

- [ ] Build the landing app.

```bash
npm run build --workspace=karmyq-landing
```

- [ ] Verify static output exists for all five routes and `/docs`.

```bash
Test-Path apps\landing\out\index.html
Test-Path apps\landing\out\principles\index.html
Test-Path apps\landing\out\how-it-works\index.html
Test-Path apps\landing\out\research\index.html
Test-Path apps\landing\out\join\index.html
Test-Path apps\landing\out\docs\index.html
```

- [ ] Run local visual smoke for desktop and mobile. Walk the mobile nav loop across all five pages plus Docs.

## Task 10: Docs, ADR, and Feedback Loop

**Files:**
- Create: `docs/adr/ADR-075-karmyq-org-multi-route-relaunch.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Create ADR-075 documenting:
  - `karmyq.org` is a five-route static public site;
  - `/docs` remains generated docs;
  - Sprint 95 keeps mailto/contact fallback;
  - Sprint 96 will add backend-backed founding-circle intake.

- [ ] Update ADR index and architecture docs.

- [ ] Run docs generation if ADRs are mirrored to landing docs.

```bash
npm run generate-docs --workspace=karmyq-landing
```

- [ ] Verify ADR-075 was mirrored into generated landing docs, and fix the source/generator if not.

```bash
Test-Path apps\landing\src\data\docs\concepts\adr-075-karmyq-org-multi-route-relaunch.json
rg -n "adr-075-karmyq-org-multi-route-relaunch|ADR-075" apps\landing\src\data\docs\nav.json
```

- [ ] If generated landing docs are part of the PR, stage the ignored generated files explicitly.

```bash
git add -f apps/landing/src/data/docs/concepts/adr-075-karmyq-org-multi-route-relaunch.json apps/landing/src/data/docs/nav.json
```

- [ ] Run feedback check.

```bash
npm run feedback:check
```

## Task 11: SDLC Quality Gates

**Files:**
- Review: branch diff

- [ ] Run `/simplify` after implementation and resolve findings.

```bash
git diff --stat
```

- [ ] Run `/code-review` on the branch diff and resolve correctness findings.

```bash
git diff -- apps/landing apps/frontend docs .claude/handoff/CURRENT_HANDOFF.md
```

- [ ] Run `/security-review` on the branch diff and document any false positives.

```bash
npm audit --package-lock-only --audit-level=high
```

## Task 12: Final Type Check and Pre-Push Verification

**Files:**
- Review: all changed files

- [ ] Run landing test/build gates.

```bash
npm test --workspace=karmyq-landing
npm run build --workspace=karmyq-landing
```

- [ ] Run relevant frontend logo test.

```bash
npx jest --runTestsByPath apps/frontend/tests/tdd/sprint-88-shell-fidelity.test.tsx
```

- [ ] Run repository-level required checks where feasible and document known root-command limitations.

```bash
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

- [ ] Confirm no forbidden copy remains.

```bash
rg -n "LinkedIn|Roy|In Defense of Gossip|founder group|founding group|moderation|governance templates|questionnaires|Bayesian|federation|community-of-communities" apps/landing/src
```

## Task 13: Merge and Deploy

**Files:**
- Review: PR contract

- [ ] Use the `/deploy` skill after Admin merge authorization.

- [ ] Open PR with `.github/pull_request_template.md` copied into the body and completed.

- [ ] After merge to `master`, monitor GitHub Actions deployment.

- [ ] Post-deploy human validation:
  - desktop route loop;
  - mobile hamburger route loop;
  - `/docs` unchanged and reachable;
  - `/join` mailto opens encoded note and visible contact fallback is present;
  - live copy contains no forbidden strings;
  - frontend shell logo renders with the real mark.

---

## Sprint 96 Preview: Founding Circle Backend Intake

Do not implement this in Sprint 95. Capture as the next sprint:

- public endpoint for founding-circle submissions;
- database table and migration;
- rate limit, honeypot, input validation, and canonical errors;
- `/join` client-side submit flow with success/error states;
- visible `contact@karmyq.org` fallback preserved;
- optional notification/export/admin review in a later phase unless Sprint 96 scope expands.
