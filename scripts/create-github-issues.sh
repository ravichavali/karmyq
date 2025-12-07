#!/bin/bash

# Karmyq - Bulk Create GitHub Issues
# This script creates all initial backlog issues from INITIAL_BACKLOG_ISSUES.md

set -e

echo "🚀 Creating GitHub Issues for Karmyq backlog..."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# EPICS
echo "📋 Creating Epics..."
gh issue create --title "[EPIC] Mobile Application (React Native + Expo)" --body "
## Goals
- Native iOS and Android apps
- Push notifications
- Offline mode
- Camera integration for profiles

## User Stories
- [ ] As a user, I want a mobile app so I can access Karmyq on-the-go
- [ ] As a user, I want push notifications so I know immediately when help is needed
- [ ] As a user, I want offline mode so I can browse even without internet

## Success Criteria
- [ ] Apps published to App Store and Play Store
- [ ] Feature parity with web app
- [ ] Push notifications working
- [ ] 4+ star rating
" --label "epic,enhancement,mobile,priority:high"

gh issue create --title "[EPIC] Enhanced Security Features" --body "
## Goals
- Multi-factor authentication (MFA)
- Email verification
- Password reset flow
- OAuth providers (Google, GitHub)
- Account deletion

## Success Criteria
- [ ] MFA implemented with TOTP
- [ ] Email verification on signup
- [ ] Password reset via email
- [ ] OAuth login working
" --label "epic,security,enhancement,priority:high"

gh issue create --title "[EPIC] Advanced Matching Algorithm" --body "
## Goals
- Skill-based matching
- Location-based matching
- Availability matching
- ML-powered recommendations

## Success Criteria
- [ ] Users matched based on skills
- [ ] Location proximity considered
- [ ] Time availability matched
- [ ] 30% increase in match success rate
" --label "epic,enhancement,service:request,priority:medium"

echo ""
echo "🐛 Creating Bug Reports..."

gh issue create --title "[BUG] Stats tab data doesn't persist after navigation" --body "
## Steps to Reproduce
1. Go to community admin panel
2. Click Stats tab (loads stats)
3. Click Members tab
4. Click Stats tab again
5. Stats show loading state again

## Expected: Stats should be cached
## Actual: Stats refetch every time
" --label "bug,service:community,priority:medium"

gh issue create --title "[BUG] SSE doesn't always reconnect after network interruption" --body "
## Description
When user loses network connection and reconnects, SSE connection doesn't always re-establish.

## Environment
- Service: Notification
- Browser: Chrome, Firefox

## Possible Solution
Add exponential backoff to reconnection logic
" --label "bug,service:notification,priority:high"

echo ""
echo "✨ Creating Feature Requests..."

gh issue create --title "[STORY] Custom request categories per community" --body "
## User Story
As a community admin, I want to define custom request categories so that requests are organized for our specific community needs

## Acceptance Criteria
- [ ] Admin can create custom categories
- [ ] Categories have name, icon, color
- [ ] Requesters select from community categories
- [ ] Categories displayed in request listings

Estimate: 3 days
" --label "feature,user-story,service:community,priority:medium"

gh issue create --title "[STORY] Full-text search for help requests" --body "
## User Story
As a community member, I want to search for requests by keyword so that I can quickly find ways to help with my skills

## Acceptance Criteria
- [ ] Search box on requests page
- [ ] Search title and description
- [ ] Real-time results (debounced)
- [ ] Highlight search terms

Estimate: 2 days
" --label "feature,user-story,service:request,priority:medium"

gh issue create --title "[STORY] Rich user profiles" --body "
## User Story
As a user, I want a detailed profile page so that others can learn about my skills and interests

## Acceptance Criteria
- [ ] Profile photo upload
- [ ] Bio/description field
- [ ] Skills list
- [ ] Interests list
- [ ] Public profile URL

Estimate: 5 days
" --label "feature,user-story,service:auth,priority:medium"

gh issue create --title "[STORY] Email notification delivery" --body "
## User Story
As a user, I want email notifications for important events so that I don't miss urgent requests

## Acceptance Criteria
- [ ] SMTP configuration
- [ ] Email templates for each notification type
- [ ] User preferences for email frequency
- [ ] Unsubscribe link in emails

Estimate: 4 days
" --label "feature,user-story,service:notification,priority:high"

echo ""
echo "🔧 Creating Technical Debt Items..."

gh issue create --title "[TECH] Generate OpenAPI/Swagger documentation" --body "
## Rationale
Need comprehensive API documentation for frontend developers and potential API consumers.

## Proposed Solution
- Use swagger-jsdoc or tsoa
- Generate from TypeScript types
- Host at /api-docs

## Acceptance Criteria
- [ ] All endpoints documented
- [ ] Interactive API explorer
- [ ] Authentication documented
" --label "technical,documentation,priority:medium"

gh issue create --title "[TECH] Implement distributed tracing" --body "
## Rationale
Need to trace requests across microservices for debugging and performance monitoring.

## Proposed Solution
- OpenTelemetry or Jaeger
- Trace ID propagation
- Service map visualization

## Acceptance Criteria
- [ ] Trace IDs in logs
- [ ] Service dependency map
- [ ] Request latency tracking
" --label "technical,infrastructure,priority:high"

gh issue create --title "[TECH] Increase test coverage to 80%" --body "
## Current Coverage
- Unit tests: ~40%
- Integration tests: ~60%
- E2E tests: 83% (recently improved!)

## Goals
- Unit tests: 80%
- Integration tests: 80%
- E2E tests: 90%

## Acceptance Criteria
- [ ] Coverage reports in CI/CD
- [ ] Block PRs below threshold
- [ ] Critical paths 100% covered
" --label "technical,testing,priority:medium"

echo ""
echo "📚 Creating Documentation Tasks..."

gh issue create --title "Write user guide documentation" --body "
## Tasks
- [ ] Getting started guide
- [ ] How to create a request
- [ ] How to respond to requests
- [ ] How to manage a community
- [ ] Privacy and data settings

Target: GitHub Wiki or /docs/guides/
" --label "documentation,priority:medium"

gh issue create --title "Create developer onboarding guide" --body "
## Tasks
- [ ] Development environment setup
- [ ] Architecture overview
- [ ] Coding standards
- [ ] Git workflow
- [ ] How to add a new service

Target: CONTRIBUTING.md + /docs/development/
" --label "documentation,priority:high"

echo ""
echo "✅ All issues created successfully!"
echo "🔗 View: https://github.com/ravichavali/karmyq/issues"
