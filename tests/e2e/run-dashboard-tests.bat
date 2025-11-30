@echo off
REM Dashboard Redesign Test Runner (Windows)
REM Runs automated E2E tests for v5.3.0 post-and-comment structure

echo ==================================
echo Dashboard Redesign E2E Tests
echo ==================================
echo.

REM Check if services are running
echo Checking if services are running...
cd ..\..\infrastructure\docker
docker-compose ps | findstr "Up" >nul 2>&1
if errorlevel 1 (
  echo X Services are not running. Please start with: docker-compose up -d
  exit /b 1
)
echo √ Services are running
echo.

REM Go back to e2e test directory
cd ..\..\tests\e2e

REM Install dependencies if needed
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

REM Run the dashboard redesign tests
echo Running dashboard redesign tests...
echo.

call npx playwright test 09-dashboard-redesign.spec.ts --reporter=list

REM Capture exit code
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE%==0 (
  echo ==================================
  echo √ ALL TESTS PASSED!
  echo ==================================
) else (
  echo ==================================
  echo X SOME TESTS FAILED
  echo ==================================
)

exit /b %EXIT_CODE%
