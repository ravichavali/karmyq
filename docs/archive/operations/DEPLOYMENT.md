# Karmyq Deployment Guide

## Quick Start

### Development (Localhost)
```bash
cd infrastructure/docker
docker-compose up -d
# Frontend at http://localhost:3000
```

### QA (Ubuntu Server)
```bash
# From dev machine
export QA_SERVER_HOST=192.168.1.100
./scripts/deploy-qa.sh
```

## Environments

### Development
- **Location**: Local machine (Windows)
- **Purpose**: Active development with hot-reload
- **Config**: `docker-compose.yml`
- **Rate Limiting**: Relaxed (300/min)

### QA
- **Location**: Ubuntu server (192.168.x.x)
- **Purpose**: Testing before production
- **Config**: `docker-compose.qa.yml`
- **Rate Limiting**: Production-ready (300/min read, 60/min write)

## QA Server Setup

### Prerequisites on Ubuntu Server
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repository
git clone <repo-url> ~/karmyq-qa
cd ~/karmyq-qa

# Create environment file
cp .env.example .env.qa
nano .env.qa
```

### Environment Variables (.env.qa)
```bash
POSTGRES_PASSWORD=<secure-password>
JWT_SECRET=<secure-jwt-secret>
NODE_ENV=production
```

### Deploy
```bash
docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d --build
```

## CI/CD Pipeline

GitHub Actions automatically:
- ✅ Runs tests on PRs
- ✅ Builds Docker images
- ✅ Deploys to QA on `develop` push
- ✅ Deploys to production on `main` push (manual approval)

### GitHub Secrets Required
```
QA_SERVER_HOST=192.168.x.x
QA_SERVER_USER=karmyq
QA_SSH_PRIVATE_KEY=<private-key>
JWT_SECRET=<secret>
POSTGRES_PASSWORD=<password>
```

## Database Management

### Seed Test Data
```bash
cd scripts
npm install
npm run seed
# Creates 2000 users, 200 communities, 7500+ memberships
```

### Backup
```bash
docker exec karmyq-postgres pg_dump -U karmyq_user karmyq_db > backup.sql
```

### Restore
```bash
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db < backup.sql
```

## Monitoring

### View Logs
```bash
docker-compose logs -f service-name
docker logs karmyq-auth-service --tail 100
```

### Health Checks
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Container Status
```bash
docker-compose ps
docker stats
```

## Scaling

Rate limits are now production-ready:
- **Read operations**: 300 req/min per user
- **Write operations**: 60 req/min per user
- **Auth operations**: 10 req/15min per IP

### Horizontal Scaling
```bash
# Scale community service to 3 instances
docker-compose up -d --scale community-service=3
```

## Troubleshooting

### Services Won't Start
```bash
docker-compose logs
docker-compose build --no-cache
docker-compose down -v && docker-compose up -d
```

### Database Issues
```bash
docker exec karmyq-postgres pg_isready
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "SELECT 1"
```

### Port Conflicts
```bash
lsof -i :3001
# Change ports in docker-compose.yml if needed
```

## Security Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secrets (64+ chars)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall
- [ ] Set up backups
- [ ] Enable logging limits
- [ ] Implement secrets rotation (see below)

## Secrets Management

Karmyq includes enterprise-grade secrets rotation with zero-downtime updates.

### Initial Setup
```bash
# Generate strong secrets
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 32  # POSTGRES_PASSWORD

# Store in .env.qa (never commit!)
```

### Automated Rotation
```bash
# Rotate secrets monthly (recommended)
./scripts/secrets-rotate.sh qa

# Rollback if issues occur
./scripts/secrets-rollback.sh qa
```

### Features
- ✅ Zero-downtime JWT rotation with 24h grace period
- ✅ AES-256-CBC encryption for secrets at rest
- ✅ Automated backup and rollback capability
- ✅ Comprehensive audit logging
- ✅ Health validation after rotation

📖 **Full Documentation:** [docs/secrets-management.md](docs/secrets-management.md)

---

**Version**: 5.2.0
**Last Updated**: November 2025
