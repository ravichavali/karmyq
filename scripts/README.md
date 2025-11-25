# Karmyq Test Data Generator

This script generates realistic test data for the Karmyq platform with national distribution across the United States.

## What It Creates

### 📊 Data Generated
- **2,000 Users** - Distributed across 40 major US cities
- **200 Communities** - Various types (Neighborhood, Professional, Interest, Support, Education, Civic)
- **~10,000 Memberships** - Each user joins 2-8 communities (preferring local/regional)
- **~300 Help Requests** - 10% of users create 1-3 requests each
- **~1,800 Karma Records** - 30% of active users have karma history

### 🗺️ Geographic Distribution

Communities and users are distributed across 40 major US cities covering all regions:
- **Northeast**: New York, Philadelphia, Boston
- **South**: Houston, San Antonio, Dallas, Austin, Miami, Atlanta, Charlotte, Nashville, Memphis
- **Midwest**: Chicago, Columbus, Indianapolis, Detroit, Milwaukee, Kansas City, Omaha, Minneapolis
- **West**: Los Angeles, Phoenix, San Diego, San Jose, San Francisco, Seattle, Denver, Portland, Las Vegas

### 🏘️ Community Types

**24 Different Categories:**
- **Neighborhood**: Local Help, Community Events, Safety Watch, Garden Share
- **Professional**: Tech Support, Career Mentoring, Freelance Network, Business Connect
- **Interest**: Book Club, Gaming Group, Fitness Buddies, Food Enthusiasts
- **Support**: Mental Health, Parents Support, Pet Care, Senior Care
- **Education**: Study Group, Language Exchange, Skill Share, Tutoring Network
- **Civic**: Volunteer Corps, Political Action, Environmental, Public Services

### 👥 User Characteristics
- Realistic names from US census data (100 first names, 100 last names)
- Email addresses with common providers (Gmail, Yahoo, Outlook, Hotmail, iCloud)
- Location data (City, State)
- Default password: `password123` (hashed with bcrypt)

## Prerequisites

1. **PostgreSQL database** must be running (via Docker Compose)
2. **Database schemas** must be initialized (auth, communities, requests, reputation)

## Installation

```bash
cd scripts
npm install
```

## Usage

### Basic Usage (with Docker Compose running)

```bash
cd scripts
npm run seed
```

### Custom Database Connection

Set environment variables before running:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=karmyq
export POSTGRES_USER=karmyq
export POSTGRES_PASSWORD=karmyq

npm run seed
```

### Full Setup from Scratch

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

## Test Credentials

After seeding, you can log in with any generated user:

**Email Format**: `firstname.lastnameNNN@provider.com`
- Examples: `james.smith42@gmail.com`, `mary.johnson123@yahoo.com`

**Password**: `password123` (for all test users)

## Data Distribution Logic

### User-Community Matching
- Users **prefer communities from their own city** (highest priority)
- If no local communities, they join **regional communities** (same state)
- Fallback to **any available community** nationwide
- Each user joins **2-8 communities** randomly

### Community Capacity
- Communities have **max_members** between 20-200
- 70% are **public**, 30% are **private**
- Membership stops when community reaches capacity

### Help Requests
- Created by **10% of users** (most active members)
- Each creator posts **1-3 requests**
- Status distribution:
  - 30% completed
  - 20% matched
  - 50% open
- Created within **last 30 days**

### Karma Distribution
- **30% of users** have karma records
- Each active user has **1-5 karma records** per community
- Points: **5, 10, 15, or 20** per record
- Reasons: "Helped a community member", "First time helping", etc.

## Output Example

```
🌱 Starting test data generation...

👥 Creating 2000 test users...
   Created 200/2000 users...
   Created 400/2000 users...
   ...
✅ Created 2000 users

🏘️  Creating 200 communities...
   Created 50/200 communities...
   Created 100/200 communities...
   ...
✅ Created 200 communities

🤝 Adding community memberships...
   Processed 200/2000 users...
   Processed 400/2000 users...
   ...
✅ Created 9847 memberships

📝 Creating help requests...
✅ Created 312 help requests

⭐ Generating karma records...
✅ Created 1823 karma records

🎉 Test data generation complete!

📊 Summary:
   - Users: 2000
   - Communities: 200
   - Memberships: 9847
   - Help Requests: 312
   - Karma Records: 1823

✨ All test data has been seeded successfully!

🔐 Test user credentials:
   Email: Any email from generated users
   Password: password123
```

## Cleanup

To remove all test data and start fresh:

```bash
# Connect to database
psql -U karmyq -d karmyq

# Truncate tables (preserves schema)
TRUNCATE TABLE reputation.karma_records CASCADE;
TRUNCATE TABLE requests.help_requests CASCADE;
TRUNCATE TABLE communities.memberships CASCADE;
TRUNCATE TABLE communities.communities CASCADE;
TRUNCATE TABLE auth.users CASCADE;
```

Or reset the entire database:

```bash
cd infrastructure/docker
docker-compose down -v
docker-compose up -d
# Wait for database init, then run seed script
```

## Future Enhancements

When switching to a global model:
- Add international cities data
- Support multiple languages
- Add timezone information
- Include country codes
- Localize community categories

## Notes

- Script uses **transactions** - if anything fails, all changes are rolled back
- Safe to run **multiple times** (will create duplicates, not recommended)
- Takes approximately **2-5 minutes** to complete depending on hardware
- Uses **bcrypt** for password hashing (same as production)
- **Idempotent** for most operations (except user creation uses unique emails)
