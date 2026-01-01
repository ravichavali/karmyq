#!/bin/bash

# setup_env.sh - Generates secure .env for Production

set -e

DEST_DIR="$(dirname "$0")/../docker"
ENV_FILE="$DEST_DIR/.env"

echo "--- Generating Production Environment Variables ---"

# Generate Random Secrets
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -hex 16)

# Domain
DOMAIN="karmyq.com"
PROTOCOL="https"

echo "Writing to $ENV_FILE..."

cat <<EOF > "$ENV_FILE"
# Production Environment Configuration

# Core
NODE_ENV=production
LOG_LEVEL=info

# Database
POSTGRES_USER=karmyq_prod
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=karmyq_prod
DATABASE_URL=postgresql://karmyq_prod:$DB_PASSWORD@postgres:5432/karmyq_prod

# Redis
REDIS_URL=redis://redis:6379 
# Note: Redis in docker-compose.yml doesn't have password enabled by default. 
# For strict production we should enable it, but for now we rely on internal network isolation.

# Security
JWT_SECRET=$JWT_SECRET

# Frontend API URLs (Routed via Nginx)
NEXT_PUBLIC_API_URL=$PROTOCOL://$DOMAIN/api
NEXT_PUBLIC_COMMUNITY_API_URL=$PROTOCOL://$DOMAIN/api/communities
NEXT_PUBLIC_REQUEST_API_URL=$PROTOCOL://$DOMAIN/api/requests
NEXT_PUBLIC_REPUTATION_API_URL=$PROTOCOL://$DOMAIN/api/reputation
NEXT_PUBLIC_NOTIFICATION_API_URL=$PROTOCOL://$DOMAIN/api/notifications
NEXT_PUBLIC_MESSAGING_API_URL=$PROTOCOL://$DOMAIN/api/messages
NEXT_PUBLIC_FEED_API_URL=$PROTOCOL://$DOMAIN/api/feed
NEXT_PUBLIC_SOCIAL_GRAPH_API_URL=$PROTOCOL://$DOMAIN/api/social-graph

# CORS
CORS_ORIGIN=$PROTOCOL://$DOMAIN

EOF

echo "--- .env Created Successfully ---"
echo "Location: $ENV_FILE"
echo "Database Password: $DB_PASSWORD"
echo "You can now run 'docker compose up'!"
