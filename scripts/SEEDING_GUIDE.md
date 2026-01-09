# Karmyq Data Seeding Guide

**Last Updated**: 2026-01-08

---

## 🎯 Quick Reference

| Approach | Script | Speed | Use Case |
|----------|--------|-------|----------|
| DB-based | [seed-test-data.js](seed-test-data.js) | ⚡ Fastest | Local dev, quick resets |
| API-based | [populate-fresh-database.js](populate-fresh-database.js) | 🐢 Slower | Test API layer, realistic flow |
| Config-based | tests/scripts/seed-data.ts | ⚙️ Configurable | Production, staging profiles |

---

## 1️⃣ DB-Based Seeding (Development)

**Script**: [scripts/seed-test-data.js](seed-test-data.js)

**How it works**: Direct SQL via `pg` Pool - bypasses API layer

**Speed**: ⚡ Fastest (~5-10 seconds)

**Usage**:
```bash
node scripts/seed-test-data.js
```

**Creates**:
- 3 test users (alice, bob, charlie)
- 2 communities
- Sample requests, offers, messages
- Direct database inserts

**When to use**:
- Quick local development
- After `truncate-database`
- When you need data FAST

---

## 2️⃣ API-Based Seeding (Testing)

**Script**: [scripts/populate-fresh-database.js](populate-fresh-database.js)

**How it works**: HTTP requests to service APIs (auth, community, request, etc.)

**Speed**: 🐢 Slower (~30-60 seconds)

**Usage**:
```bash
node scripts/populate-fresh-database.js
```

**Creates**:
- 8 test users (alice through henry)
- 3 communities
- Requests, offers, messages
- Via API calls (tests entire flow)

**When to use**:
- Testing API layer
- Realistic data flow through services
- Integration testing
- When you want to verify APIs work correctly

---

## 3️⃣ Config-Based Seeding (Production)

**Script**: tests/scripts/seed-data.ts

**How it works**: Configuration-driven seeding with environment profiles

**Speed**: ⚙️ Configurable (depends on profile)

**Profiles**:
- `quick` - Minimal data for quick tests
- `staging` - Staging environment data
- `production` - Large-scale realistic data

**Usage**:

### Local (Direct)
```bash
cd tests
npm run seed                    # Default profile
npm run seed:quick             # Quick profile
npm run seed:staging           # Staging profile
npm run seed:production        # Production profile
```

### Production Server (Recommended)
```bash
# Run in detached screen session (best for long-running)
./scripts/seed-production-screen.sh

# Creates screen session named 'seed-production'
# To reattach: screen -r seed-production
# To detach: Ctrl+A, then D
```

### From Local Machine to Production (SSH)
```bash
# Mac/Linux
./scripts/seed-production-remote.sh

# Windows
.\scripts\seed-production-remote.ps1
```

### Other Production Options
```bash
./scripts/seed-production-data.sh      # Basic wrapper
./scripts/seed-production-local.sh     # On production server directly
```

**When to use**:
- Production environment seeding
- Staging environment setup
- Large-scale data generation
- Configurable profiles for different environments

---

## 🔄 Typical Workflows

### Starting Fresh Locally
```bash
# 1. Clear database
scripts\truncate-database.bat   # Windows
./scripts/truncate-database.sh  # Mac/Linux

# 2. Seed with test data (choose one)
node scripts/seed-test-data.js              # Fast (DB-based)
node scripts/populate-fresh-database.js     # Slower (API-based)
```

### Testing API Layer
```bash
# 1. Clear database
./scripts/truncate-database.sh

# 2. Seed via API to test services
node scripts/populate-fresh-database.js

# 3. Run integration tests
npm test
```

### Production/Staging Setup
```bash
# SSH to server
ssh user@production-server

# Run in screen (recommended)
cd /path/to/karmyq
./scripts/seed-production-screen.sh

# Or use remote script from local machine
./scripts/seed-production-remote.sh
```

---

## 📊 Data Comparison

| Data Type | DB-based | API-based | Production |
|-----------|----------|-----------|------------|
| Users | 3 | 8 | Configurable (100-2000+) |
| Communities | 2 | 3 | Configurable (5-20+) |
| Requests | ~10 | ~15 | Configurable (100-1000+) |
| Speed | 5-10s | 30-60s | 5-60 min |
| Realism | Basic | High | Very High |

---

## 🔍 Which Script Should I Use?

### Use DB-based (seed-test-data.js) when:
- ✅ You need data quickly during development
- ✅ You're testing business logic (not API layer)
- ✅ You want to reset database frequently
- ✅ Speed is priority

### Use API-based (populate-fresh-database.js) when:
- ✅ You're testing API endpoints
- ✅ You want realistic data flow through services
- ✅ You're doing integration testing
- ✅ You want to verify authentication/authorization works

### Use Config-based (production scripts) when:
- ✅ Setting up production/staging environments
- ✅ You need configurable data volumes
- ✅ You want environment-specific profiles
- ✅ You need large-scale data (100s-1000s of records)

---

## 🚨 Important Notes

1. **Always truncate first**: Clear database before seeding to avoid duplicates
2. **Production scripts use screen**: They run in detached sessions for long operations
3. **All scripts are idempotent**: Safe to run multiple times (with truncate)
4. **Check docker first**: Ensure services are running (`docker-compose ps`)
5. **Three approaches, all needed**: Each serves a different purpose

---

## 📚 Related Documentation

- [SCRIPTS_INVENTORY.md](SCRIPTS_INVENTORY.md) - Complete script inventory
- [CLEANUP_RECOMMENDATIONS.md](CLEANUP_RECOMMENDATIONS.md) - Cleanup status
- [README.md](README.md) - Scripts directory overview
- [docs/testing/LOCAL_TESTING.md](../docs/testing/LOCAL_TESTING.md) - Testing guide

---

**Questions?** Check the individual script files for detailed comments and usage.
