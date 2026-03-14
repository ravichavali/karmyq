# Sprint 25 — COMPLETE ✅

## Handoff Document for New Conversation

**Date**: 2026-03-14
**Current Version**: v9.2.0
**Status**: Sprint 25 complete. Moderator role model + admin-as-connector requests tab deployed to karmyq.com.

---

## ⚡ Quick Start

Sprint 25 is done. No pending implementation work. Next sprint should start with brainstorming.

---

## ✅ What Was Completed This Session (Sprint 25)

### Moderator Role Model — Activated & Deployed (commits `a658a04`–`0502a54`)

The `moderator` role was previously a no-op. Sprint 25 fully activates it across frontend and backend.

**Spec document**: `docs/superpowers/specs/2026-03-13-moderator-role-model.md`

**Permission model** (v9.2.0):

| Feature | Member | Moderator | Admin |
|---------|:------:|:---------:|:-----:|
| Overview / Members card / Norms | ✓ | ✓ | ✓ |
| Members — Active/Pending filter | ✗ | ✓ | ✓ |
| Members — approve/reject/invite | ✗ | ✓ | ✓ |
| Members — change roles / remove | ✗ | ✗ | ✓ |
| Pending badge on Members nav | ✗ | ✓ | ✓ |
| Requests tab (triage + match) | ✗ | ✓ | ✓ |
| Insights — stats & cohesion | ✗ | ✓ | ✓ |
| Insights — export data | ✗ | ✗ | ✓ |
| Settings tab | ✗ | ✗ | ✓ |
| Providers tab | ✗ | ✓ | ✓ |

### Frontend Changes (`apps/frontend/src/pages/communities/[id].tsx`)

- Added `isModerator` and `isAdminOrMod` derived state (near line 451)
- Tab nav restructured: always-visible / `isAdminOrMod` / `isAdmin`-only groups
- Within-tab gating updated for Members, Insights, Providers, Requests
- Settings link in Overview + Providers save button gated to `isAdmin`
- **Triage modal** (Stage 1): urgency override + admin note textarea, opens from Requests tab
- **Match proposal** (Stage 2): member select + "Propose match" button inside triage modal (visible when `req.status === 'open'`)
- `handleCloseTriageModal` resets all 6 triage state vars

### Backend Changes

- `services/community-service/src/routes/members.ts`: moderators can update member `status` (approve/reject) but not `role` — prevents role escalation
- `services/request-service/src/routes/requests.ts`: new `PATCH /requests/:id/admin-triage` endpoint; `GET /requests` enriched with `admin_note` via `include_admin_notes=true`
- `services/request-service/src/routes/matches.ts`: optional `community_id` guard on `POST /matches` for admin/mod context

### Schema

- New table: `requests.request_admin_notes(id, request_id FK, community_id FK, note, updated_by, updated_at, UNIQUE(request_id, community_id))`
- Migration: `infrastructure/postgres/migrations/20260313-admin-request-triage.sql`
- **⚠️ Migration NOT auto-applied** — must run manually on server (see persistent context)

### API Client (`apps/frontend/src/lib/api.ts`)

- `requestService.adminTriageRequest(id, { community_id, urgency?, note? })` — PATCH triage
- `requestService.createMatch({ request_id, responder_id, community_id? })` — POST match
- `requestService.getRequests` params include `include_admin_notes?: boolean`

### Tests

- `tests/tdd/moderator-permissions.test.ts` — 11 tests (role gating logic, pendingCount, match proposal filtering)
- `tests/tdd/admin-request-triage.test.ts` — 11 tests (urgency badge mapping, modal init, payload contracts)
- All 22 tests pass

### Docs

- `docs/superpowers/specs/2026-03-13-moderator-role-model.md` — permission spec
- `services/request-service/CONTEXT.md` — new triage endpoint, admin notes enrichment
- `services/community-service/CONTEXT.md` — moderator approve/reject note
- `services/registry.json` — new endpoint registered
- `apps/landing/src/data/docs/concepts/community-roles.json` — new concept page
- `apps/landing/src/data/docs/guides/community-admin.json` — Moderator Role section added
- `apps/landing/src/data/docs/nav.json` — community-roles in "How It Works"

**Deployment**: Pushed to master → GitHub Actions CI/CD → karmyq.com ✅ (run `23078132674`, all green)

---

## ⚠️ Post-Deploy Action Required

Apply the Sprint 25 DB migration on the server — deploy.sh does NOT auto-run migrations:

```bash
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db \
  -f /dev/stdin < infrastructure/postgres/migrations/20260313-admin-request-triage.sql
```

Without this, the `PATCH /requests/:id/admin-triage` endpoint will error on note saves (table missing).

---

## 🚀 Next Sprint — No Planned Work

No handoff tasks. Start fresh with brainstorming.

### Optional (carried forward):
- **Network cohesion "Fragile" for demo data** — demo community may show score 0 / "Fragile" because the 90-day window finds < 2 members who joined recently. Consider relaxing window or seeding more recent members.
- **Node.js 20 actions deprecation warning** — GitHub Actions warns about deprecated Node 20 actions (checkout@v4, docker/build-push-action@v5). Not blocking today but should be updated before June 2026.

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /dev/stdin < migration.sql`
- **Landing page docs**: Files live in `apps/landing/src/data/docs/` — force-add with `git add -f` since the directory is gitignored but files are tracked. Do NOT regenerate from source.
- **Community page is the admin page** — `/communities/[id]/admin` redirects to `/communities/[id]`. Tabs are role-gated.
- **init.sql must stay in sync with migrations** — add new columns/tables to both.
- **Trust score is 0-100 integer** — stored as integer, display as-is, do not multiply by 100.
- **Tests/ excluded from main tsconfig** — `apps/frontend/tsconfig.json` excludes `tests/**`. Test type-checking handled by ts-jest.
- **LSP diagnostics are false positives** — VSCode shows parse errors that aren't real. `npx tsc --noEmit` is the source of truth.
- **Provider service types** — Valid API types: `ride`, `tradesperson`, `tutor`, `other`. Never use `skill`, `errand`, `care`.
- **Simulation community name** — `create-collective-workflow` looks up by exact name `'PDX Service Providers Network'`.
- **Sim email domain** — `@test.karmyq.com`. Wipe: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'`
- **No bulk user creation scripts** — simulation grows organically. Do NOT re-create `create-simulated-users.js`.
- **JWT communities cap** — auth service caps communities in JWT at 15 (`JWT_COMMUNITIES_LIMIT`). Full membership always checked via DB.
- **Auto-generated files gitignored** — `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md` are generated by pre-commit hook and ignored by git.
- **No worktrees** — solo developer workflow. Work directly on a feature branch (`git checkout -b feature/sprint-NN`). Worktrees cause npm install overhead and jest path bugs.
- **Network cohesion 90-day window** — both active member count (N) and edge data are filtered to 90 days to keep density ≤ 1.
- **Only one simulation now** — `simulation/` directory deleted. Only `services/simulation-service/` exists. DB user: `karmyq_user`, organic growth. Start with `pm2 start ecosystem.config.js --env production` from `services/simulation-service/`.
- **Match status lifecycle**: `proposed` → `matched` (after accept) → `completed` (after both sides mark done). There is NO `active` status for matches.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from request body (not JWT) to identify which party is completing.
- **responseInterceptor unwraps one level**: All axios API clients use `responseInterceptor` which transforms `response.data = response.data.data`. So `response.data` in handlers is already the inner data object — never do `response.data?.data`.
- **Table schema naming**: community schema is `communities` (plural), table is `members`. `requests.help_requests` has NO `community_id` column — use `requests.request_communities` junction table to link requests to communities.
- **Community stats bypasses RLS**: `community-service/src/routes/stats.ts` uses `BEGIN; SET LOCAL row_security = off` to count across all rows.
- **Badge service catch scope**: `checkAndAwardBadges` errors in `reputation-service/src/events/subscriber.ts` are caught by the same catch block as `awardKarmaForCompletedMatch` and log as "Failed to award karma for match" — this is the expected error surface for badge failures.
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms (always visible); Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only). `ValidTab` type in `[id].tsx` line ~61. `isModerator` and `isAdminOrMod` derived state near line 451.
- **Triage modal state**: 6 vars — `selectedRequest`, `showTriageModal`, `triageUrgency`, `triageNote`, `selectedResponderId`, `proposingMatch`. All reset by `handleCloseTriageModal()` (~line 454).
- **request_admin_notes table**: community-scoped notes, UNIQUE(request_id, community_id). Accessed via `PATCH /requests/:id/admin-triage` (body: `{ community_id, urgency?, note? }`). GET enriched with `include_admin_notes=true`.
- **Moderator role escalation prevention**: moderators cannot pass `role` field in member updates → cannot promote anyone (including themselves).
