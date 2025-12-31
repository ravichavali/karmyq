#!/bin/bash

# infrastructure/scripts/deploy.sh
# Usage: ./deploy.sh [production|staging]

ENV=${1:-production}
APP_DIR="$HOME/karmyq"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Deploying to $ENV environment..."

# 1. Update Codebase
if [ -d "$APP_DIR/.git" ]; then
    echo "⬇️  Pulling latest code..."
    cd $APP_DIR
    git pull origin feature/docker-compose-production
else
    echo "⚠️  Git repository not found in $APP_DIR. Assuming manual copy."
    cd $APP_DIR
fi

# 2. Configure Nginx
echo "🔧 Configuring Nginx..."
# Backup existing config
if [ -f /etc/nginx/sites-available/karmyq ]; then
    sudo cp /etc/nginx/sites-available/karmyq /etc/nginx/sites-available/karmyq.backup.$TIMESTAMP
fi

# Copy new config
sudo cp infrastructure/nginx/nginx.conf /etc/nginx/sites-available/karmyq
sudo cp infrastructure/nginx/ssl.conf /etc/nginx/conf.d/ssl.conf

# Enable site if not already enabled
if [ ! -L /etc/nginx/sites-enabled/karmyq ]; then
    sudo ln -s /etc/nginx/sites-available/karmyq /etc/nginx/sites-enabled/
fi
# Remove default if exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test Nginx config
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration valid. Reloading..."
    sudo systemctl reload nginx
else
    echo "❌ Nginx configuration failed! Check logs."
    # Don't exit, we might still want to deploy containers
fi

# 3. Deploy Containers
echo "🐳 deploying Docker containers..."

if [ "$ENV" == "production" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
else
    COMPOSE_FILE="infrastructure/docker/docker-compose.staging.yml"
fi

# Combine base config with environment override
docker compose -f infrastructure/docker/docker-compose.yml -f $COMPOSE_FILE up -d --build --remove-orphans

# 4. Cleanup
echo "🧹 Cleaning up unused images..."
docker image prune -f

echo "✨ Deployment to $ENV complete!"
