# Sync Claude Code transcripts to separate repository
# This script captures sessions and pushes them to karmyq-claude-transcripts repo

param(
    [int]$DaysBack = 7,
    [string]$TranscriptsRepoPath = "$HOME\development\karmyq-claude-transcripts"
)

$ErrorActionPreference = "Stop"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Claude Transcripts Sync" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Capture sessions to temporary directory
Write-Host "Step 1: Capturing Claude sessions..." -ForegroundColor Yellow
Write-Host ""

$tempDir = ".claude-transcripts"
& ".\scripts\capture-claude-sessions-v2.ps1" -DaysBack $DaysBack -OutputDir $tempDir -NonInteractive

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Session capture failed" -ForegroundColor Red
    exit 1
}

# Step 2: Check if transcripts repo exists
Write-Host ""
Write-Host "Step 2: Checking transcripts repository..." -ForegroundColor Yellow

if (-not (Test-Path $TranscriptsRepoPath)) {
    Write-Host "❌ Transcripts repo not found at: $TranscriptsRepoPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please clone it first:" -ForegroundColor Yellow
    Write-Host "  cd $HOME\development" -ForegroundColor White
    Write-Host "  git clone https://github.com/ravichavali/karmyq-claude-transcripts.git" -ForegroundColor White
    exit 1
}

Write-Host "✅ Found transcripts repo" -ForegroundColor Green

# Step 3: Copy sessions to transcripts repo
Write-Host ""
Write-Host "Step 3: Copying sessions to transcripts repo..." -ForegroundColor Yellow

try {
    # Copy all session directories and index
    $sourcePath = Join-Path (Get-Location) $tempDir
    $items = Get-ChildItem -Path $sourcePath

    foreach ($item in $items) {
        $destPath = Join-Path $TranscriptsRepoPath $item.Name
        Copy-Item -Path $item.FullName -Destination $destPath -Recurse -Force
        Write-Host "  Copied: $($item.Name)" -ForegroundColor White
    }

    Write-Host "✅ Sessions copied successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Copy failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Commit and push to transcripts repo
Write-Host ""
Write-Host "Step 4: Committing to transcripts repo..." -ForegroundColor Yellow

try {
    Push-Location $TranscriptsRepoPath

    # Add all changes
    git add .

    # Check if there are changes
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "⚠️  No changes to commit (sessions already synced)" -ForegroundColor Yellow
    } else {
        # Commit
        $commitDate = Get-Date -Format "yyyy-MM-dd"
        $commitMsg = "docs: add Claude sessions through $commitDate"
        git commit -m $commitMsg

        Write-Host "✅ Changes committed" -ForegroundColor Green
        Write-Host "  Message: $commitMsg" -ForegroundColor White

        # Push
        Write-Host ""
        Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
        git push origin main

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Pushed to GitHub successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Push failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            Pop-Location
            exit 1
        }
    }

    Pop-Location
} catch {
    Pop-Location
    Write-Host "❌ Git operations failed: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Clean up temporary directory (optional)
Write-Host ""
Write-Host "Step 5: Cleaning up..." -ForegroundColor Yellow

# Don't delete - keep local copy for reference
Write-Host "Local copy retained at: $tempDir" -ForegroundColor White

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "✅ Sync Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Transcripts available at:" -ForegroundColor Yellow
Write-Host "  https://github.com/ravichavali/karmyq-claude-transcripts" -ForegroundColor White
Write-Host ""
