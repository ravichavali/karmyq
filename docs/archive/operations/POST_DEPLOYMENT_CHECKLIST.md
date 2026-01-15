# Post-Deployment Organization Checklist

**Deployment**: January 2026
**Status**: Documentation Phase
**Next Steps**: Clean up and organize

## ✅ Completed

- [x] Fixed nginx routing (request creation now works)
- [x] Added all missing API routes
- [x] Fixed Loki/Promtail observability stack
- [x] Created DEPLOYMENT_GUIDE.md
- [x] Created JANUARY_2026_DEPLOYMENT.md (deployment summary)
- [x] Created CLAUDE_TRANSCRIPT_SETUP.md
- [x] Fixed capture-claude-sessions.ps1 script
- [x] Created sync-claude-transcripts.ps1 script
- [x] Updated .gitignore for separate transcripts repo

## 🔄 In Progress

### 1. Organize Scripts

**Current state**: Scripts scattered in `scripts/` directory
**Goal**: Organize into subdirectories

```
scripts/
├── deployment/              # Production deployment scripts
│   ├── deploy-frontend.sh
│   ├── deploy-service.sh
│   └── README.md
├── diagnostics/             # Debugging and testing scripts
│   ├── diagnose-frontend-request.js
│   ├── diagnose-feed.js
│   └── README.md
├── maintenance/             # Operational maintenance
│   ├── sync-claude-transcripts.ps1
│   └── README.md
├── github/                  # GitHub automation
│   ├── create-github-issues.ps1
│   ├── create-github-labels.ps1
│   └── add-labels-to-issues.ps1
└── archive/                 # Old/deprecated scripts
    └── README.md
```

**Action items**:
```bash
# Create subdirectories
mkdir -p scripts/{deployment,diagnostics,maintenance,github,archive}

# Move deployment scripts
mv scripts/deploy-frontend-*.ps1 scripts/deployment/
mv scripts/*-production*.ps1 scripts/deployment/

# Move diagnostic scripts
mv scripts/diagnose-*.js scripts/diagnostics/

# Move maintenance scripts
mv scripts/sync-claude-transcripts.ps1 scripts/maintenance/
mv scripts/capture-claude-sessions.* scripts/maintenance/

# Move GitHub scripts
mv scripts/*github*.ps1 scripts/github/
```

### 2. Setup Claude Transcripts Repo

**Steps**:
1. Create repository on GitHub:
   ```bash
   # On GitHub.com:
   # New Repository → karmyq-claude-transcripts (Private)
   ```

2. Clone locally:
   ```bash
   cd ~/development
   git clone https://github.com/ravichavali/karmyq-claude-transcripts.git
   ```

3. Test capture script:
   ```powershell
   cd c:\Users\ravic\development\karmyq
   .\scripts\capture-claude-sessions.bat 7
   ```

4. Test sync script:
   ```powershell
   .\scripts\sync-claude-transcripts.ps1 -DaysBack 7
   ```

5. Verify on GitHub:
   - Check that sessions are pushed
   - Verify index.html is readable

### 3. Complete Documentation

**Remaining docs**:
- [ ] TROUBLESHOOTING.md (expand with all issues from this session)
- [ ] NGINX_CONFIGURATION.md (detailed nginx setup guide)
- [ ] SCRIPT_ORGANIZATION.md (explain new structure)

## 📋 Pending Tasks

### Short-term (This Week)

- [ ] Remove debug logging from `apps/frontend/src/pages/dashboard.tsx`
- [ ] Test full user workflow end-to-end on production
- [ ] Archive old diagnostic scripts to `scripts/archive/`
- [ ] Create README.md in each scripts subdirectory
- [ ] Document environment variables in DEPLOYMENT_GUIDE.md

### Medium-term (This Month)

- [ ] Fix Promtail→Loki DNS issue (use proper container networking)
- [ ] Set up automated health checks (cron job or GitHub Action)
- [ ] Document SSL certificate renewal process
- [ ] Create deployment runbooks for all services
- [ ] Add nginx configuration tests

### Long-term (This Quarter)

- [ ] Setup GitHub Actions for deployment automation
- [ ] Implement automated SSL cert renewal (cron job)
- [ ] Consider containerizing nginx
- [ ] Set up comprehensive monitoring alerts
- [ ] Implement blue-green deployments

## 🗂️ Files to Review

### Scripts That Need Organization

**Deployment-related**:
- `scripts/deploy-frontend-geocoding-fix.ps1` → move to deployment/
- `scripts/deploy-frontend-debug.sh` → move to deployment/
- `scripts/seed-production-*.ps1` → move to deployment/ or maintenance/

**Diagnostic**:
- `scripts/diagnose-frontend-request.js` → move to diagnostics/
- `scripts/diagnose-feed.js` → move to diagnostics/

**Maintenance**:
- `scripts/maintenance/archive-claude-transcripts.sh` → keep (Linux version)

### Scripts to Archive

Check if these are still needed:
- Any one-off scripts from previous deployments
- Scripts superseded by new versions
- Experimental or testing scripts

## 📝 Documentation to Create

### 1. SCRIPT_ORGANIZATION.md
```markdown
# Scripts Organization

## Directory Structure
- deployment/: Production deployment scripts
- diagnostics/: Debugging and testing
- maintenance/: Routine operational tasks
- github/: GitHub automation
- archive/: Deprecated scripts

## Usage
[Document each category]
```

### 2. NGINX_CONFIGURATION.md
```markdown
# Nginx Configuration Guide

## Overview
- Host-level nginx (not containerized)
- SSL via Let's Encrypt
- Proxies to Docker services

## Route Configuration
[Document all API routes and patterns]

## SSL Management
[Document certbot setup]
```

### 3. Expand TROUBLESHOOTING.md
Add sections for:
- Request creation issue (301 redirects)
- Environment variable caching
- All nginx 404 errors we fixed
- Loki/Promtail issues
- Database connection problems

## ✨ Quick Wins

These can be done immediately:

1. **Capture this session**:
   ```powershell
   .\scripts\capture-claude-sessions.bat 1
   .\scripts\sync-claude-transcripts.ps1 -DaysBack 1
   ```

2. **Organize deployment scripts**:
   ```bash
   mkdir scripts/deployment
   mv scripts/deploy-*.ps1 scripts/deployment/
   mv scripts/deploy-*.sh scripts/deployment/
   ```

3. **Remove debug logging**:
   - Edit `apps/frontend/src/pages/dashboard.tsx`
   - Remove console.log statements added for debugging
   - Commit cleanup

4. **Commit documentation**:
   ```bash
   git add docs/operations/*.md
   git add .gitignore
   git add scripts/*.ps1
   git commit -m "docs: add operations guides and Claude transcript management"
   ```

## 🎯 Success Criteria

Post-deployment cleanup is complete when:
- ✅ All scripts organized into logical subdirectories
- ✅ Each subdirectory has a README explaining its contents
- ✅ Claude transcripts captured and synced to separate repo
- ✅ All deployment issues documented in TROUBLESHOOTING.md
- ✅ Nginx configuration fully documented
- ✅ Debug code removed from production
- ✅ All changes committed to git

## 🔗 Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [January 2026 Deployment Summary](./JANUARY_2026_DEPLOYMENT.md)
- [Claude Transcript Setup](./CLAUDE_TRANSCRIPT_SETUP.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Created**: 2026-01-03
**Purpose**: Track post-deployment cleanup and organization tasks
