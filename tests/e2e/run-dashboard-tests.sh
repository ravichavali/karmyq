#!/bin/bash

# Dashboard Redesign Test Runner
# Runs automated E2E tests for v5.3.0 post-and-comment structure

echo "=================================="
echo "Dashboard Redesign E2E Tests"
echo "=================================="
echo ""

# Check if services are running
echo "Checking if services are running..."
cd ../../infrastructure/docker
docker-compose ps | grep "Up" > /dev/null
if [ $? -ne 0 ]; then
  echo "❌ Services are not running. Please start with: docker-compose up -d"
  exit 1
fi
echo "✅ Services are running"
echo ""

# Go back to e2e test directory
cd ../../tests/e2e

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run the dashboard redesign tests
echo "Running dashboard redesign tests..."
echo ""

npx playwright test 09-dashboard-redesign.spec.ts --reporter=list

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "=================================="
  echo "✅ ALL TESTS PASSED!"
  echo "=================================="
else
  echo "=================================="
  echo "❌ SOME TESTS FAILED"
  echo "=================================="
fi

exit $EXIT_CODE
