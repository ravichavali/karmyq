@echo off
REM Truncate Database Script for Windows
REM WARNING: This deletes ALL data from the database

echo.
echo ========================================
echo   DATABASE TRUNCATION
echo ========================================
echo.
echo WARNING: This will DELETE ALL DATA!
echo.
echo Press Ctrl+C to cancel now...
pause

echo.
echo Running truncation script...
echo.

REM Copy SQL file to container
echo Copying SQL file to container...
docker cp truncate-database.sql karmyq-postgres:/tmp/

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error copying SQL file to container
    echo Make sure you're running this from the scripts directory
    exit /b 1
)

echo Running truncation...
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/truncate-database.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Database truncated successfully!
) else (
    echo.
    echo ❌ Error truncating database
    exit /b 1
)

echo.
pause
