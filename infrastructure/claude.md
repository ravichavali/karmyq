# Infrastructure Directory

## Overview
Docker configuration, database schemas, and observability setup.

## Key Files

### docker/
- `docker-compose.yml` - Main orchestration (all services + dependencies)
- `docker-compose.test.yml` - Test environment configuration

### postgres/
- `init.sql` - Complete database schema with all tables, indexes, and RLS policies
- `migrations/` - Incremental migration scripts

### Database Schemas
PostgreSQL uses separate schemas for isolation:
```sql
-- Schemas
auth        -- users, sessions
community   -- communities, memberships, norms, settings
requests    -- help_requests, offers, matches
reputation  -- karma_records, trust_scores, badges
notifications -- notifications, preferences
messaging   -- conversations, messages, participants
```

### Key Tables Reference
```sql
-- Users
auth.users (id, email, password_hash, name, created_at)
auth.sessions (id, user_id, token, expires_at)

-- Communities
community.communities (id, name, description, creator_id, settings)
community.memberships (id, community_id, user_id, role, status)
community.settings (community_id, request_ttl_days, karma_decay_enabled, etc.)

-- Requests
requests.help_requests (id, community_id, requester_id, title, category, status, expires_at)
requests.offers (id, community_id, offerer_id, title, skills, expires_at)
requests.matches (id, request_id, responder_id, status, completed_at)
```

## Observability Stack

### grafana/
Grafana dashboards and datasource provisioning

### prometheus/
- `prometheus.yml` - Metrics scraping config

### loki/
- `loki-config.yml` - Log aggregation config
- `promtail-config.yml` - Log shipping config

## Docker Commands
```bash
# Full stack
docker-compose up -d

# Rebuild specific service
docker-compose up -d --build auth-service

# View logs
docker-compose logs -f service-name

# Reset database
docker-compose down -v
docker-compose up -d
```
