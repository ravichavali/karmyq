# Belonging Graph System — Research & ADR Implementation Plan (Sprint 110)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

> **`no-deploy`** — this is a research/ADR sprint (mirrors S104/ADR-079). It ships **documentation
> only**: an audit, a reference study, ADR-081 (Proposed), a landing concept page, and the S111
> design spec. **No app code, no migration, no version bump, no deploy task.** S111 implements.

**Goal:** Decide — with evidence — the single, prominent, interactive/expandable "belonging graph"
system that replaces today's patchwork, and hand S111 a ready-to-build design spec + Proposed ADR-081.

**Architecture:** No runtime change. Output is `docs/design/sprint-110-belonging-graphs/`,
`docs/adr/ADR-081-belonging-graph-system.md`, the landing concept JSON, and the S111 spec.

**Tech Stack (context for the audit):** Next.js 14 Pages Router, D3 v7 (HEB + force), dead libs
`cytoscape`/`react-cytoscapejs`/`react-force-graph-2d`, social-graph-service (port 3010).

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/design/sprint-110-belonging-graphs/audit.md` | Surface-by-surface audit + scorecard, with file:line evidence |
| `docs/design/sprint-110-belonging-graphs/references.md` | Reference-product study → concrete lessons mapped to surfaces |
| `docs/adr/ADR-081-belonging-graph-system.md` | The decision (Status: Proposed) — **source of the landing concept JSON, which is generated** |
| `docs/superpowers/specs/2026-06-22-sprint-111-belonging-graph-system-design.md` | S111 implementation design spec (the research output) |

### Existing files to modify
| File | Change |
|------|--------|
| `docs/adr/README.md` | Add ADR-081 to the index (drift gate requires it) |
| `scripts/generate-docs.ts` | Add `adr-081-belonging-graph-system` to `ADR_GROUPS` (the curated Technical nav) — this is how the concept page + `nav.json` get wired |
| `.claude/handoff/CURRENT_HANDOFF.md` | Replace with the S110 handoff (already done in planning; update on completion) |

> **⚠️ Landing docs are GENERATED — never hand-edit them.** `scripts/generate-docs.ts` builds
> `apps/landing/src/data/docs/concepts/adr-*.json` from `docs/adr/*.md` and writes `nav.json` from the
> hardcoded `ADR_GROUPS` list, and `main()` does `fs.rmSync(OUT_DIR)` first — so any hand-edited
> concept JSON or `nav.json` is **wiped on the next generate**. The "nav.json silently reverts" gotcha
> (`feedback_nav_json_revert`) *is* this generator. Correct flow: write the ADR markdown → add its slug
> to `ADR_GROUPS` → `cd apps/landing && npm run generate-docs` → `git add -f apps/landing/src/data/docs`.
> See the `reference_generate_docs` memory.

### Files audited (read-only — DO NOT edit in S110)
`apps/frontend/src/components/{NetworkGraph,TrustGraph,TrustGraphHEB,TrustPathBadge}.tsx`,
`components/graphs/{TrustGraphHEB,CommunityDepthGraph}.tsx`,
`components/dashboard/TrustNetworkWidget.tsx`, `components/community/tabs/TrustGraphTab.tsx`,
`pages/profile.tsx`, `hooks/{useTrustPath,useLazyGraphData}.ts`,
`lib/{socialGraphClient,socialGraphUrls,api}.ts`, `apps/frontend/package.json`.

---

## ⚠️ Critical Implementation Notes (read before Task 1)

1. **No-deploy, no version bump.** ADR-081 is **Proposed**; version stays `11.17.0`. No deploy task.
2. **The audit is the deliverable — verify every claim in code** (dead libs unimported, `/network`
   absent, two D3 idioms) with exact file:line evidence before writing references/ADR.
3. **No app-code edits in S110.** No deleting dead libs, no merging wrappers — that is S111. Keep the
   research branch documentation-only.
4. **Re-introducing expand must answer S79** (why it was removed; how this avoids that). Rationale → ADR-081.
5. **Keep the data layer** (`socialGraphClient`, `useLazyGraphData`, `useTrustPath`, social-graph contracts).
6. **Drift gate:** ADR-081 in `docs/adr/README.md` + landing concept wired via `ADR_GROUPS`, or CI fails.
7. **Landing docs are GENERATED — do NOT hand-edit `nav.json` or the concept JSON.** Add the slug to
   `ADR_GROUPS` in `scripts/generate-docs.ts`, run `npm run generate-docs`, then commit the output. The
   generator wipes `OUT_DIR` every run, so hand edits vanish (the real cause of "nav.json reverts").
8. **Landing generated docs are gitignored** — `git add -f apps/landing/src/data/docs` after generating.
9. **Decide `CommunityDepthGraph`'s fate explicitly** in ADR-081 (fold into HEB, or sanctioned exception).
10. **This repo is Windows/PowerShell** — verification commands use `rg`/PowerShell, not Bash `for`/`grep`/`2>/dev/null`.
11. **Expected-dirty tree:** the planning artifacts (this plan, the spec, the modified handoff) are
    carried onto the S110 branch — Task 1 confirms the correct base + *expected* WIP, not a clean tree.

---

## Task 1: Feature branch

**Files:** none (branch only)

- [ ] Create the branch off `origin/master` (not local master — `feedback_branch_off_origin_not_local_master`)

```bash
git fetch origin && git checkout -b feature/sprint-110-belonging-graph-research origin/master
```

- [ ] Confirm the correct base **and the expected WIP** — the tree is *not* clean: the planning
      artifacts (this plan, the spec, the modified `CURRENT_HANDOFF.md`) are carried from planning onto
      this branch by `checkout -b`. Confirm those are the only changes, then `git add` them.

```powershell
git log --oneline -1; git status --short
# Expect exactly: modified .claude/handoff/CURRENT_HANDOFF.md + untracked docs/superpowers/{plans,specs}/...sprint-110-...
```

---

## Task 2: Formalize the current-state audit (with evidence)

**Files:**
- Create: `docs/design/sprint-110-belonging-graphs/audit.md`

- [ ] **Verify each audit claim in code and record file:line evidence:**
  - Dead libs: confirm `cytoscape`, `react-cytoscapejs`, `react-force-graph-2d` are unimported
    (any hit outside a `.d.ts` is a real import).

```powershell
rg -t ts -t tsx "cytoscape|react-cytoscapejs|react-force-graph" apps/frontend/src --glob "!*.d.ts"
```

  - Dead route: confirm no `/network` page exists.

```powershell
Get-ChildItem apps/frontend/src/pages -Filter "network*" -ErrorAction SilentlyContinue
# No output = confirmed dead link
```

  - Two D3 idioms: confirm HEB (`TrustGraphHEB`) vs force (`CommunityDepthGraph`).
- [ ] **Write the audit:** the six-surface table (from the spec), the three-idiom finding, the four
      duplicated wrappers, the S79 expand-removal note, and a 1–5 scorecard per surface
      (consistency, prominence, interactivity, narrative/"belonging" clarity, code health).
- [ ] **Verification:** audit names all six surfaces, cites file:line evidence for every "patchy"
      root cause, and ends with a prioritized problem list.

```powershell
rg -c "src/" docs/design/sprint-110-belonging-graphs/audit.md   # evidence present
```

---

## Task 3: Reference-product study

**Files:**
- Create: `docs/design/sprint-110-belonging-graphs/references.md`

- [ ] Study the reference set from the spec (Obsidian/Roam graph view, LinkedIn degrees, Are.na/Kumu
      expand-on-click, GitHub/Wrapped identity-data warmth, D3 HEB galleries).
- [ ] For each: 2–3 concrete "steal this" lessons, **each mapped to a specific Karmyq surface and a
      candidate S111 task.**
- [ ] Answer the S79 question: why was progressive expand removed, and what design choices (scope to
      `/network`, capped growth, smooth transitions, collapse affordance) make it safe to reintroduce.
- [ ] **Verification:** every lesson maps to a named surface; the S79 rationale is explicit.

---

## Task 4: Author ADR-081 (Proposed) — the decision

**Files:**
- Create: `docs/adr/ADR-081-belonging-graph-system.md`
- Modify: `docs/adr/README.md` (add to index)

- [ ] Write ADR-081 with: Status **Proposed**, Date 2026-06-22, Sprint **110 (research) → 111 (impl)**,
      Version 11.17.0. Mirror ADR-079's format.
- [ ] Record the decision (spec §D1–D6): one HEB engine; drop dead libs; one client data model + one
      `<BelongingGraph>` wrapper; a real full-page `/network` explorer; deliberate expand reintroduction;
      raised profile altitude. **Explicitly decide `CommunityDepthGraph`'s fate** (fold to HEB vs sanctioned exception).
- [ ] Include **Alternatives considered** (keep two idioms; adopt cytoscape/force-graph instead of D3;
      do nothing) and **Consequences** (bundle size down, one visual language, expand perf risk + mitigation).
- [ ] Add the ADR-081 row to `docs/adr/README.md`.
- [ ] **Verification:**

```powershell
rg "ADR-081" docs/adr/README.md   # one hit = indexed OK
```

---

## Task 5: Generate the landing concept page (do NOT hand-edit generated files)

**Files:**
- Modify: `scripts/generate-docs.ts` (add slug to `ADR_GROUPS`)
- Generated (commit, don't author): `apps/landing/src/data/docs/concepts/adr-081-belonging-graph-system.json`, `apps/landing/src/data/docs/nav.json`

> The concept JSON is generated from `docs/adr/ADR-081-*.md` (Task 4) and `nav.json` is generated from
> `ADR_GROUPS`. `main()` wipes `OUT_DIR` first, so hand-editing either file is pointless — it's
> overwritten on the next build. Wire via the source (`ADR_GROUPS`) and regenerate.

- [ ] Add `'adr-081-belonging-graph-system'` to the appropriate group in `ADR_GROUPS` in
      `scripts/generate-docs.ts` (Trust & Reputation group fits — it sits near `adr-063-...-unified-graph`
      and `adr-054-trust-graph-architecture`).
- [ ] Regenerate the landing docs:

```powershell
cd apps/landing; npm run generate-docs; cd ../..
```

- [ ] Verify the generator produced the concept and wired the nav (do not edit by hand):

```powershell
rg "adr-081-belonging-graph-system" apps/landing/src/data/docs/nav.json
Test-Path apps/landing/src/data/docs/concepts/adr-081-belonging-graph-system.json
```

- [ ] `git add -f apps/landing/src/data/docs` (the output dir is gitignored).

---

## Task 6: Write the S111 implementation design spec

**Files:**
- Create: `docs/superpowers/specs/2026-06-22-sprint-111-belonging-graph-system-design.md`

- [ ] Turn the approved direction into an executable S111 spec: data-model unification, the
      `<BelongingGraph>` component API (modes `ego|community|communities|fission`), the `/network`
      explorer (mode switch, depth control, search/focus, click-to-expand), dead-lib removal steps,
      profile-altitude treatment, the test plan, and the user-guide/landing updates S111 must ship.
- [ ] Carry forward any **backend endpoint gaps** the research surfaced as explicit S111 line items.
- [ ] **Verification:** spec has a File Map and a task outline S111 can run without re-deriving the audit.

---

## Task 7: Verification — full pre-push gate (not docs-only shortcuts)

**Files:** none (verification)

> Even though this sprint touches no app code, the standing pre-push gate ([CLAUDE.md](../../CLAUDE.md))
> names `npm test` (unit + regression) as the blocking check — and the pre-push hook will run it
> anyway. Run it here so a green local push is real, not assumed.

- [ ] **`npm test`** (unit + regression) — the blocking pre-push gate; must pass.

```powershell
npm test
```

- [ ] Run the doc-context drift gate (ADR indexed, nav wired) and the advisory feedback check:

```powershell
cd tests; npx jest regression/doc-context-drift-gate.test.ts --runInBand; cd ..
npm run feedback:check
```

- [ ] Run `/simplify` on the diff (docs prose tightening) and **`/code-review` + `/security-review`**
      on the branch diff. For a docs-only diff these largely confirm "no code risk"; record that
      result rather than skipping the gates (SDLC gates run every sprint — `feedback_sdlc_quality_gates`).
- [ ] **Verification:** `npm test` green; drift gate green; feedback:check advisory output reviewed;
      review gates recorded.

---

## Task 8: Open the PR (docs-only, no deploy) + update handoff

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Update the handoff: S110 complete (research/ADR-081 Proposed), S111 is "execute the belonging
      graph system" with a pointer to the new S111 spec.
- [ ] Commit and open the PR. **`gh pr create` must use the repo PR template as the body** (AGENTS.md
      requires the `.github/pull_request_template.md` contract for CLI PRs — `--fill` does NOT do this);
      fill every section and tag it research/no-deploy so reviewers know no version bump/deploy is expected.

```powershell
git add -A; git add -f apps/landing/src/data/docs
git commit -m "Sprint 110: Belonging Graph System research + ADR-081 (Proposed)"
git push -u origin feature/sprint-110-belonging-graph-research
gh pr create --title "Sprint 110: Belonging Graph System research + ADR-081 (Proposed)" --body-file .github/pull_request_template.md
# then edit the PR body to fill every template section (research/no-deploy, no version bump)
```

- [ ] **Verification:** PR shows only docs changes; no `package.json` version change; CI drift gate green.

> **No deploy task.** Merging this docs PR still runs CI, but there is no version bump and no manual
> deploy step. S111 is where code ships and `/deploy` runs.
