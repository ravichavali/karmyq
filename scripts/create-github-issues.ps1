# Karmyq - Bulk Create GitHub Issues (PowerShell)
# This script creates all initial backlog issues

Write-Host "🚀 Creating GitHub Issues for Karmyq backlog..." -ForegroundColor Cyan
Write-Host ""

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) is not installed" -ForegroundColor Red
    Write-Host "Install from: https://cli.github.com/"
    exit 1
}

# Check if authenticated
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated with GitHub" -ForegroundColor Red
    Write-Host "Run: gh auth login"
    exit 1
}

Write-Host "✅ GitHub CLI authenticated" -ForegroundColor Green
Write-Host ""

# Function to create issue
function Create-Issue {
    param($Title, $Body, $Labels)
    Write-Host "Creating: $Title" -ForegroundColor Yellow
    gh issue create --title $Title --body $Body --label $Labels
}

# EPICS
Write-Host "📋 Creating Epics..." -ForegroundColor Cyan

Create-Issue `
    -Title "[EPIC] Mobile Application (React Native + Expo)" `
    -Body @"
## Goals
- Native iOS and Android apps
- Push notifications
- Offline mode
- Camera integration for profiles

## Success Criteria
- [ ] Apps published to App Store and Play Store
- [ ] Feature parity with web app
- [ ] Push notifications working
- [ ] 4+ star rating
"@ `
    -Labels "epic,enhancement,mobile,priority:high"

Create-Issue `
    -Title "[EPIC] Enhanced Security Features" `
    -Body @"
## Goals
- Multi-factor authentication (MFA)
- Email verification
- Password reset flow
- OAuth providers (Google, GitHub)

## Success Criteria
- [ ] MFA implemented with TOTP
- [ ] Email verification on signup
- [ ] Password reset via email
- [ ] OAuth login working
"@ `
    -Labels "epic,security,enhancement,priority:high"

Create-Issue `
    -Title "[EPIC] Advanced Matching Algorithm" `
    -Body @"
## Goals
- Skill-based matching
- Location-based matching
- ML-powered recommendations

## Success Criteria
- [ ] Users matched based on skills
- [ ] 30% increase in match success rate
"@ `
    -Labels "epic,enhancement,service:request,priority:medium"

# BUGS
Write-Host ""
Write-Host "🐛 Creating Bug Reports..." -ForegroundColor Cyan

Create-Issue `
    -Title "[BUG] Stats tab data doesn't persist after navigation" `
    -Body @"
## Steps to Reproduce
1. Go to community admin panel
2. Click Stats tab
3. Navigate away
4. Return to Stats tab
5. Stats reload instead of using cache

## Expected: Cached stats
## Actual: Refetch every time
"@ `
    -Labels "bug,service:community,priority:medium"

Create-Issue `
    -Title "[BUG] SSE doesn't reconnect after network interruption" `
    -Body @"
## Description
SSE connection doesn't re-establish after network loss

## Environment
- Service: Notification
- Browsers: Chrome, Firefox

## Solution
Add exponential backoff reconnection
"@ `
    -Labels "bug,service:notification,priority:high"

# FEATURES
Write-Host ""
Write-Host "✨ Creating Features..." -ForegroundColor Cyan

Create-Issue `
    -Title "[STORY] Custom request categories per community" `
    -Body @"
As a community admin, I want custom request categories so requests are organized for our needs

## Acceptance Criteria
- [ ] Admin creates categories
- [ ] Categories have name, icon, color
- [ ] Display in request listings

Estimate: 3 days
"@ `
    -Labels "feature,user-story,service:community,priority:medium"

Create-Issue `
    -Title "[STORY] Full-text search for requests" `
    -Body @"
As a member, I want to search requests by keyword to find ways to help

## Acceptance Criteria
- [ ] Search box on requests page
- [ ] Real-time results
- [ ] Highlight search terms

Estimate: 2 days
"@ `
    -Labels "feature,user-story,service:request,priority:medium"

Create-Issue `
    -Title "[STORY] Rich user profiles" `
    -Body @"
As a user, I want a detailed profile so others can learn about me

## Acceptance Criteria
- [ ] Profile photo upload
- [ ] Bio/description
- [ ] Skills and interests
- [ ] Public profile URL

Estimate: 5 days
"@ `
    -Labels "feature,user-story,service:auth,priority:medium"

Create-Issue `
    -Title "[STORY] Email notifications" `
    -Body @"
As a user, I want email notifications so I don't miss urgent requests

## Acceptance Criteria
- [ ] SMTP configuration
- [ ] Email templates
- [ ] User preferences
- [ ] Unsubscribe links

Estimate: 4 days
"@ `
    -Labels "feature,user-story,service:notification,priority:high"

# TECHNICAL DEBT
Write-Host ""
Write-Host "🔧 Creating Technical Items..." -ForegroundColor Cyan

Create-Issue `
    -Title "[TECH] OpenAPI/Swagger documentation" `
    -Body @"
## Rationale
Need API documentation for developers

## Solution
- swagger-jsdoc or tsoa
- Host at /api-docs
- Interactive explorer

## Criteria
- [ ] All endpoints documented
- [ ] Authentication documented
"@ `
    -Labels "technical,documentation,priority:medium"

Create-Issue `
    -Title "[TECH] Distributed tracing" `
    -Body @"
## Rationale
Trace requests across microservices

## Solution
- OpenTelemetry/Jaeger
- Trace ID propagation
- Service map

## Criteria
- [ ] Trace IDs in logs
- [ ] Service dependency map
- [ ] Latency tracking
"@ `
    -Labels "technical,infrastructure,priority:high"

Create-Issue `
    -Title "[TECH] Increase test coverage to 80%" `
    -Body @"
## Current
- E2E: 83% ✅
- Integration: ~60%
- Unit: ~40%

## Goals
- E2E: 90%
- Integration: 80%
- Unit: 80%

## Criteria
- [ ] Coverage reports in CI/CD
- [ ] Block PRs below threshold
"@ `
    -Labels "technical,testing,priority:medium"

# DOCUMENTATION
Write-Host ""
Write-Host "📚 Creating Documentation..." -ForegroundColor Cyan

Create-Issue `
    -Title "Write user guide documentation" `
    -Body @"
## Tasks
- [ ] Getting started guide
- [ ] How to create/respond to requests
- [ ] How to manage a community
- [ ] Privacy settings
- [ ] Troubleshooting

Target: /docs/guides/
"@ `
    -Labels "documentation,priority:medium"

Create-Issue `
    -Title "Create developer onboarding guide" `
    -Body @"
## Tasks
- [ ] Dev environment setup
- [ ] Architecture overview
- [ ] Coding standards
- [ ] Git workflow
- [ ] Adding new services/features

Target: CONTRIBUTING.md
"@ `
    -Labels "documentation,priority:high"

Write-Host ""
Write-Host "✅ All 14 issues created!" -ForegroundColor Green
Write-Host "🔗 View: https://github.com/ravichavali/karmyq/issues" -ForegroundColor Cyan
Write-Host "📋 Add them to your project board!" -ForegroundColor Yellow
