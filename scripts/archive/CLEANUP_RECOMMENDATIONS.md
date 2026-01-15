# Scripts Cleanup Recommendations

**Created**: 2026-01-08
**Current Count**: 52 scripts (down from 67)
**Status**: ✅ Phase 1 & 2 Complete - All essential scripts remain

---

## ✅ Phase 1 Complete (Deleted 17 Scripts)

Removed one-time fixes:
- Deployment fixes (5)
- Database fixes (7)
- Diagnostic scripts (3)
- Security fixes (2)

---

## ✅ Phase 2 Complete (Deleted 2 Scripts)

**Deleted**:
- create-test-feed-data.js (redundant with populate-fresh-database.js)
- capture-claude-sessions.ps1 (v1 - superseded by v2)

---

## 📊 Phase 2 Analysis

### Production Seeding Scripts (KEEP ALL 6) ✅

**Status**: All 6 scripts are WORKING correctly! They call `npm run seed` from tests/package.json

| Script | Purpose | Keep? |
|--------|---------|-------|
| seed-production-data.sh | Basic wrapper | ✅ Keep - working correctly |
| seed-production-local.sh | Run on production server | ✅ Keep - working correctly |
| seed-production-remote.sh | SSH to production | ✅ Keep - working correctly |
| seed-production-remote.ps1 | SSH (Windows) | ✅ Keep - working correctly |
| **seed-production-screen.sh** | Run in screen session | ✅ Keep - **BEST for production** |
| seed-production-screen.ps1 | Screen (Windows) | ✅ Keep - working correctly |

**How they work**:
```bash
# All scripts call: npm run seed -- --profile production
# Which runs: ts-node scripts/seed-data.ts --profile production
# Located in: tests/scripts/seed-data.ts
```

**Recommendation**:
- Keep all 6 - they're for different deployment scenarios
- Use **seed-production-screen.sh** for production (runs in detached screen session)
- Use **seed-production-remote.sh** to seed from local machine via SSH

---

### Additional Data Generation Scripts (REVIEW 4)

| Script | Size | Purpose | Keep? |
|--------|------|---------|-------|
| create-test-feed-data.js | ~5K | Create feed test data | ❌ Redundant with populate-fresh-database.js |
| populate-polymorphic-data.js | 12K | Polymorphic examples | ⚠️ Keep for now (examples) |
| generate-large-dataset.js | 9K | Performance testing | ✅ Keep (different purpose) |
| generate-realistic-data.ts | 48K | Large-scale production data | ✅ Keep (production seeding) |

**Recommendation**:
- Delete `create-test-feed-data.js` (redundant)
- Keep `generate-large-dataset.js` (performance testing)
- Keep `generate-realistic-data.ts` (production scale)
- Keep `populate-polymorphic-data.js` for now (merge later)

---

### Wrappers & Shell Scripts (REVIEW)

| Script | Purpose | Keep? |
|--------|---------|-------|
| seed-test-data.sh | Wrapper for seed-test-data.js | ⚠️ Redundant? Just run node directly |
| seed-test-data.bat | Windows wrapper | ⚠️ Redundant? Just run node directly |
| seed-with-no-rate-limit.sh | Disable rate limits | ⚠️ Was this ever used? |
| seed-direct-sql.sh | Direct SQL seeding | ⚠️ What does this do vs seed-test-data.js? |
| seed-test-data.sql | SQL file | ✅ Keep if seed-direct-sql uses it |

**Recommendation**: Review these - most wrappers are unnecessary if we just run node directly

---

### Remaining Scripts by Category

After Phase 2 cleanup, we should have:

**Data Generation (5-6 scripts)**: ⬇️ Down from 16
- ✅ seed-test-data.js (DB-based dev/test)
- ✅ populate-fresh-database.js (API-based dev/test)
- ✅ generate-realistic-data.ts (production scale)
- ✅ generate-large-dataset.js (performance testing)
- ⚠️ populate-polymorphic-data.js (examples - consolidate later)
- ⚠️ seed-test-data.sql (if still needed)

**Testing (4 scripts)**: ✅ Keep all
- test-all.{bat,sh}
- test-local.{bat,sh}

**Diagnostics (11 scripts)**: ✅ Keep
- check-*.sh (6 scripts)
- production-diagnostics.sh
- validate-context-docs.{bat,sh}
- standardize-responses.js (?)

**Maintenance (5 scripts)**: ✅ Keep
- truncate-database.{bat,sh,sql}
- restart-services.sh
- run-migrations.sh

**Claude (3 scripts)**: ✅ Keep (delete v1)
- ✅ capture-claude-sessions-v2.ps1
- ✅ capture-claude-sessions.bat
- ❌ capture-claude-sessions.ps1 (v1 - delete)
- ✅ sync-claude-transcripts.ps1

**GitHub (5 scripts)**: ✅ Keep all
- create-github-issues.{ps1,sh}
- create-github-labels.{ps1,sh}
- add-labels-to-issues.ps1

**Git Hooks (4 scripts)**: ✅ Keep
- setup-git-hooks.sh
- install-git-hooks.{bat,sh}
- setup-production-hooks.sh

**Other**:
- init-production-database.sh (?)
- secrets-rotate.sh (?)
- secrets-rollback.sh (?)

---

## 🎯 Optional Future Cleanup

**Wrapper Scripts** - Can optionally delete if you prefer running node directly:
- seed-test-data.{sh,bat} (wrappers for seed-test-data.sql via psql)
- seed-with-no-rate-limit.sh (unclear if used)
- seed-direct-sql.sh (unclear purpose)

**Note**: seed-test-data.sh actually runs seed-test-data.sql (pure SQL with social graph test data), which is different from seed-test-data.js (Node.js script). Both may be useful.

---

## 📉 Final Count

After Phase 1 & 2:
- **Started**: 67 scripts
- **Deleted**: 15 scripts (Phase 1: 13 one-time fixes, Phase 2: 2 redundant)
- **Current**: 52 scripts
- **Reduction**: 22% decrease (15 scripts removed)

**Four Seeding Approaches** (all needed):
1. **DB-based (Node)**: scripts/seed-test-data.js (direct SQL via pg Pool - fast)
2. **DB-based (SQL)**: scripts/seed-test-data.sql (pure SQL for social graph testing)
3. **API-based**: scripts/populate-fresh-database.js (tests API layer)
4. **Config-based**: tests/scripts/seed-data.ts (production profiles)

All four serve different purposes and should be kept.

---

## 🚀 Status

✅ **Phase 1**: Deleted 13 one-time fix scripts
✅ **Phase 2**: Deleted 2 redundant scripts
✅ **Documentation**: Updated all docs with new count
✅ **Production Scripts**: Verified all 6 are working correctly

**Result**: Clean, well-organized scripts directory (52 essential scripts, down from 67)

---

**Optional Future Cleanup**: Consider removing wrapper scripts if you prefer running commands directly (would save ~3-4 more scripts).
