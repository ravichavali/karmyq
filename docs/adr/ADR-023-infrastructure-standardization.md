# ADR-023: Infrastructure Standardization and Environment Management

**Date**: 2026-01-09
**Status**: Accepted
**Deciders**: Development Team
**Related**: ADR-004 (Microservices), ADR-013 (Monorepo), DEVELOPMENT_PROCESS.md

## Context

During deployment of the simulation service to production (January 2026), we encountered several critical issues stemming from inconsistent infrastructure configuration across environments:

### Current Situation

1. **Database Naming Inconsistencies**:
   - Development: `karmyq_db` (database) with `karmyq_user` (owner)
   - Production: `karmyq_prod` (database) with `karmyq_prod` (owner)
   - Staging: Unknown/inconsistent
   - Different naming patterns make scripts, documentation, and automation brittle

2. **Path Differences**:
   - Production: `/home/ubuntu/karmyq`
   - Staging: `/home/karmyq/karmyq`
   - No consistent pattern across environments

3. **Configuration Management Issues**:
   - Environment-specific files (`.env.production.users`) deleted by `git clean -fd`
   - No clear separation between version-controlled config and environment secrets
   - Deployment process required manual recreation of credentials

4. **Docker Compose Variations**:
   - Different compose files for each environment
   - No standardized approach to environment-specific overrides
   - Configuration drift between environments

### Problems Encountered

During simulation service deployment:
- Lost user credentials file after running `git clean -fd` (untracked files deleted)
- Database connection strings hardcoded with environment-specific names
- Confusion about which paths to use for different servers
- Manual intervention required to recreate simulated users
- No automated validation of environment parity

### Requirements

1. **Predictability**: Deployments should be repeatable and consistent
2. **Safety**: Environment-specific secrets should survive git operations
3. **Clarity**: Team should immediately understand environment differences
4. **Automation**: Reduce manual steps in deployment process
5. **Documentation**: Environment setup should be self-documenting

## Decision

We will standardize infrastructure configuration across all environments using these principles:

### 1. Standardized Database Naming

**Pattern**: `karmyq_{env}` for database, `karmyq_user` for owner (consistent across all environments)

- Development: `karmyq_dev` / `karmyq_user`
- Staging: `karmyq_staging` / `karmyq_user`
- Production: `karmyq_production` / `karmyq_user`

**Rationale**:
- Single consistent user simplifies permission management
- Environment suffix makes purpose explicit
- Follows industry standard pattern (Heroku, AWS RDS, etc.)

### 2. Standardized Directory Structure

**Pattern**: `/opt/karmyq/{env}` for all deployments

- Development: Local development uses project root
- Staging: `/opt/karmyq/staging`
- Production: `/opt/karmyq/production`

**Rationale**:
- `/opt` is standard location for optional application software
- Clear separation of environments on same machine (if needed)
- Predictable paths for scripts, logs, backups

### 3. Environment Configuration Management

**Strategy**: Three-tier configuration system

1. **Version-Controlled Base** (`.env.example`, `config.template.ts`):
   - Structure and documentation of required variables
   - Safe to commit to git
   - Used for validation and initialization

2. **Environment-Specific Secrets** (`.env.{env}`, `.env.{env}.users`):
   - Stored in `/opt/karmyq/secrets/{env}/`
   - Symlinked into application directory
   - NEVER in git working directory (prevents accidental deletion)
   - Backed up separately

3. **Runtime Configuration** (loaded at startup):
   - Applications load from symlinked files
   - Fail fast with clear errors if configuration missing
   - Log configuration source (but never values)

**Directory Structure**:
```
/opt/karmyq/
├── production/
│   └── karmyq/           # Git repository
│       └── .env.production -> /opt/karmyq/secrets/production/.env
├── staging/
│   └── karmyq/           # Git repository
│       └── .env.staging -> /opt/karmyq/secrets/staging/.env
└── secrets/
    ├── production/
    │   ├── .env
    │   ├── .env.production.users
    │   └── backup/       # Automated backups
    └── staging/
        ├── .env
        ├── .env.staging.users
        └── backup/
```

### 4. Deployment Process Standardization

**Standardized Deployment Script** (`scripts/deploy.sh`):

```bash
#!/bin/bash
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENV=$1
BASE_DIR="/opt/karmyq/${ENV}"
SECRETS_DIR="/opt/karmyq/secrets/${ENV}"

# Validate environment
if [[ ! "$ENV" =~ ^(staging|production)$ ]]; then
    echo "Usage: $0 [staging|production]"
    exit 1
fi

# Pull latest code
cd "${BASE_DIR}/karmyq"
git pull origin master

# Install dependencies (preserves node_modules)
npm ci

# Build services
npm run build

# Symlink secrets (idempotent)
ln -sf "${SECRETS_DIR}/.env" .env.${ENV}
ln -sf "${SECRETS_DIR}/.env.${ENV}.users" .env.${ENV}.users

# Restart services
pm2 restart ecosystem.config.js --only simulation-service

# Health check
sleep 5
pm2 logs simulation-service --lines 50 --nostream | grep -q "Simulation service started" || {
    echo "ERROR: Service failed to start"
    exit 1
}

echo "Deployment to ${ENV} completed successfully"
```

### 5. Environment Validation

**Pre-deployment Checklist** (automated in `scripts/validate-env.sh`):

- [ ] Database name matches pattern `karmyq_{env}`
- [ ] Database user is `karmyq_user`
- [ ] Required secrets exist in `/opt/karmyq/secrets/{env}/`
- [ ] Secrets are symlinked into application directory
- [ ] Docker compose file matches environment
- [ ] PM2 ecosystem config matches environment
- [ ] All required environment variables present
- [ ] Database connection successful
- [ ] Redis connection successful

### 6. Documentation Requirements

Each environment must have:

1. **Environment README** (`docs/environments/{env}/README.md`):
   - Server details (hostname, IP, SSH key)
   - Database configuration
   - File locations
   - Access procedures
   - Backup procedures

2. **Runbook** (`docs/environments/{env}/RUNBOOK.md`):
   - Deployment procedure
   - Rollback procedure
   - Common issues and resolutions
   - Monitoring and alerts
   - Emergency contacts

## Consequences

### Positive Consequences

1. **Predictable Deployments**: Same commands work across all environments
2. **Reduced Errors**: Standardization eliminates entire classes of environment-specific bugs
3. **Faster Onboarding**: New team members can understand environment structure immediately
4. **Safer Operations**: Secrets protected from git operations
5. **Better Automation**: Consistent structure enables reliable CI/CD
6. **Clearer Debugging**: Logs, paths, and configurations follow predictable patterns
7. **Easier Testing**: Can validate environment parity programmatically

### Negative Consequences

1. **Migration Effort**: Need to migrate existing production/staging to new structure
2. **Breaking Changes**: Scripts and documentation referencing old paths must be updated
3. **Downtime Required**: Database rename and path migration require brief outage
4. **Learning Curve**: Team must learn new conventions
5. **Tooling Updates**: CI/CD pipelines, backup scripts, monitoring configs need updates

### Neutral Consequences

1. **More Explicit Configuration**: What was implicit is now explicit (clearer but more verbose)
2. **Shifted Responsibility**: Operations become more formal (good for production, potentially overkill for dev)
3. **Different Mental Model**: From "servers have different configs" to "environments are standardized instances"

## Alternatives Considered

### Alternative 1: Environment-Specific Branches

**Description**: Maintain separate git branches for each environment (`dev`, `staging`, `production`) with environment-specific configuration committed.

**Pros**:
- Simple to understand
- Configuration always in sync with code
- No external dependencies

**Cons**:
- Secrets in version control (security risk)
- Merge conflicts on every deployment
- Difficult to keep branches in sync
- Can't easily promote exact code between environments

**Why Rejected**: Secrets in git is a non-starter for production systems. Merge overhead increases operational burden significantly.

### Alternative 2: Configuration Service (Vault, Consul, etc.)

**Description**: Use external configuration management service like HashiCorp Vault or AWS Parameter Store to manage all environment configuration.

**Pros**:
- Industry standard solution
- Excellent secret management
- Audit trails and access control
- Dynamic secret rotation
- Multi-environment support built-in

**Cons**:
- Additional infrastructure to maintain
- Increased complexity for small team
- Network dependency for application startup
- Learning curve for new tool
- Cost for hosted solutions

**Why Rejected**: While technically superior, introduces operational overhead disproportionate to team size and current scale. Good future migration path as team/scale grows.

### Alternative 3: Docker Secrets + Swarm

**Description**: Use Docker Swarm with built-in secrets management.

**Pros**:
- Docker-native solution
- Good secrets management
- Integrated with orchestration
- No additional tools

**Cons**:
- Locks us into Docker Swarm (vs. other orchestrators)
- Requires Swarm mode (we're using docker-compose)
- More complex than current deployment
- Overkill for single-node deployments

**Why Rejected**: We're not using container orchestration yet. When we scale to multiple nodes, we'll likely choose Kubernetes over Swarm, making this investment wasted.

### Alternative 4: Status Quo + Documentation

**Description**: Keep current environment-specific configurations but document them thoroughly.

**Pros**:
- No migration required
- No breaking changes
- Team already familiar with current approach

**Cons**:
- Doesn't solve the root problems
- Documentation becomes outdated
- Requires constant vigilance
- Error-prone manual processes remain

**Why Rejected**: Documentation alone doesn't prevent the errors we've experienced. The problems are structural and require structural solutions.

## Implementation Notes

### Migration Path

**Phase 1: Staging Environment** (Week 1)
1. Create `/opt/karmyq/secrets/staging/` directory structure
2. Backup current `.env` files
3. Create new database `karmyq_staging` alongside `karmyq_prod`
4. Migrate data using `pg_dump` / `pg_restore`
5. Update connection strings
6. Test thoroughly
7. Switch traffic to new database
8. Decommission old database after 7 days

**Phase 2: Production Environment** (Week 2, after staging validation)
1. Same steps as staging
2. Require change approval
3. Schedule during low-traffic window
4. Have rollback plan ready
5. Extended monitoring period

**Phase 3: Development Environment** (Week 3)
1. Update docker-compose.yml with new database name
2. Create migration script for developers
3. Update documentation
4. Team meeting to walk through changes

**Phase 4: Automation & Validation** (Week 4)
1. Implement deployment scripts
2. Implement validation scripts
3. Update CI/CD pipelines
4. Create environment runbooks
5. Conduct deployment drill

### Files Affected

**Infrastructure**:
- `infrastructure/docker/docker-compose.yml`
- `infrastructure/docker/docker-compose.staging.yml`
- `infrastructure/docker/docker-compose.production.yml`
- `infrastructure/postgres/init.sql`

**Configuration**:
- All service `.env.example` files
- All service database connection strings
- PM2 ecosystem configs

**Scripts**:
- `scripts/deploy.sh` (new)
- `scripts/validate-env.sh` (new)
- `scripts/setup-secrets.sh` (new)
- Any existing deployment scripts

**Documentation**:
- `docs/environments/` (new directory)
- `docs/DEPLOYMENT.md`
- `README.md` (environment setup section)
- Service READMEs (database connection info)

### Rollback Strategy

Each migration step has a rollback procedure:

1. **Database Migration**: Keep old database running alongside new for 7 days, can switch connection string back
2. **Path Migration**: Old paths preserved until new paths validated (30 days)
3. **Secrets Migration**: Backups automated before any changes
4. **Service Updates**: Blue-green deployment pattern (old version running until new validated)

### Testing Strategy

Before declaring migration complete:

1. **Functional Testing**: All API endpoints return expected results
2. **Integration Testing**: Run full integration test suite
3. **Load Testing**: Confirm performance matches pre-migration baseline
4. **Failure Testing**: Simulate failures (database down, missing secrets) and verify error handling
5. **Deployment Testing**: Perform full deployment from scratch on test environment

## References

- **Incident**: Simulation service deployment January 2026 (lost credentials, database naming confusion)
- **Related Discussions**: User feedback: "We probably shouldn't call this db Karmyq_prod and the owner karmyq_prod. This feels like a bad pattern."
- **Industry Standards**:
  - [Twelve-Factor App - Config](https://12factor.net/config)
  - [Twelve-Factor App - Dev/Prod Parity](https://12factor.net/dev-prod-parity)
- **Tools**:
  - [PM2 Ecosystem Config](https://pm2.keymetrics.io/docs/usage/application-declaration/)
  - [PostgreSQL Naming Conventions](https://www.postgresql.org/docs/current/ddl-schemas.html)
- **Process Documents**:
  - [DEVELOPMENT_PROCESS.md](../DEVELOPMENT_PROCESS.md)
  - [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)

## Connection to Development Process

This ADR emphasizes our **tangent management process** by documenting lessons learned:

1. **Recognition**: During deployment, we recognized infrastructure inconsistency as a tangent from the primary simulation service work
2. **Documentation**: Instead of immediately fixing all environments, we documented the issue as an ADR (this document)
3. **Prioritization**: Allows deliberate decision about when to address standardization vs. continuing feature work
4. **Communication**: Makes the technical debt visible and provides implementation plan when we prioritize it

This ADR serves as an example of how we handle tangents: recognize them, document them thoroughly, and make conscious decisions about when to address them rather than getting pulled off course during feature development.
