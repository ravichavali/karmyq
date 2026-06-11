# Sprint 93: Provider↔Community Link-Up (Audit-First) + Carry-Forward Fixes — Design Spec

**Date**: 2026-06-10
**Status**: Approved
**Version**: 11.1.0 → 11.2.0
**Sprint Branch**: `feature/sprint-93-provider-linkup`

---

## Overview

Members report that the community / service-provider link-up "seems confusing" (IDEAS
2026-06-08). Code research confirms a structural seam: `requests.provider_profiles` has **no
community link** — the `/providers` directory (`GET /requests/providers`) is platform-global and
public, while every trust-bearing flow (dibs candidate pools, matching, trust scores) treats the
**community as the trust boundary**. A member browsing providers sees strangers from anywhere;
a requester gets dibs candidates scoped to their communities. The two surfaces tell different
stories about who a provider *is* relative to your community.

Rather than guess which confusion matters most, this sprint is **audit-first** (maintainer's
explicit choice, mirroring Sprint 92's diagnosis-first BUG-008): Task 2 runs a structured
Playwright UX audit of the full provider journey on the demo, the maintainer ratifies the fix
list mid-sprint, and the remaining tasks implement the ratified fixes. The sprint also closes
three researched carry-forward bugs: the ADR-064 gap on the members DELETE path (spoofable
`admin_user_id` from the request body), the login-401 React #31 whole-app crash, and the false
"You've worked with them before" dibs copy for zero-history neighbours.

### Core Principle: The Community Is the Trust Boundary — Every Surface Must Say So

Provider discovery, framing, and onboarding must present providers through the lens of shared
community membership, the same lens dibs and matching already use.

---

## Multi-Sprint Arc

### Sprint 92 — Matching & Dibs Repair (complete)
Shipped the dibs correctness floor: server-side `kind`/`reason`/`relationshipContext`,
similarity-keyed routing, race-serialized accept/reject, 8-bug sweep (v11.1.0).

### Sprint 93 — Provider↔Community Link-Up (this sprint)
Audit the provider journey, fix the ratified link-up confusions, close carry-forward bugs.

### Sprint 94 — candidates (not committed)
Service Consolidation Phase 2 (geocoding → client-side, 10→9, ADR-071) OR mobile parity.

---

## New Concepts

- **Provider journey audit** — a structured, screenshot-backed walkthrough of: become a
  provider → provider mode → directory browse (member view) → service request → dibs prompt →
  provider accept → completion/review. Artifact: `docs/design/sprint-93-provider-linkup/AUDIT.md`.
- **Ratification checkpoint** — mid-sprint maintainer decision (like S92's A-vs-B): the audit
  proposes a severity-ranked fix list; the maintainer picks what ships this sprint; the decision
  is recorded in ADR-073.
- **`community_connection` dibs reason** — new `DibsReason` value for a neighbour admitted to
  the candidate pool via an exchange trust edge with **zero** completed matches
  ([dibsDb.ts:292-295](../../services/request-service/src/db/dibsDb.ts)). Today such a candidate
  gets `trusted_neighbor` → DibsPrompt says "You've worked with {name} before" — false.

---

## Audit Hypotheses (verified against code; the audit tests them against the live UX)

1. **H1 — No community–provider tie**: `/providers` is platform-global + public; dibs/matching
   are community-scoped. Likely fix: scope/group the provider directory by the viewer's
   communities ("Providers in Berkeley Community Care") via a `communities.members` join — no
   schema change needed for the MVP; an explicit `provider_communities` listing table only if
   ratified.
2. **H2 — Dual-identity navigation**: member/provider mode switcher, ProviderDashboardCard,
   ProviderProfileTab, collectives — the dual-surface navigation may be incoherent.
3. **H3 — Onboarding/flow clarity**: "Become a provider" never explains how providers relate to
   communities, service requests, dibs, or offers.

The audit may surface findings outside H1–H3; rank everything by severity and propose.

---

## Data Model

**No guaranteed schema change.** The MVP community-scoping of provider discovery is a query
change (join `communities.members` on the viewer's community IDs). If the maintainer ratifies an
explicit provider↔community listing, add (dated migration, idempotent, `IF NOT EXISTS`,
migration-validator):

```sql
-- ONLY IF RATIFIED at the audit checkpoint
CREATE TABLE IF NOT EXISTS requests.provider_communities (
  provider_id  UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL,  -- cross-schema: no FK to communities.communities (schema ownership)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, community_id)
);
```

---

## API Endpoints

| Method | Path | Change | Auth |
|--------|------|--------|------|
| GET | `/requests/providers` | **Modify (likely, post-ratification)**: when called with a token, support community scoping (e.g. `?community_id=` or default-scope to caller's communities); keep public unauthenticated behaviour working | optional |
| GET | `/requests/:id/dibs-candidate` | **Modify**: `reason` union gains `community_connection` (returned when `kind='neighbor'` and `priorCompletedMatches === 0`) | required |
| DELETE | `/communities/:communityId/members/:userId` | **Modify (ADR-064 close-out)**: caller identity from JWT (`req.user.userId`), `admin_user_id` body field ignored; self-remove = param `userId` === JWT userId; 401 when unauthenticated; last-admin guard unchanged | required (router already mounts `authMiddleware`) |

Response envelope unchanged (`{success, data, message}`).

---

## Frontend Changes

| Surface | Change |
|---------|--------|
| `apps/frontend/src/lib/api.ts` (errorInterceptor L110-111) | Chokepoint fix: never leave an object on `data.error` (today it falls back to the object when `.message` is absent) |
| `apps/frontend/src/pages/login.tsx` + the other JSX-bound `data?.error` sites (`register.tsx:47`, `invite/[code].tsx:121`, `communities/config-templates.tsx:37`, `communities/configs/public.tsx:75`) | Render a **string** error always: prefer `data?.error?.message`, then string `data.error`, then `data.message`, then `err.message`; never put an object into error state (fixes React #31 → ErrorBoundary crash) |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Add `community_connection` copy: "You're connected with {name} in your community. Ask them first?" — keep the existing default-fallback for unknown reasons |
| `apps/frontend/src/lib/api.ts` | `removeMember` / `leaveCommunity` stop sending `admin_user_id` in the DELETE body (signature change); `packages/shared/api/client.ts` likewise |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Update `removeMember` call sites to the new signature |
| `apps/frontend/src/pages/providers/index.tsx` (+ likely `ProviderCard`, onboarding copy in `providers/new.tsx`) | Post-ratification link-up fixes (community-scoped directory grouping, flow copy) |

---

## User Guide & Doc Updates

Mandatory; all regenerate into the landing site via `cd apps/landing && npm run generate-docs`
(edit **sources**, never the JSON; verify nav.json after).

- `docs/guides/using-service-providers-guide.md` — update for community-scoped discovery + any
  ratified flow changes (how providers relate to *your* communities).
- `docs/guides/provider-mode-guide.md` — update onboarding/dual-identity sections per ratified
  H2/H3 fixes.
- `docs/guides/dibs-request.md` + `docs/guides/provider-dibs-guide.md` — document the three
  neighbour reasons incl. the new `community_connection` framing.
- **ADR-073** (`docs/adr/ADR-073-provider-community-linkup.md`) — records the audit findings +
  ratified link-up model. Add to `docs/adr/README.md` index + landing nav.
- **ADR-072** — append the `community_connection` reason to the dibs relationship-routing
  contract.
- Landing service docs for request-service / community-service endpoints if contracts change.

---

## Critical Implementation Notes

1. **Audit-first gate**: NO link-up implementation before the maintainer ratifies the audit's
   fix list (mid-sprint AskUserQuestion checkpoint). Carry-forward bug fixes (Tasks 3–8) are
   pre-ratified and can proceed in parallel.
2. **Demo audit access** (memory `reference_demo_ux_audit_access`): sim users are
   `*@test.karmyq.com`, password `password123`; confirmed member
   `aisha.white6964@test.karmyq.com` (Berkeley Community Care, plain member). Playwright MCP
   blocks `file://` — serve local mockups via `python -m http.server`. SSH `ubuntu@karmyq.com`
   key-based; DB ops via `karmyq-postgres` container env vars.
3. **login-401 layer call**: the shared `sendError`
   ([packages/shared/utils/response.ts:181-188](../../packages/shared/utils/response.ts)) emits
   `error: {code, message}` — an **object**, violating the CLAUDE.md contract
   (`error: "ERROR_CODE"` string). The api.ts errorInterceptor (L110-111) already normalizes
   `data.error` → `error.message || error`, **except** when `.message` is absent (falls back to
   the object) or a client path bypasses the interceptor — **reproduce first** against current
   code, then fix the interceptor chokepoint plus the five JSX-bound page sites. Do **NOT**
   change `sendError`'s shape this sprint (every consumer depends on it) — log the contract
   mismatch to `docs/IDEAS.md` as an architecture follow-up. (Codex review finding, verified.)
4. **members DELETE**: `membersRouter` is mounted with `authMiddleware`
   ([community-service index.ts](../../services/community-service/src/index.ts)) so
   `(req as any).user?.userId` is available — mirror the PUT handler's pattern
   ([members.ts:289-308](../../services/community-service/src/routes/members.ts)). Keep the
   last-admin guard (~L496) and the `user_left_community` event payload working
   (`removed_by` = JWT caller).
5. **Dibs GET/POST symmetry**: `POST /requests/:id/dibs` validates the nominee against the same
   pool as the GET candidate (provider pool for `service`, mutual-aid pool otherwise). The new
   `community_connection` reason must not change pool admission — it only re-labels the
   zero-history case. `deriveDibsReason` lives in
   [dibs.ts:26-30](../../services/request-service/src/routes/dibs.ts).
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
11. **Provider directory must stay publicly accessible unauthenticated** (it's used logged-out
    today); community scoping is an authenticated enhancement, not a new auth wall — unless the
    audit ratifies otherwise.
12. **Feed query surfaces gotcha** (memory): browsable-request filtering lives in 4 places incl.
    `utils/queryBuilder.ts` — if any link-up fix touches request browsability, change ALL of them.
