# Provider↔Community Link-Up (Audit-First) + Carry-Forward Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Non-Claude executors (Codex/others):** where this plan names Claude-specific tooling
> (sub-skills, AskUserQuestion, the migration-validator agent), the fallback is: work the tasks
> sequentially yourself, and **pause and ask the maintainer directly** at every decision
> checkpoint instead of AskUserQuestion. Never improvise past a checkpoint.

**Goal:** Audit the full provider↔community journey on the demo, implement the maintainer-ratified link-up fixes, and close three researched carry-forward bugs (ADR-064 members-DELETE gap, login-401 React crash, false zero-history dibs copy).

**Architecture:** No new services. The link-up MVP is a query/UX change scoping provider discovery to the viewer's communities (the trust boundary dibs/matching already use), ratified mid-sprint from a Playwright audit; ADR-073 records the model. Carry-forward fixes touch community-service (JWT-derived caller on members DELETE), the frontend (string-safe error rendering), and request-service (new `community_connection` dibs reason).

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

**Spec:** `docs/superpowers/specs/2026-06-10-sprint-93-provider-linkup-design.md`

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/design/sprint-93-provider-linkup/AUDIT.md` | Screenshot-backed provider-journey audit + severity-ranked fix list |
| `docs/adr/ADR-073-provider-community-linkup.md` | Audit findings + ratified link-up model |
| `services/community-service/tests/tdd/sprint-93-members-delete-jwt.test.ts` | TDD: DELETE members derives caller from JWT, body spoof ignored |
| `apps/frontend/tests/tdd/sprint-93-login-error-render.test.tsx` | TDD: failed login renders string message, never an object |
| `services/request-service/tests/tdd/sprint-93-dibs-reason.test.ts` | TDD: `community_connection` reason for zero-history exchange-edge neighbour |
| `infrastructure/postgres/migrations/20260610-provider-communities.sql` | ONLY IF RATIFIED: explicit provider↔community listing |

### Existing files to modify
| File | Change |
|------|--------|
| `services/community-service/src/routes/members.ts` | DELETE handler: caller from JWT, ignore body `admin_user_id` |
| `apps/frontend/src/lib/api.ts` | `removeMember`/`leaveCommunity` drop `admin_user_id` body; errorInterceptor (L110-111) never leaves an object on `data.error` |
| `packages/shared/api/client.ts` | `removeCommunityMember` drops `admin_user_id` body |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Updated `removeMember` call sites |
| `apps/frontend/src/pages/login.tsx` (+ `register.tsx`, `invite/[code].tsx`, `communities/config-templates.tsx`, `communities/configs/public.tsx`) | String-coerced error rendering at all JSX-bound `data?.error` sites (fixes React #31) |
| `services/request-service/src/routes/dibs.ts` | `deriveDibsReason`: zero-history neighbour → `community_connection` |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | `community_connection` copy + type union |
| `services/request-service/src/routes/providers.ts` | Post-ratification: community-scoped discovery (likely) |
| `apps/frontend/src/pages/providers/index.tsx`, `providers/new.tsx` | Post-ratification: directory grouping + onboarding copy (likely) |
| `docs/guides/using-service-providers-guide.md`, `provider-mode-guide.md`, `dibs-request.md`, `provider-dibs-guide.md` | Guide updates |
| `docs/adr/ADR-072-dibs-scope.md`, `docs/adr/README.md` | Reason-union addition; ADR index |
| `services/{request,community}-service/CONTEXT.md`, `services/registry.json` | Endpoint/contract updates |
| `package.json` | 11.1.0 → 11.2.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Audit-first gate**: NO link-up implementation before the maintainer ratifies the audit's fix list (mid-sprint AskUserQuestion checkpoint). Carry-forward bug fixes (Tasks 3–5) are pre-ratified and proceed regardless.
2. **Demo audit access** (memory `reference_demo_ux_audit_access`): sim users `*@test.karmyq.com`, password `password123`; confirmed member `aisha.white6964@test.karmyq.com` (Berkeley Community Care). Playwright MCP blocks `file://`. SSH `ubuntu@karmyq.com` key-based.
3. **login-401 layer call**: shared `sendError` (`packages/shared/utils/response.ts:181-188`) emits `error: {code, message}` — an object, violating the CLAUDE.md contract. The api.ts errorInterceptor (L110-111) already normalizes it **except** when `.message` is absent (falls back to the object) or the client bypasses the interceptor — reproduce first, fix the interceptor chokepoint + the five JSX-bound page sites. Do **NOT** change `sendError`'s shape this sprint — log the contract mismatch to `docs/IDEAS.md`.
4. **members DELETE**: `membersRouter` already mounts `authMiddleware` → `(req as any).user?.userId` is available; mirror the PUT handler (`members.ts:289-308`). Keep the last-admin guard (~L496) and `user_left_community` event (`removed_by` = JWT caller).
5. **Dibs GET/POST symmetry**: `community_connection` only re-labels the zero-history case — pool admission rules unchanged; `deriveDibsReason` at `dibs.ts:26-30`.
6. **JWT field is `communities`**; API client interceptor already unwraps the envelope (`res.data`, not `res.data.data`).
7. **Test commands**: per-service `npm test` = unit+regression ONLY; tdd files need `npm run test:tdd -- <name>` (a tdd file under `npm test` false-greens). Root `tests/unit/request-service/` compiles against service types and runs in CI.
8. **Landing docs are generated**: edit sources; `cd apps/landing && npm run generate-docs`; `git add -f apps/landing/src/data/docs`; grep-verify nav.json (it silently reverts).
9. **Next free ADR = 073**; version bump 11.1.0 → 11.2.0.
10. **No docs-only push to master** — the planning commit is local-only on master; never push master directly.
11. **Provider directory stays publicly accessible unauthenticated**; community scoping is an authenticated enhancement, not an auth wall (unless ratified otherwise).
12. **Feed query surfaces gotcha**: browsable-request filtering lives in 4 places incl. `utils/queryBuilder.ts` — if a link-up fix touches browsability, change ALL of them.

---

## Task 1: Sprint branch

**Files:** none (git only)

- [ ] **Create the branch from local master** (which carries the planning commit)

```bash
git checkout -b feature/sprint-93-provider-linkup
```

- [ ] **Verify the planning docs are on the branch**

```bash
git log --oneline -2   # expect: docs: Sprint 93 spec + plan — ready to execute
```

## Task 2: Provider-journey UX audit (Playwright, demo) → ratification checkpoint

**Files:**
- Create: `docs/design/sprint-93-provider-linkup/AUDIT.md` (+ screenshots in same dir)

- [ ] **Walk the full journey on https://karmyq.com with Playwright MCP**, capturing a screenshot + note at each step: login as a plain member → browse `/providers` (note: whose providers? any community framing?) → "Become a provider" onboarding (`/providers/new`) → provider mode switch → provider dashboard surfaces → create a `service` request as a second account → dibs prompt framing → provider receives/accepts → completion + review. Use `aisha.white6964@test.karmyq.com` / `password123`; pick a provider-profiled second account via the demo DB if needed.
- [ ] **Test hypotheses H1–H3 from the spec** (no community–provider tie; dual-identity navigation; onboarding clarity) and record any additional findings.
- [ ] **Write `AUDIT.md`**: journey map, finding per step, severity rank (P0–P3), and a concrete proposed fix list with effort estimates.
- [ ] **Ratification checkpoint**: present the fix list to the maintainer (AskUserQuestion on Claude; non-Claude executors pause and ask the maintainer directly); record the decision (what ships in S93 vs deferred) at the top of AUDIT.md.

```bash
ls docs/design/sprint-93-provider-linkup/AUDIT.md   # exists, contains "Ratified scope" section
```

## Task 3: Members-DELETE JWT fix (ADR-064 close-out) — TDD

**Files:**
- Create: `services/community-service/tests/tdd/sprint-93-members-delete-jwt.test.ts`
- Modify: `services/community-service/src/routes/members.ts`, `apps/frontend/src/lib/api.ts`, `packages/shared/api/client.ts`, `apps/frontend/src/components/community/tabs/ActiveTab.tsx`

- [ ] **Write failing tests FIRST**: (a) DELETE with a body `admin_user_id` of another admin but a non-admin JWT → 403; (b) self-remove (JWT userId === param userId) succeeds with no body; (c) admin JWT removing another member succeeds with no body; (d) last-admin guard still blocks; (e) `user_left_community` event `removed_by` = JWT caller.

```bash
cd services/community-service && npm run test:tdd -- sprint-93-members-delete-jwt   # red
```

- [ ] **Fix the handler** (`members.ts` DELETE, ~L419): derive caller from `(req as any).user?.userId` (401 if missing), `isSelfRemove = userId === caller`, admin check on caller, ignore body entirely — mirror the PUT pattern at L289-308.
- [ ] **Update ALL clients** (grep `admin_user_id` first — known: `api.ts` `removeMember`/`leaveCommunity`, shared `client.ts`, `ActiveTab.tsx` call sites; check mobile + simulation too).

```bash
cd services/community-service && npm run test:tdd -- sprint-93-members-delete-jwt && npm test
```

- [ ] **/simplify** the task diff.

## Task 4: Login-401 crash fix — TDD

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-93-login-error-render.test.tsx`
- Modify: `apps/frontend/src/pages/login.tsx` (+ any other `data?.error` render sites found by grep)

- [ ] **Reproduce FIRST against current code** (codex review): the api.ts errorInterceptor at
  `api.ts:110-111` ALREADY normalizes `data.error` → `error.message || error` — so the S89-observed
  crash may be partially mitigated. Two confirmed residual gaps: (a) the interceptor falls back to
  the **object** when `.message` is absent; (b) any client path that bypasses the interceptor.
  Reproduce a failed login on the demo (or in a test) and write down which path crashes today.
- [ ] **Write failing test FIRST** covering **page behavior**: reject login with
  `response.data = { success: false, error: { code: 'UNAUTHORIZED' } }` (no `.message` — the
  interceptor-gap shape) and with `error: { code, message }` → the page shows a string and does
  NOT throw (React #31 guard: assert no object child).

```bash
cd apps/frontend && npm run test:tdd -- sprint-93-login-error-render   # red
```

- [ ] **Fix at the interceptor chokepoint** (`api.ts:110-111`): never leave an object on
  `data.error` — `typeof error === 'string' ? error : error.message ?? error.code ?? 'Request failed'`.
- [ ] **Defensive page sweep** (all JSX-bound `data?.error ||` sites found by grep — do not assume
  login is the only path): `login.tsx:43`, `register.tsx:47`, `invite/[code].tsx:121`,
  `communities/config-templates.tsx:37`, `communities/configs/public.tsx:75` — prefer
  `data?.error?.message ?? (typeof data?.error === 'string' ? data.error : undefined) ?? data?.message ?? err.message ?? '<fallback>'`.
- [ ] **Log the contract mismatch** (shared `sendError` object vs CLAUDE.md string `error`) to `docs/IDEAS.md` as an architecture follow-up.

```bash
cd apps/frontend && npm run test:tdd -- sprint-93-login-error-render && npm test
```

- [ ] **/simplify** the task diff.

## Task 5: `community_connection` dibs reason — TDD

**Files:**
- Create: `services/request-service/tests/tdd/sprint-93-dibs-reason.test.ts`
- Modify: `services/request-service/src/routes/dibs.ts`, `apps/frontend/src/components/requests/DibsPrompt.tsx`

- [ ] **Write failing tests FIRST**: `deriveDibsReason('neighbor', { priorCompletedMatches: 0, ... })` → `community_connection`; `>=1` without similarity → `trusted_neighbor`; `>=1` with similarity → `prior_similar_success`; provider unchanged. Extend the existing unit coverage in `tests/unit/dibs-candidate-kind.test.ts` if it asserts the reason union.

```bash
cd services/request-service && npm run test:tdd -- sprint-93-dibs-reason   # red
```

- [ ] **Server**: add `community_connection` to the `DibsReason` union and `deriveDibsReason` (zero-history neighbour branch). Pool admission rules MUST NOT change (GET/POST symmetry).
- [ ] **Frontend**: `DibsPrompt.tsx` — add the reason to the type union + copy: "You're connected with {name} in your community. Ask them first?"; keep the default fallback for unknown reasons. Fix the now-honest `trusted_neighbor` copy if needed.

```bash
cd services/request-service && npm run test:tdd -- sprint-93-dibs-reason && npm test && cd ../../apps/frontend && npm test
```

- [ ] **/simplify** the task diff.

## Task 6: Link-up fixes — ratified scope (likely: community-scoped provider discovery)

**Files (adjust to ratified scope):**
- Modify: `services/request-service/src/routes/providers.ts`, `apps/frontend/src/pages/providers/index.tsx`, `apps/frontend/src/components/providers/ProviderCard.tsx`
- Create (only if ratified): `infrastructure/postgres/migrations/20260610-provider-communities.sql`

- [ ] **Implement exactly the fix list ratified at Task 2's checkpoint.** Likely MVP (H1): authenticated `GET /requests/providers` supports community scoping (`?community_id=` and/or "shares a community with you" grouping via `communities.members` join); unauthenticated behaviour unchanged; directory UI groups/badges providers by shared community.
- [ ] **TDD first** for whatever ships: scoping tests in `services/request-service/tests/tdd/` (e.g. provider in viewer's community appears under the community group; non-member provider still visible but unbadged — per ratified rules).
- [ ] **If a migration ships**: dated, idempotent, `IF NOT EXISTS`, no cross-schema FK; run the migration-validator agent (Claude) — non-Claude executors review manually against that exact checklist: cross-schema FK issues, `IF NOT EXISTS` guards, schema ownership.

```bash
cd services/request-service && npm run test:tdd -- sprint-93 && npm test
```

- [ ] **/simplify** the task diff.

## Task 7: Link-up flow copy + onboarding (ratified H2/H3 scope)

**Files (adjust to ratified scope):**
- Modify: `apps/frontend/src/pages/providers/new.tsx`, `apps/frontend/src/components/ProviderModeSwitcher.tsx`, onboarding workflow copy in `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] **Implement the ratified H2/H3 fixes** (onboarding explains the community relationship; dual-identity navigation cleanups). Update `workflows.ts` for any changed workflow key.
- [ ] **Frontend tests** for new conditional UI per the pre-merge minimum-coverage table.

```bash
cd apps/frontend && npm test
```

- [ ] **/simplify** the task diff.

## Task 8: User guides + landing docs + ADR-073 (+ ADR-072 addendum)

**Files:**
- Create: `docs/adr/ADR-073-provider-community-linkup.md`
- Modify: `docs/guides/using-service-providers-guide.md`, `docs/guides/provider-mode-guide.md`, `docs/guides/dibs-request.md`, `docs/guides/provider-dibs-guide.md`, `docs/adr/ADR-072-dibs-scope.md`, `docs/adr/README.md`

- [ ] **ADR-073**: audit findings, ratified link-up model, status `Implemented` on merge; index in `docs/adr/README.md`.
- [ ] **ADR-072 addendum**: `community_connection` in the reason union.
- [ ] **Guides**: community-scoped discovery + onboarding flow (using-service-providers, provider-mode); three neighbour reasons (dibs-request, provider-dibs).
- [ ] **Regenerate landing docs** and verify nav integrity:

```bash
cd apps/landing && npm run generate-docs && git add -f src/data/docs && grep -c "adr-073" src/data/docs/nav.json
```

## Task 9: CONTEXT.md + registry.json + integration test

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/community-service/CONTEXT.md`, `services/registry.json`

- [ ] **CONTEXT.md**: changed endpoints (providers scoping, dibs reason union, members DELETE contract) in "API Endpoints"; bugs fixed → "Recent Fixes".
- [ ] **registry.json**: `apis.provides` updates for changed contracts.
- [ ] **Integration/TDD test** covering the end-to-end ratified flow lives in the service `tests/tdd/` (from Tasks 3–6 — confirm coverage, add a journey test if gaps).

```bash
npm run feedback:check
```

## Task 10: SDLC quality gates

- [ ] **/simplify** — final pass on the whole branch diff.

```bash
git diff master --stat   # review scope before the pass
```

- [ ] **/code-review** — on the branch diff; resolve correctness/logic findings before merge.

```bash
# verification: zero unresolved correctness findings
```

- [ ] **/security-review** — on the branch diff; resolve real findings; written justification for any dismissal (note: the recurring `js/request-forgery` FP on `api.ts` baseURL is a known false positive).

```bash
# verification: zero unjustified findings
```

## Task 11: Final verification

- [ ] **Type check + full test tiers + docs loop + audit**

```bash
npx tsc --noEmit -p services/community-service && npx tsc --noEmit -p services/request-service && npx tsc --noEmit -p apps/frontend
npm test
npm run test:tdd
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

- [ ] **Bump root `package.json`** 11.1.0 → 11.2.0.
- [ ] **Update handoff**: mark completed tasks, record ratified scope + any deferred findings.

## Task 12: PR + Merge + Deploy (authority split per AGENTS.md "Lanes & Merge Authority")

**Any executor (contributor or orchestrator):**
- [ ] **Open the PR** (template contract: Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane) and **update the handoff** with PR number + state. Contributor agents STOP HERE — never self-merge.

**Claude (orchestrator) / Admin only:**
- [ ] **Merge-readiness validation + merge recommendation** (Claude); merge executes only on Admin authorization ("pull it in"): `gh pr merge --admin --squash --delete-branch`.
- [ ] **Use the `/deploy` skill**: merge to master triggers GitHub Actions → deploy.sh on karmyq.com; monitor the run; remember the CodeQL gate can false-block the fix-shipping push (re-run after rescan).
- [ ] **Post-deploy smoke**: all services healthy; failed login shows the message (no ErrorBoundary); members DELETE works from the UI; dibs prompt renders the right reason copy; provider directory shows ratified scoping.
- [ ] **Human validation step** (sprint-validation standard): API smoke test + DB check + UI check with the maintainer.
