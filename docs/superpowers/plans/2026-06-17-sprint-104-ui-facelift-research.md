# UI Facelift Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to execute this plan task-by-task.
> Pair with the `frontend-design` skill for the reference-research and direction tasks.

**Goal:** Produce one comprehensive UI Facelift Research doc that audits all four surface clusters,
researches reference directions anchored to the existing token system, and recommends a concrete
redesign direction specific enough to scope the S105 implementation sprint.

**Architecture:** No runtime change. Output is research docs under `docs/design/sprint-104-ui-facelift/`,
a Proposed ADR-079, and updated landing concept/ADR docs. **This is a `no-deploy` plan.**

**Tech Stack:** Docs (Markdown), static HTML mockups, `frontend-design` skill. The app under study:
Next.js 14 Pages Router, CSS-variable token system, ThemeProvider per-community skins.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/design/sprint-104-ui-facelift/README.md` | Primary research doc — synthesis, index, recommended direction |
| `docs/design/sprint-104-ui-facelift/ux-audit.md` | Current-state audit + scorecard per cluster |
| `docs/design/sprint-104-ui-facelift/visual-research.md` | Reference products + aesthetic directions |
| `docs/design/sprint-104-ui-facelift/recommendations.md` | Per-cluster change list → S105 scope |
| `docs/design/sprint-104-ui-facelift/mockups/*.html` | 2–3 static design-direction mockups (throwaway) |
| `docs/adr/ADR-079-visual-design-system-v2.md` | Proposed visual system ADR — **source** (landing JSON auto-generates from this) |

### Existing files to modify
| File | Change |
|------|--------|
| `docs/adr/README.md` | Add ADR-079 (Proposed) to index |
| `docs/concepts/ux-design-principles.md` | **Source** concept — refresh principles toward recommended direction (landing JSON regenerates from this) |
| `scripts/generate-docs.ts` | Add `adr-079-visual-design-system-v2` slug to `ADR_GROUPS` so it appears in the landing ADR nav |
| `.claude/handoff/CURRENT_HANDOFF.md` | Mark S104 done, set S105 implementation direction |

**Landing docs are GENERATED, never hand-edited.** `apps/landing/src/data/docs/` is wiped and
rebuilt by `scripts/generate-docs.ts` on every run (concepts from `docs/concepts/*.md`, ADR pages from
`docs/adr/ADR-*.md`, ADR nav from `ADR_GROUPS`). Edit the sources above, then regenerate with
`cd apps/landing && npm run generate-docs` and `git add -f` the regenerated output (the dir is
gitignored). Do not hand-edit `apps/landing/src/data/docs/**` or `nav.json`.

**No edits to `apps/frontend/src/**`, `globals.css`, or `tailwind.config.js`.**

---

## ⚠️ Critical Implementation Notes (read before Task 1)

1. **Research-first, no app code.** Do not touch `apps/frontend/src/pages/**`, `src/components/**`,
   `globals.css`, or `tailwind.config.js`. Tempting "quick fixes" become S105 recommendations.
2. **Anchor to the existing token system.** Express every direction as deltas to the existing
   CSS-variable tokens (`apps/frontend/src/styles/globals.css` + `tailwind.config.js`). Per-community
   ThemeProvider skins override tokens — any direction must survive re-skinning.
3. **Extend Sprint 87, don't restart.** Reuse `docs/design/sprint-87/scorecard.md`, `ux-audit.md`,
   `visual-research.md` as the baseline; cite what changed since S87.
4. **Mockups are throwaway.** Static HTML under the sprint mockups dir; no app imports, no API
   calls, not route-reachable. Direction illustration only.
5. **No-deploy.** No merge+deploy task. Ships via PR; no demo-deploy validation (no runtime change).
6. **frontend-design skill is the direction engine.** Feed it existing tokens + the cluster audit as
   constraints; avoid generic Tailwind defaults.
7. **ADR-079 ships Proposed.** Not Implemented — S105 advances its status.
8. **Version drift:** `package.json` 11.10.0 vs handoff v11.12.0 — note as S105 housekeeping, don't
   change versions here.
9. **Demo screenshots optional.** Use documented demo UX-audit access; fall back to local
   `npm run dev` or component inventory if demo is unreachable — don't block on screenshots.

---

## Task 1: Branch + baseline review

**Files:**
- Create: `docs/design/sprint-104-ui-facelift/` (directory)

- [ ] Create branch `feature/sprint-104-ui-facelift-research`.
- [ ] Read the Sprint 87 baseline so this sprint extends it: `docs/design/sprint-87/ux-audit.md`,
      `scorecard.md`, `visual-research.md`, `sprint-88-recommendation.md`.
- [ ] Inventory the current token system: read `apps/frontend/src/styles/globals.css` (token block)
      and `apps/frontend/tailwind.config.js` (semantic + karmyq palette). Record the token vocabulary
      that every proposed direction must speak in.
- [ ] Read the anchoring UX ADRs: ADR-020 (trust-first), ADR-053 (feed philosophy),
      ADR-068 (community-page IA).

- [ ] **Verification:** sprint dir exists; a short "baseline since S87" note captured for the audit.

```bash
ls docs/design/sprint-87/ && ls docs/design/sprint-104-ui-facelift/
```

---

## Task 2: Current-state audit — Dashboard/Home + Request feed/detail

**Files:**
- Create: `docs/design/sprint-104-ui-facelift/ux-audit.md`

- [ ] Build the shared scorecard (extend S87's): visual hierarchy, spacing rhythm, density,
      cross-surface consistency, brand/warmth fit, accessibility, mobile readiness — 1–5 each.
- [ ] Audit **Dashboard/Home** (`/dashboard`, logged-in `/index`): component inventory, token usage,
      IA, the "empty Home for established users" hierarchy gap. Score it.
- [ ] Audit **Request feed + detail** (`/requests/index`, `/requests/[id]`, `/offers/*`,
      `/matches/[id]`): card system, detail layout, action-copy surfaces (centralized in S103). Score.
- [ ] Capture current-state evidence (demo screenshots if reachable, else annotated inventory).

- [ ] **Verification:** both clusters scored against the same scorecard with concrete, cited deltas.

---

## Task 3: Current-state audit — Community page + Profile/global chrome

**Files:**
- Modify: `docs/design/sprint-104-ui-facelift/ux-audit.md`

- [ ] Audit **Community page** (`/communities/[id]` overview/requests/graph tabs,
      `/communities/index`): tab system, feed cards, graph surface, elevation/radius consistency vs
      the rest of the app. Score.
- [ ] Audit **Profile + global chrome** (`/profile`, shared nav/header/shell, `_app.tsx`,
      ThemeProvider boundary, trust/karma display). Score.
- [ ] Write the **cross-cluster consistency findings**: name where the four clusters disagree
      (radii, elevation, spacing scale, type ramp, density).

- [ ] **Verification:** all four clusters scored; a cross-cluster drift summary table exists.

---

## Task 4: Reference & visual research (frontend-design skill)

**Files:**
- Create: `docs/design/sprint-104-ui-facelift/visual-research.md`

- [ ] Invoke the `frontend-design` skill. Feed it the existing token vocabulary + the four-cluster
      audit as hard constraints.
- [ ] Research reference products in the mutual-aid / warm-social / community space; capture what
      each does well for the surfaces we care about (home IA, feed cards, community identity, chrome).
- [ ] Distill into **aesthetic principles** anchored to the existing brand (earthy green/teal/cream/
      brown; Fraunces display + Hanken Grotesk body) — evolution, not replacement.

- [ ] **Verification:** `visual-research.md` lists references + principles, each tied to a token
      vocabulary the app already has or a justified extension.

---

## Task 5: Design-direction synthesis + mockups

**Files:**
- Create: `docs/design/sprint-104-ui-facelift/mockups/*.html` (2–3 static HTML)

- [ ] Synthesize **2–3 whole-product design directions**, each with: one-line thesis, token deltas,
      density/rhythm stance, trade-offs.
- [ ] Produce one **static HTML mockup per direction** (throwaway; no app imports, no API, not
      route-reachable) showing a representative surface (e.g. dashboard or community page) in that
      direction. Mirror the Sprint 87 mockups precedent.

- [ ] **Verification:** mockups open standalone in a browser; each maps to a documented direction and
      uses only the existing/extended token vocabulary.

```bash
ls docs/design/sprint-104-ui-facelift/mockups/
```

---

## Task 6: Recommendation + per-cluster S105 scope

**Files:**
- Create: `docs/design/sprint-104-ui-facelift/recommendations.md`
- Create: `docs/design/sprint-104-ui-facelift/README.md`

- [ ] Recommend **one** direction with rationale (scorecard deltas it closes, brand fit, effort).
- [ ] Write the **per-cluster change list** (Dashboard/Home, Community, Feed/detail, Profile/chrome):
      specific token + component changes, sized well enough to become S105 tasks.
- [ ] Note housekeeping for S105: the `package.json` 11.10.0 vs handoff v11.12.0 version drift.
- [ ] Write `README.md` as the primary doc: problem, method, links to audit/research/recommendations,
      the recommended direction, and the S105 rollout sketch.

- [ ] **Verification:** README links all sub-docs; recommendation is singular and actionable; every
      cluster has a concrete change list.

---

## Task 7: ADR-079 (Proposed) + landing docs (via the generator)

**Files:**
- Create: `docs/adr/ADR-079-visual-design-system-v2.md` (source)
- Modify: `docs/adr/README.md`, `docs/concepts/ux-design-principles.md` (source),
  `scripts/generate-docs.ts` (`ADR_GROUPS`)
- Regenerate (do not hand-edit): `apps/landing/src/data/docs/**`

- [ ] Write **ADR-079: Karmyq Visual Design System v2** at status **Proposed** (the generator reads
      the `Status:` line) — context (surface drift), the recommended direction, token-system
      implications, and the rollout decision deferred to S105.
- [ ] Add ADR-079 to `docs/adr/README.md` index.
- [ ] Add the slug `adr-079-visual-design-system-v2` to an appropriate group in `ADR_GROUPS` inside
      `scripts/generate-docs.ts` so it appears in the landing ADR nav.
- [ ] Refresh the **source** concept `docs/concepts/ux-design-principles.md` to reflect the
      recommended principles (framed as "where the system is heading", Proposed).
- [ ] **Regenerate** the landing docs from sources, then `git add -f` the output (dir is gitignored):

```bash
cd apps/landing && npm run generate-docs && cd ../..
git add -f apps/landing/src/data/docs
```

- [ ] **Verification** (assert the generator emitted ADR-079 into both the page set and the nav —
      do NOT hand-edit these files):

```bash
test -f apps/landing/src/data/docs/concepts/adr-079-visual-design-system-v2.json && echo "ADR page generated"
grep -c "adr-079" apps/landing/src/data/docs/nav.json   # must be >= 1 after regenerate
npm run feedback:check
```

---

## Task 8: SDLC quality gates (docs-appropriate)

**Files:** none (review only)

- [ ] **`/simplify`** on the branch diff — tighten the docs/ADR prose, remove redundancy across the
      sub-docs, ensure single-source-of-truth (no duplicated audit content). Verify: clean pass.
- [ ] **`/code-review`** on the branch diff — verify no app code was changed, JSON docs are
      well-formed, nav.json integrity holds, ADR fields complete. Verify: no correctness findings.
- [ ] **`/security-review`** on the branch diff — confirm no secrets/PII in screenshots or research
      docs, no embedded credentials in demo evidence. Verify: no real findings (justify dismissals).
- [ ] Confirm **no `apps/frontend/src/**` / `globals.css` / `tailwind.config.js` changes** in the
      diff (research-first guardrail).

- [ ] **Verification:**

```bash
git diff --name-only master... | grep -E 'apps/frontend/src|globals.css|tailwind.config' && echo "GUARDRAIL VIOLATION" || echo "clean: docs-only"
git diff --check
```

---

## Task 9: Final verification + PR (no deploy)

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] `npm run feedback:check` passes (docs complete).
- [ ] Re-run `cd apps/landing && npm run generate-docs` cleanly and confirm the generated JSON parses
      (the generator emits valid JSON; this just guards against a malformed source ADR/concept).
- [ ] Update `CURRENT_HANDOFF.md`: mark S104 complete; set S105 = UI Facelift Implementation with the
      recommended direction + per-cluster scope as the entry point.
- [ ] Open PR using `.github/pull_request_template.md`. **No merge+deploy task — this plan is
      `no-deploy`.** Do not self-merge; Admin merges. No demo-deploy validation pass required (no
      runtime change).

- [ ] **Verification:**

```bash
npm run feedback:check
cd apps/landing && npm run generate-docs && cd ../..   # regenerates cleanly = sources are valid
git add -f apps/landing/src/data/docs
```

---

## Notes

- **No-deploy:** there is no Task to merge+push to master for a deploy. The PR carries the research;
  it merges through the normal review gate without a demo deploy.
- **Minimum-task note:** this is a research sprint; tasks are audit/research/synthesis rather than
  TDD-then-implement. No `tests/tdd/` task because no runtime behavior changes.
