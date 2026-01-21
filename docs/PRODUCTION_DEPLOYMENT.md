# Production Deployment Guide

## Current Status (2026-01-20)

- **Disk Usage**: 87% full (only 13% remaining)
- **Simulation Service**: Not running (needs fixes deployed)
- **Issues to Address**:
  1. Storage cleanup needed
  2. Log rotation not configured
  3. Simulation service configuration fixes

---

## Step 1: Storage Cleanup (URGENT)

### 1.1 Check Current Usage

```bash
cd ~/karmyq
./scripts/check-storage.sh
```

This will show:
- Overall disk usage
- Docker container log sizes
- PM2 log sizes
- Docker images and volumes

### 1.2 Clean Docker Logs (Immediate Relief)

```bash
./scripts/clean-docker-logs.sh
```

This will:
- Show current log sizes
- Truncate all Docker container logs
- Free up disk space immediately
- **Safe**: Containers keep running

Expected savings: 500MB-2GB depending on how long logs have accumulated.

### 1.3 Setup Permanent Log Rotation

```bash
./scripts/setup-log-rotation.sh
```

This will:
- Configure Docker to auto-rotate logs (10MB max, 3 files = 30MB per container)
- Restart Docker daemon
- Restart containers with new settings
- Prevent future disk exhaustion

### 1.4 Clean PM2 Logs

```bash
pm2 flush  # Clear all PM2 logs
pm2 install pm2-logrotate  # Install log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
pm2 set pm2-logrotate:compress true
```

### 1.5 Remove Old Docker Artifacts (Optional)

```bash
# Remove unused images older than 24h
docker image prune -a --filter 'until=24h'

# Remove unused volumes
docker volume prune -f

# Remove build cache
docker builder prune -a -f
```

---

## Step 2: Deploy Simulation Service Fixes

### 2.1 Pull Latest Code

```bash
cd ~/karmyq
git pull origin master
```

This includes:
- Fixed configuration loading (reads all PM2 env vars)
- BUSINESS_HOURS_ENABLED flag for 24/7 operation
- export-all-users.js script to use existing DB users

### 2.2 Rebuild Simulation Service

```bash
cd ~/karmyq/services/simulation-service
npm install
npm run build
```

### 2.3 Export Existing Users for Simulation

This makes simulation use ALL real users from the database (not just predefined ones):

```bash
cd ~/karmyq/services/simulation-service
node export-all-users.js --env production --password demo123!Demo
```

This creates `.env.production.users` file with credentials for all active users.

### 2.4 Start Simulation Service

```bash
pm2 stop karmyq-simulation  # Stop if running
pm2 delete karmyq-simulation  # Remove old instance
pm2 start ecosystem.config.js --env production
pm2 save  # Save PM2 process list
```

### 2.5 Verify Simulation is Running

```bash
pm2 logs karmyq-simulation --lines 50
```

Expected output:
```
🚀 Starting synthetic user simulation...
Environment: production
Total simulated users: 20
Concurrent sessions: 2-5
✅ Loaded 50 user credentials from .env.production.users
[user@example.com] Starting session (active-helper)
[user@example.com] Performing action: browse
```

### 2.6 Monitor for Issues

```bash
pm2 monit  # Real-time monitoring
```

Check that:
- No rapid restarts (was 1065 before)
- CPU usage reasonable (10-30%)
- Memory stable (< 200MB)

---

## Step 3: Deploy Application Updates (If Needed)

Only if there are other application changes:

```bash
cd ~/karmyq
./scripts/deploy.sh
```

This automatically:
1. Pulls latest code
2. Loads `.env.production`
3. Builds all Docker images
4. Deploys via docker-compose
5. Verifies services

---

## Expected Results

### Storage
- **Before**: 87% used (13% free)
- **After cleanup**: 70-75% used (25-30% free)
- **After log rotation**: Stable at 70-75% (logs won't grow indefinitely)

### Simulation Service
- **Before**: 1065 restarts, hammering login endpoint
- **After**: Stable, 2-5 concurrent sessions, 5s delays
- **Users**: All existing DB users + simulation users (real activity)

### Monitoring

```bash
# Check disk usage
df -h /

# Check Docker logs size
du -sh /var/lib/docker/containers/*/\*-json.log

# Check PM2 status
pm2 list
pm2 logs karmyq-simulation

# Check container status
docker ps
docker stats
```

---

## Troubleshooting

### Disk Still Full After Cleanup

1. Check PostgreSQL logs:
   ```bash
   docker logs karmyq-postgres | wc -l
   docker exec karmyq-postgres du -sh /var/lib/postgresql/data
   ```

2. Check for large files:
   ```bash
   sudo find / -xdev -type f -size +100M -exec du -h {} \; 2>/dev/null
   ```

### Simulation Service Keeps Restarting

1. Check logs:
   ```bash
   pm2 logs karmyq-simulation --err --lines 100
   ```

2. Check if users file exists:
   ```bash
   ls -lh ~/karmyq/services/simulation-service/.env.production.users
   ```

3. Test login manually:
   ```bash
   curl -X POST https://karmyq.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"demo123!Demo"}'
   ```

### Docker Won't Restart After Log Rotation

1. Check Docker daemon status:
   ```bash
   sudo journalctl -u docker -n 50
   ```

2. Validate daemon.json:
   ```bash
   sudo cat /etc/docker/daemon.json | jq .
   ```

3. If invalid JSON, restore backup:
   ```bash
   sudo cp /etc/docker/daemon.json.backup /etc/docker/daemon.json
   sudo systemctl restart docker
   ```

---

## Maintenance Schedule

### Daily (Automated)
- Docker logs auto-rotate (10MB max per container)
- PM2 logs auto-rotate (10MB max, 3 files)

### Weekly
- Check disk usage: `./scripts/check-storage.sh`
- Review simulation logs: `pm2 logs karmyq-simulation`

### Monthly
- Clean old Docker images: `docker image prune -a`
- Clean old volumes: `docker volume prune -f`
- Review PM2 logs: `pm2 flush`

---

## Emergency Contacts

If deployment fails:
1. Rollback code: `git checkout HEAD~1 && ./scripts/deploy.sh`
2. Stop simulation: `pm2 stop karmyq-simulation`
3. Check logs: `docker compose logs -f` and `pm2 logs`

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project overview and deployment
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [ADR-006](adr/006-synthetic-user-simulation.md) - Simulation design
