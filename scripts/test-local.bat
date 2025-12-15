@echo off
REM
REM Local Test Runner - Social Karma v2.0 (Windows)
REM Run this before committing to catch issues early
REM
REM Usage:
REM   scripts\test-local.bat          # Run all tests
REM   scripts\test-local.bat quick    # Run only fast tests
REM   scripts\test-local.bat e2e      # Run only E2E tests
REM

setlocal enabledelayedexpansion

set MODE=%1
if "%MODE%"=="" set MODE=full

echo ========================================
echo   Karmyq Local Test Runner
echo ========================================
echo.

REM 1. Type Check
if not "%MODE%"=="e2e" (
  echo [33m📝 Running TypeScript type check...[0m
  call npm run type-check --workspace=services/feed-service --if-present
  if errorlevel 1 (
    echo [31m❌ Type check failed[0m
    exit /b 1
  )
  echo [32m✅ Type check passed[0m
  echo.
)

REM 2. Integration Tests
if not "%MODE%"=="e2e" (
  echo [33m🧪 Running integration tests...[0m

  REM Check if services are running
  curl -s http://localhost:3007/health >nul 2>&1
  if errorlevel 1 (
    echo [31m⚠️  Feed Service not running. Starting services...[0m
    docker-compose -f infrastructure\docker\docker-compose.yml up -d
    echo Waiting for services to be ready...
    timeout /t 10 >nul
  )

  REM Run integration tests
  cd tests
  call npm test integration/feed-service.test.ts
  if errorlevel 1 (
    echo [31m❌ Integration tests failed[0m
    cd ..
    exit /b 1
  )
  cd ..

  echo [32m✅ Integration tests passed[0m
  echo.
)

REM 3. E2E Tests
if "%MODE%"=="e2e" (
  echo [33m🎭 Running E2E tests (this may take a few minutes)...[0m

  REM Ensure services are running
  docker-compose -f infrastructure\docker\docker-compose.yml up -d
  timeout /t 5 >nul

  REM Seed test data
  echo Seeding test data...
  type tests\e2e\seed-social-karma-v2-simple.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db >nul 2>&1

  REM Run E2E tests
  cd tests\e2e
  call npm test tests/10-social-karma-v2.spec.ts
  if errorlevel 1 (
    echo [31m❌ E2E tests failed[0m
    cd ..\..
    exit /b 1
  )
  cd ..\..

  echo [32m✅ E2E tests passed[0m
  echo.
)

if "%MODE%"=="full" (
  echo [33m🎭 Running E2E tests (this may take a few minutes)...[0m

  REM Ensure services are running
  docker-compose -f infrastructure\docker\docker-compose.yml up -d
  timeout /t 5 >nul

  REM Seed test data
  echo Seeding test data...
  type tests\e2e\seed-social-karma-v2-simple.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db >nul 2>&1

  REM Run E2E tests
  cd tests\e2e
  call npm test tests/10-social-karma-v2.spec.ts
  if errorlevel 1 (
    echo [31m❌ E2E tests failed[0m
    cd ..\..
    exit /b 1
  )
  cd ..\..

  echo [32m✅ E2E tests passed[0m
  echo.
)

REM Summary
echo ========================================
echo   [32m✅ All tests passed![0m
echo ========================================
echo.
echo [32mSafe to commit![0m

endlocal
