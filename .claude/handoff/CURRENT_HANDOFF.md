# Sprint 21 — Organic Simulation Growth (Staged, Not Yet Committed)

## Handoff Document for New Conversation

**Date**: 2026-03-10
**Current Version**: v9.5.0 (Sprint 20 deployed; Sprint 21 staged, not yet committed)
**Status**: Sprint 21 changes complete and staged. Need commit → push → reseed → start simulation.

---

## ⚠️ First Thing Next Session: Commit + Deploy + Reseed

All Sprint 21 changes are staged. Run:

```bash
# 1. Commit
git commit -m "feat(sprint-21): organic simulation growth, @test.karmyq.com domain, founder bootstrap"

# 2. Push → CI/CD auto-deploys
git push origin master

# 3. After CI green: SSH and wipe old sim data
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod << 'EOF'
DELETE FROM requests.matches
  WHERE requester_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com')
     OR responder_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM requests.help_requests
  WHERE requester_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM community.members
  WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM community.communities
  WHERE created_by IN (SELECT id FROM auth.users WHERE email LIKE '%@test.karmyq.com');
DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com';
EOF

# 4. Restart simulation — founders auto-created on startup
pm2 restart karmyq-simulation --update-env
pm2 logs karmyq-simulation --lines 50
```

**Expected startup output:**
```
🌱 Checking founder accounts...
🌱 Created founder: Maria Reyes <maria.reyes@test.karmyq.com>
🌱 Created founder: James Okafor <james.okafor@test.karmyq.com>
🌱 Created founder: Priya Sharma <priya.sharma@test.karmyq.com>
🌱 Created founder: Wei Zhang <wei.zhang@test.karmyq.com>
🌱 Created founder: Fatima Alhassan <fatima.alhassan@test.karmyq.com>
🌱 Founders ready. Total sim users: 5
🚀 Starting synthetic user simulation...
Growth: 12 new users/day → target 500 users
```

---

## What Was Completed This Session

### Sprint 21 — Organic Simulation Growth

| Change | What | Why |
|--------|------|-----|
| `simulator.ts` rewrite | Organic growth engine: `bootstrapFounders()` + `maybeRegisterNewUser()` | Remove dependency on bulk creation script; users grow naturally |
| `register-user-workflow.ts` NEW | `registerNewUser()` — registers via API, returns `{ id, email, name, token }` | Standalone function for growth engine |
| `db-user-loader.ts` | Filter all queries to `%@test.karmyq.com`; added `getUserCount()`, `userExistsByEmail()` | Sim only touches its own users |
| `realistic-data.ts` | Added `FOUNDERS` constant (5 named people); 4 new community templates | Founder bootstrap; 9 total community templates |
| `create-community-workflow.ts` | Cap raised 5 → 15 | Accommodate 9 templates + organic growth |
| `join-community-workflow.ts` | Guard raised `>= 3` → `>= 6` | Target 5-6 communities/user, 75 users/community |
| `request-workflow.ts` | Skip if user already has 2+ open requests | Prevent request glut |
| `profiles/index.ts` | REQUESTER `createRequests` 0.8 → 0.3; ACTIVE_HELPER `registerAsProvider` 0.05 → 0.08 | Balance request creation; nudge toward 1:10 provider ratio |
| `config/default.json` | Added `growth` block: `newUsersPerDay:12`, `maxUsers:500`, `emailDomain`, `password` | Configurable growth rate |
| `index.ts` | Load growth config from env vars | Allow runtime tuning without code changes |
| `DEPLOYMENT.md` rewrite | Reflects organic growth approach, wipe/reseed instructions | Old doc referenced bulk scripts |
| Deleted obsolete files | `create-simulated-users.js`, `extract-user-credentials.js`, `export-all-users.js`, `credentials-loader.ts` | Remove misleading old approach |
| `tests/unit/register-user-workflow.test.ts` NEW | 4 tests for `registerNewUser()` | Process compliance |
| `CONTEXT.md` updated | Sprint 21 section: growth engine, params, community templates | Documentation current |

### Key Decisions Made
1. **No bulk creation script** — founders bootstrap on startup, everyone else registers organically via API. Much more natural data growth story.
2. **`@test.karmyq.com` domain** — consistent with original `simulation/` design (commit c5489a8). Easy to wipe with a single SQL pattern. Previous session used `@sim-prod.karmyq.com` (wrong).
3. **2 open request cap** — primary guard against request glut. Combined with lowered REQUESTER weight (0.8→0.3).
4. **Community cap 15, join guard 6** — math: 500 users × 5.5 avg memberships / 75 avg per community = ~37 communities. Cap at 15 is the natural template limit; will raise if needed.
5. **Growth rate 12/day default** — reaches ~75 users in ~1 week, ~150 in ~2 weeks. Configurable: set `GROWTH_USERS_PER_DAY=3` to slow down after initial ramp.

---

## Current Demo DB State

- ⚠️ **DB still has old `@test.karmyq.com` data** (stale sim data). Wipe per instructions above.
- No new migrations in Sprint 21
- After reseed: 5 founders created → communities form → 10-15 new users/day join

---

## To Slow Down Simulation (After a Few Weeks)

Set in `ecosystem.config.js` on demo server and restart:
```bash
GROWTH_USERS_PER_DAY=3    # Trickle growth
GROWTH_MAX_USERS=200      # Stop at 200 users
```

---

## Sprint 22 Candidates

1. **Default values for communities and users** — initial config defaults when a new community is created; starting karma/trust for new users. Captured in `docs/IDEAS.md` [2026-03-10 architecture].
2. **Individual trust mechanics** — user-level trust scores as a first-class system. Relates to ADR-011, ADR-040, ADR-043. Design session needed.
3. **Trust model evolution proposals (Part 2)** — system surfaces config evolution proposals for admins. Design session first.
4. **ADR-040 edge cases** — min member floor before trust badge shows; trust score decay for inactive communities.
5. **Karma vs trust unification** — two separate systems, no defined relationship. Design session needed.

---

## Key Files Reference

### Simulation Service (Sprint 21)
| Area | File |
|------|------|
| Organic growth engine | `services/simulation-service/src/simulator.ts` |
| User registration | `services/simulation-service/src/workflows/register-user-workflow.ts` |
| DB user loader (filtered to @test.karmyq.com) | `services/simulation-service/src/db-user-loader.ts` |
| Growth config | `services/simulation-service/src/config/default.json` |
| Founder data | `services/simulation-service/src/data/realistic-data.ts` (FOUNDERS const) |
| Community templates (9 total) | `services/simulation-service/src/data/realistic-data.ts` (COMMUNITIES array) |
| Request glut guard | `services/simulation-service/src/workflows/request-workflow.ts` (line ~30) |
| Deployment guide | `services/simulation-service/DEPLOYMENT.md` |

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually via `docker exec karmyq-postgres psql ... -f /dev/stdin < migration.sql`
- **Landing page docs are gitignored** — generated by `scripts/generate-docs.ts` at build time. Edit source JSON directly in `apps/landing/src/data/docs/`. `generate-docs.ts` has hardcoded nav arrays — new concepts/ADRs must be added to `whyKarmyq`, `howItWorks`, `ADR_GROUPS`, or `GUIDE_ORDER`.
- **Community page is the admin page** — `/communities/[id]/admin` → redirects to `/communities/[id]`. Admin tabs are role-gated.
- **init.sql must stay in sync with migrations** — whenever a migration adds a function/schema change needed by integration tests, it must also be added to `init.sql`.
- **Trust score is 0-100 integer** — `reputation.community_trust_scores.score` is stored as integer (0-100), not a 0-1 float. Display directly as `{score}%`, do not multiply.
- **Tests/ excluded from main tsconfig** — `apps/frontend/tsconfig.json` excludes `tests/**`. Test type-checking is handled by ts-jest. This is intentional.
- **LSP diagnostics are false positives** — VSCode shows parse errors in `trust-model.ts` and simulation-service workflow files that are not real. `npx tsc --noEmit` is the source of truth.
- **Provider service types** — Valid API types are `ride`, `tradesperson`, `tutor`, `other`. Never use `skill`, `errand`, or `care`.
- **Simulation community name** — `create-collective-workflow` looks up community by exact name `'PDX Service Providers Network'`. If name changes in realistic-data.ts, update the workflow too.
- **Sim email domain** — `@test.karmyq.com`. All sim user queries filter by this pattern. Wipe: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'`.
- **No bulk user creation scripts** — simulation bootstraps founders on startup and grows organically. Do NOT re-create `create-simulated-users.js`.
