#!/usr/bin/env node
/**
 * Auto-promote TDD tests to regression when they pass
 *
 * TDD Framework Rule: When a test in tdd/ passes, automatically move it to regression/
 * This ensures passing tests become locked-in regression tests.
 *
 * Walks both services/* and apps/* workspaces for a tests/tdd directory.
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

/**
 * Every workspace root that can hold a tests/tdd directory.
 * APPS_DIR was declared and never walked until Sprint 122 PR 2, so an
 * apps/* tdd test could never be promoted (see ADR-088).
 */
function collectTddTargets(roots = [SERVICES_DIR, APPS_DIR]) {
  const targets = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const label = path.basename(root);

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;

      const dir = path.join(root, entry.name);
      const tddDir = path.join(dir, 'tests', 'tdd');
      if (!fs.existsSync(tddDir)) continue;

      targets.push({ workspace: `${label}/${entry.name}`, dir, tddDir });
    }
  }

  return targets;
}

function promoteTddTests() {
  console.log('🔄 Checking TDD tests for auto-promotion...\n');

  let promoted = 0;
  let failed = 0;

  for (const { workspace, dir, tddDir } of collectTddTargets()) {
    for (const testFile of findTestFiles(tddDir)) {
      const testName = path.basename(testFile);
      console.log(`  Testing: ${workspace}/tests/tdd/${testName}`);

      if (runTestFile(testFile, dir)) {
        const regressionDir = path.join(dir, 'tests', 'regression');
        fs.mkdirSync(regressionDir, { recursive: true });
        fs.renameSync(testFile, path.join(regressionDir, testName));

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

module.exports = { collectTddTargets, promoteTddTests };

if (require.main === module) {
  promoteTddTests();
}
