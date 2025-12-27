# Claude Code Session Transcripts

This directory contains HTML transcripts of development sessions with Claude Code. These transcripts serve as:

- **Development History**: Track how features were built and why certain decisions were made
- **Onboarding Documentation**: Help new developers understand the codebase evolution
- **Problem-Solving Reference**: Review past conversations when debugging similar issues
- **Knowledge Base**: Capture architectural discussions and technical reasoning

## How to Use

### View Sessions
Open `index.html` in your browser to see all captured sessions organized by date.

### Capture New Sessions

**Automatic capture (last 7 days):**
```powershell
# PowerShell
.\scripts\capture-claude-sessions.ps1

# Or using batch file
.\scripts\capture-claude-sessions.bat
```

**Capture specific timeframe:**
```powershell
# Last 30 days
.\scripts\capture-claude-sessions.ps1 -DaysBack 30

# Last 3 days with auto-commit
.\scripts\capture-claude-sessions.ps1 -DaysBack 3 -AutoCommit
```

**Using batch wrapper:**
```bash
# Last 14 days
.\scripts\capture-claude-sessions.bat 14

# Last 7 days with auto-commit
.\scripts\capture-claude-sessions.bat 7 autocommit
```

## Automated Workflow

### Option 1: Manual Weekly Capture
Run the script every Friday to archive the week's sessions:
```powershell
.\scripts\capture-claude-sessions.ps1 -DaysBack 7 -AutoCommit
```

### Option 2: Git Hook (Post-Commit)
Add to `.git/hooks/post-commit` to auto-capture after commits:
```bash
#!/bin/bash
# Only run on Fridays or when specifically requested
if [ "$(date +%u)" -eq 5 ]; then
    powershell -ExecutionPolicy Bypass -File scripts/capture-claude-sessions.ps1 -DaysBack 7
fi
```

### Option 3: Scheduled Task (Windows)
Create a Windows scheduled task to run daily:
```powershell
# Create scheduled task (run as admin)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Users\ravic\development\karmyq\scripts\capture-claude-sessions.ps1 -DaysBack 1"

$trigger = New-ScheduledTaskTrigger -Daily -At 6PM

Register-ScheduledTask -TaskName "Capture Claude Sessions" `
    -Action $action -Trigger $trigger -Description "Daily capture of Claude Code sessions"
```

## Directory Structure

```
docs/claude-sessions/
├── index.html                    # Main index page
├── 2025-12-27/                   # Date-based folders
│   ├── session-abc123-index.html # Session transcript
│   ├── page-001.html             # Paginated session pages
│   ├── page-002.html
│   └── ...
├── 2025-12-26/
│   └── ...
└── README.md                     # This file
```

## Key Features Captured

Sessions automatically include:
- ✅ **Full conversation history** - All messages, code, and reasoning
- ✅ **Syntax highlighting** - Code blocks properly formatted
- ✅ **Tool calls** - Which tools were used and why
- ✅ **Mobile-friendly** - Responsive HTML design
- ✅ **Search-friendly** - Text-based, indexable content

## Privacy & Git

**Default behavior**: Sessions are committed to git for team documentation.

If you prefer to keep sessions local (not in git), uncomment this line in `.gitignore`:
```gitignore
# docs/claude-sessions/
```

## Troubleshooting

### "claude-code-transcripts not found"
Install the tool:
```bash
pip install git+https://github.com/simonw/claude-code-transcripts.git
```

### Unicode encoding errors
Set environment variable before running:
```powershell
$env:PYTHONUTF8=1
```

### No sessions found
Check that Claude Code is installed and you have recent sessions:
```powershell
ls "$env:APPDATA\Claude\claude-code\sessions"
```

## Example Use Cases

### 1. Reviewing Feature Implementation
When a new developer asks "How was the geocoding service built?", point them to the session from 2025-12-26 where it was implemented.

### 2. Debugging Issues
If a bug appears in code written during a Claude session, review the transcript to understand the original reasoning and edge cases discussed.

### 3. Architectural Decisions
When questioning why a certain architecture was chosen (e.g., three-tier caching), review the session where it was designed.

### 4. Onboarding New Team Members
Have new developers read recent sessions to understand:
- How the team approaches problems
- Code conventions and patterns
- Architecture decisions and trade-offs

## Contributing

If you improve the capture script or workflow:
1. Test changes locally
2. Update this README with new features
3. Commit both script and documentation changes

---

**Last Updated**: 2025-12-27
**Tool**: [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) by Simon Willison
