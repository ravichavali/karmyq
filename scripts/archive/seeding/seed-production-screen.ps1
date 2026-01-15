# Run Production Seeding in Screen Session (PowerShell Version)
# This allows seeding to continue even if you disconnect

Write-Host "========================================"
Write-Host "Production Database Seeding (Screen)"
Write-Host "========================================"
Write-Host ""

if (-not $env:DEMO_PASSWORD) {
    Write-Host "ERROR: DEMO_PASSWORD environment variable is required" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:"
    Write-Host '  $env:DEMO_PASSWORD = "your_secure_password"'
    Write-Host "  .\scripts\seed-production-screen.ps1"
    exit 1
}

Write-Host "This script will:"
Write-Host "1. SSH to production server"
Write-Host "2. Start a detached screen session named 'karmyq-seed'"
Write-Host "3. Run seeding in the background"
Write-Host "4. You can disconnect and seeding will continue"
Write-Host ""
Write-Host "Duration: 15-30 minutes or longer (runs in background)"
Write-Host ""

if ($env:SKIP_CONFIRMATION -ne "true") {
    $confirm = Read-Host "Continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled."
        exit 0
    }
}

Write-Host ""
Write-Host "Starting screen session on production server..." -ForegroundColor Yellow
Write-Host ""

# SSH to production and run the screen script
ssh ubuntu@karmyq.com "export DEMO_PASSWORD='$env:DEMO_PASSWORD' && cd ~/karmyq && git pull origin master && chmod +x scripts/seed-production-screen.sh && ./scripts/seed-production-screen.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "✅ Screen Session Started" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "The seeding is now running in the background on the production server."
    Write-Host ""
    Write-Host "To monitor progress, SSH to production and run:"
    Write-Host "  ssh ubuntu@karmyq.com"
    Write-Host "  screen -r karmyq-seed"
    Write-Host ""
    Write-Host "To detach from screen (leave it running):"
    Write-Host "  Press: Ctrl+A, then D"
    Write-Host ""
    Write-Host "To check if it's still running:"
    Write-Host "  screen -ls"
    Write-Host ""
    Write-Host "The session will automatically close when seeding completes."
    Write-Host "Expected duration: 15-30 minutes or longer"
} else {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "❌ Failed to Start Screen Session" -ForegroundColor Red
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Please check the output above for errors."
    exit 1
}
