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

REM Run via Docker if postgres is in container
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/truncate-database.sql 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Done! Use docker cp to copy SQL file first:
    echo docker cp scripts\truncate-database.sql karmyq-postgres:/tmp/
    echo Then run: docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/truncate-database.sql
) else (
    REM Try direct approach
    echo Copying SQL file to container...
    docker cp scripts\truncate-database.sql karmyq-postgres:/tmp/

    echo Running truncation...
    docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/truncate-database.sql
)

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
