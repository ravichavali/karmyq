# Sprint 86 — Unified Feed (Community view + texture) — ✅ SHIPPED + DEPLOYED (v10.10.0) + post-ship bug-bash

> **▶ PRODUCT POLISH REVIEW (2026-06-05, Codex):** user flagged feature drift + stale UX and asked
> for a thorough review against the karmyq.org manifesto/docs. Review artifact written:
> `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md`.
>
> **Recommendation:** do **not** let Sprint 87 default straight to mobile parity. First run
> **Sprint 87: Product Truth and UX Reset** to align repo/public docs, landing placeholders, product
> scorecard, screenshot-based UX audit, and the community feed `minScore` decision. Then proceed:
> Sprint 88 core help-loop polish, Sprint 89 community sovereignty polish, Sprint 90 trust/forgetting
> + profile polish, Sprint 91 mobile parity from the clarified model, Sprint 92 architecture/service
> pruning.
>
> **Status:** ✅ **direction approved + decisions locked (2026-06-05)** — full detail in "Decisions Locked"
> at the top of the roadmap spec. Summary: (1) aesthetic = **warm commons, calm behavior** (warmth =
> identity, calm = discipline; not cold SaaS, not loud civic); (2) Sprint 87 **includes quick wins**
> (stale metadata, `apps/frontend/CONTEXT.md` BrowseFeed drift, landing placeholders) — no production UI
> rewrite until mockups approved; (3) **score-vs-relationship rule**: keep the relationship path, remove
> per-person karma/trust SCORES, de-emphasize match % — `RequestCard` KarmaBadge removal **folds into the
> Sprint 88 card redesign**; (4) community "show all open" = **both** member affordance + admin list (#64);
> (5) "designed to forget" stays **Sprint 90**, seeded small in 88. Added S87 scope: clean/seed demo data
> before the UX audit; a11y + responsive as explicit presentation rules.
>
> **Multi-agent process:** every plan/PR/branch/commit is reviewed by the agent that did NOT author it
> (Codex ↔ Claude). One owner per artifact — don't co-edit the same doc. (This roadmap: Codex authored,
> Claude reviewed; Claude now owns these two planning docs' finalization + commit.)
>
> **Maintainer direction added:** "Nothing is too sacred" in the presentation layer. Current layout,
> navigation, cards, tabs, visual system, and interaction patterns are not constraints. The next
> sprint should be a **manifesto-first presentation reset**, with visual research + throwaway mockups
> before implementation planning. Preserve working domain behavior, but let the UI change shape if it
> better expresses community sovereignty, meaning over accounting, privacy/forgetting, and a finite
> humane help loop.
>
> **▶ STATUS (2026-06-05):** Sprint 86 shipped (v10.10.0, PR #60) and a post-ship bug-bash cleared every
> issue surfaced on demo. **All merged + deployed:**
> - **#60** Sprint 86 feature (Community feed view + texture + ADR-067 seam).
> - **#61** Dashboard crash hotfix — `RequestPayloadRenderer` shape guards (the seam fix newly exercised the
>   payload renderers on heterogeneous real data → `Cannot read … 'address'`; now no-ops on mismatched payloads).
> - **#62** Decision-band stale-sibling reconcile (Codex) — `UnifiedFeed` background-refetches after a
>   `DecisionBand` action so server-auto-rejected sibling matches disappear ("Match must be in proposed state").
> - **#63** Fusion member-count (0-vs-N) — `executeFusion` now recomputes `current_members`; backfill migration
>   `20260605-fusion-member-count-backfill.sql` (applied on demo, verified in deploy log).
> - **#64** Decision-band inline expand + withdraw-offer moved to Helping + `fetchSeq` sequence-guard.
> - **#65** Split carries trust edges (+`stability`) + karma into children (don't reset bonds); backfill
>   `20260605-split-carry-trust-karma-backfill.sql` (applied on demo, verified). Fusion trust copy also fixed to carry `stability`.
> - **#66** review follow-ups (merged + deployed): `UnifiedFeed` unmount guard (`mountedRef`);
>   DecisionBand row HTML purity (`<span>` not `<p>` inside the `<button>`).
>
> **Remaining human checks (need a logged-in MEMBER session):** community Requests tab shows canonical cards
> **with payload detail** + activity summary + stories, no decision band; Dashboard Home shows the decision
> band (rows **expand inline**, **no withdraw rows**) + payload detail, no crash; a merged community's member
> count is consistent (header == list); a split child shows real connections/karma (not 0).
>
> **▶ NEXT: Sprint 87 = Product Truth & UX Reset** (NOT mobile parity — that moved to Sprint 91). A
> manifesto-first presentation reset: stale-docs quick wins, demo-data cleanup, screenshot UX audit, and
> throwaway mockups against the **warm-commons/calm** aesthetic, before any production UI rewrite. See the
> roadmap spec for the full 87→92 arc. The items previously parked here — **impression logging** on the
> `view=home`/`view=community` union path (only the legacy array path logs to `requests.feed_events`) and
> the **community `minScore`** "show all open" affordance — now land in **Sprint 88** (help-loop redesign).
>
> **(history)** Sprint 86 was executed on branch `feature/sprint-86-unified-feed-community-view`.
>
> **All 12 plan tasks done.** Verification: request-service 212 unit+regression pass + build clean;
> frontend 62 unit+regression pass + tsc clean; new S86 tests green (payload-type 4, community-texture 5,
> community integration [DB-tier], UnifiedFeed community view 4); `npm audit` 0 high/critical (ADR-059);
> **TDD failures are all pre-existing (zero new)** — verified against master baseline.
>
> **Scoping decision executed (Task 7):** community Browse tab = `<UnifiedFeed view="community" />` for all
> members + a **separate admin all-status management list** (triage/boost/propose), since the curated feed
> serves only open requests.
>
> **Post-merge TODO:** (1) monitor "Deploy to Demo" via `/deploy`; (2) demo validation —
> `GET /requests/curated?view=community&community_id=:id` returns the ranked request+activity+story union
> (auth-gated, no decision item); community Requests tab shows canonical cards **with payload detail** (seam
> fix) + activity summary + stories; Dashboard Home still shows the decision band + payload detail; confirm
> the deleted legacy components don't appear anywhere.
>
> **Carried items (re-homed by the polish roadmap):** impression logging on the union path → **Sprint 88**;
> community `minScore` "show all open" affordance → **Sprint 88** (decision = both member + admin); mobile
> parity → **Sprint 91** (after the web model is polished, so it doesn't fossilize current drift).
>
> **(Original READY-TO-EXECUTE note, for reference):** Sprint 85 shipped + deployed (v10.9.0, PR #58);
> Sprint 86 spec + plan written. Target version v10.10.0.

---

## Quick Start — Sprint 87: Product Truth & UX Reset

1. Read this handoff (top status + the locked decisions) **and** the roadmap spec:
   `docs/superpowers/specs/2026-06-05-sprint-87-90-polish-reset-review-and-roadmap.md`.
2. Confirm **lane ownership** with the maintainer (Codex ↔ Claude; one owner per artifact;
   every plan/PR/branch/commit is reviewed by the agent that did NOT author it).
3. Sprint 87 is a **manifesto-first presentation reset — design-research-first, NOT a code-execute sprint:**
   - **Quick wins** (safe to ship): stale version/source-of-truth metadata (`CLAUDE.md`, `README.md`,
     `docs/README.md`, `docs/ARCHITECTURE.md`), `apps/frontend/CONTEXT.md` BrowseFeed drift, landing
     placeholder stories; clean/seed representative demo data **before** the UX audit.
   - Then: screenshot UX audit + throwaway mockups against the **warm-commons / calm** aesthetic.
   - **No production UI rewrite until the maintainer approves the mockup direction.** The Sprint 88
     implementation plan is written only after that approval.

> **(Historical)** Sprint 86 is complete + shipped (v10.10.0, PRs #60–#66 — see status block above). Its
> old Quick Start (branch `feature/sprint-86-unified-feed-community-view`, plan
> `docs/superpowers/plans/2026-06-04-sprint-86-unified-feed-community-view.md`) no longer applies.

## Sprint 86 goal (one sentence)

Render the unified-feed union in its **second view** — Community Feed (replacing `BrowseTab`'s bespoke
cards), served by a new `GET /requests/curated?view=community` — populate the `activity`/`story`
**texture layer** (computed in request-service, not feed-service), **retire the legacy feed components**
(`BrowseFeed`/`Feed.tsx`/`FeedItem.tsx`/`FeedFilterPanel`), and fix the `request_type`/`payload_type`
modelling seam so payload detail finally renders on canonical cards (ADR-067). **Web-only.**

## Scoping decisions (made 2026-06-04 — all confirmed with user)

1. **Scope = full step-4–6 bundle, web-only:** Community Feed view + texture layer + legacy retirement +
   the `request_type` seam fix. **Mobile parity → Sprint 87.** _(Superseded 2026-06-05: mobile parity is
   now Sprint 91; Sprint 87 = Product Truth & UX Reset.)_
2. **Seam fix ships now (ADR-067):** separate `request_type` (5-value enum, filter) from `payload_type`
   (fine subtype, payload rendering, sourced from the existing `category` column). **No DB migration.**
3. **Texture computed in request-service** via `view=community` — request-service's own DB reads, **no
   feed-service call** (keeps the unified feed single-source per ADR-066).

## Multi-sprint arc

- **Sprint 84** — unified feed research & direction. ✅ Complete (`no-deploy`).
- **Sprint 85** — unified feed, Dashboard Home first (steps 1–3). ✅ Shipped v10.9.0.
- **Sprint 86** — Community Feed view + texture + legacy retirement + seam fix (steps 4–6). ✅ Shipped v10.10.0 (PR #60).
- **Sprint 87 (next)** — **Product Truth & UX Reset** (manifesto-first presentation reset; see roadmap
  spec). NOT mobile parity — that's now **Sprint 91**. Then: 88 help-loop redesign (incl. impression
  logging + community `minScore`), 89 community sovereignty, 90 trust/forgetting/profile, 91 mobile
  parity, 92 architecture pruning.

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
  Carried to **Sprint 88** (help-loop redesign; re-homed from S87 by the polish roadmap).
- **One manual UI check from S85** (low priority now): confirm on demo Dashboard Home that a responder can
  withdraw an offer from the decision band — covered by the S85 verify-lock test; visual confirm only.

### Sprint 81 residual (carried)
- JWT-in-URL exposure → nginx log scrub (shipped Sprint 83). Token TTL kept at 1h (documented). SSE auth tests promoted to regression.
