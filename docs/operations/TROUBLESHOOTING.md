# Production Troubleshooting Guide

## Common Issues

### 1. Nginx 502 Bad Gateway
**Symptoms**: Website returns 502 error.
**Cause**: One or more backend services are down or not reachable on `127.0.0.1:PORT`.
**Diagnosis**:
```bash
# Check container status
docker ps

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```
**Fix**:
If a service is down:
```bash
docker compose restart [service-name]
```

### 2. "Connection limit exceeded" (PostgreSQL)
**Symptoms**: Services crashing, logs show "too many clients".
**Cause**: Connection pool size too high or too many instances.
**Fix**:
1. Check active connections:
   ```bash
   docker exec karmyq-postgres psql -U karmyq_user karmyq_db -c "SELECT count(*) FROM pg_stat_activity;"
   ```
2. Reduce replicas (if scaled up).
3. Ensure `db.ts` max connections is set to 5.

### 3. WebSocket Disconnection (Messaging)
**Symptoms**: Chat messages not delivered, "Transport error".
**Cause**: Sticky sessions not working or Redis Pub/Sub failure.
**Fix**:
1. Verify Nginx `ip_hash` is enabled for messaging upstream.
2. Check Redis connectivity:
   ```bash
   docker exec karmyq-messaging-service ping redis
   ```

### 4. SSL Certificate Expiry
**Symptoms**: Browser warning "Your connection is not private".
**Cause**: Certbot auto-renewal failed.
**Fix**:
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### 5. Deployment Fails (Git Pull Conflict)
**Symptoms**: `deploy.sh` fails with git errors.
**Cause**: Local changes on the server.
**Fix**:
```bash
cd ~/karmyq
git reset --hard origin/feature/docker-compose-production
./infrastructure/scripts/deploy.sh production
```
