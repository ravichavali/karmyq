# Sprint 84 — Unified Feed & Dashboard Redesign (Research & Direction) — ✅ COMPLETE · Sprint 85 = implement

> **▶ STATUS (2026-06-03):** Sprint 84 **deliverable is complete** on branch
> `feature/sprint-84-unified-feed-redesign-research`. The design-direction doc + three throwaway
> HTML/Tailwind mockups are written; quality gates (simplify/code-review/security-review, adapted
> for a docs/mockup diff) passed. `no-deploy` — version stays 10.8.0; merging the docs PR to
> `master` is the completion. **Next session executes Sprint 85: implement the unified feed**
> (recommended first slice = Dashboard Home).

## Sprint 84 deliverable (complete)
- **Direction doc:** [`docs/design/sprint-84-unified-feed/README.md`](../../docs/design/sprint-84-unified-feed/README.md)
  — audit of the 3 feed surfaces → data/action inventory → 5-product reference study → 8 principles
  → unified IA (one model, two views) → open questions + Sprint 85 recommendations.
- **Mockups:** [`docs/design/sprint-84-unified-feed/mockups/`](../../docs/design/sprint-84-unified-feed/mockups/)
  — `dashboard-home.html`, `community-feed.html`, `index.html` (standalone, Tailwind CDN, throwaway).

## Sprint 85 goal (next session)
Implement the unified feed model, **Dashboard Home first** (highest traffic; best payoff for action
altitude). Per the direction doc §7.2 build sequence:
1. Canonical `request` card component (absorbs `RequestPayloadRenderer` + trust/Karma badges + status token + inline Offer-to-Help).
2. Unified feed endpoint / item shape (`request | decision | activity | story` union) — resolve source-of-truth open question (Feed svc 3007 vs `request-service` `/requests/curated` + `view=` param).
3. `decision` band (promote `CommitmentsTab`'s "Needs Your Response" into the home feed top band).
4. Community Feed view (same components, `community_id` scope) + split admin console out of `BrowseTab`.
5. Texture layer (`activity` + `story`, dismissible, capped, below fold).
6. Retire unmounted `Feed/Feed.tsx`; de-dup `FeedFilterPanel` vs `FilterChipRow`.
- **Write ADR-066** (Unified Feed Model) against real S85 code (reserved per gotchas below).
- **Carry into S85:** Withdraw-Offer role bug, urgency/request_type vocabulary reconciliation,
  `match_score` scale normalization, server-side action altitude, on-duty filter generalization,
  mobile parity (see direction doc §7.4).

## Multi-sprint arc
- **Sprint 83** — founding-circle positioning + ADR-065 (complete; closed the outward/marketing phase).
- **Sprint 84** — unified feed research & direction. ✅ **Complete (doc + mockups, no code).**
- **Sprint 85 (next)** — implement the unified feed, Dashboard Home first. Spec/plan via `sprint-planning`.

## Sprint 84 reference (complete — full detail in the spec + direction doc)
- **Spec:** `docs/superpowers/specs/2026-06-03-sprint-84-unified-feed-redesign-research-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-03-sprint-84-unified-feed-redesign-research.md`
- Sprint 84 was `no-deploy` (doc + throwaway mockups, no production code/schema/API). The audited
  surfaces and full reasoning are recorded in the direction doc above; Sprint 85 reads that, not
  this handoff, for the design detail.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge. (PR #52 was admin-merged via `gh pr merge --admin` after explicit author authorization, since branch protection requires a review the solo-dev flow can't self-supply.)
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ NEXT-SESSION WARM-UP — unblock dependabot PRs
The open dependabot PRs (#34–50) predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several here ARE major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (Note: `docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: 059 = dependency gate, 060 = code-scanning gate, 061 = supply-chain hardening, 062 = community identity/idempotent creation, 063 = canonical trust metric + unified graph viz, 064 = authorize from authenticated identity, **065 = karmyq.org/karmyq.com domain roles**. (Next free: 066 — reserve for the Sprint 85 unified-feed ADR.)
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: 10.8.0 (Sprint 83 shipped; content voice pass + Sprint 84 research do not bump it)
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. PR #51 + #52 are merged — if judging by live content, first confirm the "Deploy to Demo" GitHub Actions run succeeded and live `karmyq.org` matches `master`. (Not relevant to Sprint 84, which ships no live content.)

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
