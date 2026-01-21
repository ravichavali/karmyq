#!/usr/bin/env node
/**
 * Update Service Dependencies Script
 *
 * Removes hoisted dependencies from service package.json files
 * since they're now in the root package.json
 */

const fs = require('fs');
const path = require('path');

// Dependencies now hoisted to root
const HOISTED_DEPS = [
  'express',
  'pg',
  'redis',
  'bull',
  'winston',
  'zod',
  'dotenv',
  'express-rate-limit',
  'bcryptjs',
  'jsonwebtoken',
  'ioredis',
  'cors'
];

const SERVICES_DIR = path.join(__dirname, '../services');

function updateServicePackageJson(servicePath) {
  const pkgPath = path.join(servicePath, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const serviceName = path.basename(servicePath);

  let removed = [];

  // Remove hoisted dependencies
  if (pkg.dependencies) {
    HOISTED_DEPS.forEach(dep => {
      if (pkg.dependencies[dep]) {
        removed.push(`${dep}@${pkg.dependencies[dep]}`);
        delete pkg.dependencies[dep];
      }
    });
  }

  // Write back if changes were made
  if (removed.length > 0) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ ${serviceName}: Removed ${removed.length} hoisted deps`);
    removed.forEach(dep => console.log(`  - ${dep}`));
    return removed.length;
  }

  return 0;
}

function main() {
  console.log('🔧 Updating service package.json files...\n');

  const services = fs.readdirSync(SERVICES_DIR)
    .filter(name => {
      const servicePath = path.join(SERVICES_DIR, name);
      return fs.statSync(servicePath).isDirectory() &&
             !name.startsWith('.') &&
             name !== 'node_modules';
    });

  let totalRemoved = 0;
  let servicesUpdated = 0;

  services.forEach(service => {
    const servicePath = path.join(SERVICES_DIR, service);
    const removed = updateServicePackageJson(servicePath);

    if (removed && removed > 0) {
      totalRemoved += removed;
      servicesUpdated++;
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Updated ${servicesUpdated} service(s)`);
  console.log(`📦 Removed ${totalRemoved} duplicate dependency declarations`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Next steps:');
  console.log('1. Run: npm install');
  console.log('2. Test services to ensure they still work');
  console.log('3. Run: npm run analyze:services');
}

main();
