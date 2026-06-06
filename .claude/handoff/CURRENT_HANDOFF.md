# Sprint 89 — Community Sovereignty Redesign — IMPLEMENTED, IN REVIEW

> **▶ STATUS (2026-06-06):** Sprint 89 is **implemented on `feature/sprint-89-community-sovereignty-redesign`
> and awaiting maintainer merge authorization** (PR open). Version bumped **10.12.0 → 10.13.0**. All 12
> plan tasks executed: pulse endpoint (reuses the S86 texture aggregation via shared `fetchCommunityPulse`
> + new `timeSensitive`, members-only gate), warm four-tab page (`Home · People · How we're connected ·
> Stewardship` + group-only Activities), warm Home default for **all roles** (headline bug fixed),
> `CommunityHero` + `CommunityPulse`, `BrowseTab` split → `StewardRequestsAdmin` under `StewardshipTab`,
> centralized `lib/communityTabs.ts` deep-link resolver, `UnifiedFeed.suppressActivity` de-dup, ADR-068 +
> landing docs + onboarding + CONTEXT/registry. Gates green: `npm test` (27 tasks), tsc (request-service +
> frontend), landing build, `npm audit` (0 high), feedback:check + analyze:services. New TDD: frontend IA
> suite (9 pass); backend pulse suite (DB-gated → runs in CI integration). 5 pre-existing frontend TDD
> failures unchanged (trust-model / useTrustQuestions / sprint-38/39/40 — proven via stash).
>
> **▶ NEXT (post-merge):** Verify CI/CD + CodeQL green (dismiss the recurring `api.ts` js/request-forgery
> FP), member-login UI check on demo (land on warm Home, click the four tabs, old `?tab=overview` deep link
> resolves), then set **Sprint 90 — Trust, forgetting, profile polish** (visible decay; "designed to forget").
>
> **▶ ORIGINAL SCOPE (locked with maintainer, 2026-06-06):** Bring the whole `/communities/[id]` page up to
> the approved `community-home.html` mockup. Three decisions locked:
> 1. **Full consolidation to four warm tabs** — Home · People · How we're connected · Stewardship
>    (admin Settings/Providers fold under Stewardship; Activities stays a group-only 5th tab).
> 2. **Pulse endpoint reuses the existing S86 texture aggregation** (helped / open asks / recent
>    joins / helpers, all already computed server-side) + a new `timeSensitive` field; the duplicate
>    in-feed `ActivityCard` is suppressed on Home. (Codex review corrected the original "new endpoint
>    + client-side recent-joins" framing — that would have triple-counted the same numbers.)
> 3. **Everyone lands on warm Home** (members + admins); admins reach tools via Stewardship.
>
> **▶ HEADLINE BUG THIS SPRINT FIXES:** the S88 warm feed (`BrowseTab` → `UnifiedFeed`) is currently
> rendered only on the `requests` tab, which is gated behind `isAdminOrMod` in `[id].tsx` (~line 192).
> **Regular members never reach the redesigned feed.** Promoting it to the default Home for all roles
> is the core fix.

---

## Quick Start — Next Session

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-89-community-sovereignty-redesign`
3. Open plan: `docs/superpowers/plans/2026-06-06-sprint-89-community-sovereignty-redesign.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

## Sprint 89 goal (one sentence)

Bring the whole `/communities/[id]` page up to the approved warm `community-home` mockup — four warm
tabs (Home · People · How we're connected · Stewardship), warm Home as the default for every role, a
serif hero with the visible Dunbar cap bar, and a real "this week in the neighbourhood" pulse.

## Multi-sprint arc

- **Sprint 85** — unified feed, Dashboard Home first. ✅ v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + seam fix. ✅ v10.10.0.
- **Sprint 87** — Product Truth & UX Reset; warm-commons direction approved. ✅ v10.11.0.
- **Sprint 88** — Core help-loop redesign: shared shell + Dashboard Home + Community **feed**. ✅ v10.12.0.
- **Sprint 89 (THIS)** — Community sovereignty redesign: the whole community **page**. Target v10.13.0.
- **Sprint 90** — Trust, forgetting, profile polish (visible decay; "designed to forget").
- **Sprint 91** — Mobile parity from the polished model.
- **Sprint 92** — Architecture & service pruning.

## Critical Implementation Notes (copied verbatim from spec)

1. **Headline bug + BrowseTab is two surfaces.** The warm feed is admin-gated today (`requests` tab
   under `isAdminOrMod` in `[id].tsx`), so members never see it. But `BrowseTab` contains BOTH the
   member `UnifiedFeed` AND an admin steward-request manager (all-status list, triage/boost/propose/
   insights/export). Home renders the **member `UnifiedFeed` only**, for every role; the admin block
   is **extracted** to `StewardRequestsAdmin` under Stewardship. Whole-BrowseTab-on-Home re-strands
   admins in management; UnifiedFeed-only without extracting loses the admin tools.
2. **Default tab = Home for all roles.** Initial `activeTab` is `'home'`; remove the `overview`
   default. Admins reach management via **Stewardship**, not by landing on it.
3. **Preserve EVERY deep link via a centralized exported resolver** (`lib/communityTabs.ts`). The
   live map aliases more than the obvious set — remap ALL: `overview`/`requests`→`home`;
   `trust`→`connected`; `governance`/`fission`/`fusion`→`stewardship`;
   `settings`/`config`/`links`/`providers`→`stewardship` (admin sub-section);
   `manage`/`pending`/`members`/`norms`→`people`; `stats`/`insights`/`export`→`stewardship`. The
   redirect test currently owns a *copied* map — change it to import the real resolver.
4. **Pulse reuses the S86 texture aggregation — no second query; de-dup the in-feed card.**
   request-service already computes the same weekly numbers at `requests.ts ~L1010–1051`
   (`exchanges_completed_week`, `new_members_count`, `open_requests_count` with `expired = FALSE`,
   `recent_helpers`) and appends an in-feed `ActivityCard`. Extract/reuse that query (adding only
   `timeSensitive`); `recentJoins` comes from the endpoint (server already reads `members.joined_at`
   — no client-side seam). **Suppress the in-feed `ActivityCard` on community Home** so the pulse
   isn't rendered twice.
5. **Pulse endpoint must enforce membership.** Gate on `user.communities` (active membership in
   `:communityId`), **not** `communityMemberships` (always `undefined` → always 403). Non-members → 403.
6. **`openAsks` excludes expired** — `status='open' AND expired = FALSE` (match the existing query).
7. **No empty tiles.** The pulse suppresses rows with no meaningful data; the Dunbar capline always renders.
8. **API unwrap rule:** `createApiClient` already unwraps the envelope — consume `res.data`, not `res.data.data`.
9. **Don't rewrite admin management (carry S88 note 13).** Stewardship *relocates* existing components
   (incl. extracted `StewardRequestsAdmin`) under sub-nav. `/communities/[id]/admin` is a back-compat
   redirect, not a live config home.
10. **Cap bar uses the real cap** — `current_members` / `max_members` (both present; fall back to 150 only if null).
11. **`community_type` matters.** Activities stays a group-only tab; do not surface it for `mutual_aid`.
12. **Schema name is `communities.*` (plural).** The request-service local README is stale on the JWT field.
13. **nav.json reverts.** After `generate-docs`, grep-verify and re-apply; landing docs gitignored → `git add -f`.

## Tab mapping (where everything goes)

| Warm tab | Source today | Audience |
|----------|--------------|----------|
| **Home** (default) | hero + pulse + `BrowseTab`'s **member `UnifiedFeed` only** (was admin-gated `requests`); `overview` retired | Everyone |
| **People** | `ActiveTab` (`people`) | Everyone |
| **How we're connected** | `TrustGraphTab` (`trust`) | Members |
| **Stewardship** | `GovernanceTab` + `FissionTab` + `FusionTab` + admin `StewardRequestsAdmin` (extracted from `BrowseTab`) + admin `ProfileTab(settings\|providers)` | Members (admin tools gated within) |
| **Activities** (5th, conditional) | `ActivitiesTab` | `community_type==='group'` only |

## ADR numbering

**ADR-068 — Community Page Information Architecture (warm four-tab model)** is created this sprint.
Records the four-tab consolidation, warm-Home default, member/admin altitude split, and the pulse
seam. Next free ADR after this = **069**. (066 = unified-feed model S85; 067 = `request_type` vs
`payload_type` seam S86.)

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-06-sprint-89-community-sovereignty-redesign-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-06-sprint-89-community-sovereignty-redesign.md`
- **Target mockup:** `docs/design/sprint-87/mockups/community-home.html` (the whole page, not just the feed)
- **Approved presentation rules:** `docs/design/sprint-87/presentation-rules.md`
- **S88 spec/plan:** `docs/superpowers/specs/2026-06-05-sprint-88-core-help-loop-redesign-design.md`,
  `docs/superpowers/plans/2026-06-05-sprint-88-core-help-loop-redesign.md`
- **Reusable blocks shipped S88:** `apps/frontend/src/styles/karmyq-shell.css` (`.kq-*`),
  `TrustPathBadge presentation="feed"` (green relationship face-pill).

---

# Archived Context — Sprint 88 Core Help-Loop Redesign — ✅ MERGED + DEPLOYED (v10.12.0)

> Sprint 88 shipped via PR **#71** (core) + PR **#72** (shell-fidelity follow-up, `95fa62c`).
> Implemented: shared `.kq-*` shell; relationship-led `RequestCard` (KarmaBadge removed, match-%
> demoted to qualitative copy, `TrustPathBadge` promoted); Dashboard Home + Community **feed**
> headers; `Show more open requests` (backend `minScore=0` honored, finite-check parser); union-path
> impression logging; mobile FAB/decision-band spacing; split/fusion name cleanup; docs regenerated.
> Deployed green (CI/CD `27069900734`, Tests `27069900728`, CodeQL `27069900546`); demo home HTTP 200.
> Spec/plan: `docs/superpowers/.../2026-06-05-sprint-88-core-help-loop-redesign{-design,}.md`.
>
> **Note that fed Sprint 89:** S88 re-skinned the **feed surface only**; the community **page** chrome
> + tab structure were untouched, and the warm feed ended up admin-gated. That is exactly what S89 fixes.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge.
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
The open dependabot PRs predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several are major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (`docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: ADR-068 created in S89; next free = 069.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **10.12.0** (Sprint 88 shipped; S89 bumps to 10.13.0).
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
- **`request_type` vs `category`**: `request_type` = 5-value `request_type_enum` (filter); `category` = fine
  payload subtype (`transportation` etc., what `RequestPayloadRenderer` switches on, what matching keys off).
  S86 surfaces `category` as `payload_type` on the card (ADR-067).

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. If judging by live content, first confirm the most recent "Deploy to Demo" GitHub Actions run succeeded and live content matches `master`.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
