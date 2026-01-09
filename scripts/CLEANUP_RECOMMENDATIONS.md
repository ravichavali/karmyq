# Scripts Cleanup Recommendations

**Created**: 2026-01-08
**Current Count**: 54 scripts (down from 67)
**Status**: Phase 1 complete, Phase 2 recommendations below

---

## ✅ Phase 1 Complete (Deleted 17 Scripts)

Removed one-time fixes:
- Deployment fixes (5)
- Database fixes (7)
- Diagnostic scripts (3)
- Security fixes (2)

---

## 📊 Phase 2 Recommendations

### Production Seeding Scripts (DELETE 5 of 6)

**Problem**: We have 6 production seeding variants that all call `npm run seed` which doesn't exist!

| Script | Purpose | Keep? |
|--------|---------|-------|
| seed-production-data.sh | Basic wrapper | ❌ Delete - calls non-existent npm script |
| seed-production-local.sh | Run on production server | ❌ Delete - calls non-existent npm script |
| seed-production-remote.sh | SSH to production | ❌ Delete - calls non-existent npm script |
| seed-production-remote.ps1 | SSH (Windows) | ❌ Delete - calls non-existent npm script |
| seed-production-screen.sh | Run in screen session | ❌ Delete - calls non-existent npm script |
| seed-production-screen.ps1 | Screen (Windows) | ❌ Delete - calls non-existent npm script |

**Recommendation**: Delete all 6. When we need production seeding, use:
```bash
# Use the actual working scripts
node scripts/generate-realistic-data.ts  # OR
node scripts/seed-test-data.js
```

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

## 🎯 Phase 2 Deletions (Recommended)

Delete these 8-10 scripts:

**Production Seeding (6)**:
- seed-production-data.sh
- seed-production-local.sh
- seed-production-remote.{sh,ps1}
- seed-production-screen.{sh,ps1}

**Redundant Data Scripts (2)**:
- create-test-feed-data.js
- capture-claude-sessions.ps1 (v1)

**Wrappers (2-4)** - Optional:
- seed-test-data.{sh,bat} (just use node directly)
- seed-with-no-rate-limit.sh (was this used?)
- seed-direct-sql.sh (verify purpose first)

---

## 📉 Expected Final Count

After Phase 2:
- **Current**: 54 scripts
- **Delete**: 8-12 scripts
- **Final**: ~42-46 scripts (down from 67)

Still high, but much more manageable and all with clear purposes.

---

## 🚀 Next Steps

1. **Review production scripts** - Confirm they're not used
2. **Delete Phase 2 scripts** - Clean up redundant wrappers
3. **Update README.md** - Reflect new script count
4. **Update SCRIPTS_INVENTORY.md** - Mark deleted scripts

---

**Recommendation**: Proceed with Phase 2 cleanup to get down to ~45 essential scripts.
