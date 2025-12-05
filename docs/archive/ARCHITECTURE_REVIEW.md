# Karmyq Architecture Review & Cleanup Plan
**Date**: November 25, 2025  
**Version**: 5.1.0

## Executive Summary

This document outlines the current architecture, identifies issues, and provides a cleanup and improvement plan for production readiness.

## Current Architecture

### Microservices (8 services)
1. **Auth Service** (3001) - User authentication & JWT
2. **Community Service** (3002) - Community management
3. **Request Service** (3003) - Help requests
4. **Reputation Service** (3004) - Karma & trust scores
5. **Notification Service** (3005) - Notifications & SSE
6. **Messaging Service** (3006) - Direct messages
7. **Feed Service** (3007) - Activity aggregation
8. **Cleanup Service** (3008) - Data expiration

### Frontend Applications
- **Web App** (3000) - Next.js 14
- **Mobile App** - React Native + Expo

### Infrastructure
- **PostgreSQL 15** - Multi-schema database
- **Redis** - Queue & cache
- **Docker Compose** - Container orchestration

## Issues Identified

### 🔴 Critical Issues

#### 1. Rate Limiting Too Aggressive
**Problem**: Hit rate limit with single user (100 req/min standard)  
**Impact**: Poor UX, can't handle 200 communities  
**Solution**: 
- Implement intelligent rate limiting per endpoint type
- Add request batching/pagination
- Cache responses properly
- Use different limits for read vs write operations

#### 2. No CI/CD Pipeline
**Problem**: Manual deployment process  
**Impact**: Error-prone, slow releases  
**Solution**: Setup GitHub Actions for automated testing and deployment

#### 3. Development Mode in Production Code
**Problem**: Rate limiting disabled via env var  
**Impact**: Security risk in production  
**Solution**: Proper environment-based configuration

### 🟡 Medium Priority Issues

#### 4. Archived Documentation Not Removed
**Location**: `docs/archive/` (9 files)  
**Impact**: Confusion, outdated info  
**Solution**: Remove archive folder, keep git history

#### 5. Temporary Scripts Not Cleaned
**Location**: `scripts/fix-category.js`, `scripts/fix-category2.js`  
**Impact**: Clutter  
**Solution**: Remove temporary fix scripts

#### 6. No Load Balancing
**Problem**: Single instance per service  
**Impact**: Can't scale horizontally  
**Solution**: Add load balancer configuration

#### 7. No Health Checks on All Services
**Problem**: Some services lack proper health endpoints  
**Impact**: Can't monitor service health  
**Solution**: Standardize health check endpoints

### 🟢 Low Priority Issues

#### 8. Mobile App Missing Screens
**Problem**: Request/message detail pages missing  
**Impact**: Incomplete UX  
**Solution**: Add missing screens (post-cleanup)

#### 9. No Monitoring/Observability
**Problem**: Grafana/Loki/Prometheus setup but not integrated  
**Impact**: Can't troubleshoot production issues  
**Solution**: Complete observability setup

## Cleanup Plan

### Phase 1: Remove Unnecessary Files (30 min)
- [ ] Delete `docs/archive/` folder
- [ ] Delete temp scripts: `fix-category.js`, `fix-category2.js`
- [ ] Delete `scripts/seed-output.log`
- [ ] Clean up unused mobile dependencies
- [ ] Review and remove old data scripts

### Phase 2: Fix Rate Limiting (1 hour)
- [ ] Implement tiered rate limiting strategy
- [ ] Add Redis-based distributed rate limiting
- [ ] Configure per-endpoint limits
- [ ] Add rate limit monitoring
- [ ] Document rate limit policies

### Phase 3: CI/CD Pipeline (2 hours)
- [ ] Create GitHub Actions workflows
- [ ] Setup automated testing
- [ ] Configure multi-environment deployment
- [ ] Add Docker registry integration
- [ ] Setup secrets management

### Phase 4: QA Environment Setup (1 hour)
- [ ] Create QA docker-compose configuration
- [ ] Setup environment variables for QA
- [ ] Document QA deployment process
- [ ] Create deployment scripts
- [ ] Setup database migration strategy

### Phase 5: Documentation Update (30 min)
- [ ] Update README with new architecture
- [ ] Document CI/CD process
- [ ] Create deployment runbook
- [ ] Update environment setup docs

## Scalability Improvements

### Rate Limiting Strategy

```yaml
Endpoint Types:
  Authentication:
    - Login: 5 req/15min per IP
    - Register: 3 req/15min per IP
    - Verify: 10 req/15min per user
  
  Read Operations (GET):
    - List: 300 req/min per user (with pagination)
    - Detail: 500 req/min per user
    - Search: 100 req/min per user
  
  Write Operations (POST/PUT/DELETE):
    - Create: 60 req/min per user
    - Update: 120 req/min per user
    - Delete: 30 req/min per user
  
  Real-time:
    - SSE connections: 10 concurrent per user
    - WebSocket: 5 concurrent per user
```

### Caching Strategy

```yaml
Cache Layers:
  1. Client-side: React Query (5min TTL)
  2. CDN: Static assets (1 year)
  3. Redis: API responses (1-5min TTL)
  4. Database: Query result cache
```

### Horizontal Scaling Plan

```yaml
Services to Scale:
  - Community Service: 3+ instances (high read)
  - Request Service: 3+ instances (high read/write)
  - Auth Service: 2+ instances (stateless)
  - Feed Service: 2+ instances (aggregation heavy)
  
Load Balancing:
  - Method: Round-robin with health checks
  - Tool: Nginx or Traefik
  - Health Check: /health endpoint (30s interval)
```

## Deployment Architecture

### Development (localhost)
```
Developer Machine:
├── Docker Compose
├── All 8 services
├── PostgreSQL + Redis
└── Web + Mobile apps
```

### QA (Ubuntu Server)
```
Ubuntu Server (192.168.x.x):
├── Docker Compose
├── All 8 services (QA build)
├── PostgreSQL (separate instance)
├── Redis (separate instance)
├── Nginx (reverse proxy)
└── SSL/TLS certificates
```

### Production (Future)
```
Cloud Infrastructure:
├── Kubernetes Cluster
│   ├── Service Pods (auto-scaling)
│   ├── Load Balancers
│   └── Ingress Controller
├── Managed PostgreSQL
├── Managed Redis
├── CDN (Cloudflare)
└── Monitoring Stack
```

## Timeline

**Total Estimated Time**: 5-6 hours

1. **Cleanup & Review** (1 hour) - Remove files, review code
2. **Rate Limiting Fix** (1.5 hours) - Implement proper limits
3. **CI/CD Setup** (2 hours) - GitHub Actions + deployment
4. **QA Environment** (1 hour) - Ubuntu server setup
5. **Documentation** (30 min) - Update all docs

## Success Criteria

- [ ] No archived/temporary files in repository
- [ ] Rate limiting handles 10+ concurrent users
- [ ] CI/CD pipeline deploys automatically
- [ ] QA environment accessible on Ubuntu server
- [ ] All services have health checks
- [ ] Documentation is current and complete
- [ ] Load test passes with 50 concurrent users

## Next Steps After Cleanup

1. Add missing mobile screens
2. Implement comprehensive test suite
3. Setup monitoring dashboards
4. Load testing with realistic data
5. Security audit
6. Performance optimization

---

**Notes**: This is a living document. Update as architecture evolves.
