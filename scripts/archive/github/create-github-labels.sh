#!/bin/bash
# Create GitHub Labels for Karmyq

set -e

echo "🏷️  Creating GitHub Labels..."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not installed"
    exit 1
fi

# Function to create label
create_label() {
    local name=$1
    local color=$2
    local desc=$3
    echo "Creating: $name"
    gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null || echo "  ✓ Already exists"
}

echo "Creating Priority Labels..."
create_label "priority:critical" "b60205" "Critical priority - blocking"
create_label "priority:high" "d93f0b" "High priority"
create_label "priority:medium" "fbca04" "Medium priority"
create_label "priority:low" "0e8a16" "Low priority"

echo ""
echo "Creating Service Labels..."
create_label "service:auth" "1d76db" "Authentication service"
create_label "service:community" "1d76db" "Community service"
create_label "service:request" "1d76db" "Request service"
create_label "service:reputation" "1d76db" "Reputation service"
create_label "service:notification" "1d76db" "Notification service"
create_label "service:messaging" "1d76db" "Messaging service"
create_label "service:feed" "1d76db" "Feed service"
create_label "service:cleanup" "1d76db" "Cleanup service"
create_label "service:frontend" "5319e7" "Frontend application"
create_label "service:infrastructure" "0052cc" "Infrastructure/DevOps"

echo ""
echo "Creating Type Labels..."
create_label "epic" "3e4b9e" "Epic - large feature"
create_label "feature" "a2eeef" "New feature"
create_label "bug" "d73a4a" "Bug report"
create_label "technical" "fef2c0" "Technical debt"
create_label "documentation" "0075ca" "Documentation"
create_label "user-story" "c5def5" "User story"
create_label "enhancement" "84b6eb" "Enhancement"
create_label "security" "ee0701" "Security-related"

echo ""
echo "Creating Status Labels..."
create_label "blocked" "b60205" "Blocked"
create_label "help-wanted" "008672" "Help wanted"
create_label "good-first-issue" "7057ff" "Good for newcomers"

echo ""
echo "✅ All labels created!"
echo "🔗 View: https://github.com/ravichavali/karmyq/labels"
