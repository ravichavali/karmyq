# Deployment Guide

**Version**: 8.0
**Last Updated**: 2026-01-03
**Maintainer**: Operations Team

## Overview

This guide covers deployment procedures for karmyq.com production environment.

## Architecture Overview

- **Host**: karmyq.com (Ubuntu 22.04 LTS)
- **Reverse Proxy**: Nginx (host-level, port 443)
- **Container Runtime**: Docker + Docker Compose
- **Services**: 10 microservices + frontend
- **Database**: PostgreSQL 15 (containerized)
- **Cache/Queue**: Redis (containerized)
- **Observability**: Grafana + Loki + Prometheus

## Pre-Deployment Checklist

- [ ] Changes committed to git
- [ ] Tests passing locally (if applicable)
- [ ] Database migrations prepared (if applicable)
- [ ] Backup recent data
- [ ] Check service health on production

## Deployment Procedures

### 1. Frontend Deployment

```bash
# SSH to production server
ssh ubuntu@karmyq.com

# Navigate to project
cd ~/karmyq

# Pull latest code
git pull origin master

# Rebuild and restart frontend
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate frontend

# Verify
docker logs karmyq-frontend --tail 50
curl -I https://karmyq.com
```

**When to use**: Frontend code changes, environment variable updates

**Downtime**: ~30 seconds (frontend only)

### 2. Backend Service Deployment

```bash
# Example: Deploying request-service
ssh ubuntu@karmyq.com
cd ~/karmyq
git pull origin master

cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate request-service

# Verify
docker logs karmyq-request-service --tail 50
curl -I https://karmyq.com/api/requests
```

**When to use**: Service code changes, dependency updates

**Downtime**: ~10-20 seconds per service (rolling restart possible)

### 3. Nginx Configuration Deployment

```bash
# On local machine - update nginx.conf
vim infrastructure/nginx/nginx.conf

# Commit changes
git add infrastructure/nginx/nginx.conf
git commit -m "fix(nginx): update routing configuration"
git push origin master

# On production server
ssh ubuntu@karmyq.com
cd ~/karmyq
git pull origin master

# Copy to nginx directory and reload
sudo cp infrastructure/nginx/nginx.conf /etc/nginx/sites-available/karmyq
sudo nginx -t
sudo systemctl reload nginx
```

**When to use**: API routing changes, SSL updates, proxy settings

**Downtime**: None (nginx reload is graceful)

### 4. Database Migration

```bash
# On production server
ssh ubuntu@karmyq.com

# Backup database first
docker exec karmyq-postgres pg_dump -U karmyq_prod -d karmyq_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration (example)
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod < migration.sql

# Or connect interactively
docker exec -it karmyq-postgres psql -U karmyq_prod -d karmyq_prod
```

**When to use**: Schema changes, data migrations

**Downtime**: Varies (test migrations first!)

### 5. Full Stack Deployment

```bash
# Only when necessary (updates all services)
ssh ubuntu@karmyq.com
cd ~/karmyq
git pull origin master

cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate

# Verify all services
docker ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail 50
```

**When to use**: Major version updates, infrastructure changes

**Downtime**: 2-5 minutes (all services restart)

## Environment Variables

Production environment variables are managed in `.env` file on the server:

```bash
# Location: ~/karmyq/.env
# NEVER commit this file to git!

# To update environment variables:
ssh ubuntu@karmyq.com
vim ~/karmyq/.env

# Then restart affected services with --force-recreate flag
cd ~/karmyq/infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate <service-name>
```

**Important**: Docker Compose caches environment variables. Always use `--force-recreate` when env vars change.

## Post-Deployment Verification

1. **Check service health**:
   ```bash
   docker ps  # All containers should be "Up"
   docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
   ```

2. **Check logs for errors**:
   ```bash
   docker logs karmyq-frontend --tail 100
   docker logs karmyq-request-service --tail 100
   # etc for other services
   ```

3. **Test API endpoints**:
   ```bash
   curl -I https://karmyq.com
   curl -I https://karmyq.com/api/requests
   curl -I https://karmyq.com/api/communities
   ```

4. **Check Grafana dashboards**:
   ```bash
   # SSH tunnel to access Grafana
   ssh -L 3011:localhost:3011 ubuntu@karmyq.com
   # Open http://localhost:3011
   ```

## Rollback Procedure

If deployment fails:

1. **Quick rollback** (revert to previous container):
   ```bash
   # Find previous image
   docker images | grep karmyq-frontend

   # Tag and restart with previous version
   docker tag <previous-image-id> karmyq-frontend:latest
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
   ```

2. **Git rollback** (if code issues):
   ```bash
   git log --oneline  # Find good commit
   git reset --hard <commit-hash>
   # Then redeploy
   ```

3. **Database rollback** (restore backup):
   ```bash
   docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod < backup_YYYYMMDD_HHMMSS.sql
   ```

## Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

### Issue: Container won't start after environment variable change

**Solution**: Use `--force-recreate` flag:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate <service>
```

### Issue: Nginx returns 404 for API routes

**Solution**: Check nginx routing configuration and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Issue: Frontend shows old version after deployment

**Solution**: Browser cache. Hard refresh (Ctrl+Shift+R) or clear cache.

## Monitoring & Alerts

- **Grafana**: http://localhost:3011 (via SSH tunnel)
- **Loki Logs**: LogQL queries in Grafana
- **Container Health**: `docker ps` shows status

## Emergency Contacts

- **Primary**: [Your contact]
- **Database**: [DBA contact]
- **Infrastructure**: [DevOps contact]

## Related Documentation

- [Nginx Configuration](./NGINX_CONFIGURATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Observability Setup](./GRAFANA_ACCESS.md)
- [SSL Certificates](./SSL_CERTIFICATES.md)
