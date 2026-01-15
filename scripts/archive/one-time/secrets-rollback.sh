#!/bin/bash

# Karmyq Secrets Rollback Script
# Rollback to previous secrets if rotation fails
# Usage: ./secrets-rollback.sh [environment] [backup-timestamp]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-qa}"
BACKUP_TIMESTAMP="$2"
SECRETS_DIR="${HOME}/.karmyq/secrets/${ENVIRONMENT}"
BACKUP_DIR="${SECRETS_DIR}/backups"
AUDIT_LOG="${SECRETS_DIR}/rotation-audit.log"
ENCRYPTION_KEY_FILE="${HOME}/.karmyq/encryption.key"

# Docker compose file based on environment
if [ "$ENVIRONMENT" == "qa" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.qa.yml"
elif [ "$ENVIRONMENT" == "production" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
else
    COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
fi

echo -e "${RED}╔═══════════════════════════════════════════╗${NC}"
echo -e "${RED}║     Karmyq Secrets Rollback System       ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Secrets Directory:${NC} $SECRETS_DIR"
echo -e "${YELLOW}Backup Directory:${NC} $BACKUP_DIR"
echo ""

# Function to log audit events
log_audit() {
    local event="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] ROLLBACK: $event" >> "$AUDIT_LOG"
    echo -e "${GREEN}✓${NC} $event"
}

# Function to list available backups
list_backups() {
    echo -e "${BLUE}Available Backups:${NC}"
    echo ""

    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}No backups found${NC}"
        exit 1
    fi

    local backups=($(ls -t "$BACKUP_DIR" 2>/dev/null))

    if [ ${#backups[@]} -eq 0 ]; then
        echo -e "${RED}No backups found${NC}"
        exit 1
    fi

    local i=1
    for backup in "${backups[@]}"; do
        local backup_date=$(echo "$backup" | sed 's/_/ /')
        echo -e "  ${GREEN}$i.${NC} $backup_date"
        i=$((i + 1))
    done

    echo ""
}

# Function to select backup
select_backup() {
    if [ -n "$BACKUP_TIMESTAMP" ]; then
        # Backup timestamp provided as argument
        SELECTED_BACKUP="${BACKUP_DIR}/${BACKUP_TIMESTAMP}"

        if [ ! -d "$SELECTED_BACKUP" ]; then
            echo -e "${RED}Backup not found: $BACKUP_TIMESTAMP${NC}"
            exit 1
        fi
    else
        # Interactive selection
        list_backups

        read -p "Select backup to restore (1-n, or 'latest'): " selection

        if [ "$selection" == "latest" ] || [ "$selection" == "1" ]; then
            # Get most recent backup
            SELECTED_BACKUP=$(ls -t "$BACKUP_DIR" | head -1)
            SELECTED_BACKUP="${BACKUP_DIR}/${SELECTED_BACKUP}"
        else
            # Get nth backup
            local backups=($(ls -t "$BACKUP_DIR"))
            local index=$((selection - 1))

            if [ $index -lt 0 ] || [ $index -ge ${#backups[@]} ]; then
                echo -e "${RED}Invalid selection${NC}"
                exit 1
            fi

            SELECTED_BACKUP="${BACKUP_DIR}/${backups[$index]}"
        fi
    fi

    echo -e "${YELLOW}Selected backup:${NC} $(basename $SELECTED_BACKUP)"
    echo ""
}

# Function to restore secrets from backup
restore_secrets() {
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Restoring Secrets from Backup      ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    # Restore JWT secrets
    if [ -f "${SELECTED_BACKUP}/jwt_secret.enc" ]; then
        cp "${SELECTED_BACKUP}/jwt_secret.enc" "${SECRETS_DIR}/jwt_secret.enc"
        echo -e "${GREEN}✓${NC} JWT secret restored"
    fi

    if [ -f "${SELECTED_BACKUP}/jwt_secret_previous.enc" ]; then
        cp "${SELECTED_BACKUP}/jwt_secret_previous.enc" "${SECRETS_DIR}/jwt_secret_previous.enc"
        echo -e "${GREEN}✓${NC} Previous JWT secret restored"
    fi

    # Restore PostgreSQL password
    if [ -f "${SELECTED_BACKUP}/postgres_password.enc" ]; then
        cp "${SELECTED_BACKUP}/postgres_password.enc" "${SECRETS_DIR}/postgres_password.enc"
        echo -e "${GREEN}✓${NC} PostgreSQL password restored"
    fi

    # Restore environment file
    if [ -f "${SELECTED_BACKUP}/.env.encrypted" ]; then
        cp "${SELECTED_BACKUP}/.env.encrypted" "${SECRETS_DIR}/.env.encrypted"
        echo -e "${GREEN}✓${NC} Environment file restored"
    fi

    log_audit "Secrets restored from backup: $(basename $SELECTED_BACKUP)"
}

# Function to decrypt and regenerate .env file
regenerate_env_file() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Regenerating Environment File      ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    # Decrypt secrets
    local jwt_secret=$(openssl enc -aes-256-cbc -d -pbkdf2 \
        -pass file:"$ENCRYPTION_KEY_FILE" -in "${SECRETS_DIR}/jwt_secret.enc" 2>/dev/null)

    local jwt_secret_previous=$(openssl enc -aes-256-cbc -d -pbkdf2 \
        -pass file:"$ENCRYPTION_KEY_FILE" -in "${SECRETS_DIR}/jwt_secret_previous.enc" 2>/dev/null || echo "")

    local postgres_password=$(openssl enc -aes-256-cbc -d -pbkdf2 \
        -pass file:"$ENCRYPTION_KEY_FILE" -in "${SECRETS_DIR}/postgres_password.enc" 2>/dev/null)

    # Generate .env file
    local env_file="${SECRETS_DIR}/.env"

    cat > "$env_file" <<EOF
# Karmyq ${ENVIRONMENT} Environment Configuration (ROLLED BACK)
# Restored from backup: $(basename $SELECTED_BACKUP)
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT COMMIT THIS FILE

NODE_ENV=production

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=karmyq_db
POSTGRES_USER=karmyq_user
POSTGRES_PASSWORD=${postgres_password}

# JWT Secrets
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

    echo -e "${GREEN}✓${NC} Environment file regenerated"
    log_audit "Environment file regenerated from backup"
}

# Function to restart services with restored secrets
restart_services() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Restarting Services                 ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

    # Load restored environment
    export $(cat "${SECRETS_DIR}/.env" | grep -v '^#' | xargs)

    # Update database password
    echo -e "${YELLOW}Updating PostgreSQL password in database...${NC}"
    local container_name="karmyq-${ENVIRONMENT}-postgres"

    if docker ps --format '{{.Names}}' | grep -q "$container_name"; then
        docker exec "$container_name" psql -U karmyq_user -d karmyq_db -c \
            "ALTER USER karmyq_user WITH PASSWORD '$POSTGRES_PASSWORD';" >/dev/null
        echo -e "${GREEN}✓${NC} PostgreSQL password updated"
    fi

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

    log_audit "All services restarted with restored secrets"
}

# Function to validate rollback
validate_rollback() {
    echo ""
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo -e "${BLUE}  Validating Rollback                 ${NC}"
    echo -e "${BLUE}═════════════════════════════════════${NC}"
    echo ""

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
        log_audit "Rollback validated - all services healthy"
        return 0
    else
        echo ""
        echo -e "${RED}✗ Some health checks failed${NC}"
        echo -e "${YELLOW}Manual intervention may be required${NC}"
        return 1
    fi
}

# Function to display rollback summary
display_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Rollback Completed                ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Secrets restored from backup"
    echo -e "${GREEN}✓${NC} Environment file regenerated"
    echo -e "${GREEN}✓${NC} Services restarted"
    echo -e "${GREEN}✓${NC} Health checks completed"
    echo ""
    echo -e "${YELLOW}Restored from:${NC} $(basename $SELECTED_BACKUP)"
    echo -e "${YELLOW}Audit log:${NC} $AUDIT_LOG"
    echo ""
}

# Main execution
main() {
    echo -e "${RED}⚠️  WARNING: This will rollback secrets to a previous backup${NC}"
    echo ""

    # Confirm before proceeding
    read -p "Continue with rollback? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Rollback cancelled${NC}"
        exit 0
    fi

    # Select backup
    select_backup

    # Confirm selected backup
    echo ""
    read -p "Restore from $(basename $SELECTED_BACKUP)? (yes/no): " confirm_backup
    if [ "$confirm_backup" != "yes" ]; then
        echo -e "${YELLOW}Rollback cancelled${NC}"
        exit 0
    fi

    # Restore secrets
    restore_secrets

    # Regenerate environment file
    regenerate_env_file

    # Restart services
    restart_services

    # Validate rollback
    if validate_rollback; then
        display_summary
        exit 0
    else
        echo -e "${RED}Rollback validation failed${NC}"
        exit 1
    fi
}

# Run main function
main
