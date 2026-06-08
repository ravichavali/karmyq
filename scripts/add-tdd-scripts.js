#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SERVICES = [
  'auth-service', 'community-service',
  'notification-service', 'reputation-service',
  'request-service', 'social-graph-service'
];

for (const service of SERVICES) {
  const pkgPath = path.join(__dirname, '../services', service, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Update test scripts
  pkg.scripts.test = 'npm run test:unit && npm run test:regression';
  pkg.scripts['test:unit'] = 'jest tests/unit --passWithNoTests';
  pkg.scripts['test:regression'] = 'jest tests/regression --passWithNoTests';
  pkg.scripts['test:tdd'] = 'jest tests/tdd --passWithNoTests';
  pkg.scripts['test:integration'] = 'jest tests/integration';

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated ${service}`);
}

console.log('\n✅ All services updated');
