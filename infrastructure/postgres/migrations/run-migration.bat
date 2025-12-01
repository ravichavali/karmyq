@echo off
REM Run migration inside Docker container (Windows)
REM Usage: run-migration.bat <migration-file.sql>

set MIGRATION_FILE=%1

if "%MIGRATION_FILE%"=="" (
    echo Usage: run-migration.bat ^<migration-file.sql^>
    exit /b 1
)

if not exist "%MIGRATION_FILE%" (
    echo Error: Migration file %MIGRATION_FILE% not found
    exit /b 1
)

echo Running migration: %MIGRATION_FILE%
echo ========================================

REM Copy migration file to container
docker cp "%MIGRATION_FILE%" karmyq-postgres:/tmp/migration.sql

REM Run migration
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/migration.sql

REM Clean up
docker exec karmyq-postgres rm /tmp/migration.sql

echo ========================================
echo Migration complete!
