# Karmyq Scripts

This directory contains utility scripts for managing the Karmyq platform.

## Available Scripts

### 🌱 Data Management

#### `seed-test-data.js`
Seeds the database with comprehensive test data for development and testing.

**Usage:**
```bash
cd scripts
npm install
npm run seed
```

**What it creates:**
- 2000 test users across 40 US cities
- 200 communities (24 categories)
- 7500+ community memberships
- 400+ help requests
- 7200+ karma records

**Test Credentials:**
- Email: `james.smith42@gmail.com` (or any generated email)
- Password: `password123`

📖 **Full Documentation:** See detailed README in this file (scroll down)

### 🚀 Deployment

#### `deploy-qa.sh`
Deploys the application to the QA environment on Ubuntu server.

**Usage:**
```bash
export QA_SERVER_HOST=192.168.1.100
export QA_SERVER_USER=karmyq
./deploy-qa.sh
```

**What it does:**
- SSH into QA server
- Pull latest code from git
- Build Docker images
- Deploy services with docker-compose
- Run comprehensive health checks

### 🔐 Secrets Management

#### `secrets-rotate.sh`
Enterprise-grade secrets rotation with zero-downtime updates.

**Usage:**
```bash
# Interactive rotation
./secrets-rotate.sh qa

# Dry run (preview changes)
./secrets-rotate.sh qa --dry-run

# Production
./secrets-rotate.sh production
```

**What it does:**
- Backs up current secrets
- Generates new JWT_SECRET (64 chars) and POSTGRES_PASSWORD (32 chars)
- Encrypts with AES-256-CBC
- Updates database password
- Performs rolling restart
- Validates health checks
- Logs to audit trail

**Output:**
- `~/.karmyq/secrets/{env}/jwt_secret.enc` - Encrypted current JWT
- `~/.karmyq/secrets/{env}/jwt_secret_previous.enc` - Encrypted previous JWT (24h grace)
- `~/.karmyq/secrets/{env}/postgres_password.enc` - Encrypted DB password
- `~/.karmyq/secrets/{env}/.env` - Decrypted environment file
- `~/.karmyq/secrets/{env}/rotation-audit.log` - Audit trail
- `~/.karmyq/secrets/{env}/backups/{timestamp}/` - Backup directory

#### `secrets-rollback.sh`
Rollback to previous secrets if rotation fails.

**Usage:**
```bash
# Interactive (select backup)
./secrets-rollback.sh qa

# Specific backup
./secrets-rollback.sh qa 20250125_143022

# Latest backup
./secrets-rollback.sh qa latest
```

**What it does:**
- Lists available backups
- Restores selected secrets
- Regenerates `.env` file
- Updates database password
- Restarts services
- Validates health checks

**Security Features:**
- ✅ Zero-downtime JWT rotation (dual-key, 24h grace period)
- ✅ AES-256-CBC encryption at rest
- ✅ Automated backup before rotation
- ✅ Comprehensive audit logging
- ✅ Health validation after changes
- ✅ Rollback capability

📖 **Full Documentation:** [../docs/secrets-management.md](../docs/secrets-management.md)

---

## Detailed Documentation

### Test Data Generator

This script generates realistic test data for the Karmyq platform with national distribution across the United States.

#### What It Creates

**📊 Data Generated:**
- **2,000 Users** - Distributed across 40 major US cities
- **200 Communities** - Various types (Neighborhood, Professional, Interest, Support, Education, Civic)
- **~10,000 Memberships** - Each user joins 2-8 communities (preferring local/regional)
- **~300 Help Requests** - 10% of users create 1-3 requests each
- **~1,800 Karma Records** - 30% of active users have karma history

**🗺️ Geographic Distribution:**

Communities and users are distributed across 40 major US cities covering all regions:
- **Northeast**: New York, Philadelphia, Boston
- **South**: Houston, San Antonio, Dallas, Austin, Miami, Atlanta, Charlotte, Nashville, Memphis
- **Midwest**: Chicago, Columbus, Indianapolis, Detroit, Milwaukee, Kansas City, Omaha, Minneapolis
- **West**: Los Angeles, Phoenix, San Diego, San Jose, San Francisco, Seattle, Denver, Portland, Las Vegas

**🏘️ Community Types (24 Categories):**
- **Neighborhood**: Local Help, Community Events, Safety Watch, Garden Share
- **Professional**: Tech Support, Career Mentoring, Freelance Network, Business Connect
- **Interest**: Book Club, Gaming Group, Fitness Buddies, Food Enthusiasts
- **Support**: Mental Health, Parents Support, Pet Care, Senior Care
- **Education**: Study Group, Language Exchange, Skill Share, Tutoring Network
- **Civic**: Volunteer Corps, Political Action, Environmental, Public Services

**👥 User Characteristics:**
- Realistic names from US census data (100 first names, 100 last names)
- Email addresses with common providers (Gmail, Yahoo, Outlook, Hotmail, iCloud)
- Location data (City, State)
- Default password: `password123` (hashed with bcrypt)

#### Prerequisites

1. **PostgreSQL database** must be running (via Docker Compose)
2. **Database schemas** must be initialized (auth, communities, requests, reputation)

#### Installation

```bash
cd scripts
npm install
```

#### Usage

**Basic Usage (with Docker Compose running):**

```bash
cd scripts
npm run seed
```

**Custom Database Connection:**

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=karmyq_db
export POSTGRES_USER=karmyq_user
export POSTGRES_PASSWORD=karmyq_password_dev

npm run seed
```

**Full Setup from Scratch:**

```bash
# 1. Start Docker services
cd infrastructure/docker
docker-compose up -d

# 2. Wait for database to be ready
sleep 10

# 3. Run seed script
cd ../../scripts
npm install
npm run seed
```

#### Test Credentials

After seeding, you can log in with any generated user:

**Email Format**: `firstname.lastnameNNN@provider.com`
- Examples: `james.smith42@gmail.com`, `mary.johnson123@yahoo.com`

**Password**: `password123` (for all test users)

#### Cleanup

To remove all test data and start fresh:

```bash
# Option 1: Truncate tables (preserves schema)
psql -U karmyq_user -d karmyq_db << EOF
TRUNCATE TABLE reputation.karma_records CASCADE;
TRUNCATE TABLE requests.help_requests CASCADE;
TRUNCATE TABLE communities.memberships CASCADE;
TRUNCATE TABLE communities.communities CASCADE;
TRUNCATE TABLE auth.users CASCADE;
EOF

# Option 2: Reset entire database
cd infrastructure/docker
docker-compose down -v
docker-compose up -d
# Wait for database init, then run seed script
```

---

**Version:** 5.2.0
**Last Updated:** November 2025
