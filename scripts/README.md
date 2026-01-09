# Karmyq Scripts Directory

**Last Updated**: 2026-01-08
**Total Scripts**: 67 (see SCRIPTS_INVENTORY.md for complete list)

Utility scripts for development, testing, deployment, and project management.

## 🎯 Primary Scripts (Most Commonly Used)

### Data Seeding

```bash
# DB-based seeding (direct SQL - faster)
node scripts/seed-test-data.js

# API-based seeding (tests API layer)
node scripts/populate-fresh-database.js
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

- **SCRIPTS_INVENTORY.md** - Complete inventory with status and recommendations
- **DEVELOPMENT_PROCESS.md** - Testing requirements and workflows
- **docs/operations/CLAUDE_TRANSCRIPT_SETUP.md** - Session capture workflow
- **docs/operations/SYNTHETIC_DATA_PLAN.md** - Data generation consolidation plan

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
