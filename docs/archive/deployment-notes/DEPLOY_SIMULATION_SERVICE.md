# Deploy Simulation Service - Step by Step

## Server Information

- **Production**: `ubuntu@karmyq-vnic` - Code at `/home/ubuntu/karmyq`
- **Staging**: Code at `/home/karmyq/karmyq`

---

## Production Deployment (ubuntu@karmyq-vnic)

You're currently on this server. Follow these steps:

### Step 1: Install PM2

```bash
sudo npm install -g pm2
```

Verify:
```bash
pm2 --version
```

### Step 2: Navigate to Simulation Service

```bash
cd /home/ubuntu/karmyq/services/simulation-service
```

Verify files are there:
```bash
ls -la
```

You should see:
- `package.json`
- `src/`
- `ecosystem.config.js`
- `create-simulated-users.js`
- `.env.production`

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Build TypeScript

```bash
npm run build
```

Verify build:
```bash
ls -la dist/
```

### Step 5: Configure Environment

```bash
# Copy production template
cp .env.production .env

# Edit configuration
nano .env
```

**Important**: Set the correct `API_BASE_URL`. First, check where your API is:

```bash
# Check if services are in Docker
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep karmyq

# Test API connectivity
curl http://localhost:3001/health
```

In the `.env` file, set:
- If services are on localhost: `API_BASE_URL=http://localhost:3000/api`
- If behind nginx: `API_BASE_URL=http://localhost/api`
- If on domain: `API_BASE_URL=https://karmyq.com/api`

Save and exit (Ctrl+X, Y, Enter)

### Step 6: Determine API URL

Before creating users, test which API URL works:

```bash
# Test localhost
curl http://localhost:3000/api/health

# Test nginx
curl http://localhost/api/health

# Test domain
curl https://karmyq.com/api/health
```

Use whichever one returns a successful response.

### Step 7: Create Simulated Users

```bash
# First, dry run to preview
node create-simulated-users.js --env production --count 20 --dry-run

# If that looks good, create users
node create-simulated-users.js --env production --count 20
```

Expected output:
```
✓ Created: 20
✓ Credentials saved to: .env.production.users
```

**If it fails**, check:
- Is API_BASE_URL correct in .env?
- Are services running? (`docker ps`)
- Can you manually register? (`curl -X POST http://localhost:3000/api/auth/register ...`)

### Step 8: Start Service with PM2

```bash
# Start service
pm2 start ecosystem.config.js --env production

# Save configuration
pm2 save

# Enable auto-start on boot
pm2 startup
# Copy and run the sudo command it shows
```

### Step 9: Verify Running

```bash
# Check status
pm2 status

# View logs
pm2 logs karmyq-simulation --lines 50
```

**What you should see**:
```
🤖 Simulation Service Starting...
✓ Configuration loaded
✓ Session manager initialized
✓ Business hours: 09:00-21:00 Pacific
✓ Total users: 20
✓ Concurrent sessions: 5-15
```

**If outside business hours (9am-9pm Pacific)**:
```
⏸️ Outside business hours, pausing simulation
```

To check current Pacific time:
```bash
TZ=America/Los_Angeles date
```

### Step 10: Monitor Activity

During business hours (9am-9pm Pacific), watch for activity:

```bash
# Real-time logs
pm2 logs karmyq-simulation

# Should see sessions starting:
# [Session] Started session for sim-user-1@sim-prod.karmyq.com
# [Action] Browse requests (user: sim-user-1)
# [Action] Create request (user: sim-user-2)
```

---

## Staging Deployment

For staging server at `/home/karmyq/karmyq`:

```bash
# SSH to staging
ssh karmyq@staging-server  # or whatever your staging hostname is

# Navigate to simulation service
cd /home/karmyq/karmyq/services/simulation-service

# Install PM2 (if not already installed)
sudo npm install -g pm2

# Install dependencies
npm install

# Build
npm run build

# Configure
cp .env.production .env.staging
nano .env.staging
# Set API_BASE_URL to staging API (likely http://localhost:3000/api)
# Reduce to 10 users for staging
cp .env.staging .env

# Create staging users
node create-simulated-users.js --env staging --count 10

# Start with staging config
pm2 start ecosystem.config.js --env staging
pm2 save
pm2 startup
```

---

## Quick Reference

### Check Service Status
```bash
pm2 status
pm2 logs karmyq-simulation
pm2 monit
```

### Restart After Config Changes
```bash
nano .env
pm2 restart karmyq-simulation --update-env
```

### Stop Service
```bash
pm2 stop karmyq-simulation
```

### Delete Service
```bash
pm2 delete karmyq-simulation
```

---

## Troubleshooting

### "Command 'pm2' not found" after install
```bash
# Add npm global bin to PATH
export PATH=$PATH:$(npm get prefix)/bin

# Verify
pm2 --version

# Make permanent
echo 'export PATH=$PATH:'$(npm get prefix)'/bin' >> ~/.bashrc
```

### "Cannot find module" errors
```bash
cd /home/ubuntu/karmyq/services/simulation-service
npm install
npm run build
```

### "ECONNREFUSED" errors
```bash
# Check if services are running
docker ps | grep karmyq

# Test API manually
curl http://localhost:3001/health
curl http://localhost:3000/api/health

# Update API_BASE_URL in .env
nano .env
pm2 restart karmyq-simulation --update-env
```

### "401 Unauthorized" errors
```bash
# Users weren't created properly
# Try creating them again
cd /home/ubuntu/karmyq/services/simulation-service
node create-simulated-users.js --env production --count 20
```

### Service not active during business hours
```bash
# Check current Pacific time
TZ=America/Los_Angeles date

# Check business hours config
grep BUSINESS_HOURS .env

# Service runs 9am-9pm Pacific only
```

---

## Next Steps After Deployment

1. **Let it run for 30 minutes** during business hours
2. **Check logs** for any errors:
   ```bash
   pm2 logs karmyq-simulation --err --lines 100
   ```
3. **Verify database activity** (optional):
   ```bash
   docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db -c "
   SELECT COUNT(*) FROM requests.help_requests
   WHERE created_at > NOW() - INTERVAL '1 hour'
   AND requester_id IN (
     SELECT id FROM auth.users WHERE email LIKE '%sim-prod.karmyq.com'
   );"
   ```

---

## Current Step

**You are here**: Need to run Step 1 (Install PM2) on production server

Run this command on the server:
```bash
sudo npm install -g pm2
```

Then let me know when it's done and we'll continue to the next step!
