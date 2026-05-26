#!/usr/bin/env node
/**
 * Auto-promote TDD tests to regression when they pass
 *
 * TDD Framework Rule: When a test in tdd/ passes, automatically move it to regression/
 * This ensures passing tests become locked-in regression tests.
 *
 * Usage:
 *   - Run automatically after tests: npm run test:tdd && node scripts/promote-tdd-tests.js
 *   - Run manually: node scripts/promote-tdd-tests.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICES_DIR = path.join(__dirname, '../services');
const APPS_DIR = path.join(__dirname, '../apps');

function findTestFiles(dir) {
  const files = [];

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) return;

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function runTestFile(filePath, serviceDir) {
  try {
    // Use forward slashes so jest can use the path as a regex filter on Windows
    const posixPath = filePath.replace(/\\/g, '/');
    execSync(`npx jest "${posixPath}" --forceExit --testTimeout=10000`, {
      stdio: 'pipe',
      cwd: serviceDir,
      timeout: 60000,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function promoteTddTests() {
  console.log('🔄 Checking TDD tests for auto-promotion...\n');

  let promoted = 0;
  let failed = 0;

  // Check services
  const services = fs.readdirSync(SERVICES_DIR);
  for (const service of services) {
    const tddDir = path.join(SERVICES_DIR, service, 'tests', 'tdd');
    if (!fs.existsSync(tddDir)) continue;

    const tddTests = findTestFiles(tddDir);
    for (const testFile of tddTests) {
      const testName = path.basename(testFile);
      console.log(`  Testing: ${service}/tests/tdd/${testName}`);

      if (runTestFile(testFile, path.join(SERVICES_DIR, service))) {
        // Test passed! Promote to regression
        const regressionDir = path.join(SERVICES_DIR, service, 'tests', 'regression');
        fs.mkdirSync(regressionDir, { recursive: true });

        const newPath = path.join(regressionDir, testName);
        fs.renameSync(testFile, newPath);

        console.log(`    ✅ PROMOTED to regression/${testName}\n`);
        promoted++;
      } else {
        console.log(`    ⏸️  Still failing, keeping in tdd/\n`);
        failed++;
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Promoted: ${promoted}`);
  console.log(`⏸️  Still in TDD: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (promoted > 0) {
    console.log('🎉 Tests promoted! Remember to commit the changes.\n');
  }
}

promoteTddTests();
