#!/usr/bin/env node
/**
 * Add TDD framework test scripts to all service package.json files
 */

const fs = require('fs');
const path = require('path');

const SERVICES = [
  'auth-service',
  'community-service',
  'feed-service',
  'notification-service',
  'reputation-service',
  'request-service',
  'social-graph-service'
];

for (const service of SERVICES) {
  const pkgPath = path.join(__dirname, '../services', service, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Update test scripts
  pkg.scripts.test = 'jest --testPathPattern="(unit|regression)"';
  pkg.scripts['test:unit'] = 'jest --testPathPattern=unit';
  pkg.scripts['test:regression'] = 'jest --testPathPattern=regression';
  pkg.scripts['test:tdd'] = 'jest --testPathPattern=tdd';
  pkg.scripts['test:integration'] = 'jest --testPathPattern=integration';

  // Write back
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated ${service}`);
}

console.log('\n✅ All services updated with TDD framework scripts');
