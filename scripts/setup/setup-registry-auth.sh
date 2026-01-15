#!/bin/bash
set -e

# Script to set up Docker registry authentication
# Usage: ./setup-registry-auth.sh <username> <password>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 admin mySecurePassword123"
    exit 1
fi

USERNAME="$1"
PASSWORD="$2"
HTPASSWD_FILE="infrastructure/docker/registry/htpasswd"

echo "🔐 Setting up registry authentication..."

# Create htpasswd file
docker run --rm --entrypoint htpasswd httpd:2 -Bbn "$USERNAME" "$PASSWORD" > "$HTPASSWD_FILE"

echo "✅ Authentication file created: $HTPASSWD_FILE"
echo ""
echo "📝 Registry credentials:"
echo "   Username: $USERNAME"
echo "   Password: $PASSWORD"
echo ""
echo "⚠️  Keep these credentials secure!"
echo "   Save them in a password manager"
echo ""
echo "Next steps:"
echo "1. Start the registry: docker-compose up -d registry"
echo "2. Login: docker login localhost:5000 -u $USERNAME"
echo "3. Test: curl -u $USERNAME:$PASSWORD http://localhost:5000/v2/_catalog"
