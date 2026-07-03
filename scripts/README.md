# Karmyq Scripts Directory

**Last Updated**: 2026-01-08
**Total Scripts**: 52 (down from 67 - see SCRIPTS_INVENTORY.md for complete list)

Utility scripts for development, testing, deployment, and project management.

## 🎯 Primary Scripts (Most Commonly Used)

### Data Seeding

```bash
# DB-based seeding (direct SQL - faster)
node scripts/seed-test-data.js

# API-based seeding (tests API layer)
node scripts/populate-fresh-database.js

# Production seeding (config-based with profiles)
cd tests && npm run seed:production     # Local
./scripts/seed-production-screen.sh     # Production (recommended)
./scripts/seed-production-remote.sh     # SSH to production
```

### Testing (Required Before Commits)

```bash
# Windows - Full test suite
scripts\test-all.bat

# Mac/Linux - Full test suite
./scripts/test-all.sh

# Quick development testing
scripts\test-local.bat quick
```

### Maintenance

```bash
# Clear database
scripts\truncate-database.bat   # Windows
./scripts/truncate-database.sh  # Mac/Linux

# Restart services
./scripts/restart-services.sh
```

### Claude Transcript Capture

```bash
# Capture sessions (see docs/operations/CLAUDE_TRANSCRIPT_SETUP.md)
.\scripts\capture-claude-sessions-v2.ps1 -DaysBack 90

# Sync to separate repo
.\scripts\sync-claude-transcripts.ps1
```

---

## 📁 Script Organization

See **SCRIPTS_INVENTORY.md** for complete categorization of all 67 scripts.

**Key Categories**:
- Data Generation (16 scripts) - Seeding and data generation
- Testing (4 scripts) - Test suite runners
- Diagnostics (14 scripts) - Health checks and debugging
- Maintenance (7 scripts) - Database and service maintenance
- GitHub (5 scripts) - Issue and label management
- Claude (3 scripts) - Session capture and sync
- Git Hooks (4 scripts) - Pre-commit hooks

---

## 📚 Related Documentation

- **[SEEDING_GUIDE.md](SEEDING_GUIDE.md)** - Complete guide to all seeding approaches
- **[SCRIPTS_INVENTORY.md](SCRIPTS_INVENTORY.md)** - Complete inventory with status and recommendations
- **[CLEANUP_RECOMMENDATIONS.md](CLEANUP_RECOMMENDATIONS.md)** - Cleanup status and Phase 2 plan
- **[DEVELOPMENT_PROCESS.md](../docs/DEVELOPMENT_PROCESS.md)** - Testing requirements and workflows
- **[docs/operations/CLAUDE_TRANSCRIPT_SETUP.md](../docs/operations/CLAUDE_TRANSCRIPT_SETUP.md)** - Session capture workflow

---

## GitHub Integration

### Quick Start

Run these commands in order to set up your GitHub project:

```powershell
# 1. Create all labels first
.\scripts\create-github-labels.ps1

# 2. Create all issues with labels
.\scripts\create-github-issues.ps1
```

## Create GitHub Labels

Creates all project labels (priorities, services, types, etc.)

### Usage

**Windows:**
```powershell
.\scripts\create-github-labels.ps1
```

This creates 35+ labels including:
- **Priority**: critical, high, medium, low
- **Services**: auth, community, request, notification, etc.
- **Types**: epic, bug, feature, technical, documentation
- **Status**: blocked, help-wanted, good-first-issue

## Bulk Create GitHub Issues

Creates all 14 initial backlog issues automatically.

### Prerequisites

1. Install GitHub CLI: https://cli.github.com/
2. Authenticate: `gh auth login`
3. **Run create-github-labels.ps1 first** (to create labels)

### Usage

**Windows:**
```powershell
.\scripts\create-github-issues.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/create-github-issues.sh
./scripts/create-github-issues.sh
```

### What Gets Created

- 3 Epics (Mobile, Security, Matching)
- 2 Bugs (Stats, SSE)
- 4 Features (Categories, Search, Profiles, Email)
- 3 Technical (Swagger, Tracing, Testing)
- 2 Documentation (User, Developer guides)

### After Running

1. View: https://github.com/ravichavali/karmyq/issues
2. Add to your Project board
3. Start working!

## Demo data reset (Sprint 117 — the ONLY supported path)

The curated demo reset replaces the old `truncate-database.*` scripts (which now delegate here or
refuse). It is **dry-run by default**; a destructive apply requires an explicit demo fingerprint
(`DEMO_RESET_MARKER=karmyq-demo-reset-v1`), a completed verified backup, an advisory lock, paused
mutation jobs, and one transaction.

```bash
# Read-only plan (no mutation)
npm --workspace @karmyq/simulation-service run reset:demo

# Read-only outward-API health + privacy verification
npm --workspace @karmyq/simulation-service run verify:demo

# Destructive full reset — approved downtime only (backup written to --backup-dir)
npm --workspace @karmyq/simulation-service run reset:demo -- --apply --publish-config

# Explicit finite live-story rotation — NOT a full reset
npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config
```

**Recovery:** an apply that fails after the DB transaction leaves the demo disabled and prints a
bounded restore/rerun path; restore from the timestamped `pg_dump` backup in `--backup-dir`. Never run
`scripts/truncate-database.sql` directly — it is disabled because it cannot guarantee these controls.
