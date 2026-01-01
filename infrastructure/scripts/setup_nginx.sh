#!/bin/bash

# setup_nginx.sh - Automates Nginx & SSL Setup

set -e

DOMAIN="karmyq.com"
DOMAIN2="www.karmyq.com"
EMAIL="kvpal@karmyq.com" # Replace or generic? Using user's implicit email or just ask. I'll use a placeholder or prompt? I'll hardcode for now or auto-detect.

echo "--- Installing Nginx ---"
sudo apt-get install -y nginx

echo "--- Configuring Nginx ---"
# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Create snippets directory
sudo mkdir -p /etc/nginx/snippets

# 1. SSL Hardening
if [ -f "infrastructure/nginx/ssl-hardening.conf" ]; then
    echo "Copying SSL hardening config..."
    sudo cp infrastructure/nginx/ssl-hardening.conf /etc/nginx/snippets/
else
    echo "Creating default SSL hardening..."
    cat <<EOF | sudo tee /etc/nginx/snippets/ssl-hardening.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000" always;
EOF
fi

# 2. Dummy SSL Certs (Snake Oil) for Bootstrap
# We need this because nginx.conf includes ssl-certificates.conf, which must exist and be valid
echo "Configuring initial Self-Signed Certs..."
cat <<EOF | sudo tee /etc/nginx/snippets/ssl-certificates.conf
ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
EOF

# 3. Link Karmyq Config
echo "Linking Nginx web server config..."
# Use absolute path assuming repo is at ~/karmyq
sudo ln -sf /home/ubuntu/karmyq/infrastructure/nginx/nginx.conf /etc/nginx/sites-available/karmyq
sudo ln -sf /etc/nginx/sites-available/karmyq /etc/nginx/sites-enabled/

# 4. Create Webroot for Certbot
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

echo "--- Testing Nginx Config ---"
sudo nginx -t

echo "--- Restarting Nginx ---"
sudo systemctl restart nginx
echo "Nginx started with Self-Signed Certs."

# 5. Request Real Certs via Certbot (Webroot Mode)
echo "--- Requesting Let's Encrypt Certificates ---"
# Check if certs already exist
if sudo certbot certificates | grep -q "$DOMAIN"; then
    echo "Certificates already exist. Skipping request."
else
    echo "Requesting new certificate for $DOMAIN and $DOMAIN2..."
    sudo certbot certonly --webroot -w /var/www/certbot \
        -d $DOMAIN -d $DOMAIN2 \
        --email $EMAIL --agree-tos --no-eff-email --non-interactive
    
    # 6. Update Config to use Real Certs
    echo "Updating Nginx to use Real Certs..."
    cat <<EOF | sudo tee /etc/nginx/snippets/ssl-certificates.conf
ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
EOF

    echo "--- Reloading Nginx with Real SSL ---"
    sudo systemctl reload nginx
fi

echo "--- Setup Complete! ---"
echo "Your server should now be serving HTTPS at https://$DOMAIN"
