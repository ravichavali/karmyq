# Initial Backlog Issues

Copy these into GitHub Issues to populate your initial backlog. Use the appropriate templates when creating.

## Epics (Use Epic Template)

### 1. Mobile Application
```
Title: [EPIC] Mobile Application (React Native + Expo)
Labels: epic, enhancement, mobile
Priority: High

Goals:
- Native iOS and Android apps
- Push notifications
- Offline mode
- Camera integration for profiles

User Stories:
- [ ] As a user, I want a mobile app so I can access Karmyq on-the-go
- [ ] As a user, I want push notifications so I know immediately when help is needed
- [ ] As a user, I want offline mode so I can browse even without internet

Success Criteria:
- [ ] Apps published to App Store and Play Store
- [ ] Feature parity with web app
- [ ] Push notifications working
- [ ] 4+ star rating

Out of Scope:
- Apple Watch / Android Wear
- Tablet-optimized UI
```

### 2. Enhanced Security
```
Title: [EPIC] Enhanced Security Features
Labels: epic, security, enhancement
Priority: High

Goals:
- Multi-factor authentication (MFA)
- Email verification
- Password reset flow
- OAuth providers (Google, GitHub)
- Account deletion

Success Criteria:
- [ ] MFA implemented with TOTP
- [ ] Email verification on signup
- [ ] Password reset via email
- [ ] OAuth login working
```

### 3. Advanced Matching
```
Title: [EPIC] Advanced Matching Algorithm
Labels: epic, enhancement, service:request
Priority: Medium

Goals:
- Skill-based matching
- Location-based matching
- Availability matching
- ML-powered recommendations

Success Criteria:
- [ ] Users matched based on skills
- [ ] Location proximity considered
- [ ] Time availability matched
- [ ] 30% increase in match success rate
```

## Known Bugs (Use Bug Template)

### 1. Stats Page Issue
```
Title: [BUG] Stats tab data doesn't persist after navigation
Labels: bug, service:community, priority:medium

Description:
When viewing community stats, if you navigate away and come back, stats need to be refetched. Should cache stats.

Steps to Reproduce:
1. Go to community admin panel
2. Click Stats tab (loads stats)
3. Click Members tab
4. Click Stats tab again
5. Stats show loading state again

Expected: Stats should be cached
Actual: Stats refetch every time

Impact: Medium - UX issue but not blocking
```

### 2. Notification SSE Reconnection
```
Title: [BUG] SSE doesn't always reconnect after network interruption
Labels: bug, service:notification, priority:high

Description:
When user loses network connection and reconnects, SSE connection doesn't always re-establish.

Environment:
- Service: Notification
- Browser: Chrome, Firefox
- OS: All

Impact: High - Users miss real-time notifications

Possible Solution:
Add exponential backoff to reconnection logic
```

## Feature Enhancements (Use User Story Template)

### 1. Request Categories
```
Title: [STORY] Custom request categories per community
Labels: feature, user-story, service:community

As a community admin
I want to define custom request categories
So that requests are organized for our specific community needs

Acceptance Criteria:
- [ ] Admin can create custom categories
- [ ] Categories have name, icon, color
- [ ] Requesters select from community categories
- [ ] Categories displayed in request listings
- [ ] Default categories still available

Estimate: 3 days
```

### 2. Request Search
```
Title: [STORY] Full-text search for help requests
Labels: feature, user-story, service:request

As a community member
I want to search for requests by keyword
So that I can quickly find ways to help with my skills

Acceptance Criteria:
- [ ] Search box on requests page
- [ ] Search title and description
- [ ] Real-time results (debounced)
- [ ] Highlight search terms
- [ ] Filter + search combined

Estimate: 2 days
```

### 3. User Profiles
```
Title: [STORY] Rich user profiles
Labels: feature, user-story, service:auth

As a user
I want a detailed profile page
So that others can learn about my skills and interests

Acceptance Criteria:
- [ ] Profile photo upload
- [ ] Bio/description field
- [ ] Skills list
- [ ] Interests list
- [ ] Location (optional)
- [ ] Public profile URL

Estimate: 5 days
```

### 4. Email Notifications
```
Title: [STORY] Email notification delivery
Labels: feature, user-story, service:notification

As a user
I want email notifications for important events
So that I don't miss urgent requests even when not using the app

Acceptance Criteria:
- [ ] SMTP configuration
- [ ] Email templates for each notification type
- [ ] User preferences for email frequency
- [ ] Unsubscribe link in emails
- [ ] Batch emails (daily digest option)

Estimate: 4 days
```

## Technical Debt (Use Technical Requirement Template)

### 1. API Documentation
```
Title: [TECH] Generate OpenAPI/Swagger documentation
Labels: technical, documentation, priority:medium

Rationale:
Need comprehensive API documentation for frontend developers and potential API consumers.

Proposed Solution:
- Use swagger-jsdoc or tsoa
- Generate from TypeScript types
- Host at /api-docs
- Include examples and authentication

Service Changes:
- [x] All services (add Swagger annotations)

Acceptance Criteria:
- [ ] All endpoints documented
- [ ] Interactive API explorer
- [ ] Request/response examples
- [ ] Authentication documented
```

### 2. Monitoring & Observability
```
Title: [TECH] Implement distributed tracing
Labels: technical, infrastructure, priority:high

Rationale:
Need to trace requests across microservices for debugging and performance monitoring.

Proposed Solution:
- OpenTelemetry or Jaeger
- Trace ID propagation
- Service map visualization
- Performance metrics

Acceptance Criteria:
- [ ] Trace IDs in logs
- [ ] Service dependency map
- [ ] Request latency tracking
- [ ] Error rate monitoring
```

### 3. Testing Coverage
```
Title: [TECH] Increase test coverage to 80%
Labels: technical, testing, priority:medium

Current Coverage:
- Unit tests: ~40%
- Integration tests: ~60%
- E2E tests: ~30%

Goals:
- Unit tests: 80%
- Integration tests: 80%
- E2E tests: 60%

Acceptance Criteria:
- [ ] Coverage reports in CI/CD
- [ ] Block PRs below threshold
- [ ] Critical paths 100% covered
```

## Documentation Tasks

### 1. User Guides
```
Title: Write user guide documentation
Labels: documentation

Tasks:
- [ ] Getting started guide
- [ ] How to create a request
- [ ] How to respond to requests
- [ ] How to manage a community
- [ ] Privacy and data settings
- [ ] Troubleshooting common issues

Target: GitHub Wiki or /docs/guides/
```

### 2. Developer Onboarding
```
Title: Create developer onboarding guide
Labels: documentation

Tasks:
- [ ] Development environment setup
- [ ] Architecture overview
- [ ] Coding standards
- [ ] Git workflow
- [ ] How to add a new service
- [ ] How to add a new feature

Target: CONTRIBUTING.md + /docs/development/
```

## How to Use This File

1. **Create issues** - Copy each section into a new GitHub issue
2. **Use templates** - Select the appropriate template (Epic, User Story, Bug, etc.)
3. **Add to project** - They'll automatically go to Backlog
4. **Prioritize** - Move high-priority items to Ready
5. **Start working** - Pick from Ready column

## Priority Guide

- **Critical**: Blocking or data loss
- **High**: Important for next release
- **Medium**: Nice to have soon
- **Low**: Future consideration

---

**Ready to populate your backlog?** Start creating these issues on GitHub!
