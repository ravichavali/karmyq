# Simulation Service Deployment Guide

**Last Updated**: 2026-01-08
**Status**: Phase 1 Complete - Ready for Production Deployment

---

## Overview

The Synthetic User Simulation Service simulates realistic user behavior on the Karmyq platform to maintain an active, engaging demo environment.

**Key Features**:
- 5 user behavior profiles (Active Helper, Requester, Browser, Community Builder, Social User)
- 5 core workflows (Browse, Create Request, Offer Help, Send Messages, Complete Matches)
- Business hours scheduling (9am-9pm Pacific)
- Rate limiting with exponential backoff
- Session management with realistic activity patterns

**Reference**: [docs/adr/ADR-006.md](../../docs/adr/ADR-006.md)

---

## Prerequisites

### Production Environment Requirements
- Node.js 18+
- Access to Karmyq production API
- Simulated user accounts (dedicated test/demo users)
- Process manager (PM2 or systemd)

### Environment Variables

Create `.env.production`:

```bash
# API Configuration
API_BASE_URL=https://karmyq.com/api

# Simulation Control
SIMULATION_ENABLED=true
ENVIRONMENT=production

# Session Configuration
MIN_CONCURRENT_SESSIONS=5
MAX_CONCURRENT_SESSIONS=15

# Rate Limiting
RESPECT_RATE_LIMITS=true
MIN_DELAY_MS=2000
MAX_RETRIES=3

# Business Hours (Pacific Time)
BUSINESS_HOURS_ENABLED=true
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=21:00
BUSINESS_HOURS_TIMEZONE=America/Los_Angeles

# Logging
LOG_LEVEL=info
```

---

## Deployment Steps

### Option A: Deploy to Production Server

1. **SSH to production server**:
   ```bash
   ssh user@production-server
   ```

2. **Clone or update repository**:
   ```bash
   cd /opt/karmyq
   git pull origin master
   ```

3. **Install dependencies**:
   ```bash
   cd services/simulation-service
   npm install
   npm run build
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production settings
   nano .env.production
   ```

5. **Start with PM2** (recommended):
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup  # Run once to enable auto-start on boot
   ```

6. **Verify running**:
   ```bash
   pm2 logs simulation-service
   pm2 status
   ```

### Option B: Docker Deployment

1. **Build Docker image**:
   ```bash
   cd services/simulation-service
   docker build -t karmyq-simulation-service .
   ```

2. **Run container**:
   ```bash
   docker run -d \
     --name karmyq-simulation \
     --env-file .env.production \
     --restart unless-stopped \
     karmyq-simulation-service
   ```

3. **Check logs**:
   ```bash
   docker logs -f karmyq-simulation
   ```

---

## PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'simulation-service',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      API_BASE_URL: 'https://karmyq.com/api',
      SIMULATION_ENABLED: 'true',
      ENVIRONMENT: 'production',
      MIN_CONCURRENT_SESSIONS: '5',
      MAX_CONCURRENT_SESSIONS: '15',
      BUSINESS_HOURS_ENABLED: 'true'
    },
    env_staging: {
      NODE_ENV: 'staging',
      API_BASE_URL: 'https://staging.karmyq.com/api',
      SIMULATION_ENABLED: 'true',
      ENVIRONMENT: 'staging',
      MIN_CONCURRENT_SESSIONS: '2',
      MAX_CONCURRENT_SESSIONS: '5'
    },
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    exp_backoff_restart_delay: 100
  }]
};
```

---

## Systemd Service (Alternative to PM2)

Create `/etc/systemd/system/karmyq-simulation.service`:

```ini
[Unit]
Description=Karmyq Synthetic User Simulation Service
After=network.target

[Service]
Type=simple
User=karmyq
WorkingDirectory=/opt/karmyq/services/simulation-service
EnvironmentFile=/opt/karmyq/services/simulation-service/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=karmyq-simulation

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
sudo systemctl daemon-reload
sudo systemctl enable karmyq-simulation
sudo systemctl start karmyq-simulation
sudo systemctl status karmyq-simulation
sudo journalctl -u karmyq-simulation -f
```

---

## Create Simulated Users

The simulation service needs dedicated user accounts. Create them via admin panel or API:

```bash
# Example: Create 20 simulated users
for i in {1..20}; do
  curl -X POST https://karmyq.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"sim-user-$i@karmyq.com\",
      \"password\": \"SimPassword123!\",
      \"name\": \"Simulated User $i\",
      \"bio\": \"Demo user for platform testing\"
    }"
done
```

**Important**: Store credentials securely (environment variables or secrets manager).

---

## Monitoring

### Check Service Health

```bash
# PM2
pm2 status simulation-service
pm2 logs simulation-service --lines 100

# Systemd
sudo systemctl status karmyq-simulation
sudo journalctl -u karmyq-simulation -n 100 -f

# Docker
docker ps | grep simulation
docker logs karmyq-simulation --tail 100 -f
```

### Key Metrics to Monitor

1. **Active Sessions**: Should be between MIN and MAX_CONCURRENT_SESSIONS
2. **Actions Per Minute**: Should see steady activity during business hours
3. **Error Rate**: Should be <1% (mostly 429 rate limit errors are expected)
4. **Memory Usage**: Should stay under 500MB
5. **API Response Times**: Should be <2 seconds average

### Grafana Dashboard Queries

```promql
# Active simulation sessions
karmyq_simulation_active_sessions

# Actions per minute
rate(karmyq_simulation_actions_total[1m])

# Error rate
rate(karmyq_simulation_errors_total[5m])

# API call latency
histogram_quantile(0.95, rate(karmyq_simulation_api_duration_seconds_bucket[5m]))
```

---

## Troubleshooting

### Service Won't Start

**Check logs**:
```bash
pm2 logs simulation-service --err
```

**Common issues**:
- Missing environment variables → Check `.env.production`
- API unreachable → Test with `curl https://karmyq.com/api/health`
- Invalid credentials → Verify simulated user accounts exist

### High Error Rate

**Check API endpoints**:
```bash
curl -X POST https://karmyq.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sim-user-1@karmyq.com","password":"SimPassword123!"}'
```

**Common causes**:
- API routing issues → Check nginx configuration
- Rate limiting too aggressive → Increase MIN_DELAY_MS
- Users not community members → Join communities manually first

### No Activity During Business Hours

**Verify configuration**:
```bash
echo $BUSINESS_HOURS_ENABLED  # Should be "true"
echo $BUSINESS_HOURS_START    # Should be "09:00"
echo $BUSINESS_HOURS_END      # Should be "21:00"
```

**Check timezone**:
```bash
node -e "console.log(new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}))"
```

### Memory Leaks

**Monitor memory**:
```bash
pm2 monit
```

**Restart if needed**:
```bash
pm2 restart simulation-service
```

---

## Scaling

### Increase Activity

Edit `.env.production`:
```bash
MIN_CONCURRENT_SESSIONS=10   # Was 5
MAX_CONCURRENT_SESSIONS=30   # Was 15
```

Restart:
```bash
pm2 restart simulation-service --update-env
```

### Multiple Instances (Advanced)

Run multiple simulation service instances with different configs:

```bash
pm2 start ecosystem.config.js --name simulation-service-1
pm2 start ecosystem.config.js --name simulation-service-2
```

---

## Stopping/Pausing Simulation

### Temporary Pause
```bash
# PM2
pm2 stop simulation-service

# Systemd
sudo systemctl stop karmyq-simulation

# Docker
docker stop karmyq-simulation
```

### Disable Permanently
```bash
# PM2
pm2 delete simulation-service
pm2 save

# Systemd
sudo systemctl disable karmyq-simulation

# Docker
docker rm karmyq-simulation
```

### Graceful Shutdown

The service handles SIGINT/SIGTERM gracefully:
- Completes current actions
- Logs out active sessions
- Saves state before exit

---

## Configuration Profiles

### Staging Environment
- Lower concurrency (2-5 sessions)
- Shorter business hours (10am-5pm)
- More aggressive rate limiting

### Production Environment
- Higher concurrency (5-15 sessions)
- Full business hours (9am-9pm)
- Realistic rate limiting

### Demo/Marketing Environment
- Moderate concurrency (3-8 sessions)
- Extended hours (8am-10pm)
- Varied user profiles

---

## Security Considerations

1. **Use Dedicated Accounts**: Don't use real user accounts for simulation
2. **Strong Passwords**: Use complex passwords for simulated users
3. **Rate Limiting**: Respect platform rate limits to avoid DoS
4. **Monitoring**: Alert on abnormal behavior (too many errors, unusual patterns)
5. **Access Control**: Restrict who can start/stop simulation service

---

## Related Documentation

- [ADR-006: Synthetic User Simulation](../../docs/adr/ADR-006.md) - Architecture decision
- [TESTING.md](TESTING.md) - Testing documentation
- [README.md](README.md) - Service overview
- [docs/operations/DEPLOYMENT_GUIDE.md](../../docs/operations/DEPLOYMENT_GUIDE.md) - General deployment guide

---

**Status**: Ready for Phase 2 deployment to production/staging environment.
