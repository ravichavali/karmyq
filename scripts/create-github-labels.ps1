# Create GitHub Labels for Karmyq
# Run this once to set up all project labels

Write-Host "🏷️  Creating GitHub Labels..." -ForegroundColor Cyan
Write-Host ""

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) is not installed" -ForegroundColor Red
    exit 1
}

# Function to create label
function Create-Label {
    param($Name, $Color, $Description)
    Write-Host "Creating: $Name" -ForegroundColor Yellow
    gh label create $Name --color $Color --description $Description --force 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Created" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Already exists" -ForegroundColor Gray
    }
}

Write-Host "Creating Priority Labels..." -ForegroundColor Cyan
Create-Label "priority:critical" "b60205" "Critical priority - blocking issues"
Create-Label "priority:high" "d93f0b" "High priority"
Create-Label "priority:medium" "fbca04" "Medium priority"
Create-Label "priority:low" "0e8a16" "Low priority"

Write-Host ""
Write-Host "Creating Service Labels..." -ForegroundColor Cyan
Create-Label "service:auth" "1d76db" "Authentication service"
Create-Label "service:community" "1d76db" "Community service"
Create-Label "service:request" "1d76db" "Request service"
Create-Label "service:reputation" "1d76db" "Reputation service"
Create-Label "service:notification" "1d76db" "Notification service"
Create-Label "service:messaging" "1d76db" "Messaging service"
Create-Label "service:feed" "1d76db" "Feed service"
Create-Label "service:cleanup" "1d76db" "Cleanup service"
Create-Label "service:frontend" "5319e7" "Frontend application"
Create-Label "service:infrastructure" "0052cc" "Infrastructure/DevOps"

Write-Host ""
Write-Host "Creating Type Labels..." -ForegroundColor Cyan
Create-Label "epic" "3e4b9e" "Epic - large feature spanning multiple issues"
Create-Label "feature" "a2eeef" "New feature or enhancement"
Create-Label "bug" "d73a4a" "Bug report"
Create-Label "technical" "fef2c0" "Technical debt or infrastructure"
Create-Label "documentation" "0075ca" "Documentation improvements"
Create-Label "user-story" "c5def5" "User story"
Create-Label "enhancement" "84b6eb" "Enhancement to existing feature"
Create-Label "security" "ee0701" "Security-related issue"

Write-Host ""
Write-Host "Creating Status Labels..." -ForegroundColor Cyan
Create-Label "blocked" "b60205" "Blocked by another issue"
Create-Label "help-wanted" "008672" "Extra attention is needed"
Create-Label "good-first-issue" "7057ff" "Good for newcomers"
Create-Label "wontfix" "ffffff" "This will not be worked on"
Create-Label "duplicate" "cfd3d7" "Duplicate issue"
Create-Label "invalid" "e4e669" "Invalid issue"

Write-Host ""
Write-Host "Creating Special Labels..." -ForegroundColor Cyan
Create-Label "mobile" "f9d0c4" "Mobile app related"
Create-Label "testing" "d4c5f9" "Testing related"
Create-Label "performance" "ffaac8" "Performance improvements"
Create-Label "accessibility" "fad8c7" "Accessibility improvements"

Write-Host ""
Write-Host "✅ All labels created!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 View labels: https://github.com/ravichavali/karmyq/labels" -ForegroundColor Cyan
