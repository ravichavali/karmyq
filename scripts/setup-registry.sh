#!/bin/bash
set -e

# Script to set up the self-hosted Docker registry on production
# This script should be run on the production server

echo "🐳 Setting up Karmyq Self-Hosted Docker Registry"
echo "================================================"
echo ""

# Check if running on production server
if [ ! -d "/home/ubuntu/karmyq" ]; then
    echo "⚠️  Warning: This doesn't appear to be the production server"
    echo "   Expected directory: /home/ubuntu/karmyq"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

cd /home/ubuntu/karmyq

# Create registry directory if it doesn't exist
echo "📁 Creating registry directories..."
mkdir -p infrastructure/docker/registry

# Generate secure random password
echo "🔐 Generating secure credentials..."
REGISTRY_USERNAME="karmyq-admin"
REGISTRY_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Create htpasswd file
echo "   Creating htpasswd file..."
docker run --rm --entrypoint htpasswd httpd:2 -Bbn "$REGISTRY_USERNAME" "$REGISTRY_PASSWORD" > infrastructure/docker/registry/htpasswd

# Save credentials to a secure file
CREDS_FILE="$HOME/.karmyq-registry-creds"
echo "   Saving credentials to $CREDS_FILE..."
cat > "$CREDS_FILE" <<EOF
# Karmyq Docker Registry Credentials
# Generated: $(date)
# Keep this file secure!

REGISTRY_USERNAME=$REGISTRY_USERNAME
REGISTRY_PASSWORD=$REGISTRY_PASSWORD

# Login command:
# docker login karmyq.com -u $REGISTRY_USERNAME -p '$REGISTRY_PASSWORD'
EOF

chmod 600 "$CREDS_FILE"

echo ""
echo "✅ Registry setup complete!"
echo ""
echo "📝 Credentials saved to: $CREDS_FILE"
echo ""
echo "🔑 Registry Credentials:"
echo "   Username: $REGISTRY_USERNAME"
echo "   Password: $REGISTRY_PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo "   You'll need them to push/pull images"
echo ""
echo "Next steps:"
echo "1. Start the registry:"
echo "   cd /home/ubuntu/karmyq/infrastructure/docker"
echo "   docker-compose up -d registry"
echo ""
echo "2. Update nginx configuration:"
echo "   sudo cp /home/ubuntu/karmyq/infrastructure/nginx/karmyq.com.conf /etc/nginx/sites-available/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "3. Login to the registry:"
echo "   docker login karmyq.com -u $REGISTRY_USERNAME"
echo ""
echo "4. Test the registry:"
echo "   curl -u $REGISTRY_USERNAME:$REGISTRY_PASSWORD https://karmyq.com/v2/_catalog"
