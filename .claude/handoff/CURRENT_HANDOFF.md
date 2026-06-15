# Sprint 100 - Pulse Truth + Feed Actionability - READY TO EXECUTE (v11.8.0 → v11.9.0)

> **STATUS (2026-06-15):** PLANNED, ready to execute. Spec + plan written, scope confirmed with the
> maintainer. Sprint 99 (v11.8.0) is live and validated. The local-only post-deploy docs from S99
> (handoff + audit-log Final Validation) ride **this** sprint's PR (no docs-only push to master).

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-100-pulse-truth-actionability`.
3. Open plan: `docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Make the community pulse tell the truth (distinct helpers, reachable open asks, exchanges that
actually show up as connections), collapse the engagement-y empty state to one honest "you're caught
up" message, make request cards actionable and legible, and fold in four functional items (BUG-009
pulse gap, proposed-match surfacing on Home, BUG-010 split failure, sim liveliness).

**Core principle:** every claim is reachable and true. If the pulse names a number, the member must be
able to see the thing it counts.

---

## Scope (maintainer-confirmed)

### The five findings (root-caused)
- **F1 / BUG-009** — pulse "N neighbours helped each other" counts completed `matches` **rows**, not
  distinct responders (`requests.ts:1070-1077`); and a community trust edge only forms when the
  `match_completed` payload carries `community_id` (`subscriber.ts:45-50`) → counted exchanges show no
  connection. **Decision: count distinct responders AND reconcile connections at the source (ADR-078).**
- **F2** — "N open asks waiting for a hand" counts every community ask incl. own/offered, but the feed
  shows only fillable. **Decision: keep community-wide count, soften copy to "across the community,"
  make the pulse row navigate to a reachable read-only open-asks view.**
- **F3** — engagement-y empty state ("No top matches" + "Show more open requests"). **Decision: collapse
  to the single verbatim "You're caught up" message; remove the Show-more button there.**
- **F4** — request cards aren't clickable. **Decision: wire the card body → `/requests/[id]`
  (stopPropagation on Offer + inner links).**
- **F5** — leading icon (the asker's colored-initial avatar) is unexplained. **Decision: add accessible
  label + tooltip ("Asked by {name}").**

### Folded-in (bug log + ideas)
- **G1 — proposed-match surfacing on Home** (IDEAS 2026-06-15): hundreds of `proposed` responder
  matches never surface as actionable items → established members' Home reads empty. Investigate + surface; right-size.
- **G2 — BUG-010 community split fails** on `446c2c65-64e1-4e8e-9d87-54671939a4da`. Reproduce-first, fix, regression test.
- **G3 — simulation pace / liveliness** (IDEAS 2026-06-15 thread 1): raise pace + spread requests across more test users.

### Explicitly OUT of scope
- **Withdraw-Offer bug (IDEAS 2026-05-20)** — verified already fixed (reject/withdraw guard permits
  either match participant; old requester-only error string gone). IDEAS entry annotated resolved. Do not re-open.
- Broad UI facelift, karma/trust unification, governance/fission redesign, provider/community
  architecture redesign, blog/analytics, "platform forgets" delivery, error-tracker infra.

---

## Critical Implementation Notes (from spec — read before coding)

1. **Audit first, freeze second.** Task 1 confirms live state on `308f7192…`, BUG-009 `eb32c151…`,
   BUG-010 `446c2c65…` before any patch.
2. **Fix at the source, not the client.** F1/F2/G1 are data/API truth bugs.
3. **Distinct, not raw.** `helpedThisWeek` → `COUNT(DISTINCT responder_id)` over the same subset feeding `recentHelpers`.
4. **Reconciliation derives from `request_communities`** at completion — never the event payload's `community_id`.
5. **Backfill is a script** (idempotent, before/after counts), **not** a migration.
6. **`trust_edges_live` is a VIEW** — write through the trust-edge service.
7. **Open-asks reachability includes own + offered**, rendered read-only.
8. **Empty-state copy is verbatim**; remove Show-more there; update onboarding copy same change.
9. **Clickable card must `stopPropagation`** on Offer + inner links/badges.
10. **Trace ALL feed/query surfaces** (incl. `queryBuilder.ts`) before patching feed behavior.
11. **Pulse is the single source of truth** for the in-feed ActivityCard + `GET /pulse`.
12. **G1 right-size; G2 reproduce-first; G3 bounded tuning.**
13. **Version bump** `11.8.0` → `11.9.0`; **ADR-078** next free ADR.

---

## Planning Artifacts

- Spec: `docs/superpowers/specs/2026-06-15-sprint-100-pulse-truth-actionability-design.md`
- Plan: `docs/superpowers/plans/2026-06-15-sprint-100-pulse-truth-actionability.md`
- Audit log (create in Task 1): `docs/bugs/sprint-100-pulse-truth-actionability.md`

---

## Tester Accounts

```text
maria.reyes@test.karmyq.com / password123        # rich state (15 communities, providers, trust)
aisha.white6964@test.karmyq.com / password123    # simpler member (Berkeley Community Care)
```

Communities under investigation:
- `308f7192-5c60-4c52-b7e8-56ead255ba52` (maintainer's report — F1/F2/F4/F5)
- `eb32c151-9953-409f-87ad-9abed720e4f4` (BUG-009 — same pulse gap)
- `446c2c65-64e1-4e8e-9d87-54671939a4da` (BUG-010 — split failure)

---

## Multi-Sprint Arc

- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0).
- **S98 (done):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99 (done):** Release Experience Audit + Fine Tune (v11.8.0).
- **S100 (this sprint):** Pulse Truth + Feed Actionability + fold-ins (v11.9.0).
- **S101+ candidates:** founding-circle review/notify surface, community/provider link-up clarity
  (IDEAS 2026-06-08), research-first UI facelift, "platform forgets" visible-decay delivery.
- **Deferred:** Service Consolidation Phase 2 (geocoding → client-side, ADR-071); mobile parity.

---

## Persistent Context

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models
  are available.

### Architecture Gotchas

- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-077 shipped in S98; next free ADR = **078** (this sprint).
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use
  `res.data`, not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.
- **Pulse single source of truth:** `fetchCommunityPulse` feeds both the in-feed ActivityCard and `GET /pulse`.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).
- `nav.json` silently reverts — always grep-verify after editing.

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
