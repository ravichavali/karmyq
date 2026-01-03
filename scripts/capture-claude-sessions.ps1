# Capture Claude Code session transcripts
# This script exports Claude Code conversation history to HTML files

param(
    [int]$DaysBack = 7,
    [switch]$AutoCommit,
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
Write-Host "Capturing sessions from last $DaysBack days..." -ForegroundColor Cyan
Write-Host ""

# Calculate start date
$startDate = (Get-Date).AddDays(-$DaysBack)
$startDateStr = $startDate.ToString("yyyy-MM-dd")

Write-Host "Capturing sessions from last $DaysBack day(s)" -ForegroundColor White
Write-Host ""

# Run claude-code-transcripts
# Note: The tool is interactive and will prompt you to select sessions
try {
    Write-Host "Running claude-code-transcripts..." -ForegroundColor Yellow
    Write-Host "You will be prompted to select which sessions to export." -ForegroundColor Yellow
    Write-Host "TIP: Use arrow keys to navigate, Space to select, Enter to confirm." -ForegroundColor Cyan
    Write-Host ""

    # Run the command (interactive)
    & claude-code-transcripts local --output $fullPath --output-auto --json --limit 20

    if ($LASTEXITCODE -eq 0) {
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
            $commitMsg = "docs: capture Claude sessions from $startDateStr to $(Get-Date -Format 'yyyy-MM-dd')"
            git commit -m $commitMsg

            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Changes committed to git" -ForegroundColor Green
                Write-Host "Commit message: $commitMsg" -ForegroundColor White
            } else {
                Write-Host "⚠️  No changes to commit (sessions may already be captured)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host ""
        Write-Host "❌ Session capture failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
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
Write-Host "  Open $fullPath\index.html in your browser" -ForegroundColor White
Write-Host ""
