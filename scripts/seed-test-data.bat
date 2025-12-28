@echo off
REM Seed Test Data Script for Windows
REM Usage: scripts\seed-test-data.bat

echo.
echo 🌱 Seeding test data for social graph testing...
echo.

REM Default database connection
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=karmyq_db
set DB_USER=karmyq_user
set DB_PASSWORD=karmyq_password_dev

REM Run the seed script using docker exec if postgres is in docker
docker exec -i karmyq-postgres psql -U %DB_USER% -d %DB_NAME% < scripts\seed-test-data.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Error seeding test data
    exit /b 1
)

echo.
echo ✅ Test data loaded successfully!
echo.
echo You can now test the social graph with:
echo   - Community ID: 11111111-1111-1111-1111-111111111111
echo   - Alice (Admin): aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
echo   - Bob: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
echo.
echo Generate JWT tokens for testing:
echo   node -e "console.log(require('jsonwebtoken').sign({userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', communityMemberships: [{communityId: '11111111-1111-1111-1111-111111111111', role: 'admin'}]}, 'dev_jwt_secret_change_in_production'))"
echo.
