# Add labels to existing GitHub issues
# This script adds the correct labels to all 14 issues created

Write-Host "🏷️  Adding labels to existing issues..." -ForegroundColor Cyan
Write-Host ""

# Get all open issues
$issues = gh issue list --limit 100 --json number,title | ConvertFrom-Json

foreach ($issue in $issues) {
    $number = $issue.number
    $title = $issue.title

    Write-Host "Issue #$number : $title" -ForegroundColor Yellow

    # Determine labels based on title
    $labels = @()

    # Epic issues
    if ($title -match "\[EPIC\]") {
        $labels += "epic"

        if ($title -match "Mobile") {
            $labels += @("enhancement", "mobile", "priority:high")
        }
        elseif ($title -match "Security") {
            $labels += @("security", "enhancement", "priority:high")
        }
        elseif ($title -match "Matching") {
            $labels += @("enhancement", "service:request", "priority:medium")
        }
    }

    # Bug issues
    elseif ($title -match "\[BUG\]") {
        $labels += "bug"

        if ($title -match "Stats") {
            $labels += @("service:community", "priority:medium")
        }
        elseif ($title -match "SSE") {
            $labels += @("service:notification", "priority:high")
        }
    }

    # Story/Feature issues
    elseif ($title -match "\[STORY\]") {
        $labels += @("feature", "user-story")

        if ($title -match "categories") {
            $labels += @("service:community", "priority:medium")
        }
        elseif ($title -match "search") {
            $labels += @("service:request", "priority:medium")
        }
        elseif ($title -match "profiles") {
            $labels += @("service:auth", "priority:medium")
        }
        elseif ($title -match "Email") {
            $labels += @("service:notification", "priority:high")
        }
    }

    # Technical issues
    elseif ($title -match "\[TECH\]") {
        $labels += "technical"

        if ($title -match "Swagger|OpenAPI") {
            $labels += @("documentation", "priority:medium")
        }
        elseif ($title -match "tracing") {
            $labels += @("infrastructure", "priority:high")
        }
        elseif ($title -match "coverage") {
            $labels += @("testing", "priority:medium")
        }
    }

    # Documentation issues
    elseif ($title -match "user guide") {
        $labels += @("documentation", "priority:medium")
    }
    elseif ($title -match "developer|onboarding") {
        $labels += @("documentation", "priority:high")
    }

    # Add labels to issue
    if ($labels.Count -gt 0) {
        $labelString = $labels -join ","
        Write-Host "  Adding: $labelString" -ForegroundColor Gray
        gh issue edit $number --add-label $labelString 2>&1 | Out-Null
        Write-Host "  ✓ Labels added" -ForegroundColor Green
    }

    Write-Host ""
}

Write-Host "✅ All issues labeled!" -ForegroundColor Green
Write-Host "🔗 View: https://github.com/ravichavali/karmyq/issues" -ForegroundColor Cyan
