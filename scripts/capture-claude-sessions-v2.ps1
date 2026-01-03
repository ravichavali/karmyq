# Capture Claude Code session transcripts
# This script exports Claude Code conversation history to HTML files
# Supports both interactive and automated (cron) modes

param(
    [int]$DaysBack = 7,
    [switch]$AutoCommit,
    [switch]$NonInteractive,  # For cron jobs - captures all sessions
    [string]$OutputDir = "docs/claude-sessions"
)

$ErrorActionPreference = "Stop"

# Set UTF-8 encoding
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Claude Code Session Capture" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if claude-code-transcripts is installed
Write-Host "Checking for claude-code-transcripts tool..." -ForegroundColor Yellow

$claudeTranscripts = Get-Command claude-code-transcripts -ErrorAction SilentlyContinue
if (-not $claudeTranscripts) {
    Write-Host "❌ claude-code-transcripts not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install with:" -ForegroundColor Yellow
    Write-Host "  pip install git+https://github.com/simonw/claude-code-transcripts.git" -ForegroundColor White
    Write-Host ""
    Write-Host "Or using pipx (recommended):" -ForegroundColor Yellow
    Write-Host "  pipx install git+https://github.com/simonw/claude-code-transcripts.git" -ForegroundColor White
    exit 1
}

Write-Host "✅ claude-code-transcripts found" -ForegroundColor Green
Write-Host ""

# Create output directory
$fullPath = Join-Path (Get-Location) $OutputDir
if (-not (Test-Path $fullPath)) {
    Write-Host "Creating output directory: $OutputDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
}

Write-Host "Output directory: $fullPath" -ForegroundColor Cyan
Write-Host "Capturing sessions from last $DaysBack day(s)" -ForegroundColor Cyan
Write-Host ""

# Determine mode
if ($NonInteractive) {
    Write-Host "Mode: Non-interactive (automated capture)" -ForegroundColor Yellow
} else {
    Write-Host "Mode: Interactive (manual selection)" -ForegroundColor Yellow
}
Write-Host ""

# Get Claude sessions directory
$claudeSessionsPath = Join-Path $env:APPDATA "Claude\claude-code\sessions"
if (-not (Test-Path $claudeSessionsPath)) {
    Write-Host "❌ Claude sessions directory not found at: $claudeSessionsPath" -ForegroundColor Red
    exit 1
}

# Calculate cutoff date
$cutoffDate = (Get-Date).AddDays(-$DaysBack)

# Find sessions within date range
Write-Host "Finding sessions since $($cutoffDate.ToString('yyyy-MM-dd'))..." -ForegroundColor Yellow
$recentSessions = Get-ChildItem -Path $claudeSessionsPath -Filter "*.jsonl" |
    Where-Object { $_.LastWriteTime -ge $cutoffDate } |
    Sort-Object LastWriteTime -Descending

if ($recentSessions.Count -eq 0) {
    Write-Host "⚠️  No sessions found in the last $DaysBack day(s)" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($recentSessions.Count) session(s)" -ForegroundColor Green
Write-Host ""

# Run claude-code-transcripts
try {
    if ($NonInteractive) {
        # Non-interactive: Process all sessions
        Write-Host "Processing all sessions automatically..." -ForegroundColor Yellow
        Write-Host ""

        $successCount = 0
        $failCount = 0

        foreach ($session in $recentSessions) {
            Write-Host "Processing: $($session.Name) ($($session.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))" -ForegroundColor Cyan

            # Process this session
            & claude-code-transcripts json --output $fullPath --output-auto --json $session.FullName

            if ($LASTEXITCODE -eq 0) {
                $successCount++
                Write-Host "  ✅ Captured" -ForegroundColor Green
            } else {
                $failCount++
                Write-Host "  ❌ Failed" -ForegroundColor Red
            }
        }

        Write-Host ""
        Write-Host "Results: $successCount succeeded, $failCount failed" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })

    } else {
        # Interactive: Let user select
        Write-Host "Running claude-code-transcripts..." -ForegroundColor Yellow
        Write-Host "You will be prompted to select which sessions to export." -ForegroundColor Yellow
        Write-Host "TIP: Use arrow keys to navigate, Space to select, Enter to confirm." -ForegroundColor Cyan
        Write-Host ""

        # Run the command (interactive)
        & claude-code-transcripts local --output $fullPath --output-auto --json --limit $($recentSessions.Count)

        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "❌ Session capture failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    }

    Write-Host ""
    Write-Host "✅ Sessions captured successfully!" -ForegroundColor Green
    Write-Host ""

    # Show what was captured
    $sessionDirs = Get-ChildItem -Path $fullPath -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' }
    if ($sessionDirs) {
        Write-Host "📁 Captured sessions:" -ForegroundColor Cyan
        foreach ($dir in $sessionDirs | Sort-Object Name -Descending | Select-Object -First 10) {
            $fileCount = (Get-ChildItem -Path $dir.FullName -File).Count
            Write-Host "  $($dir.Name) - $fileCount files" -ForegroundColor White
        }
    }

    # Auto-commit if requested
    if ($AutoCommit) {
        Write-Host ""
        Write-Host "Auto-commit enabled, committing to git..." -ForegroundColor Yellow

        git add $OutputDir
        $commitMsg = "docs: capture Claude sessions through $(Get-Date -Format 'yyyy-MM-dd')"
        git commit -m $commitMsg

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Changes committed to git" -ForegroundColor Green
            Write-Host "Commit message: $commitMsg" -ForegroundColor White
        } else {
            Write-Host "⚠️  No changes to commit (sessions may already be captured)" -ForegroundColor Yellow
        }
    }

} catch {
    Write-Host ""
    Write-Host "❌ Error capturing sessions: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Capture complete!" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "View sessions:" -ForegroundColor Yellow
$indexPath = Join-Path $fullPath "index.html"
Write-Host "  Open $indexPath in your browser" -ForegroundColor White
Write-Host ""
