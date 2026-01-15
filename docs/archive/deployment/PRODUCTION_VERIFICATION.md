# Production Deployment Verification

**Instance**: 132.226.89.171 (OCI)
**Date**: 2026-01-01
**Domain**: https://karmyq.com

## Prerequisites

After pulling latest changes from git, make scripts executable:

```bash
cd ~/karmyq
chmod +x scripts/*.sh
```

## Quick Health Check Commands

```bash
# 1. Check all Docker containers
docker ps -a

# 2. Check Docker Compose services
docker-compose ps

# 3. Check service logs (last 50 lines)
docker-compose logs --tail=50

# 4. Check specific service health
docker logs karmyq-auth-service --tail=20
docker logs karmyq-community-service --tail=20
docker logs karmyq-request-service --tail=20

# 5. Verify database connectivity
docker exec karmyq-postgres psql -U karmyq -d karmyq -c "SELECT schema_name FROM information_schema.schemata;"

# 6. Verify Redis connectivity
docker exec karmyq-redis redis-cli ping

# 7. Check network connectivity
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# 8. Check disk space
df -h

# 9. Check memory usage
free -h

# 10. Check running processes
ps aux | grep node
```

## Expected Healthy State

### Docker Containers
All containers should be "Up" status:
- karmyq-postgres
- karmyq-redis
- karmyq-auth-service (port 3001)
- karmyq-community-service (port 3002)
- karmyq-request-service (port 3003)
- karmyq-reputation-service (port 3004)
- karmyq-notification-service (port 3005)
- karmyq-messaging-service (port 3006)
- karmyq-feed-service (port 3007)
- karmyq-cleanup-service (port 3008)
- karmyq-geocoding-service (port 3009)

### Health Endpoints
Each service should return:
```json
{
  "status": "ok",
  "service": "service-name",
  "timestamp": "ISO-8601-datetime"
}
```

### Database Schemas
Should see:
- auth
- community
- requests
- reputation
- notifications
- messaging

## Troubleshooting

### If containers are down
```bash
# Restart all services
docker-compose down
docker-compose up -d

# Check logs for errors
docker-compose logs --tail=100
```

### If database connection fails
```bash
# Check postgres logs
docker logs karmyq-postgres --tail=50

# Verify environment variables
docker exec karmyq-auth-service env | grep DB
```

### If Redis connection fails
```bash
# Check Redis logs
docker logs karmyq-redis --tail=50

# Test connection
docker exec karmyq-redis redis-cli ping
```

## External Access Testing

From your local machine, test public endpoints:

```bash
# Replace <PUBLIC_IP> with 132.226.89.171

# Test auth service
curl http://132.226.89.171:3001/health

# Test community service
curl http://132.226.89.171:3002/health

# Test API (should get 401 without token)
curl http://132.226.89.171:3001/api/users
```

## Security Checklist

- [ ] Firewall rules configured (only necessary ports open)
- [ ] Environment variables secured (not in git)
- [ ] Database passwords are strong and unique
- [ ] JWT secret is secure and rotated
- [ ] SSL/TLS configured (if using domain)
- [ ] Backup strategy in place
- [ ] Log rotation configured
- [ ] Monitoring alerts set up

## Production Configuration

### Environment Variables Required
```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=karmyq
DB_USER=karmyq
DB_PASSWORD=<secure-password>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Auth
JWT_SECRET=<secure-secret>
JWT_EXPIRES_IN=24h

# Service Ports
AUTH_SERVICE_PORT=3001
COMMUNITY_SERVICE_PORT=3002
REQUEST_SERVICE_PORT=3003
# ... etc
```

### Port Exposure
If using reverse proxy (recommended):
- External: 80 (HTTP) / 443 (HTTPS)
- Internal: 3001-3009 (services)

If direct exposure:
- Open ports 3001-3009 in firewall
- Consider rate limiting

## Next Steps

1. **Set up monitoring**: Configure Grafana/Prometheus
2. **Configure backups**: Database and Redis backups
3. **Set up domain**: Point DNS to 132.226.89.171
4. **Configure SSL**: Use Let's Encrypt for HTTPS
5. **Set up CI/CD**: Automated deployments from git
6. **Configure logging**: Centralized log aggregation
7. **Set up alerts**: Service down notifications

## Useful Commands

```bash
# View all logs in real-time
docker-compose logs -f

# Restart a specific service
docker-compose restart auth-service

# Update and redeploy
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Backup database
docker exec karmyq-postgres pg_dump -U karmyq karmyq > backup-$(date +%Y%m%d).sql

# Restore database
cat backup-20260101.sql | docker exec -i karmyq-postgres psql -U karmyq karmyq
```
