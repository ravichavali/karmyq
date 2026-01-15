# Production Deployment Guide

## 1. Prerequisites

- **OCI Compute Instance**: Ubuntu 22.04 LTS or Oracle Linux 8/9 (2+ vCPUs, 12GB+ RAM recommended for full stack).
- **Domain Name**: `karmyq.com` pointing to OCI Public IP (A Record).
- **Ports Open**: 80 (HTTP), 443 (HTTPS), 22 (SSH).

## 2. Server Initialization

Run this on your local machine to copy the setup script, or create it directly on the server.

```bash
# Windows Users: Run this in PowerShell (OpenSSH is included in Windows 10/11)
# Alternatively, manually copy file content using 'nano' on the server.

# Copy setup script to server
scp infrastructure/scripts/setup-server.sh opc@your-server-ip:~/

# SSH into server
ssh opc@your-server-ip

# Run setup script
chmod +x setup-server.sh
./setup-server.sh
```

**After script completes**:
1.  Set password for karmyq: `sudo passwd karmyq`
2.  Switch to karmyq user: `su - karmyq`

## 3. Clone Repository

```bash
# Ensure you are 'karmyq' user
cd ~/karmyq
git clone https://github.com/ravichavali/karmyq.git .
git checkout feature/docker-compose-production
```

## 4. Environment Configuration

Create the production environment file:

```bash
cp .env.production.example .env
nano .env
```

**Critical Variables to Set**:
-   `POSTGRES_PASSWORD`: Use a strong unique password.
-   `JWT_SECRET`: Generate a 32+ char random string.
-   `NEXT_PUBLIC_*_URL`: Ensure these point to `https://karmyq.com/...`

## 5. SSL Certificates (Let's Encrypt)

Before starting Nginx, generate certificates:

```bash
sudo certbot certonly --standalone -d karmyq.com -d www.karmyq.com
```

**Note**: If this fails, ensure Port 80 is open in Oracle Cloud "Security Lists".

## 6. Initial Deployment

Run the deployment script:

```bash
chmod +x infrastructure/scripts/deploy.sh
./infrastructure/scripts/deploy.sh production
```

This will:
1.  Copy `nginx.conf` and `ssl.conf` to `/etc/nginx/...`.
2.  Start Docker containers (builds may take 10-15 mins first time).
3.  Reload Nginx.

## 7. Post-Deployment Verification

1.  **Check Containers**: `docker ps` (Expect 14 containers healthy).
2.  **Check Logs**: `docker logs karmyq-auth-service --tail 100`.
3.  **Visit Website**: https://karmyq.com
4.  **Check Grafana**: https://karmyq.com/monitor/ (Default admin/admin - CHANGE THIS).

## 8. Maintenance

-   **Updates**: Run `./infrastructure/scripts/deploy.sh production`.
-   **Backups**: Configured in `infrastructure/scripts/backup-db.sh` (Set up cron job).
-   **Logs**: `docker compose logs -f [service]`.
