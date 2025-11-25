# Secrets Management & Rotation Guide

## Overview

Karmyq implements enterprise-grade secrets management with automated rotation, zero-downtime updates, and comprehensive audit logging. This system ensures that sensitive credentials are never stored in version control and are regularly rotated to minimize security risks.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Secrets Management Flow                   │
└─────────────────────────────────────────────────────────────┘

1. Generation          2. Encryption         3. Storage
   ┌──────────┐          ┌──────────┐          ┌──────────┐
   │ openssl  │──────────│ AES-256  │──────────│ ~/.karmyq│
   │ rand     │          │ CBC      │          │ /secrets │
   └──────────┘          └──────────┘          └──────────┘
                                                      │
4. Dual-Key JWT                                      │
   ┌────────────────────────────┐                   │
   │ JWT_SECRET (current)       │◄──────────────────┘
   │ JWT_SECRET_PREVIOUS (grace)│
   └────────────────────────────┘
                  │
5. Zero-Downtime Deployment
   ┌────────────────────────────┐
   │ Old tokens: valid 24h      │
   │ New tokens: immediately    │
   │ Rolling service restart    │
   └────────────────────────────┘
```

## Security Features

### ✅ Secrets Never in Git
- All secrets generated on target servers
- `.env` files excluded from version control
- Encrypted storage with AES-256-CBC

### ✅ Zero-Downtime Rotation
- Dual-key JWT validation (current + previous)
- 24-hour grace period for old tokens
- Rolling service restart strategy

### ✅ Audit Logging
- All rotation events logged with timestamps
- Backup history maintained
- Rollback capability with validation

### ✅ Automated Rotation
- On-demand via script
- Optional CI/CD integration
- Scheduled rotation (cron)

## Secrets Rotation Scripts

### 1. `secrets-rotate.sh` - Main Rotation Script

Rotates JWT secrets and PostgreSQL passwords with zero downtime.

**Usage:**
```bash
# Interactive rotation
./scripts/secrets-rotate.sh qa

# Dry run (preview changes)
./scripts/secrets-rotate.sh qa --dry-run

# Production rotation
./scripts/secrets-rotate.sh production
```

**What it does:**
1. Backs up current secrets
2. Generates new JWT_SECRET (64 chars) and POSTGRES_PASSWORD (32 chars)
3. Encrypts secrets with AES-256-CBC
4. Updates database password
5. Performs rolling restart of all services
6. Validates health checks
7. Logs all events to audit log

**Output files:**
- `~/.karmyq/secrets/{env}/jwt_secret.enc` - Encrypted current JWT
- `~/.karmyq/secrets/{env}/jwt_secret_previous.enc` - Encrypted previous JWT
- `~/.karmyq/secrets/{env}/postgres_password.enc` - Encrypted DB password
- `~/.karmyq/secrets/{env}/.env` - Decrypted environment file (temporary)
- `~/.karmyq/secrets/{env}/.env.encrypted` - Encrypted environment file
- `~/.karmyq/secrets/{env}/rotation-audit.log` - Audit trail
- `~/.karmyq/secrets/{env}/backups/{timestamp}/` - Backup directory

### 2. `secrets-rollback.sh` - Rollback Script

Rollback to previous secrets if rotation fails.

**Usage:**
```bash
# Interactive rollback (select backup)
./scripts/secrets-rollback.sh qa

# Rollback to specific backup
./scripts/secrets-rollback.sh qa 20250125_143022

# Rollback to latest backup
./scripts/secrets-rollback.sh qa latest
```

**What it does:**
1. Lists available backups
2. Restores selected secrets
3. Regenerates `.env` file
4. Updates database password
5. Restarts services
6. Validates health checks
7. Logs rollback event

## Zero-Downtime JWT Rotation

### How It Works

The authentication middleware supports **dual-key validation**:

```typescript
// packages/shared/middleware/auth.ts

function verifyTokenWithRotation(token: string): JWTPayload {
  const JWT_SECRET = process.env.JWT_SECRET;          // Current
  const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS; // Previous

  // Try current secret first
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // Fall back to previous secret (24h grace period)
    if (JWT_SECRET_PREVIOUS) {
      return jwt.verify(token, JWT_SECRET_PREVIOUS);
    }
    throw error;
  }
}
```

### Rotation Timeline

```
Day 0: Before Rotation
├─ JWT_SECRET: abc123...
└─ All tokens signed with abc123...

Day 1: Rotation Occurs
├─ JWT_SECRET: xyz789... (NEW)
├─ JWT_SECRET_PREVIOUS: abc123... (OLD, grace period)
├─ New logins: signed with xyz789...
└─ Old tokens (abc123...): still valid for 24h

Day 2: Grace Period Ends
├─ JWT_SECRET: xyz789...
├─ JWT_SECRET_PREVIOUS: (removed)
└─ Only xyz789... tokens valid
```

## Database Password Rotation

PostgreSQL passwords are rotated using `ALTER USER`:

```bash
# Update password in database
docker exec karmyq-qa-postgres psql -U karmyq_user -d karmyq_db -c \
  "ALTER USER karmyq_user WITH PASSWORD 'new_password';"

# Services pick up new password on restart
docker-compose up -d --force-recreate auth-service
```

## Encryption Details

### AES-256-CBC Encryption

**Encryption key location:** `~/.karmyq/encryption.key`

**Encryption process:**
```bash
# Generate encryption key (one-time setup)
openssl rand -base64 32 > ~/.karmyq/encryption.key
chmod 600 ~/.karmyq/encryption.key

# Encrypt secret
echo -n "$SECRET" | openssl enc -aes-256-cbc -salt -pbkdf2 \
  -pass file:~/.karmyq/encryption.key -out secret.enc

# Decrypt secret
openssl enc -aes-256-cbc -d -pbkdf2 \
  -pass file:~/.karmyq/encryption.key -in secret.enc
```

### File Permissions

All secret files are protected with strict permissions:
```bash
chmod 600 ~/.karmyq/encryption.key
chmod 600 ~/.karmyq/secrets/*/jwt_secret.enc
chmod 600 ~/.karmyq/secrets/*/postgres_password.enc
chmod 600 ~/.karmyq/secrets/*/.env
```

## Deployment Integration

### Manual Rotation (Recommended)

For maximum security, rotate secrets manually after each deployment:

```bash
# SSH into QA server
ssh qa-server

# Navigate to project
cd ~/karmyq-qa

# Rotate secrets
./scripts/secrets-rotate.sh qa

# Monitor for 24 hours
docker-compose -f infrastructure/docker/docker-compose.qa.yml logs -f
```

### CI/CD Integration (Optional)

The CI/CD pipeline includes optional secrets rotation:

```yaml
# .github/workflows/ci.yml

- name: Deploy and rotate secrets
  env:
    ROTATE_SECRETS: ${{ secrets.ROTATE_SECRETS_ON_DEPLOY || 'false' }}
```

**To enable:**
1. Add GitHub Secret: `ROTATE_SECRETS_ON_DEPLOY=true`
2. Commit and push to `develop`
3. Secrets will rotate automatically on deployment

**Note:** Automated rotation is disabled by default for safety. Manual rotation is recommended for production.

## Scheduled Rotation (Cron)

Set up automated monthly rotation with cron:

```bash
# Edit crontab
crontab -e

# Add rotation schedule (1st day of month, 2 AM)
0 2 1 * * cd ~/karmyq-qa && ./scripts/secrets-rotate.sh qa 2>&1 | logger -t karmyq-secrets

# Add grace period cleanup (2nd day of month, 2 AM)
0 2 2 * * cd ~/karmyq-qa && ./scripts/secrets-cleanup-grace.sh qa 2>&1 | logger -t karmyq-secrets
```

## Monitoring & Alerting

### Audit Log Analysis

Monitor rotation events:

```bash
# View recent rotations
tail -f ~/.karmyq/secrets/qa/rotation-audit.log

# Count rotations this month
grep "$(date +%Y-%m)" ~/.karmyq/secrets/qa/rotation-audit.log | wc -l

# Find failed rotations
grep -i "failed" ~/.karmyq/secrets/qa/rotation-audit.log
```

### Health Check Monitoring

After rotation, monitor service health:

```bash
# Check all services
for port in {3001..3008}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
  echo "Port $port: $status"
done

# Monitor logs for JWT warnings
docker-compose logs -f | grep "previous JWT secret"
```

## Security Best Practices

### ✅ DO

1. **Rotate secrets regularly** - Monthly minimum, quarterly recommended
2. **Use strong secrets** - Minimum 32 characters, 64 for JWT
3. **Monitor audit logs** - Review rotation events weekly
4. **Test rollback procedure** - Quarterly rollback drills
5. **Backup encryption keys** - Store `encryption.key` in secure vault
6. **Limit grace period** - 24 hours maximum for JWT rotation
7. **Use separate secrets per environment** - Dev, QA, Prod

### ❌ DON'T

1. **Never commit `.env` files** - Always in `.gitignore`
2. **Never share encryption keys** - Each server has unique key
3. **Never disable rotation** - Security risk if secrets never change
4. **Never skip health checks** - Always validate after rotation
5. **Never automate production rotation** - Always manual for prod
6. **Never extend grace period indefinitely** - Time-bound only

## Compliance & Auditing

### SOC 2 Compliance

This secrets management system supports SOC 2 requirements:

- **CC6.1** - Logical and physical access controls
- **CC6.2** - Prior to issuing system credentials, identify and authenticate users
- **CC6.7** - System is designed to restrict access to system configurations

### Audit Evidence

All rotation events are logged with:
- Timestamp (ISO 8601 UTC)
- Action performed (rotation, rollback, validation)
- Environment (qa, production)
- Success/failure status

**Audit log format:**
```
[2025-01-25T14:30:22Z] JWT secret rotated (dual-key active for grace period)
[2025-01-25T14:30:25Z] PostgreSQL password rotated
[2025-01-25T14:30:28Z] All services restarted with new secrets
[2025-01-25T14:30:45Z] Rotation validated - all services healthy
```

## Troubleshooting

### Rotation Fails - Services Won't Start

**Symptoms:** Health checks fail after rotation

**Solution:**
```bash
# 1. Check service logs
docker-compose -f infrastructure/docker/docker-compose.qa.yml logs

# 2. Verify secrets are loaded
docker-compose -f infrastructure/docker/docker-compose.qa.yml exec auth-service env | grep JWT_SECRET

# 3. Rollback if necessary
./scripts/secrets-rollback.sh qa latest
```

### Old Tokens Still Valid After 24h

**Symptoms:** JWT_SECRET_PREVIOUS tokens accepted beyond grace period

**Solution:**
```bash
# Remove JWT_SECRET_PREVIOUS from .env
nano ~/.karmyq/secrets/qa/.env
# Delete or comment out: JWT_SECRET_PREVIOUS=...

# Restart services
docker-compose -f infrastructure/docker/docker-compose.qa.yml restart
```

### Database Connection Failures

**Symptoms:** Services can't connect to PostgreSQL after rotation

**Solution:**
```bash
# 1. Verify database password was updated
docker exec karmyq-qa-postgres psql -U karmyq_user -d karmyq_db -c "SELECT 1"

# 2. Check environment variable
echo $POSTGRES_PASSWORD

# 3. Manually update if needed
docker exec karmyq-qa-postgres psql -U karmyq_user -d karmyq_db -c \
  "ALTER USER karmyq_user WITH PASSWORD 'your_password';"
```

### Encryption Key Lost

**Symptoms:** Cannot decrypt secrets, `openssl` errors

**Solution:**
```bash
# If encryption key is lost, all encrypted secrets are unrecoverable
# You must generate new secrets and re-deploy

# 1. Generate new encryption key
openssl rand -base64 32 > ~/.karmyq/encryption.key
chmod 600 ~/.karmyq/encryption.key

# 2. Rotate all secrets (will create new encrypted files)
./scripts/secrets-rotate.sh qa

# 3. Update all services
docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d --force-recreate
```

**Prevention:** Backup `~/.karmyq/encryption.key` to secure vault (1Password, HashiCorp Vault, AWS Secrets Manager)

## Backup & Disaster Recovery

### Backup Strategy

**What to backup:**
1. Encryption key: `~/.karmyq/encryption.key`
2. Current secrets: `~/.karmyq/secrets/{env}/*.enc`
3. Audit logs: `~/.karmyq/secrets/{env}/rotation-audit.log`

**Backup schedule:**
- Before each rotation
- Automated daily backups
- Off-site storage for production

### Recovery Procedure

**Scenario: Server hardware failure**

1. Provision new server
2. Restore encryption key from backup
3. Restore encrypted secrets from backup
4. Deploy application
5. Decrypt and load secrets
6. Validate health checks

**Scenario: Accidental deletion**

1. List available backups: `./scripts/secrets-rollback.sh qa`
2. Select most recent backup
3. Rollback: `./scripts/secrets-rollback.sh qa latest`
4. Validate services

## Advanced Topics

### Multi-Environment Secrets

Manage separate secrets for each environment:

```bash
# Development
./scripts/secrets-rotate.sh dev

# QA
./scripts/secrets-rotate.sh qa

# Staging
./scripts/secrets-rotate.sh staging

# Production
./scripts/secrets-rotate.sh production
```

### Custom Rotation Schedules

Different secrets have different rotation requirements:

| Secret Type | Rotation Frequency | Rationale |
|-------------|-------------------|-----------|
| JWT_SECRET | Monthly | Tokens are short-lived (24h max) |
| POSTGRES_PASSWORD | Quarterly | Infrequent direct access |
| API Keys | As needed | When leaked or compromised |
| Encryption Key | Annually | Requires re-encryption of all secrets |

### Integration with Secret Managers

For production, integrate with enterprise secret managers:

**HashiCorp Vault:**
```bash
# Store secrets in Vault
vault kv put secret/karmyq/qa \
  jwt_secret="$(openssl rand -base64 64)" \
  postgres_password="$(openssl rand -base64 32)"

# Retrieve secrets
export JWT_SECRET=$(vault kv get -field=jwt_secret secret/karmyq/qa)
export POSTGRES_PASSWORD=$(vault kv get -field=postgres_password secret/karmyq/qa)
```

**AWS Secrets Manager:**
```bash
# Store secrets
aws secretsmanager create-secret \
  --name karmyq/qa/jwt_secret \
  --secret-string "$(openssl rand -base64 64)"

# Retrieve secrets
export JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id karmyq/qa/jwt_secret \
  --query SecretString \
  --output text)
```

---

**Version:** 5.2.0
**Last Updated:** November 2025
**Security Contact:** security@karmyq.com (update with your email)

