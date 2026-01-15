# Fix Nginx 502 Bad Gateway Error

## Problem
The frontend loads but API calls fail with "502 Bad Gateway" because nginx doesn't know how to proxy `/api/*` requests to the backend services.

## Solution
Update nginx configuration to proxy API routes to the backend services running on localhost:3001-3010.

## Step-by-Step Fix

### 1. Check Current Nginx Configuration

On the server (ubuntu@karmyq-vnic), run:

```bash
# View current nginx config
sudo cat /etc/nginx/sites-available/karmyq.com
# or if using default
sudo cat /etc/nginx/sites-available/default

# Check which config is active
ls -la /etc/nginx/sites-enabled/
```

### 2. Backup Current Configuration

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/karmyq.com /etc/nginx/sites-available/karmyq.com.backup.$(date +%Y%m%d)
# or for default
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d)
```

### 3. Pull Latest Changes on Server

On the server (ubuntu@karmyq-vnic):

```bash
# Navigate to your karmyq directory
cd ~/karmyq  # or wherever your repo is located

# Pull latest changes
git pull origin master

# Make scripts executable
chmod +x scripts/*.sh
chmod +x infrastructure/nginx/*.sh 2>/dev/null || true
```

### 3a. Alternative: Upload Configuration Directly

If you prefer to upload without pulling the full repo:

```bash
# From your local machine
scp infrastructure/nginx/karmyq.com.conf ubuntu@132.226.89.171:/tmp/karmyq.com.conf
```

### 4. Install New Configuration

On the server:

```bash
# If you pulled from git, copy from repo
sudo cp ~/karmyq/infrastructure/nginx/karmyq.com.conf /etc/nginx/sites-available/karmyq.com

# Or if you uploaded to /tmp
# sudo mv /tmp/karmyq.com.conf /etc/nginx/sites-available/karmyq.com

# If the site isn't enabled yet, create symlink
sudo ln -sf /etc/nginx/sites-available/karmyq.com /etc/nginx/sites-enabled/karmyq.com

# Remove default if it exists and conflicts
sudo rm /etc/nginx/sites-enabled/default
```

### 5. Test Configuration

```bash
# Test nginx configuration for syntax errors
sudo nginx -t
```

Expected output:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Reload Nginx

```bash
# Reload nginx to apply new configuration
sudo systemctl reload nginx

# Or restart if reload doesn't work
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

### 7. Verify Fix

**From your browser:**
- Go to https://karmyq.com
- Try to register or login
- Check browser console (F12) - should no longer see 502 errors

**From the server:**
```bash
# Test auth endpoint
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User"}'

# Should return a response (not 502)
```

**From external:**
```bash
# Test via nginx proxy
curl https://karmyq.com/api/auth/health
# Should return {"status":"ok",...}
```

### 8. Check Logs if Issues Persist

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/karmyq-error.log

# Check service logs
docker logs karmyq-auth-service --tail=50
docker logs karmyq-frontend --tail=50
```

## What the Configuration Does

The new nginx config:

1. **Defines upstreams** for all backend services (ports 3000-3010)
2. **Proxies API routes** to the correct service:
   - `/api/auth/*` → auth-service (3001)
   - `/api/communities/*` → community-service (3002)
   - `/api/requests/*` → request-service (3003)
   - `/api/reputation/*` → reputation-service (3004)
   - `/api/notifications/*` → notification-service (3005)
   - `/api/messaging/*` → messaging-service (3006)
   - `/api/feed/*` → feed-service (3007)
   - `/api/geocoding/*` → geocoding-service (3009)
   - `/api/social/*` → social-graph-service (3010)
3. **Proxies all other routes** to the frontend (3000)
4. **Enables SSL** with Let's Encrypt certificates
5. **Redirects HTTP to HTTPS**
6. **Sets proper headers** for proxying (X-Real-IP, X-Forwarded-For, etc.)
7. **Configures SSE** for notification service (long-lived connections)

## Troubleshooting

### Issue: "502 Bad Gateway" still occurs

**Check if services are running:**
```bash
docker ps | grep karmyq-auth-service
docker logs karmyq-auth-service --tail=20
```

**Test direct connection:**
```bash
curl http://localhost:3001/health
```

If this fails, the service isn't responding. Check service logs.

### Issue: "Connection refused"

The service container might not be listening on the expected port.

**Check container ports:**
```bash
docker ps | grep karmyq-auth-service
# Should show: 127.0.0.1:3001->3001/tcp
```

**Check from inside container:**
```bash
docker exec karmyq-auth-service wget -qO- http://localhost:3001/health
```

### Issue: SSL certificate errors

If you see SSL errors, check certificates:
```bash
sudo certbot certificates
```

If certificates are missing or expired:
```bash
sudo certbot --nginx -d karmyq.com -d www.karmyq.com
```

### Issue: nginx won't reload

**Check for syntax errors:**
```bash
sudo nginx -t
```

**View detailed error:**
```bash
sudo journalctl -u nginx -n 50
```

## Alternative: Quick Fix via sed (if you understand the current config)

If you just need to add API proxying to an existing config:

```bash
# This is ADVANCED - only if you know what you're doing
# Backup first!
sudo cp /etc/nginx/sites-available/karmyq.com /etc/nginx/sites-available/karmyq.com.backup

# Add upstream blocks and location blocks
# (Manual editing recommended - use nano or vim)
sudo nano /etc/nginx/sites-available/karmyq.com
```

## Expected Result

After applying this fix:
- ✅ Homepage loads normally
- ✅ User registration works
- ✅ User login works
- ✅ API calls succeed (no 502 errors)
- ✅ Browser console shows successful API responses
- ✅ All backend services accessible via nginx proxy

## Next Steps

Once nginx is working:
1. Test full user flow (register → login → create community → create request)
2. Fix Loki restart loop (separate issue)
3. Set up monitoring alerts
4. Configure database backups
5. Set up CI/CD pipeline
