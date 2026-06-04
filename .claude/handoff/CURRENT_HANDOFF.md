# Sprint 86 — Unified Feed: Community Feed view + texture — 📋 READY TO EXECUTE

> **▶ STATUS (2026-06-04):** Sprint 85 **shipped + deployed** (v10.9.0, PR #58). Sprint 86 spec + plan
> written and ready. Open a fresh chat and execute from the plan below. Target version **v10.10.0**.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-86-unified-feed-community-view`
3. Open plan: `docs/superpowers/plans/2026-06-04-sprint-86-unified-feed-community-view.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

## Sprint 86 goal (one sentence)

Render the unified-feed union in its **second view** — Community Feed (replacing `BrowseTab`'s bespoke
cards), served by a new `GET /requests/curated?view=community` — populate the `activity`/`story`
**texture layer** (computed in request-service, not feed-service), **retire the legacy feed components**
(`BrowseFeed`/`Feed.tsx`/`FeedItem.tsx`/`FeedFilterPanel`), and fix the `request_type`/`payload_type`
modelling seam so payload detail finally renders on canonical cards (ADR-067). **Web-only.**

## Scoping decisions (made 2026-06-04 — all confirmed with user)

1. **Scope = full step-4–6 bundle, web-only:** Community Feed view + texture layer + legacy retirement +
   the `request_type` seam fix. **Mobile parity → Sprint 87.**
2. **Seam fix ships now (ADR-067):** separate `request_type` (5-value enum, filter) from `payload_type`
   (fine subtype, payload rendering, sourced from the existing `category` column). **No DB migration.**
3. **Texture computed in request-service** via `view=community` — request-service's own DB reads, **no
   feed-service call** (keeps the unified feed single-source per ADR-066).

## Multi-sprint arc

- **Sprint 84** — unified feed research & direction. ✅ Complete (`no-deploy`).
- **Sprint 85** — unified feed, Dashboard Home first (steps 1–3). ✅ Shipped v10.9.0.
- **Sprint 86 (this)** — Community Feed view + texture + legacy retirement + seam fix (steps 4–6). 📋 Ready.
- **Sprint 87 (next)** — mobile parity (both views) + home-feed impression logging for the unified-feed
  path (the `feed_events` impression log currently only fires on the **legacy array** path, not the
  `view=home`/`view=community` union — analytics gap carried from S85).

## Reference

- **Spec:** `docs/superpowers/specs/2026-06-04-sprint-86-unified-feed-community-view-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-04-sprint-86-unified-feed-community-view.md`
- **Direction doc:** `docs/design/sprint-84-unified-feed/README.md` (principles, IA, build sequence)
- **Mockups:** `docs/design/sprint-84-unified-feed/mockups/`
- **What S85 shipped (the foundation S86 extends):** `RequestCard`/`DecisionBand`/`UnifiedFeed`
  (`apps/frontend/src/components/Feed/`), `GET /requests/curated?view=home`
  (`services/request-service/src/routes/requests.ts` + `services/unifiedFeed.ts`), the `UnifiedFeedItem`
  union (`apps/frontend/src/types/unified-feed.ts` + `feed-items.ts`), ADR-066.

## ⚠️ Critical Implementation Notes (copied from spec — these prevent the bugs)

1. **Texture is computed in request-service, NOT feed-service.** `view=community` assembles request +
   activity + story from request-service's own DB reads. No feed-service call (ADR-066 single-source).
2. **Seam fix = two fields + a normalization map, no migration. A raw `r.category` passthrough is WRONG.**
   `request_type` stays the 5-value enum (filter). Derive `payload_type` via `categoryToPayloadType()`:
   on INSERT `category` and `request_type` get the *same* value (`requests.ts:1147`), so newer rows hold
   the enum while older/sim rows hold skill tokens (`moving`, `tech_support`, `gardening`, …) that the
   matching SQL keys off (`requests.ts:112–123`). The renderer switches on `moving_help`/`tech_help`/etc.,
   so the map translates known aliases and returns `undefined` for the rest (renderer no-ops safely —
   no regression). Build the map from the real distinct `category` values (Task 1 dry-run).
3. **Community view has NO decision band, and needs a `community_id` + membership guard** — `view=community`
   returns `request`/`activity`/`story` only (never call `fetchDecisions`). MUST 400 on missing
   `community_id` and verify the caller is a member (JWT `user.communities`) before texture reads, so a
   non-member can't pull a community's texture.
4. **Texture ranks below requests; stories below activity.** Extend priority bands in `unifiedFeed.ts`:
   requests (1000–1100, existing) > activity (~500) > story (~100). Reuse the stable descending-priority
   sort — client renders in array order, server owns ordering.
5. **Texture queries are best-effort** — each wrapped in try/catch, degrade to "no texture", log; never
   break the feed (same non-fatal pattern as `fetchDecisions` in `requests.ts`).
6. **Delete legacy components, don't bypass them.** `BrowseFeed.tsx`, `Feed/Feed.tsx`, `Feed/FeedItem.tsx`,
   `FeedFilterPanel.tsx` removed this sprint. Grep every import before deleting (a dangling import fails
   `tsc`). `BrowseTab` keeps its triage/export/member-picker controls — only its bespoke *card rendering*
   is replaced by `<UnifiedFeed view="community" />`.
7. **`UnifiedFeed` already takes `communityId`** and passes it to `getCuratedRequests`. S86 adds a `view`
   prop, the `activity`/`story` renderers, and conditional decision-band/browse-mode hiding — don't
   rebuild the fetch/filter plumbing, extend it.
8. **`view=home` request items also gain `payload_type`** (`categoryToPayloadType(r.category)` in
   `toRequestCardData`) — the seam fix lights up payload detail on Dashboard Home too.
9. **Dry-run the `category` vocabulary** on the demo DB to build the map + its unit test
   (`SELECT request_type, category, COUNT(*) FROM requests.help_requests GROUP BY 1,2`). Null/unknown
   `category` → `payload_type` undefined → `RequestPayloadRenderer` no-ops on empty payload (safe).
10. **`res.data.items` not `res.data.data.items`** (interceptor unwraps). **JWT field is `communities`.**
11. **Landing docs dir is gitignored** → `git add -f`. Run `generate-docs` from `apps/landing/`,
    **grep-verify nav.json after** (it silently reverts).

## ADR numbering

- **067 = reserved for Sprint 86** — `request_type` vs `payload_type` vocabulary (the seam fix).
  (Next free after 067: 068.) 066 = unified-feed model (S85), 065 = domain roles, 064 = authorize from
  identity, 063 = canonical trust metric + unified graph, 062 = community identity/idempotent creation,
  061 = supply-chain hardening, 060 = code-scanning gate, 059 = dependency gate.

---

## Persistent Context (carry forward unchanged)

### Multi-agent PR process — ✅ LIVE on master (2026-06-02, PR #45)
- `.github/pull_request_template.md` = the cross-agent PR contract (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- `.github/workflows/pr-contract.yml` fails a PR whose body is empty or missing the four required headers; `dependabot[bot]` passes through.
- master **branch protection**: required checks = `pr-contract`, `Lint & Type Check`, `Test Frontend`, `Test Backend Services (Unit + Regression)`, `Code Scanning Gate (ADR-060)`, `Security Audit`; `strict: true`; 1 approving review; `enforce_admins: false`.
- **Merge authority:** Admin owns approval + merge; Claude validates merge-readiness and recommends, executes merge only on Admin authorization ("pull it in"). Agents never self-merge. (PR #52/#58 were admin-merged via `gh pr merge --admin` after explicit author authorization, since branch protection requires a review the solo-dev flow can't self-supply.)
- **Enforcement is identity-based** — same-machine agents (Claude, Codex) share admin `gh` creds, so "no direct push to master" is convention-by-discipline for them, not a hard gate. See AGENTS.md "Enforcement reality".
- A deliberate empty marker commit `90b9067` exists on master — do NOT "clean it up".

### ⚠️ Open dependabot PRs (#34–50) still need unblocking
The open dependabot PRs predate `pr-contract.yml`; their stale branches have no `pr-contract` status, so the now-required check **blocks** them. To unblock each: comment **`@dependabot rebase`** → recreated branch includes the workflow and passes via bot pass-through. Then review/merge per dependabot merge discipline (**inspect grouped PRs for MAJOR bumps; don't rapid-merge** — 5 concurrent deploys caused ENOTEMPTY). Several are major bumps (tailwindcss 3→4 #41, typescript-eslint 6→8 #40, expo/vector-icons 14→15 #39, gesture-handler 2→3 #37, eslint-config-expo 8→56 #36, eslint-config-next 15→16 #35) — inspect before merging.

### Architecture Gotchas (Persistent)
- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`. (`docs/design/` is NOT gitignored — only the landing data dir is.)
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json — run from `apps/landing/`; grep-verify after; re-apply if reverted
- **ADR numbering**: see "ADR numbering" above (next free = 068).
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **Schema is `communities.communities`** (plural schema name) — older `community.*` comments are stale
- **API response unwrap**: `createApiClient` interceptor already unwraps the envelope — use `res.data`, not `res.data.data`
- **trust_edges_live is a VIEW**: never INSERT/UPDATE it — write `trust_edges`, read `trust_edges_live`
- **`git add` on CLAUDE.md**: tracked as lowercase `claude.md`
- **Solo dev — no worktrees**: work directly on feature branches
- **Root package.json version**: **10.9.0** (Sprint 85 shipped). **Sprint 86 bumps it to 10.10.0.**
- **CI security gates**: dependency audit (ADR-059, blocking `--audit-level=high`) + CodeQL code-scanning gate (ADR-060) run automatically on push
- **`request_type` vs `category`**: `request_type` = 5-value `request_type_enum` (filter); `category` = fine
  payload subtype (`transportation` etc., what `RequestPayloadRenderer` switches on, what matching keys off).
  S86 surfaces `category` as `payload_type` on the card (ADR-067).

### Pre-Existing TDD Failures (do NOT fix — a NEW failure this sprint is a real regression)
`sprint-39-provider-ux` (7), `sprint-43-feed-ranking` (crashes), `admin-schemas-api.test.ts` (request-service), `sprint-68-halflife` (6 DB-conn), `sprint-67-governance` (DB-conn), social-graph-service tdd `sprint-66`/`sprint-67`/`sprint-68`.

### ⚠️ Deploy drift watch
`karmyq.org` live content drifted from `master` around Sprint 83. If judging by live content, first confirm the most recent "Deploy to Demo" GitHub Actions run succeeded and live content matches `master`.

### Sprint 85 residual / carry-forward
- **Home-feed impression logging gap**: the `requests.feed_events` impression INSERT only fires on the
  **legacy array** path of `handleCuratedFeed`, not the `view=home` (or new `view=community`) union path.
  Carried to **Sprint 87** (analytics).
- **One manual UI check from S85** (low priority now): confirm on demo Dashboard Home that a responder can
  withdraw an offer from the decision band — covered by the S85 verify-lock test; visual confirm only.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
