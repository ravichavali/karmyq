# Sprint 24 — Admin Page Simplification

## Handoff Document for New Conversation

**Date**: 2026-03-12
**Current Version**: v9.1.0
**Status**: Sprint 23 complete. Sprint 24 planned: admin page simplification ready to execute.

---

## ⚡ Quick Start

Sprint 24 is a UI-only refactor. Everything is planned. Jump straight to execution:

1. **Read the implementation plan** (all context is there):
   ```
   docs/superpowers/plans/2026-03-12-admin-page-simplification.md
   ```

2. **Execute using subagent-driven-development skill**:
   ```
   Invoke: superpowers:subagent-driven-development
   ```
   The plan has 7 tasks across 4 chunks. Subagents can parallelize Chunks 2+3+4 once Chunk 1 (state changes + tab nav bar) is complete.

3. **First commit target**: `tests/tdd/admin-tab-redirect.test.ts` then state narrowing in `[id].tsx`

---

## ✅ What Was Completed This Session (Sprint 23 → transitioning to Sprint 24)

### Bug Fix: `column "requester_id" does not exist` in badge service (commit `707ba9c`)

**Error**: `❌ Failed to award karma for match: column "requester_id" does not exist`

**Root cause**: `services/reputation-service/src/services/badgeService.ts` line 49 queried
`COUNT(DISTINCT requester_id) FROM requests.matches` — `requester_id` only exists on `requests.help_requests`, not on `requests.matches`.

**Fix**: Added `LEFT JOIN requests.help_requests hr ON m.request_id = hr.id` and changed `requester_id` → `hr.requester_id`. TypeScript check passed.

**Note**: The error appeared as "Failed to award karma for match" because `checkAndAwardBadges` is wrapped in the same try/catch as `awardKarmaForCompletedMatch` in `services/reputation-service/src/events/subscriber.ts` (lines 71–90).

### Admin Page Simplification — Brainstormed + Spec Written + Plan Written

Completed the full brainstorm → spec → plan pipeline:

- **Spec**: `docs/superpowers/specs/2026-03-12-admin-page-simplification-design.md` (commit `d6019ae`, updated `fdc3acf`)
- **Plan**: `docs/superpowers/plans/2026-03-12-admin-page-simplification.md` (commit `88f74cf`)

**Design decisions locked in** (do not re-debate):
- 12 → 7 tabs: Members (merged: Members+Manage+Pending), Norms, Overview, Requests, Insights (merged: Statistics+Export), Settings (merged: Config+Settings+Links), Providers
- Members tab: Active/Pending filter for admins, non-admin gets existing card view unchanged
- Settings tab: Config summary card + CommunityLinks + Advanced toggle (collapsed by default) for TTLs + karma decay
- Old `?tab=config` / `manage` / `pending` / `stats` / `export` / `links` → redirected via `useEffect`
- Config tab was public before — intentionally making it admin-only in Settings; Overview already shows config highlights to non-admins

---

## 🚀 Sprint 24 — What's Next

### Primary Task: Execute the Admin Page Simplification Plan

**Plan file**: `docs/superpowers/plans/2026-03-12-admin-page-simplification.md`

**Single file to edit**: `apps/frontend/src/pages/communities/[id].tsx` (~1530 lines)

**Key line references** (current, will shift as edits are made):
- `activeTab` type union: line ~70
- Tab nav bar: lines 507–621 (currently 12 tabs)
- Members tab render: lines 845–911 (card view)
- Config tab render: lines 1011–1103 (`CommunityConfigEditor`, questionnaire, diff)
- Manage Members tab render: lines 1106–1135 (role dropdown, remove)
- Pending tab render: lines 1138–1166 (approve/reject)
- Old Settings tab render: lines 1169–1213 (6 TTL fields + karma decay)
- Statistics tab render: lines 1216–1356 (stat cards + trust score + network cohesion)
- Providers tab render: lines 1359–1434 (unchanged)
- Export tab render: lines 1437–1459 (3 export types)
- Linked Communities tab render: lines 1462–1466 (`<CommunityLinks>`)
- Requests tab render: lines 1469–1528+ (unchanged)

**`isAdmin` derivation** (line ~416):
```typescript
const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active';
```

**New `activeTab` type** (after change):
```typescript
type ValidTab = 'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers';
```

**Success criteria** (from spec):
1. Admin sees exactly 7 tabs
2. All admin functionality accessible
3. Non-admin Members tab: card list, no filter row, no role/remove controls
4. Pending badge: red dot on Members tab when pending count > 0 (admin-only)
5. Advanced settings collapsed by default; all 6 TTL fields + karma decay accessible on expand
6. Old `?tab=` query params redirect correctly
7. Network Cohesion panel present in Insights tab
8. Overview config highlight panels unchanged

### Secondary: Deploy the badge fix (commit `707ba9c`)
The badge service fix is committed but not yet deployed. After executing the admin page plan, run:
```bash
git push origin master  # GitHub Actions deploys automatically
```

### Optional: Network cohesion "Fragile" for demo data
Demo community may show score 0 / "Fragile" because the 90-day window finds < 2 members who joined in the last 90 days. This is architecturally correct but may not look good in a demo. Consider relaxing the window or seeding more recent members.

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /dev/stdin < migration.sql`
- **Landing page docs**: Edit source markdown in `docs/concepts/` and `docs/adr/`. `scripts/generate-docs.ts` has hardcoded nav arrays — new pages must be added there.
- **Community page is the admin page** — `/communities/[id]/admin` redirects to `/communities/[id]`. Admin tabs are role-gated.
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
