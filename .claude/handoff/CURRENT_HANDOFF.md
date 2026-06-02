# LinkedIn Launch Relaunch — ✅ IMPLEMENTED on Codex branch, awaiting PR review

> **▶ STATUS:** Sprint 83 merge verified on `origin/master`; local `master` fast-forwarded to `f34eb2e`.
> Codex branched from fresh master as `agent/codex/linkedin-launch-relaunch` and implemented the
> accepted karmyq.org LinkedIn Launch Relaunch scope. Claude should review the PR; agents must not
> self-merge.

## What shipped this sprint
1. **Homepage relaunch copy** — `apps/landing` now leads with a LinkedIn-launch founding-circle invitation
   instead of the manifesto-first "find your neighbors" funnel.
2. **CTA consolidation** — Header, hero, Movement, and CTA cards point at `#founding-circle`; `karmyq.com`
   is secondary "Try the PoC" positioning.
3. **Founding-circle mailto** — `buildFoundingCircleMailto()` encodes email/lens/contribution/concern;
   `contact@karmyq.org` remains visible and copyable as fallback.
4. **ADR-065** — documents domain roles: `karmyq.org` = commons/invitation/docs, `karmyq.com` = working PoC.
5. **Landing docs generated** — ADR-065 JSON exists under `apps/landing/src/data/docs/concepts/` and
   aggregate docs JSON reflects ADR count 63.
6. **PR #51 review fixes** — added ADR-065 to the `generate-docs.ts` ADR nav source so `nav.json`
   persists after regeneration, removed the old production-dead `buildSubscribeMailto()` helper, updated
   Sprint 76 encoding/code-scanning tests to lock the new founding-circle helper, and marked ADR-065
   Implemented.

## Validation run
- ✅ `npm test -- --runInBand` from `apps/landing` — 2 suites, 22 tests passed.
- ✅ `npm run build` from `apps/landing` — passed; existing `Header.tsx` `<img>` lint warning remains.
- ✅ `npm run feedback:check` from root — passed, but reported no staged changes.
- ✅ `npx turbo run test -- --passWithNoTests` from root — 27 tasks successful.
- ✅ Review-fix targeted tests:
  `npx jest tests/unit/frontend/sprint-76-encoding.test.ts --runInBand`;
  `npm run test:regression -- --runInBand sprint-76-code-scanning-gate.test.ts` from `tests`;
  `npm test -- --runInBand` from `apps/landing`; `npm run build` from `apps/landing`.
- ⚠️ `npx tsc --noEmit` from root — exits with TypeScript help because root has no tsconfig project.
- ⚠️ `npm run test:unit` from root — Turbo reports missing `test:unit` task.
- ⚠️ Plain `npm test -- --passWithNoTests` from root forwards args incorrectly to Turbo; use
  `npx turbo run test -- --passWithNoTests` instead.

## Preflight live-site sync
- `karmyq.org` was checked before implementation and is still out of sync with fresh `master` content.
- This appears to be deploy/live-site drift, not a branch issue. Do not judge the relaunch by current live
  content until deploy status is confirmed after PR merge.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git switch agent/codex/linkedin-launch-relaunch`
3. Review diff, especially `apps/landing/src/lib/buildSubscribeMailto.ts` and
   `apps/landing/tests/regression/founding-circle-mailto.test.ts`
4. Force-add ignored landing docs before commit/PR:
   `git add -f apps/landing/src/data/docs/concepts/adr-065-karmyq-org-and-com-domain-roles.json`
5. Open PR with `.github/pull_request_template.md` body; Claude reviews, Admin merges

---

## Sprint Goal

Refocus `karmyq.org` from manifesto-first into a LinkedIn-launch invitation for specialists to join the
founding circle, while documenting the `.org`/`.com` role split and preserving mailto safety.

---

## Review checklist
- Confirm the homepage tone matches the accepted LinkedIn launch plan.
- Confirm every user-provided mailto field is encoded and covered by exact-output regression.
- Confirm `contact@karmyq.org` is visible/copyable, not only hidden behind protocol handling.
- ADR-065 nav/source/status review items are fixed; Claude should re-check the updated PR diff.
- Confirm ignored generated docs are included in the PR with forced add.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ NEXT-SESSION WARM-UP — unblock dependabot PRs
The 8 open dependabot PRs (#33–41) predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY).

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation, 063 = canonical trust metric + unified graph viz, 064 = authorize from authenticated identity, **065 = karmyq.org/karmyq.com domain roles**.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: 10.7.0 (→ 10.8.0 this sprint)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### Sprint 81 residual (now being addressed by item #2 above)
- JWT-in-URL exposure → nginx log scrub (item 2). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
