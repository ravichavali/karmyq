# KarmyQ Self-Hosting Guide

Run your own KarmyQ instance for your community, maintaining full data sovereignty and control.

## Table of Contents

1. [Why Self-Host?](#why-self-host)
2. [System Requirements](#system-requirements)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Configuration](#configuration)
6. [Security Hardening](#security-hardening)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Upgrading](#upgrading)
10. [Federation](#federation)

---

## Why Self-Host?

**Data Sovereignty**: Your community owns its data
- No third-party surveillance
- Control over data retention policies
- Local legal compliance (GDPR, etc.)

**Customization**: Tailor to your community's needs
- Custom branding
- Local language support
- Community-specific features

**Resilience**: Not dependent on external services
- Works during internet outages (local network)
- No risk of service shutdown
- Community controls uptime

**Privacy**: Keep sensitive data local
- No data shared with corporations
- End-to-end control of information
- Optional encryption at rest

---

## System Requirements

### Minimum (Small Community: ~50 users)

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Bandwidth**: 10 Mbps up/down
- **OS**: Linux (Ubuntu 22.04 LTS recommended)

### Recommended (Medium Community: ~500 users)

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Bandwidth**: 100 Mbps up/down
- **OS**: Linux (Ubuntu 22.04 LTS recommended)

### Enterprise (Large Community: 5000+ users)

- **CPU**: 8+ cores
- **RAM**: 16+ GB
- **Storage**: 500+ GB SSD
- **Bandwidth**: 1 Gbps up/down
- **Load Balancer**: For horizontal scaling

### Software Prerequisites

- **Docker**: 24.0+
- **Docker Compose**: 2.20+
- **Domain Name**: For HTTPS (optional for local-only)
- **SSL Certificate**: Let's Encrypt recommended

---

## Quick Start

For development/testing only. **Do not use in production!**

```bash
# Clone repository
git clone https://github.com/karmyq/karmyq.git
cd karmyq

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access at http://localhost:3000
```

---

## Detailed Setup

### Step 1: Server Preparation

#### 1.1 Create a dedicated user

```bash
# Create karmyq user
sudo adduser karmyq
sudo usermod -aG docker karmyq
su - karmyq
```

#### 1.2 Install Docker

```bash
# Update package index
sudo apt update

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

#### 1.3 Configure Firewall

```bash
# Allow SSH (if remote)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 2: Clone and Configure

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/karmyq/karmyq.git
sudo chown -R karmyq:karmyq karmyq
cd karmyq

# Create environment file
cp .env.example .env
```

### Step 3: Environment Configuration

Edit `.env`:

```bash
# ============================================================================
# INSTANCE CONFIGURATION
# ============================================================================

# Instance identity
INSTANCE_DOMAIN=mutual-aid.example.org
INSTANCE_NAME=My Community Mutual Aid
INSTANCE_DESCRIPTION=Coordination platform for our community
INSTANCE_ADMIN_EMAIL=admin@example.org

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# PostgreSQL
POSTGRES_USER=karmyq_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD
POSTGRES_DB=karmyq_db
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# ============================================================================
# REDIS CONFIGURATION
# ============================================================================

REDIS_URL=redis://redis:6379
REDIS_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD

# ============================================================================
# AUTHENTICATION
# ============================================================================

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING
JWT_EXPIRATION=7d

# Session secret
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_STRING

# ============================================================================
# EMAIL CONFIGURATION (Optional)
# ============================================================================

# SMTP settings for email notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.org
SMTP_PASSWORD=email_password
SMTP_FROM=KarmyQ <noreply@example.org>
SMTP_SECURE=false  # true for port 465, false for other ports

# ============================================================================
# SSL/TLS (Production)
# ============================================================================

# Let's Encrypt email
LETSENCRYPT_EMAIL=admin@example.org

# SSL mode
SSL_ENABLED=true

# ============================================================================
# LOGGING
# ============================================================================

LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json  # json, pretty

# ============================================================================
# FEDERATION (Optional)
# ============================================================================

FEDERATION_ENABLED=false
FEDERATION_AUTO_ACCEPT=false

# ============================================================================
# RESOURCE LIMITS
# ============================================================================

# Max upload size (in MB)
MAX_UPLOAD_SIZE=10

# Rate limiting
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX_REQUESTS=100

# ============================================================================
# FEATURE FLAGS
# ============================================================================

ENABLE_NOTIFICATIONS=true
ENABLE_MESSAGING=true
ENABLE_REPUTATION=true
ENABLE_GOVERNANCE=true
ENABLE_FEED=true
```

### Step 4: Generate Secrets

```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# Generate session secret
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env

# Generate database password
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

# Generate Redis password
echo "REDIS_PASSWORD=$(openssl rand -base64 24)" >> .env
```

### Step 5: SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended for Production)

```bash
# Install certbot
sudo apt install -y certbot

# Obtain certificate
sudo certbot certonly --standalone \
  -d mutual-aid.example.org \
  --email admin@example.org \
  --agree-tos \
  --non-interactive

# Certificates will be at:
# /etc/letsencrypt/live/mutual-aid.example.org/fullchain.pem
# /etc/letsencrypt/live/mutual-aid.example.org/privkey.pem
```

#### Option B: Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=localhost"
```

### Step 6: Launch Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f

# Check individual service
docker logs karmyq-frontend
docker logs karmyq-postgres
```

### Step 7: Initialize Database

```bash
# Database migrations are applied automatically on first start
# Check if migrations completed successfully:
docker logs karmyq-postgres | grep "database system is ready"
```

### Step 8: Create Admin User

```bash
# Access the auth service container
docker exec -it karmyq-auth-service sh

# Run admin creation script
node scripts/create-admin.js \
  --email admin@example.org \
  --name "Admin User" \
  --password "CHANGE_THIS_PASSWORD"
```

### Step 9: Verify Installation

```bash
# Check all services are running
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # Community service
curl http://localhost:3003/health  # Request service
curl http://localhost:3004/health  # Reputation service
curl http://localhost:3005/health  # Notification service
curl http://localhost:3006/health  # Messaging service
curl http://localhost:3007/health  # Feed service

# Access frontend
curl http://localhost:3000
```

---

## Configuration

### Production Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: karmyq-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - karmyq-network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: karmyq-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - karmyq-network
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: karmyq-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - auth-service
      - community-service
      - request-service
      - reputation-service
      - notification-service
      - messaging-service
      - feed-service
    networks:
      - karmyq-network
    restart: always

  # Frontend
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.production
    container_name: karmyq-frontend
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://${INSTANCE_DOMAIN}/api/auth
      NEXT_PUBLIC_COMMUNITY_API_URL: https://${INSTANCE_DOMAIN}/api/community
      NEXT_PUBLIC_REQUEST_API_URL: https://${INSTANCE_DOMAIN}/api/request
      NEXT_PUBLIC_REPUTATION_API_URL: https://${INSTANCE_DOMAIN}/api/reputation
      NEXT_PUBLIC_NOTIFICATION_API_URL: https://${INSTANCE_DOMAIN}/api/notification
      NEXT_PUBLIC_MESSAGING_API_URL: https://${INSTANCE_DOMAIN}/api/messaging
      NEXT_PUBLIC_FEED_API_URL: https://${INSTANCE_DOMAIN}/api/feed
    networks:
      - karmyq-network
    restart: always

  # Auth Service
  auth-service:
    build:
      context: ./services/auth-service
      dockerfile: Dockerfile.production
    container_name: karmyq-auth-service
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: ${JWT_EXPIRATION}
      LOG_LEVEL: ${LOG_LEVEL}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - karmyq-network
    restart: always

  # Community Service
  community-service:
    build:
      context: ./services/community-service
      dockerfile: Dockerfile.production
    container_name: karmyq-community-service
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      LOG_LEVEL: ${LOG_LEVEL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - karmyq-network
    restart: always

  # ... (similar for other services)

volumes:
  postgres_data:
  redis_data:

networks:
  karmyq-network:
    driver: bridge
```

### Nginx Configuration

Create `infrastructure/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream auth_service {
        server auth-service:3001;
    }

    upstream community_service {
        server community-service:3002;
    }

    # ... other upstreams

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name mutual-aid.example.org;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name mutual-aid.example.org;

        ssl_certificate /etc/letsencrypt/live/mutual-aid.example.org/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/mutual-aid.example.org/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # API Routes
        location /api/auth {
            proxy_pass http://auth_service;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api/community {
            proxy_pass http://community_service;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # ... other API routes

        # Federation endpoint
        location /.well-known/karmyq {
            proxy_pass http://federation_service;
        }
    }
}
```

---

## Security Hardening

### 1. Database Security

```sql
-- Create read-only user for backups
CREATE USER karmyq_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE karmyq_db TO karmyq_readonly;
GRANT USAGE ON SCHEMA public TO karmyq_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO karmyq_readonly;

-- Revoke unnecessary privileges
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

### 2. Firewall Rules

```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Docker Security

```yaml
# In docker-compose.production.yml, add security options:
services:
  postgres:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql
```

### 4. Environment Variables

```bash
# Never commit .env file
echo ".env" >> .gitignore

# Set restrictive permissions
chmod 600 .env
```

### 5. Rate Limiting

In each service, add rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

---

## Maintenance

### Backup Strategy

#### Database Backup

```bash
# Create backup script
cat > /opt/karmyq/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/karmyq/backups
DATE=$(date +%Y%m%d_%H%M%S)
POSTGRES_CONTAINER=karmyq-postgres

mkdir -p $BACKUP_DIR

docker exec $POSTGRES_CONTAINER pg_dump -U karmyq_user karmyq_db | \
  gzip > $BACKUP_DIR/karmyq_db_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "karmyq_db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: karmyq_db_$DATE.sql.gz"
EOF

chmod +x /opt/karmyq/scripts/backup.sh
```

#### Automated Backups

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/karmyq/scripts/backup.sh >> /var/log/karmyq-backup.log 2>&1
```

#### Restore from Backup

```bash
# Stop services
docker-compose down

# Restore database
gunzip < backups/karmyq_db_20250110_020000.sql.gz | \
  docker exec -i karmyq-postgres psql -U karmyq_user karmyq_db

# Restart services
docker-compose up -d
```

### Monitoring

#### Health Check Script

```bash
cat > /opt/karmyq/scripts/health-check.sh << 'EOF'
#!/bin/bash
SERVICES=(
  "http://localhost:3001/health"  # Auth
  "http://localhost:3002/health"  # Community
  "http://localhost:3003/health"  # Request
  "http://localhost:3004/health"  # Reputation
  "http://localhost:3005/health"  # Notification
  "http://localhost:3006/health"  # Messaging
  "http://localhost:3007/health"  # Feed
)

for service in "${SERVICES[@]}"; do
  if ! curl -f -s $service > /dev/null; then
    echo "ALERT: $service is down!" | mail -s "KarmyQ Health Alert" admin@example.org
  fi
done
EOF

chmod +x /opt/karmyq/scripts/health-check.sh

# Run every 5 minutes
*/5 * * * * /opt/karmyq/scripts/health-check.sh
```

### Log Rotation

```bash
# Create logrotate configuration
sudo cat > /etc/logrotate.d/karmyq << 'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  missingok
  delaycompress
  copytruncate
}
EOF
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check container logs
docker-compose logs

# Check individual service
docker logs karmyq-postgres

# Restart services
docker-compose restart
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker exec karmyq-postgres pg_isready -U karmyq_user

# Check connection from service
docker exec karmyq-auth-service nc -zv postgres 5432

# View PostgreSQL logs
docker logs karmyq-postgres
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Limit container memory (in docker-compose.yml)
services:
  postgres:
    mem_limit: 2g
    memswap_limit: 2g
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a

# Remove old logs
journalctl --vacuum-time=7d
```

---

## Upgrading

### Minor Version Upgrade

```bash
# Backup first!
./scripts/backup.sh

# Pull latest code
git fetch origin
git checkout v1.2.0  # or latest version tag

# Update containers
docker-compose pull
docker-compose up -d

# Check health
docker-compose ps
```

### Major Version Upgrade

```bash
# Read CHANGELOG.md for breaking changes
cat CHANGELOG.md

# Backup database
./scripts/backup.sh

# Run migration scripts
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /migrations/v2.0.0.sql

# Update containers
docker-compose down
docker-compose up -d
```

---

## Federation

See [FEDERATION_PROTOCOL.md](./FEDERATION_PROTOCOL.md) for detailed federation setup.

### Quick Federation Setup

```bash
# Enable federation in .env
FEDERATION_ENABLED=true

# Generate instance keypair
docker exec karmyq-federation-service npm run init-keypair

# Your instance will be discoverable at:
# https://your-domain.org/.well-known/karmyq
```

---

## Getting Help

- **Documentation**: https://docs.karmyq.org
- **Community Forum**: https://forum.karmyq.org
- **GitHub Issues**: https://github.com/karmyq/karmyq/issues
- **Matrix Chat**: #karmyq:matrix.org
- **Email**: support@karmyq.org

---

## License

KarmyQ is free and open source software licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

This means:
- You can run it for any purpose
- You can study and modify the source code
- You can distribute copies
- If you modify and run it as a network service, you must share your changes

---

**Happy self-hosting! Power to the communities! 🤝**
