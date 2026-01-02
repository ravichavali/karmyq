# Seed Production Database via SSH (PowerShell Version)
# This script SSHs to production server and runs seeding locally

Write-Host "========================================"
Write-Host "Production Database Seeding"
Write-Host "========================================"
Write-Host ""

if (-not $env:DEMO_PASSWORD) {
    Write-Host "ERROR: DEMO_PASSWORD environment variable is required" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:"
    Write-Host '  $env:DEMO_PASSWORD = "your_secure_password"'
    Write-Host "  .\scripts\seed-production-remote.ps1"
    exit 1
}

Write-Host "This script will:"
Write-Host "1. SSH to production server (karmyq.com)"
Write-Host "2. Pull latest code"
Write-Host "3. Run seeding script on the server"
Write-Host "4. Create 2000 demo users and 200 communities"
Write-Host ""
Write-Host "Duration: ~15-30 minutes (may run longer)"
Write-Host ""

if ($env:SKIP_CONFIRMATION -ne "true") {
    $confirm = Read-Host "Continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled."
        exit 0
    }
}

Write-Host ""
Write-Host "Connecting to production server and running seeding..." -ForegroundColor Yellow
Write-Host ""

# Create the SSH command that will run on the production server
$sshCommand = @"
export DEMO_PASSWORD='$env:DEMO_PASSWORD'
cd ~/karmyq
git pull origin master
chmod +x scripts/seed-production-local.sh
./scripts/seed-production-local.sh
"@

# Run the command on production server
Write-Host "Executing seeding on production server..." -ForegroundColor Cyan
Write-Host "(This will take 15-30 minutes or longer - please be patient)" -ForegroundColor Cyan
Write-Host ""

echo $sshCommand | ssh ubuntu@karmyq.com "bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "✅ Seeding Completed Successfully" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Test accounts created:"
    Write-Host "  • user1@test.karmyq.com"
    Write-Host "  • user2@test.karmyq.com"
    Write-Host "  • user3@test.karmyq.com"
    Write-Host "  • ... (up to user2000@test.karmyq.com)"
    Write-Host ""
    Write-Host "Password: $env:DEMO_PASSWORD"
    Write-Host ""
    Write-Host "You can now log in at https://karmyq.com"
} else {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "❌ Seeding Failed" -ForegroundColor Red
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Please check the output above for errors."
    exit 1
}
