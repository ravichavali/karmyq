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
    # Pull the currently checked out branch
    git pull origin $(git rev-parse --abbrev-ref HEAD)
else
    echo "⚠️  Git repository not found in $APP_DIR. Assuming initial deployment or manual copy."
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

# Check if snippets directory exists, create if not
if [ ! -d "/etc/nginx/snippets" ]; then
    sudo mkdir -p /etc/nginx/snippets
fi
sudo cp infrastructure/nginx/ssl.conf /etc/nginx/snippets/ssl-hardening.conf

# Cleanup old conflicting config if it exists
if [ -f /etc/nginx/conf.d/ssl.conf ]; then
    sudo rm /etc/nginx/conf.d/ssl.conf
fi

# 2.5 Configure SSL Certificates (Must happen before Nginx Test)
echo "🔒 Configuring SSL Certificates..."
SSL_SNIPPET="/etc/nginx/snippets/ssl-certificates.conf"
SSL_DIR="/etc/nginx/ssl"

# Ensure SSL dir exists
if [ ! -d "$SSL_DIR" ]; then
    sudo mkdir -p $SSL_DIR
fi

if [ "$ENV" == "staging" ]; then
    echo "🚧 Staging Environment: Generating Self-Signed Certificates..."
    CERT_KEY="$SSL_DIR/self-signed.key"
    CERT_CRT="$SSL_DIR/self-signed.crt"
    
    # Generate cert if it doesn't exist
    if [ ! -f "$CERT_KEY" ]; then
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout $CERT_KEY \
            -out $CERT_CRT \
            -subj "/C=US/ST=State/L=City/O=Karmyq/OU=Staging/CN=karmyq-staging"
    fi

    # Write snippet for Self-Signed
    echo "ssl_certificate $CERT_CRT;" | sudo tee $SSL_SNIPPET > /dev/null
    echo "ssl_certificate_key $CERT_KEY;" | sudo tee -a $SSL_SNIPPET > /dev/null

else
    # Production
    echo "🌍 Production Environment: Checking for Let's Encrypt..."
    LE_PATH="/etc/letsencrypt/live/karmyq.com"
    
    if [ -f "$LE_PATH/fullchain.pem" ]; then
        echo "✅ Let's Encrypt certificates found."
        echo "ssl_certificate $LE_PATH/fullchain.pem;" | sudo tee $SSL_SNIPPET > /dev/null
        echo "ssl_certificate_key $LE_PATH/privkey.pem;" | sudo tee -a $SSL_SNIPPET > /dev/null
    else
        echo "⚠️  Let's Encrypt certificates NOT found. Using fallback snakeoil certs to allow Nginx start."
        # Fallback to snakeoil or generate temporary self-signed to allow Nginx to start for ACME validation
        # Ubuntu usually has ssl-cert-snakeoil
        if [ -f "/etc/ssl/certs/ssl-cert-snakeoil.pem" ]; then
             echo "ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;" | sudo tee $SSL_SNIPPET > /dev/null
             echo "ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;" | sudo tee -a $SSL_SNIPPET > /dev/null
        else
            # Generate temp cert
            sudo openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
                -keyout $SSL_DIR/temp.key \
                -out $SSL_DIR/temp.crt \
                -subj "/CN=temp"
            echo "ssl_certificate $SSL_DIR/temp.crt;" | sudo tee $SSL_SNIPPET > /dev/null
            echo "ssl_certificate_key $SSL_DIR/temp.key;" | sudo tee -a $SSL_SNIPPET > /dev/null
        fi
    fi
fi

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



# Reload Nginx again to apply SSL config
sudo systemctl reload nginx

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
