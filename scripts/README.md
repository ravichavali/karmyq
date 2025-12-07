# Scripts - Karmyq Automation

Utility scripts for development and project management.

## Quick Start

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
