# Claude Code Transcript Management

**Version**: 8.0.0
**Last Updated**: 2026-01-03

This guide explains how to capture and manage Claude Code conversation transcripts in a separate repository.

## Overview

Claude Code sessions are valuable documentation but can make the main repo large. This setup:
- Captures transcripts locally
- Syncs them to a separate `karmyq-claude-transcripts` repository
- Keeps main repo clean
- Preserves full AI-assisted development history

## Architecture

```
karmyq/                           # Main repo
├── scripts/
│   ├── capture-claude-sessions.ps1
│   └── capture-claude-sessions.bat
└── .claude-transcripts/          # Local cache (gitignored)
    └── sessions/

karmyq-claude-transcripts/        # Separate repo (auto-synced)
├── 2026-01-03/
│   ├── session-abc123.html
│   └── page-001.html
├── 2026-01-02/
│   └── ...
├── index.html
└── README.md
```

## Initial Setup

### 1. Create Separate Repository

```bash
# On GitHub, create new repository: karmyq-claude-transcripts
# Can be private for sensitive conversations

# Clone it locally
cd ~/development
git clone https://github.com/ravichavali/karmyq-claude-transcripts.git
```

### 2. Install claude-code-transcripts Tool

```bash
# Option A: Using pipx (recommended)
pipx install git+https://github.com/simonw/claude-code-transcripts.git

# Option B: Using pip
pip install git+https://github.com/simonw/claude-code-transcripts.git

# Verify installation
claude-code-transcripts --help
```

### 3. Update Main Repo .gitignore

Add to `.gitignore` in main karmyq repo:
```gitignore
# Claude transcripts (managed in separate repo)
.claude-transcripts/
docs/claude-sessions/
```

### 4. Configure Auto-Sync Script

Create `scripts/sync-claude-transcripts.ps1`:

```powershell
# Sync Claude transcripts to separate repo
param(
    [int]$DaysBack = 7,
    [string]$TranscriptsRepo = "~/development/karmyq-claude-transcripts"
)

# Capture sessions
.\scripts\capture-claude-sessions.ps1 -DaysBack $DaysBack -OutputDir ".claude-transcripts"

# Copy to transcripts repo
$source = ".\.claude-transcripts\*"
$dest = $TranscriptsRepo
Copy-Item -Path $source -Destination $dest -Recurse -Force

# Commit and push
cd $TranscriptsRepo
git add .
git commit -m "docs: add Claude sessions from $(Get-Date -Format 'yyyy-MM-dd')"
git push origin main
```

## Daily Workflow

### Initial Capture (First Time)

Capture last 90 days of sessions to get full history:

```powershell
# Non-interactive mode (processes all sessions automatically)
.\scripts\capture-claude-sessions.bat 90 auto

# Then sync to separate repo
.\scripts\sync-claude-transcripts.ps1 -DaysBack 90
```

This will:
1. Find all sessions from last 90 days
2. Automatically export all of them (no prompts)
3. Save to `.claude-transcripts/` directory
4. Sync to `karmyq-claude-transcripts` repo

### Daily Capture (Ongoing)

**Option A: Interactive** (recommended for manual review)
```powershell
# In main karmyq repo - shows selection menu
.\scripts\capture-claude-sessions.bat 1

# This will:
# 1. Find sessions from last day
# 2. Let you select which to export (Space to select, Enter to confirm)
# 3. Save to .claude-transcripts/

# Then sync to separate repo
.\scripts\sync-claude-transcripts.ps1 -DaysBack 1
```

**Option B: Automated** (for cron jobs)
```powershell
# Non-interactive - captures all automatically
.\scripts\capture-claude-sessions.bat 2 auto

# Use 2 days instead of 1 to ensure no sessions missed
# Then sync
.\scripts\sync-claude-transcripts.ps1 -DaysBack 2
```

### Automated Capture (Optional)

#### Option 1: Windows Scheduled Task

```powershell
# Create daily task at 6 PM (run as admin)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Users\ravic\development\karmyq\scripts\sync-claude-transcripts.ps1 -DaysBack 1"

$trigger = New-ScheduledTaskTrigger -Daily -At "18:00"

Register-ScheduledTask `
    -TaskName "Sync Claude Transcripts" `
    -Action $action `
    -Trigger $trigger `
    -Description "Daily sync of Claude Code sessions to separate repo"
```

#### Option 2: GitHub Action (Auto-sync from main repo)

Create `.github/workflows/sync-transcripts.yml` in main repo:

```yaml
name: Sync Claude Transcripts

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install claude-code-transcripts
        run: pip install git+https://github.com/simonw/claude-code-transcripts.git

      - name: Capture sessions
        run: |
          claude-code-transcripts --output ./transcripts --since $(date -d '7 days ago' +%Y-%m-%d)

      - name: Checkout transcripts repo
        uses: actions/checkout@v4
        with:
          repository: ravichavali/karmyq-claude-transcripts
          token: ${{ secrets.TRANSCRIPTS_REPO_TOKEN }}
          path: transcripts-repo

      - name: Copy and commit
        run: |
          cp -r ./transcripts/* ./transcripts-repo/
          cd transcripts-repo
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "docs: auto-sync Claude sessions $(date +%Y-%m-%d)" || echo "No changes"
          git push
```

## Usage Examples

### Capture Last Week
```powershell
.\scripts\capture-claude-sessions.bat 7
```

### Capture and Auto-Commit
```powershell
.\scripts\capture-claude-sessions.bat 7 autocommit
```

### Capture Specific Date Range
```powershell
# Capture sessions from last 30 days
.\scripts\capture-claude-sessions.ps1 -DaysBack 30 -OutputDir ".claude-transcripts"
```

## Viewing Transcripts

### Local Viewing
```powershell
# Open in browser
start .claude-transcripts\index.html
```

### From Transcripts Repo
```bash
cd ~/development/karmyq-claude-transcripts
open index.html  # Mac
start index.html  # Windows
xdg-open index.html  # Linux
```

### Search Transcripts
```bash
# Search for specific topics
cd ~/development/karmyq-claude-transcripts
grep -r "nginx configuration" .
grep -r "database migration" .
```

## Maintenance

### Clean Up Old Sessions (Local)
```powershell
# Remove sessions older than 90 days from local cache
$cutoff = (Get-Date).AddDays(-90)
Get-ChildItem .claude-transcripts -Directory | Where-Object {
    [datetime]::ParseExact($_.Name, 'yyyy-MM-dd', $null) -lt $cutoff
} | Remove-Item -Recurse -Force
```

### Archive Old Sessions (Transcripts Repo)
```bash
# In transcripts repo, create yearly archives
cd ~/development/karmyq-claude-transcripts
git tag -a "archive-2025" -m "Archive 2025 sessions"
git push origin archive-2025
```

## Troubleshooting

### "claude-code-transcripts not found"
```bash
# Reinstall
pipx install --force git+https://github.com/simonw/claude-code-transcripts.git
```

### "No sessions found"
```bash
# Check Claude sessions directory
ls "$env:APPDATA\Claude\claude-code\sessions"  # Windows
ls "~/Library/Application Support/Claude/claude-code/sessions"  # Mac
```

### Unicode Encoding Errors
```powershell
# Set before running
$env:PYTHONUTF8=1
.\scripts\capture-claude-sessions.bat 7
```

### Permission Denied
```powershell
# Run PowerShell as Administrator
# Or unblock script
Unblock-File .\scripts\capture-claude-sessions.ps1
```

## Security Considerations

- **Private Repo**: Keep transcripts repo private if conversations contain sensitive info
- **Access Control**: Limit who has access to transcripts repo
- **Secrets**: Never commit API keys or passwords (they shouldn't be in transcripts anyway)
- **Audit**: Review transcripts before syncing if working with proprietary code

## Benefits

1. **Development History**: Full record of how features were built
2. **Onboarding**: New developers see thought process and decisions
3. **Debugging**: Reference past conversations when issues arise
4. **Knowledge Transfer**: Share learnings across team
5. **Documentation**: Self-documenting codebase evolution

## Related Documentation

- [Claude Session Workflow](../CLAUDE_SESSION_WORKFLOW.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Tool**: [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) by Simon Willison
