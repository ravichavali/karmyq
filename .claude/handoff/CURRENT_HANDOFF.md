# Sprint 93 — Provider↔Community Link-Up (Audit-First) + Carry-Forward Fixes — 🚧 IN PROGRESS

> **▶ STATUS (2026-06-10):** Sprint 93 EXECUTING on `feature/sprint-93-provider-linkup`.
> **Tasks 1–7 DONE (all TDD, green, tsc clean):** branch ✅; audit ✅
> (`docs/design/sprint-93-provider-linkup/AUDIT.md`, ratified FULL link-up F1+F2+F3); T3 members-DELETE
> JWT (6 tests); T4 login-401 crash + `getErrorMessage` helper + 5 page sweep (9 tests); T5
> `community_connection` dibs reason extracted to `dibsReason.ts` (5 server + 1 FE tests); T6 F1
> community-scoped discovery (`GET /providers` annotates `shared_communities`, no schema change; 4
> server + 4 card + 2 page tests) + F2 onboarding copy; T7 F3 community-framed provider home + duty
> status (page test). **F3 NOTE:** delivered the bounded coherence increment, NOT the full
> "facets-not-modes" nav redesign (IDEAS [2026-05-06]) — flagged for maintainer; logged as follow-up.
> **Remaining: T8 docs (ADR-073 + ADR-072 addendum + 4 guides + landing), T9 CONTEXT/registry, T10
> gates, T11 verify + bump 11.2.0, T12 PR.** Do NOT push master directly.

**Sprint goal (one sentence):** Audit the full provider↔community journey on the demo
(Playwright), implement the maintainer-ratified link-up fixes, and close three researched
carry-forward bugs (ADR-064 members-DELETE gap, login-401 React crash, false zero-history dibs
copy) — each proven by a test.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-93-provider-linkup`
3. Open plan: `docs/superpowers/plans/2026-06-10-sprint-93-provider-linkup.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Spec:** `docs/superpowers/specs/2026-06-10-sprint-93-provider-linkup-design.md`

---

## Multi-sprint arc

- **S92 (done):** Matching & Dibs Repair — dibs correctness floor (`kind`/`reason`/
  `relationshipContext`, similarity routing), 8-bug sweep.
- **S93 (this):** Provider↔Community link-up, audit-first; carry-forward fixes.
- **S94 (candidates, not committed):** Service Consolidation Phase 2 (geocoding → client-side,
  10→9, ADR-071) OR mobile parity.

## Scope (confirmed with maintainer, 2026-06-10)

- **Centerpiece:** community/service-provider link-up cleanup (IDEAS 2026-06-08), **audit-first**:
  Task 2 = structured Playwright UX audit of the provider journey on the demo → severity-ranked
  fix list → **maintainer ratifies mid-sprint** (AskUserQuestion checkpoint) → implement ratified
  fixes. Spec hypotheses: H1 no community–provider tie (directory is platform-global while
  dibs/matching are community-scoped — confirmed in code: `provider_profiles` has no community
  link); H2 dual-identity navigation; H3 onboarding clarity.
- **Carry-forward bugs (pre-ratified, proceed regardless of audit):**
  - **ADR-064 gap**: `members.ts` DELETE (~L419) reads `admin_user_id` from the request body
    (spoofable); PUT above it was already fixed to use JWT. Fix server + ALL clients (`api.ts`
    `removeMember`/`leaveCommunity`, shared `client.ts`, `ActiveTab.tsx`; check mobile + sim).
  - **login-401 crash**: shared `sendError` (`packages/shared/utils/response.ts:181-188`) emits
    `error: {code,message}` object; the api.ts errorInterceptor (L110-111) normalizes it EXCEPT
    when `.message` is absent (falls back to the object) or the interceptor is bypassed →
    object rendered as React child → React #31 → whole-app ErrorBoundary. **Reproduce first**,
    fix the interceptor chokepoint + 5 JSX-bound page sites (`login.tsx:43`, `register.tsx:47`,
    `invite/[code].tsx:121`, `config-templates.tsx:37`, `configs/public.tsx:75`); do NOT change
    `sendError` shape (log contract mismatch to IDEAS.md).
  - **False dibs copy**: a neighbour admitted via exchange trust edge with 0 completed matches
    (`dibsDb.ts:292-295`) gets `trusted_neighbor` → "You've worked with {name} before" is false.
    Add `community_connection` reason (server `deriveDibsReason` at `dibs.ts:26-30` + DibsPrompt
    copy); pool admission unchanged (GET/POST symmetry).

## Critical implementation notes (copied from spec)

1. **Audit-first gate**: NO link-up implementation before the maintainer ratifies the audit's
   fix list (mid-sprint AskUserQuestion checkpoint). Carry-forward bug fixes (Tasks 3–5) are
   pre-ratified and can proceed in parallel.
2. **Demo audit access** (memory `reference_demo_ux_audit_access`): sim users are
   `*@test.karmyq.com`, password `password123`; confirmed member
   `aisha.white6964@test.karmyq.com` (Berkeley Community Care, plain member). Playwright MCP
   blocks `file://` — serve local mockups via `python -m http.server`. SSH `ubuntu@karmyq.com`
   key-based; DB ops via `karmyq-postgres` container env vars.
3. **login-401 layer call**: the shared `sendError` emits `error: {code, message}` — an object,
   violating the CLAUDE.md contract (`error: "ERROR_CODE"` string). The api.ts errorInterceptor
   (L110-111) already normalizes `data.error` **except** when `.message` is absent (falls back
   to the object) or the client bypasses the interceptor — reproduce first, then fix the
   interceptor chokepoint + the five JSX-bound page sites. Do **NOT** change `sendError`'s shape
   this sprint — log the contract mismatch to `docs/IDEAS.md` as an architecture follow-up.
4. **members DELETE**: `membersRouter` is mounted with `authMiddleware` so
   `(req as any).user?.userId` is available — mirror the PUT handler's pattern
   (`members.ts:289-308`). Keep the last-admin guard (~L496) and the `user_left_community` event
   payload working (`removed_by` = JWT caller).
5. **Dibs GET/POST symmetry**: `POST /requests/:id/dibs` validates the nominee against the same
   pool as the GET candidate. The new `community_connection` reason must not change pool
   admission — it only re-labels the zero-history case.
6. **JWT field is `communities`** (never `communityMemberships`); API client interceptor already
   unwraps the envelope — use `res.data`, not `res.data.data`.
7. **Test commands**: per-service `npm test` = unit+regression ONLY. A `tests/tdd/` file needs
   `npm run test:tdd -- <name>`; verifying a tdd file with `npm test` false-greens. Root
   `tests/unit/request-service/` compiles against service types and runs in CI.
8. **Landing docs are generated** — edit sources, regenerate with
   `cd apps/landing && npm run generate-docs`; `apps/landing/src/data/docs/` is gitignored →
   `git add -f`; grep-verify nav.json after editing (it silently reverts).
9. **Next free ADR = 073.** Root `package.json` version bump 11.1.0 → 11.2.0.
10. **No docs-only push to master** — the Sprint 93 planning commit is local-only on master; the
    sprint branch carries it into the PR. Never push master directly.
11. **Provider directory must stay publicly accessible unauthenticated**; community scoping is an
    authenticated enhancement, not a new auth wall — unless the audit ratifies otherwise.
12. **Feed query surfaces gotcha**: browsable-request filtering lives in 4 places incl.
    `utils/queryBuilder.ts` — if any link-up fix touches request browsability, change ALL of them.

> **Cross-agent review (codex, 2026-06-11):** plan reviewed pre-execution; P1 (Task 12
> over-granted merge/deploy to the executor — now split per AGENTS.md: contributor opens PR +
> stops; Claude/Admin own merge + deploy), P2 (Claude-specific tooling — non-Claude fallback
> added: pause-and-ask-maintainer at checkpoints, manual migration checklist), and the login-401
> root-cause refinement (api.ts interceptor L110-111 already normalizes except the no-`.message`
> gap; sweep 5 page sites, reproduce first) all verified against code and patched into spec +
> plan. Directionally approved.

## Success criteria

- [ ] Provider-journey audit (`docs/design/sprint-93-provider-linkup/AUDIT.md`) with
      severity-ranked findings + maintainer-ratified scope recorded.
- [ ] Ratified link-up fixes implemented with tests (likely: community-scoped provider
      discovery + onboarding/flow copy).
- [ ] ADR-064 members-DELETE gap closed (JWT caller; spoof test red→green; all clients updated).
- [ ] login-401 renders a string message, no ErrorBoundary crash (test); contract mismatch
      logged to IDEAS.md.
- [ ] `community_connection` dibs reason live end-to-end (server + DibsPrompt; tests).
- [ ] ADR-073 written + indexed; ADR-072 addendum; 4 guides updated; landing regenerated,
      nav verified.
- [ ] All four SDLC gates run (testing, /simplify, /code-review, /security-review).
- [ ] `npm test`, `npm run test:tdd`, `npm run feedback:check`, `npm audit` clean; tsc clean.
- [ ] Merged + deployed; version 11.2.0; post-deploy smoke + human validation passed.

## Deferred / backlog (not in S93)

- Service Consolidation Phase 2 (geocoding → client-side, ADR-071) — S94 candidate.
- Mobile parity — S94 candidate.
- Shared `sendError` envelope vs CLAUDE.md contract mismatch (logged to IDEAS in Task 4).
- Dependabot PRs #34–50 unblocking (see persistent context).

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
- **ADR numbering**: ADR-072 created in S92; **next free = 073.**
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name)
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **11.1.0** (Sprint 92) → bump to 11.2.0 in Sprint 93.
- **Request-type config**: `enabled_request_types` may hold legacy names; backend gates only on the
  5 built-ins (`generic|ride|service|event|borrow`) — see BUG-006 fix in `requests.ts`.
- **CI security gates**: dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-service serves the feed** now (`/requests/feed`) + already calls social-graph via `SOCIAL_GRAPH_API_URL`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. Confirm the latest "Deploy to Demo"
run succeeded and live content matches `master` before judging by live content.
