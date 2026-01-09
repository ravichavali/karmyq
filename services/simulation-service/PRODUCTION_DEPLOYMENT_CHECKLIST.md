# Production Deployment Checklist - Simulation Service

**Service**: Synthetic User Simulation Service
**Version**: Phase 1 Complete
**Date**: 2026-01-09
**Environment**: Production + Staging

---

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] All TypeScript compiles without errors
- [x] No `any` types except controlled contexts
- [x] Error handling implemented for all workflows
- [x] Graceful shutdown handlers (SIGINT/SIGTERM)
- [x] Rate limiting with exponential backoff
- [x] Comprehensive logging

### ✅ Documentation
- [x] README.md complete
- [x] DEPLOYMENT.md comprehensive
- [x] TESTING.md with test results
- [x] ADR-006 architectural decision documented
- [x] CONTEXT.md service overview

### ✅ Configuration
- [x] `.env.production` template created
- [x] `ecosystem.config.js` PM2 config ready
- [x] Environment-specific settings validated
- [x] Business hours configured for Pacific timezone

### ✅ Testing
- [x] TypeScript compilation successful
- [x] API connectivity verified
- [x] Workflows tested locally (test-workflows.ts)
- [ ] Integration tests passing (pending test data)
- [ ] Load testing completed (pending deployment)

---

## Deployment Steps

### Step 1: Server Preparation

**On Production Server** (karmyq.com or your production host):

```bash
# 1. SSH to production server
ssh user@production-server

# 2. Install Node.js 18+ if not present
node --version  # Should be 18+

# 3. Install PM2 globally
npm install -g pm2

# 4. Create application directory
sudo mkdir -p /opt/karmyq
sudo chown $USER:$USER /opt/karmyq
```

**Status**: ⬜ Not Started

---

### Step 2: Code Deployment

```bash
# 1. Clone or pull repository
cd /opt/karmyq
git clone https://github.com/your-org/karmyq.git .
# OR if already cloned:
git pull origin master

# 2. Navigate to simulation service
cd services/simulation-service

# 3. Install dependencies
npm install --production

# 4. Build TypeScript
npm run build

# 5. Verify build
ls -la dist/
```

**Expected Output**:
- `dist/` directory with compiled JavaScript
- No TypeScript errors

**Status**: ⬜ Not Started

---

### Step 3: Create Simulated Users

```bash
# Still in /opt/karmyq/services/simulation-service

# 1. Preview user creation (dry run)
node create-simulated-users.js --env production --count 20 --dry-run

# 2. Create users
node create-simulated-users.js --env production --count 20

# 3. Verify credentials file created
ls -la .env.production.users

# 4. Secure credentials file
chmod 600 .env.production.users
```

**Expected Output**:
```
✓ Created: 20
✓ Already existed: 0
✗ Failed: 0

✓ Credentials saved to: .env.production.users
```

**Status**: ⬜ Not Started

---

### Step 4: Configure Environment

```bash
# 1. Copy production environment template
cp .env.production .env

# 2. Verify configuration
cat .env

# 3. Test API connectivity
curl https://karmyq.com/api/health
```

**Expected `.env` contents**:
```bash
API_BASE_URL=https://karmyq.com/api
SIMULATION_ENABLED=true
ENVIRONMENT=production
MIN_CONCURRENT_SESSIONS=5
MAX_CONCURRENT_SESSIONS=15
TOTAL_USERS=20
BUSINESS_HOURS_ENABLED=true
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=21:00
BUSINESS_HOURS_TIMEZONE=America/Los_Angeles
RESPECT_RATE_LIMITS=true
MIN_DELAY_MS=2000
MAX_RETRIES=3
LOG_LEVEL=info
```

**Status**: ⬜ Not Started

---

### Step 5: Start Service with PM2

```bash
# 1. Verify ecosystem.config.js
cat ecosystem.config.js

# 2. Start service
pm2 start ecosystem.config.js --env production

# 3. Save PM2 configuration
pm2 save

# 4. Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# 5. Check status
pm2 status
pm2 logs karmyq-simulation --lines 50
```

**Expected Output**:
```
┌────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id │ name                 │ mode    │ ↺       │ status   │
├────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ karmyq-simulation    │ fork    │ 0       │ online   │
└────┴──────────────────────┴─────────┴─────────┴──────────┘
```

**Logs should show**:
```
🤖 Simulation Service Starting...
✓ Configuration loaded
✓ Session manager initialized
✓ Business hours: 09:00-21:00 Pacific
✓ Total users: 20
✓ Concurrent sessions: 5-15
🚀 Simulation service running
```

**Status**: ⬜ Not Started

---

### Step 6: Verify Service Activity

**Wait 2-3 minutes, then check logs**:

```bash
pm2 logs karmyq-simulation --lines 100
```

**Expected Activity** (during business hours):
```
[Session] Started session for sim-user-1@sim-prod.karmyq.com
[Action] Browse requests (user: sim-user-1)
[Action] Create request (user: sim-user-2)
[Action] Offer help (user: sim-user-3)
[Session] Completed session for sim-user-1 (duration: 5m 23s)
```

**Check for errors**:
```bash
pm2 logs karmyq-simulation --err --lines 50
```

**Should NOT see**:
- Login failures (401 errors)
- Connection timeouts
- Unhandled exceptions
- High rate limit errors (429 > 5%)

**Status**: ⬜ Not Started

---

### Step 7: Verify Database Activity

**On database server or via psql**:

```sql
-- Check recent requests created
SELECT COUNT(*), MAX(created_at)
FROM requests.help_requests
WHERE requester_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%sim-prod.karmyq.com'
)
AND created_at > NOW() - INTERVAL '1 hour';

-- Check recent offers
SELECT COUNT(*), MAX(created_at)
FROM requests.help_offers
WHERE responder_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%sim-prod.karmyq.com'
)
AND created_at > NOW() - INTERVAL '1 hour';

-- Check active sessions
SELECT COUNT(*) as active_simulated_sessions
FROM auth.sessions
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%sim-prod.karmyq.com'
)
AND expires_at > NOW();
```

**Expected**: Activity should be visible during business hours

**Status**: ⬜ Not Started

---

### Step 8: Setup Monitoring

**Add Grafana alerts** (if using Grafana):

1. **Simulation Service Health**:
   - Alert if service down > 5 minutes
   - Alert if no activity during business hours > 15 minutes

2. **Error Rate**:
   - Alert if error rate > 10%
   - Alert if 429 rate limit errors > 20%

3. **Memory Usage**:
   - Alert if memory > 400MB
   - Auto-restart at 500MB (configured in ecosystem.config.js)

**PM2 Monitoring** (built-in):
```bash
pm2 monit  # Real-time monitoring
```

**Status**: ⬜ Not Started

---

### Step 9: Staging Deployment (Recommended)

**Repeat Steps 1-8 for staging environment**:

```bash
# On staging server
cd /opt/karmyq/services/simulation-service

# Create 10 staging users
node create-simulated-users.js --env staging --count 10

# Start with staging config
pm2 start ecosystem.config.js --env staging
```

**Verify staging before promoting to production**:
- Run for 24 hours
- Monitor error rates
- Check database load
- Verify business hours compliance

**Status**: ⬜ Not Started

---

## Post-Deployment Verification

### Day 1: Initial Monitoring

- [ ] Service stayed online for 24 hours
- [ ] No unhandled exceptions
- [ ] Rate limiting working correctly
- [ ] Business hours respected
- [ ] Database activity visible
- [ ] Memory usage < 400MB

### Week 1: Stability Check

- [ ] Service uptime > 99%
- [ ] Error rate < 5%
- [ ] Sessions distributed correctly (5-15 concurrent)
- [ ] Profile distribution matches config
- [ ] No performance degradation

### Month 1: Production Validation

- [ ] Service running continuously
- [ ] Platform feels "alive" with activity
- [ ] No negative impact on real users
- [ ] Metrics collected and analyzed
- [ ] Adjustments documented

---

## Rollback Plan

**If issues occur, follow these steps**:

### Stop Service Immediately
```bash
pm2 stop karmyq-simulation
pm2 delete karmyq-simulation
```

### Investigate Logs
```bash
pm2 logs karmyq-simulation --err --lines 500 > error-log.txt
```

### Remove Simulated Users (if causing issues)
```sql
-- Disable login for simulated users
UPDATE auth.users
SET password_hash = 'DISABLED'
WHERE email LIKE '%sim-prod.karmyq.com';
```

### Report Issue
- Document the issue in GitHub Issues
- Include error logs
- Note timestamp and conditions
- Describe impact on platform

---

## Troubleshooting Guide

### Service Won't Start

**Check**:
```bash
# Node.js version
node --version  # Must be 18+

# Dependencies installed
ls node_modules/

# Build successful
ls dist/

# Environment file exists
cat .env
```

**Common fixes**:
- Run `npm install`
- Run `npm run build`
- Check `.env` configuration
- Verify API URL is correct

---

### High Error Rate

**Check logs**:
```bash
pm2 logs karmyq-simulation --err --lines 200
```

**Common causes**:
1. **401 Unauthorized**: Simulated users not created or wrong passwords
2. **429 Rate Limit**: Increase `MIN_DELAY_MS` from 2000 to 3000+
3. **500 Server Error**: API endpoints down or database issues
4. **Network timeout**: API_BASE_URL incorrect or network issues

**Fix**:
```bash
# Restart with updated config
pm2 restart karmyq-simulation --update-env
```

---

### No Activity During Business Hours

**Check time and timezone**:
```bash
# Server timezone
date
timedatectl

# Pacific time now
node -e "console.log(new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}))"
```

**Verify configuration**:
```bash
grep BUSINESS_HOURS .env
```

**Expected**:
- Service only active 9am-9pm Pacific
- Paused outside business hours

---

### Memory Leaks

**Monitor memory**:
```bash
pm2 monit
```

**If memory growing**:
1. Check logs for errors
2. Restart service: `pm2 restart karmyq-simulation`
3. Monitor for 24 hours
4. If continues, report issue

**PM2 auto-restarts at 500MB** (configured in ecosystem.config.js)

---

## Security Checklist

- [ ] Simulated user credentials stored securely
- [ ] `.env.production.users` file has 600 permissions
- [ ] Credentials NOT committed to git (check `.gitignore`)
- [ ] Simulated users clearly marked (email domain)
- [ ] Simulated users NOT given admin privileges
- [ ] Rate limiting enabled to prevent DoS
- [ ] Logs sanitized (no passwords logged)
- [ ] Access to production server restricted

---

## Contact Information

**If issues arise**:
1. Check logs first: `pm2 logs karmyq-simulation`
2. Review troubleshooting guide above
3. Create GitHub issue with error logs
4. Contact DevOps team if service impacts platform

**Emergency Stop**:
```bash
pm2 stop karmyq-simulation
```

---

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [TESTING.md](TESTING.md) - Testing documentation
- [README.md](README.md) - Service overview
- [../../docs/adr/ADR-006.md](../../docs/adr/ADR-006.md) - Architecture decision
- [CONTEXT.md](../../docs/services/simulation-service/CONTEXT.md) - Complete service context

---

**Deployment Status**: ⬜ Not Started
**Last Updated**: 2026-01-09
**Next Review**: After Step 7 completion
