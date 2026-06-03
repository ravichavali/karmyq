# Sprint 84 — Unified Feed & Dashboard Redesign (Research & Direction) — 📋 SPECCED, READY TO EXECUTE

> **▶ STATUS (2026-06-03):** Sprint 83 + the karmyq.org content voice pass (PR #52) are merged to
> `master` (`47ad11b`). Sprint 84 is **scoped and specced** via `sprint-planning`. This is a
> **research/direction sprint — the deliverable is a design doc + throwaway HTML mockups, not
> code.** Next session executes the plan.

## Sprint goal (one sentence)
Produce a purpose-driven, research-backed design direction for a single **unified feed system**
spanning the dashboard home and the community feed — delivered as a markdown direction doc +
browser-viewable HTML/Tailwind mockups — ready for Sprint 85 to implement.

## Quick Start
1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-84-unified-feed-redesign-research`
3. Open plan: `docs/superpowers/plans/2026-06-03-sprint-84-unified-feed-redesign-research.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

**Spec:** `docs/superpowers/specs/2026-06-03-sprint-84-unified-feed-redesign-research-design.md`

## Multi-sprint arc
- **Sprint 83** — founding-circle positioning + ADR-065 (complete; closed the outward/marketing phase).
- **Sprint 84 (this)** — unified feed research & direction. **Doc + mockups, no code.**
- **Sprint 85+** — implement the unified feed, one vertical slice at a time (likely dashboard
  home first). Sequencing is a Sprint 85 planning call.

## Deliverables this sprint produces
- `docs/design/sprint-84-unified-feed/README.md` — the design-direction doc (audit → data/action
  inventory → reference study → principles → unified IA → Sprint 85 recommendations).
- `docs/design/sprint-84-unified-feed/mockups/*.html` — standalone HTML/Tailwind mockups of the
  redesigned dashboard-home feed and community feed (Tailwind via CDN; throwaway).

## Critical implementation notes (from the spec — verbatim)
1. **Deliverable is a document, not code.** Don't write production feed components — that's Sprint 85.
2. **Mockups are throwaway.** Standalone HTML + Tailwind CDN under
   `docs/design/sprint-84-unified-feed/mockups/`. Don't wire into the Next.js build, don't add to
   `apps/frontend`, don't import app components.
3. **Design backward from the job** — "connect need with help inside a community of trust." Every
   recommendation traces to it; reject borrowed social-feed patterns unless re-justified.
   (Source: `docs/IDEAS.md` [2026-05-20] framing note.)
4. **Audit before inventing.** Read all three current feed surfaces — `BrowseFeed`, community
   `BrowseTab` (586 lines), `Feed/Feed.tsx` — before proposing the unified model. Their
   duplication is the thing being collapsed, so document it first.
5. **No schema/API/endpoint changes.** Missing data the redesign wants → log as a Sprint 85
   recommendation, don't build it.
6. **Unify, don't add a fourth surface.** Output is ONE feed model in two views (dashboard home /
   community feed), not a new parallel feed.
7. **`no-deploy` sprint.** No version bump (stays 10.8.0); nothing reaches `karmyq.com`. Merging
   the docs PR to master is the completion.
8. **`docs/design/` is NOT gitignored** (only `apps/landing/src/data/docs/` is) — normal
   `git add` works.

## Scope boundaries
- **In:** audit, data/action inventory, reference study, principles, unified IA, mockups, Sprint
  85 recommendations.
- **Out (later/separate):** writing production feed components, schema/API changes, the on-duty
  Community/Provider/Both feed filter, and the **Withdraw-Offer role bug** (`docs/IDEAS.md`
  [2026-05-20] — responder can't withdraw own proposed offer). Both stay on the backlog.

## Audit sources (read-only — do NOT modify)
`apps/frontend/src/pages/dashboard.tsx`, `components/BrowseFeed.tsx`, `components/BrowseModeControl.tsx`,
`components/community/tabs/BrowseTab.tsx`, `components/Feed/Feed.tsx` + `FeedItem.tsx` +
`RequestPayloadRenderer.tsx`, `components/FeedFilterPanel.tsx`, `components/TabBar.tsx`,
`components/CommitmentsTab.tsx`, `components/MyRequestsTab.tsx`,
`components/dashboard/TrustNetworkWidget.tsx`, `components/ProviderDashboardCard.tsx`,
`types/feed-items.ts`.

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
