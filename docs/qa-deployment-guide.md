# QA Environment Deployment Guide

## Overview
This guide walks you through deploying Karmyq to your Ubuntu server for QA testing.

## Prerequisites

### On Your Development Machine (Windows)
- Git configured with SSH access to your repository
- SSH access to Ubuntu QA server
- Docker installed (for local testing)

### On Ubuntu QA Server
- Ubuntu 20.04+ (Desktop or Server)
- Docker and Docker Compose installed
- Git configured
- Network accessible from your dev machine (192.168.x.x)

## Step 1: Prepare Ubuntu QA Server

### 1.1 Install Docker
```bash
# SSH into your Ubuntu server
ssh your-username@192.168.x.x

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
# SSH back in
```

### 1.2 Install Docker Compose (if not included)
```bash
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### 1.3 Clone Repository
```bash
# Clone your repository
git clone <your-repo-url> ~/karmyq-qa
cd ~/karmyq-qa
git checkout develop
```

## Step 2: Configure Environment

### 2.1 Create QA Environment File
```bash
cd ~/karmyq-qa
cp .env.qa.example .env.qa
nano .env.qa
```

### 2.2 Generate Secure Secrets
```bash
# Generate secure PostgreSQL password
openssl rand -base64 32

# Generate secure JWT secret (minimum 32 characters)
openssl rand -base64 32
```

### 2.3 Update .env.qa
Replace these values in `.env.qa`:
```bash
POSTGRES_PASSWORD=<paste-generated-password>
JWT_SECRET=<paste-generated-jwt-secret>
NEXT_PUBLIC_API_URL=http://192.168.x.x:3001  # Replace x.x with your server IP
```

## Step 3: Deploy Services

### 3.1 Build and Start Services
```bash
cd ~/karmyq-qa
docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d --build
```

### 3.2 Monitor Deployment
```bash
# Watch logs
docker-compose -f infrastructure/docker/docker-compose.qa.yml logs -f

# Check container status
docker-compose -f infrastructure/docker/docker-compose.qa.yml ps
```

### 3.3 Verify Health
```bash
# Wait 30 seconds for services to start
sleep 30

# Health checks
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # Community
curl http://localhost:3003/health  # Request
curl http://localhost:3004/health  # Reputation
curl http://localhost:3005/health  # Notification
curl http://localhost:3006/health  # Messaging
curl http://localhost:3007/health  # Feed
curl http://localhost:3008/health  # Cleanup
```

## Step 4: Seed Test Data

### 4.1 Install Seed Script Dependencies
```bash
cd ~/karmyq-qa/scripts
npm install
```

### 4.2 Run Seed Script
```bash
# Set environment variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=karmyq_db
export POSTGRES_USER=karmyq_user
export POSTGRES_PASSWORD=<your-qa-password>

# Run seed
npm run seed
```

Expected output:
- 2000 users created
- 200 communities created
- 7500+ memberships
- 400+ help requests
- 7000+ karma records

## Step 5: Configure GitHub Actions (Optional)

### 5.1 Generate SSH Key for CI/CD
```bash
# On Ubuntu QA server
ssh-keygen -t ed25519 -C "github-actions-karmyq-qa" -f ~/.ssh/github_actions_qa
cat ~/.ssh/github_actions_qa.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions_qa  # Copy this private key
```

### 5.2 Add GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `QA_SERVER_HOST`: 192.168.x.x (your Ubuntu server IP)
- `QA_SERVER_USER`: your-username
- `QA_SSH_PRIVATE_KEY`: <paste-private-key-from-above>
- `JWT_SECRET`: <your-jwt-secret>
- `POSTGRES_PASSWORD`: <your-postgres-password>

### 5.3 Test Automatic Deployment
```bash
# On your dev machine
git checkout develop
git commit --allow-empty -m "test: trigger QA deployment"
git push origin develop
```

Watch the GitHub Actions workflow run at: `https://github.com/<your-repo>/actions`

## Step 6: Access QA Environment

### From Your Dev Machine
- Frontend: `http://192.168.x.x:3000`
- Auth API: `http://192.168.x.x:3001`
- Community API: `http://192.168.x.x:3002`

### Test Login Credentials
```
Email: alice.johnson@example.com
Password: Test123!

Or any user from: bob.smith@, carol.williams@, dave.brown@example.com
```

## Maintenance

### Update QA Environment
```bash
# SSH into QA server
ssh your-username@192.168.x.x
cd ~/karmyq-qa

# Pull latest code
git pull origin develop

# Rebuild and restart
docker-compose -f infrastructure/docker/docker-compose.qa.yml down
docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d --build
```

### View Logs
```bash
# All services
docker-compose -f infrastructure/docker/docker-compose.qa.yml logs -f

# Specific service
docker logs karmyq-qa-auth-service -f --tail 100
```

### Backup Database
```bash
# Create backup
docker exec karmyq-qa-postgres pg_dump -U karmyq_user karmyq_db > backup-$(date +%Y%m%d).sql

# Restore backup
docker exec -i karmyq-qa-postgres psql -U karmyq_user -d karmyq_db < backup-20250125.sql
```

### Reset Test Data
```bash
# Clear and reseed
cd ~/karmyq-qa/scripts
npm run seed
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose -f infrastructure/docker/docker-compose.qa.yml logs

# Rebuild from scratch
docker-compose -f infrastructure/docker/docker-compose.qa.yml down -v
docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d --build
```

### Database Connection Issues
```bash
# Test database connectivity
docker exec karmyq-qa-postgres pg_isready -U karmyq_user

# Check database exists
docker exec karmyq-qa-postgres psql -U karmyq_user -l
```

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3001

# Kill the process
sudo kill <PID>
```

### Can't Access from Dev Machine
```bash
# On Ubuntu server, check firewall
sudo ufw status

# Allow ports if needed
sudo ufw allow 3000:3008/tcp
```

## Security Notes

- Change default passwords immediately
- Use strong JWT secrets (32+ characters)
- Keep `.env.qa` out of version control
- Restrict QA server access to your local network
- Regularly update Docker images
- Enable HTTPS when exposing to internet

## Next Steps

After successful deployment:
1. Test all features on web frontend
2. Test mobile app (configure EXPO_PUBLIC_API_HOST=192.168.x.x)
3. Run integration tests against QA environment
4. Set up monitoring (optional: Grafana/Loki)
5. Document any issues found

---

**Version**: 5.1.0
**Last Updated**: November 2025
