# Claude Code Session Capture Workflow

Quick reference for capturing and using Claude Code session transcripts.

## 🚀 Quick Start

```powershell
# Capture last 7 days of sessions
.\scripts\capture-claude-sessions.ps1

# Or using batch wrapper
.\scripts\capture-claude-sessions.bat
```

**View captured sessions**: Open `docs/claude-sessions/index.html` in your browser

---

## 📋 Common Commands

| Command | Description |
|---------|-------------|
| `.\scripts\capture-claude-sessions.bat` | Capture last 7 days |
| `.\scripts\capture-claude-sessions.bat 30` | Capture last 30 days |
| `.\scripts\capture-claude-sessions.bat 7 autocommit` | Capture and commit to git |
| `.\scripts\capture-claude-sessions.ps1 -Verbose` | Show detailed output |

---

## 📅 Recommended Schedule

### Weekly (Recommended)
Every Friday evening:
```powershell
.\scripts\capture-claude-sessions.ps1 -DaysBack 7 -AutoCommit
git push  # Push to remote if desired
```

### Daily (For Active Development)
End of each day:
```powershell
.\scripts\capture-claude-sessions.ps1 -DaysBack 1
```

### Monthly Archive
End of month:
```powershell
.\scripts\capture-claude-sessions.ps1 -DaysBack 30 -AutoCommit
```

---

## 🎯 Use Cases

### 1. Code Review
Before reviewing code, check if it was written with Claude:
```
docs/claude-sessions/ → Find date → Review conversation → Understand context
```

### 2. Onboarding
Point new developers to relevant sessions:
- "How was the geocoding service built?" → `2025-12-26` session
- "Why did we choose three-tier caching?" → Search transcripts for "caching"

### 3. Debugging
When a bug appears in Claude-written code:
1. Check git blame for date
2. Find session from that date
3. Review conversation for edge cases and assumptions

### 4. Documentation
Use transcripts as source material for:
- Architecture Decision Records (ADRs)
- Technical design docs
- API documentation
- Troubleshooting guides

---

## 🔧 Integration Options

### Option 1: Git Hook (Automatic)
Create `.git/hooks/post-commit`:
```bash
#!/bin/bash
# Capture sessions weekly (on Fridays)
if [ "$(date +%u)" -eq 5 ]; then
    powershell -ExecutionPolicy Bypass -File scripts/capture-claude-sessions.ps1 -DaysBack 7 -AutoCommit
fi
```

Make executable:
```bash
chmod +x .git/hooks/post-commit
```

### Option 2: Windows Scheduled Task
Run daily at 6 PM:
```powershell
# Run as Administrator
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File $PWD\scripts\capture-claude-sessions.ps1 -DaysBack 1"

$trigger = New-ScheduledTaskTrigger -Daily -At 6PM

Register-ScheduledTask -TaskName "Capture Claude Sessions" `
    -Action $action -Trigger $trigger `
    -Description "Daily capture of Claude Code development sessions"
```

### Option 3: Package.json Script
Add to `package.json`:
```json
{
  "scripts": {
    "capture-sessions": "powershell -ExecutionPolicy Bypass -File scripts/capture-claude-sessions.ps1",
    "capture-sessions:week": "powershell -ExecutionPolicy Bypass -File scripts/capture-claude-sessions.ps1 -DaysBack 7 -AutoCommit"
  }
}
```

Run with:
```bash
npm run capture-sessions
npm run capture-sessions:week
```

---

## 📊 What Gets Captured

Each session transcript includes:

✅ **Full conversation**
- All messages between you and Claude
- Complete code blocks with syntax highlighting
- Reasoning and explanations

✅ **Tool usage**
- Which tools Claude used (Read, Write, Edit, Bash, etc.)
- Tool parameters and outputs
- Why each tool was chosen

✅ **Context**
- File paths referenced
- Commands executed
- Error messages and fixes

✅ **Metadata**
- Session timestamp
- Duration
- Files modified

---

## 🔍 Searching Sessions

### Method 1: Browser Search
1. Open `docs/claude-sessions/index.html`
2. Use browser's "Find in Page" (Ctrl+F)
3. Search for keywords like "geocoding", "authentication", etc.

### Method 2: File Search
```powershell
# Search all session HTML files for a term
Get-ChildItem -Path docs\claude-sessions -Filter *.html -Recurse |
    Select-String -Pattern "geocoding" -Context 2,2
```

### Method 3: Visual Studio Code
1. Open `docs/claude-sessions/` in VS Code
2. Use "Search in Folder" (Ctrl+Shift+F)
3. Search with regex support

---

## 💡 Tips & Best Practices

### 1. Capture Regularly
Don't wait too long - capture sessions while context is fresh:
```powershell
# After major feature work
.\scripts\capture-claude-sessions.ps1 -DaysBack 1 -AutoCommit
```

### 2. Add Descriptive Commits
The script auto-commits with:
```
docs: Add N Claude Code session transcript(s) from YYYY-MM-DD
```

You can amend to add details:
```bash
git commit --amend -m "docs: Add session - Implemented geocoding three-tier cache"
```

### 3. Review Before Pushing
If sessions contain sensitive data:
```powershell
# Capture without auto-commit
.\scripts\capture-claude-sessions.ps1

# Review files
start docs\claude-sessions\index.html

# Commit manually if okay
git add docs/claude-sessions
git commit -m "docs: Add development sessions"
```

### 4. Create Indexes
After capturing many sessions, create topic-based indexes:
```markdown
# docs/claude-sessions/TOPICS.md

## Authentication
- 2025-12-15: JWT implementation
- 2025-12-20: OAuth integration

## Geocoding
- 2025-12-26: Three-tier caching system
- 2025-12-27: IndexedDB implementation
```

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Script not found** | Run from project root: `.\scripts\capture-claude-sessions.ps1` |
| **UTF-8 encoding error** | Set `$env:PYTHONUTF8=1` before running |
| **No sessions found** | Check `$env:APPDATA\Claude\claude-code\sessions` exists |
| **Permission denied** | Run PowerShell as Administrator |
| **Git commit failed** | Ensure git is configured with user name/email |

---

## 📚 Related Documentation

- **[Session Storage README](claude-sessions/README.md)** - Detailed documentation
- **[Social Graph Feature](features/SOCIAL_GRAPH_TRUST_PATHS.md)** - Example of documented feature
- **[Geocoding Service](../services/geocoding-service/README.md)** - Service built during captured sessions

---

## 🎉 Benefits

This workflow gives you:

1. **🧠 Institutional Knowledge** - Never lose context on why decisions were made
2. **🚀 Faster Onboarding** - New devs read sessions to understand the codebase
3. **🐛 Better Debugging** - Review original implementation when fixing bugs
4. **📖 Automatic Documentation** - Sessions become living documentation
5. **🔍 Searchable History** - Find answers to "how was X built?" instantly

---

**Need Help?** Check `docs/claude-sessions/README.md` or review a captured session to see examples!
