# Deploy frontend with geocoding API URL fix
# Fixes localhost:3009 references to use /api/geocoding proxy

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deploy Frontend - Geocoding Fix" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload updated files to server
Write-Host "Step 1: Uploading updated files to server..." -ForegroundColor Yellow

$filesToUpload = @(
    "apps\frontend\.env.production",
    "apps\frontend\src\lib\geocoding.ts",
    "scripts\deploy-frontend-geocoding-fix.sh"
)

foreach ($file in $filesToUpload) {
    Write-Host "  Uploading $file..." -ForegroundColor Gray
    scp "$file" ubuntu@karmyq.com:~/karmyq/$file
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to upload $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Files uploaded successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Run deployment script on server
Write-Host "Step 2: Running deployment script on server..." -ForegroundColor Yellow

ssh ubuntu@karmyq.com "chmod +x ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh && bash ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Deployment script failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test the fix:" -ForegroundColor Cyan
Write-Host "  1. Visit https://karmyq.com" -ForegroundColor White
Write-Host "  2. Open browser console (F12)" -ForegroundColor White
Write-Host "  3. Try creating a request with location search" -ForegroundColor White
Write-Host "  4. Verify NO localhost:3009 errors appear" -ForegroundColor White
Write-Host "  5. Check Network tab for /api/geocoding/ requests" -ForegroundColor White
Write-Host ""
