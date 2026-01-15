#!/bin/bash

# Karmyq Secrets Rotation Script
# Enterprise-grade secrets management with zero-downtime rotation
# Usage: ./secrets-rotate.sh [environment] [--dry-run]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-qa}"
DRY_RUN="${2}"
SECRETS_DIR="${HOME}/.karmyq/secrets/${ENVIRONMENT}"
AUDIT_LOG="${SECRETS_DIR}/rotation-audit.log"
BACKUP_DIR="${SECRETS_DIR}/backups"
ENCRYPTION_KEY_FILE="${HOME}/.karmyq/encryption.key"

# Docker compose file based on environment
if [ "$ENVIRONMENT" == "qa" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.qa.yml"
elif [ "$ENVIRONMENT" == "production" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
else
    COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
fi

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Karmyq Secrets Rotation System v1.0    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Compose File:${NC} $COMPOSE_FILE"
echo -e "${YELLOW}Secrets Directory:${NC} $SECRETS_DIR"
if [ "$DRY_RUN" == "--dry-run" ]; then
    echo -e "${YELLOW}Mode:${NC} DRY RUN (no changes will be made)"
fi
echo ""

# Create necessary directories
mkdir -p "$SECRETS_DIR"
mkdir -p "$BACKUP_DIR"
touch "$AUDIT_LOG"

# Function to log audit events
log_audit() {
    local event="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $event" >> "$AUDIT_LOG"
    echo -e "${GREEN}✓${NC} $event"
}

# Function to generate secure random string
generate_secret() {
    local length="${1:-48}"
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-$length
}

# Function to encrypt secret
encrypt_secret() {
    local secret="$1"
    local output_file="$2"

    # Ensure encryption key exists
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        echo -e "${YELLOW}Creating encryption key...${NC}"
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
    fi

    echo -n "$secret" | openssl enc -aes-256-cbc -salt -pbkdf2 \
        -pass file:"$ENCRYPTION_KEY_FILE" -out "$output_file"
    chmod 600 "$output_file"
}

# Function to decrypt secret
decrypt_secret() {
    local input_file="$1"

    if [ ! -f "$input_file" ]; then
        echo ""
        return 1
    fi

    openssl enc -aes-256-cbc -d -pbkdf2 \
        -pass file:"$ENCRYPTION_KEY_FILE" -in "$input_file" 2>/dev/null || echo ""
}

# Function to backup current secrets
backup_secrets() {
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_subdir="${BACKUP_DIR}/${backup_timestamp}"

    echo -e "${YELLOW}📦 Backing up current secrets...${NC}"
    mkdir -p "$backup_subdir"

    if [ -f "${SECRETS_DIR}/jwt_secret.enc" ]; then
        cp "${SECRETS_DIR}/jwt_secret.enc" "${backup_subdir}/"
        cp "${SECRETS_DIR}/jwt_secret_previous.enc" "${backup_subdir}/" 2>/dev/null || true
    fi

    if [ -f "${SECRETS_DIR}/postgres_password.enc" ]; then
        cp "${SECRETS_DIR}/postgres_password.enc" "${backup_subdir}/"
    fi

    if [ -f "${SECRETS_DIR}/.env.encrypted" ]; then
        cp "${SECRETS_DIR}/.env.encrypted" "${backup_subdir}/"
    fi

    log_audit "Secrets backed up to ${backup_subdir}"
}

# Function to rotate JWT secret with zero-downtime
rotate_jwt_secret() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  JWT Secret Rotation (Zero-Downtime)${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    # Read current JWT secret
    local current_jwt=""
    if [ -f "${SECRETS_DIR}/jwt_secret.enc" ]; then
        current_jwt=$(decrypt_secret "${SECRETS_DIR}/jwt_secret.enc")
    fi

    # Generate new JWT secret
    local new_jwt=$(generate_secret 64)

    echo -e "${YELLOW}Current JWT (first 10 chars):${NC} ${current_jwt:0:10}..."
    echo -e "${YELLOW}New JWT (first 10 chars):${NC} ${new_jwt:0:10}..."
    echo ""

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo -e "${YELLOW}[DRY RUN] Would rotate JWT secret${NC}"
        return 0
    fi

    # Backup current as previous
    if [ -n "$current_jwt" ]; then
        encrypt_secret "$current_jwt" "${SECRETS_DIR}/jwt_secret_previous.enc"
        echo -e "${GREEN}✓${NC} Current JWT saved as previous (for grace period)"
    fi

    # Save new JWT secret
    encrypt_secret "$new_jwt" "${SECRETS_DIR}/jwt_secret.enc"
    echo -e "${GREEN}✓${NC} New JWT secret generated and encrypted"

    # Export both secrets for dual-key validation
    export JWT_SECRET="$new_jwt"
    export JWT_SECRET_PREVIOUS="$current_jwt"

    log_audit "JWT secret rotated (dual-key active for grace period)"
}

# Function to rotate database password
rotate_postgres_password() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  PostgreSQL Password Rotation        ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    # Generate new password
    local new_password=$(generate_secret 32)

    echo -e "${YELLOW}New password (first 10 chars):${NC} ${new_password:0:10}..."
    echo ""

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo -e "${YELLOW}[DRY RUN] Would rotate PostgreSQL password${NC}"
        return 0
    fi

    # Save new password
    encrypt_secret "$new_password" "${SECRETS_DIR}/postgres_password.enc"
    echo -e "${GREEN}✓${NC} New PostgreSQL password generated and encrypted"

    # Update database password
    echo -e "${YELLOW}Updating PostgreSQL password in database...${NC}"

    local container_name="karmyq-${ENVIRONMENT}-postgres"

    # Check if postgres container is running
    if docker ps --format '{{.Names}}' | grep -q "$container_name"; then
        docker exec "$container_name" psql -U karmyq_user -d karmyq_db -c \
            "ALTER USER karmyq_user WITH PASSWORD '$new_password';" >/dev/null
        echo -e "${GREEN}✓${NC} PostgreSQL password updated in database"
    else
        echo -e "${YELLOW}⚠${NC}  PostgreSQL container not running, password will be applied on restart"
    fi

    export POSTGRES_PASSWORD="$new_password"

    log_audit "PostgreSQL password rotated"
}

# Function to generate .env file with rotated secrets
generate_env_file() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Generating Environment File         ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    local jwt_secret=$(decrypt_secret "${SECRETS_DIR}/jwt_secret.enc")
    local jwt_secret_previous=$(decrypt_secret "${SECRETS_DIR}/jwt_secret_previous.enc")
    local postgres_password=$(decrypt_secret "${SECRETS_DIR}/postgres_password.enc")

    local env_file="${SECRETS_DIR}/.env"

    cat > "$env_file" <<EOF
# Karmyq ${ENVIRONMENT} Environment Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT THIS FILE

NODE_ENV=production

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=karmyq_db
POSTGRES_USER=karmyq_user
POSTGRES_PASSWORD=${postgres_password}

# JWT Secrets (dual-key for zero-downtime rotation)
JWT_SECRET=${jwt_secret}
JWT_SECRET_PREVIOUS=${jwt_secret_previous}

# Redis
REDIS_URL=redis://redis:6379

# Rate Limiting
RATE_LIMIT_DISABLED=false
RATE_LIMIT_MULTIPLIER=1

# Logging
LOG_LEVEL=info

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

    if [ "$DRY_RUN" != "--dry-run" ]; then
        # Encrypt the .env file
        encrypt_secret "$(cat $env_file)" "${SECRETS_DIR}/.env.encrypted"
        echo -e "${GREEN}✓${NC} Environment file generated and encrypted"

        # Show unencrypted file location
        echo -e "${YELLOW}Unencrypted env file:${NC} $env_file"
        echo -e "${YELLOW}Encrypted env file:${NC} ${SECRETS_DIR}/.env.encrypted"
    else
        echo -e "${YELLOW}[DRY RUN] Would generate environment file${NC}"
    fi
}

# Function to restart services with new secrets
restart_services() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Restarting Services                 ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo -e "${YELLOW}[DRY RUN] Would restart services with new secrets${NC}"
        return 0
    fi

    # Load new environment
    export $(cat "${SECRETS_DIR}/.env" | grep -v '^#' | xargs)

    # Rolling restart of services
    echo -e "${YELLOW}Performing rolling restart...${NC}"

    local services=(
        "auth-service"
        "community-service"
        "request-service"
        "reputation-service"
        "notification-service"
        "messaging-service"
        "feed-service"
        "cleanup-service"
    )

    for service in "${services[@]}"; do
        echo -e "${YELLOW}  Restarting ${service}...${NC}"
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate "$service" >/dev/null 2>&1
        sleep 2
        echo -e "${GREEN}  ✓${NC} ${service} restarted"
    done

    log_audit "All services restarted with new secrets"
}

# Function to validate rotation
validate_rotation() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Validating Rotation                 ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo -e "${YELLOW}[DRY RUN] Would validate rotation${NC}"
        return 0
    fi

    # Wait for services to stabilize
    echo -e "${YELLOW}Waiting for services to stabilize...${NC}"
    sleep 10

    # Health checks
    local services=(
        "auth-service:3001"
        "community-service:3002"
        "request-service:3003"
    )

    local all_healthy=true

    for service in "${services[@]}"; do
        local name=$(echo $service | cut -d: -f1)
        local port=$(echo $service | cut -d: -f2)

        if curl -f -s http://localhost:$port/health >/dev/null 2>&1; then
            echo -e "${GREEN}  ✓${NC} $name is healthy"
        else
            echo -e "${RED}  ✗${NC} $name health check failed"
            all_healthy=false
        fi
    done

    if [ "$all_healthy" = true ]; then
        echo ""
        echo -e "${GREEN}✓ All health checks passed${NC}"
        log_audit "Rotation validated - all services healthy"
        return 0
    else
        echo ""
        echo -e "${RED}✗ Some health checks failed${NC}"
        echo -e "${YELLOW}Consider rolling back using: ./secrets-rollback.sh${NC}"
        return 1
    fi
}

# Function to display rotation summary
display_summary() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Secrets Rotation Summary            ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} JWT secret rotated (dual-key active)"
    echo -e "${GREEN}✓${NC} PostgreSQL password rotated"
    echo -e "${GREEN}✓${NC} Environment file generated"
    echo -e "${GREEN}✓${NC} Services restarted"
    echo -e "${GREEN}✓${NC} Health checks completed"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Monitor services for 24 hours"
    echo "2. Previous JWT secret will be valid for 24h grace period"
    echo "3. After 24h, remove JWT_SECRET_PREVIOUS from environment"
    echo "4. Backups available in: $BACKUP_DIR"
    echo ""
    echo -e "${YELLOW}Audit Log:${NC} $AUDIT_LOG"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}Starting secrets rotation...${NC}"
    echo ""

    # Confirm before proceeding (skip in dry-run)
    if [ "$DRY_RUN" != "--dry-run" ]; then
        read -p "Continue with secrets rotation? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo -e "${RED}Rotation cancelled${NC}"
            exit 0
        fi
    fi

    # Backup current secrets
    backup_secrets

    # Rotate secrets
    rotate_jwt_secret
    rotate_postgres_password

    # Generate new environment file
    generate_env_file

    # Restart services
    restart_services

    # Validate rotation
    if validate_rotation; then
        display_summary
        exit 0
    else
        echo -e "${RED}Rotation validation failed${NC}"
        exit 1
    fi
}

# Run main function
main
