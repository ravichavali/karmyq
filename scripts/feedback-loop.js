#!/usr/bin/env node
/**
 * Feedback Loop Automation
 *
 * Detects changes and prompts to update correct context files
 * Run automatically via git hooks or manually
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGISTRY_PATH = path.join(__dirname, '../services/registry.json');

function getChangedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

function analyzeChanges(changedFiles) {
  const updates = {
    servicesChanged: new Set(),
    apiChanges: [],
    schemaChanges: [],
    dependencyChanges: [],
    needsRegistryUpdate: false,
    needsADR: false,
    needsSimulationUpdate: false,
    missingContextUpdates: [],
    missingMigrationDocs: [],
    newAdrWithoutIndex: false,
  };

  changedFiles.forEach(file => {
    // Service changes
    const serviceMatch = file.match(/^services\/([^/]+)\//);
    if (serviceMatch) {
      const serviceName = serviceMatch[1];
      updates.servicesChanged.add(serviceName);

      // API route changes
      if (file.includes('/routes/')) {
        updates.apiChanges.push({
          service: serviceName,
          file: file,
          action: 'UPDATE_CONTEXT_API_SECTION'
        });
      }

      // Database changes
      if (file.includes('/database/') || file.includes('/models/')) {
        updates.schemaChanges.push({
          service: serviceName,
          file: file,
          action: 'UPDATE_CONTEXT_SCHEMA_SECTION'
        });
      }

      // Package.json changes (new dependencies)
      if (file.endsWith('package.json')) {
        updates.dependencyChanges.push({
          service: serviceName,
          file: file,
          action: 'CHECK_REGISTRY_DEPENDENCIES'
        });
      }
    }

    // Registry changes
    if (file === 'services/registry.json') {
      updates.needsRegistryUpdate = true;
    }

    // Database schema changes
    if (file.includes('infrastructure/postgres/init.sql') ||
        file.includes('infrastructure/postgres/migrations/')) {
      updates.schemaChanges.push({
        service: 'ALL',
        file: file,
        action: 'UPDATE_ALL_SERVICE_CONTEXTS'
      });
    }

    // New service detection
    if (file.includes('services/') && !file.includes('registry.json')) {
      const newServiceMatch = file.match(/^services\/([^/]+)\/src\/index\.ts$/);
      if (newServiceMatch) {
        updates.needsSimulationUpdate = true;
      }
    }

    // ADR added without index update
    if (file.match(/^docs\/adr\/ADR-\d+.*\.md$/)) {
      updates.newAdrWithoutIndex = true;
    }

    // Migration added — check if CONTEXT.md schema section was also updated
    if (file.match(/^infrastructure\/postgres\/migrations\//)) {
      updates.missingMigrationDocs.push(file);
    }
  });

  // Cross-check: route files changed but CONTEXT.md not included
  const contextFilesChanged = new Set(
    changedFiles.filter(f => f.endsWith('CONTEXT.md')).map(f => {
      const m = f.match(/^services\/([^/]+)\//);
      return m ? m[1] : null;
    }).filter(Boolean)
  );

  updates.servicesChanged.forEach(service => {
    const hasRouteChange = updates.apiChanges.some(c => c.service === service);
    if (hasRouteChange && !contextFilesChanged.has(service)) {
      updates.missingContextUpdates.push(service);
    }
  });

  return updates;
}

function generateFeedbackReport(updates) {
  if (updates.servicesChanged.size === 0 &&
      !updates.needsRegistryUpdate &&
      !updates.needsADR &&
      !updates.newAdrWithoutIndex &&
      updates.missingMigrationDocs.length === 0) {
    return null;
  }

  let report = '\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '🔄 FEEDBACK LOOP: Context Updates Needed\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // API Changes
  if (updates.apiChanges.length > 0) {
    report += '📡 API Changes Detected:\n';
    updates.apiChanges.forEach(change => {
      report += `\n  Service: ${change.service}\n`;
      report += `  File: ${change.file}\n`;
      report += `  ✅ TODO:\n`;
      report += `     1. Update services/${change.service}/CONTEXT.md "API Endpoints" section\n`;
      report += `     2. Update services/registry.json "apis.provides" array\n`;
      report += `     3. Run: npm run analyze:services\n`;
      report += `     4. If used by frontend: Document in apps/frontend/.claude/API_CHANGES.md\n`;
    });
    report += '\n';
  }

  // Schema Changes
  if (updates.schemaChanges.length > 0) {
    report += '🗄️  Database Schema Changes Detected:\n';
    updates.schemaChanges.forEach(change => {
      report += `\n  Service: ${change.service}\n`;
      report += `  File: ${change.file}\n`;
      report += `  ✅ TODO:\n`;
      if (change.service === 'ALL') {
        report += `     1. Update infrastructure/postgres/init.sql\n`;
        report += `     2. Create migration in infrastructure/postgres/migrations/\n`;
        report += `     3. Update affected service CONTEXT.md files\n`;
      } else {
        report += `     1. Update services/${change.service}/CONTEXT.md "Database Schema" section\n`;
        report += `     2. Update infrastructure/postgres/init.sql if schema changed\n`;
        report += `     3. Create migration script if needed\n`;
      }
    });
    report += '\n';
  }

  // Dependency Changes
  if (updates.dependencyChanges.length > 0) {
    report += '📦 Dependency Changes Detected:\n';
    updates.dependencyChanges.forEach(change => {
      report += `\n  Service: ${change.service}\n`;
      report += `  File: ${change.file}\n`;
      report += `  ✅ TODO:\n`;
      report += `     1. Update services/registry.json "dependencies" section\n`;
      report += `     2. Run: npm run analyze:services (check for circular deps)\n`;
      report += `     3. Update services/${change.service}/.claude/README.md if needed\n`;
    });
    report += '\n';
  }

  // New Service
  if (updates.needsSimulationUpdate) {
    report += '🆕 New Service Detected:\n';
    report += `  ✅ TODO:\n`;
    report += `     1. Add entry to services/registry.json\n`;
    report += `     2. Run: node scripts/generate-service-context.js\n`;
    report += `     3. Add to docker-compose.yml\n`;
    report += `     4. Add to infrastructure/postgres/init.sql (if needs schema)\n`;
    report += `     5. Update services/simulation-service to test new service\n`;
    report += `     6. Run: npm run analyze:services\n\n`;
  }

  // Registry Update
  if (updates.needsRegistryUpdate) {
    report += '📋 Service Registry Updated:\n';
    report += `  ✅ TODO:\n`;
    report += `     1. Run: npm run analyze:services\n`;
    report += `     2. Review services/dependency-graph.md\n`;
    report += `     3. Review services/impact-analysis.md\n`;
    report += `     4. Regenerate service contexts: node scripts/generate-service-context.js\n\n`;
  }

  // Missing CONTEXT.md updates for route changes
  if (updates.missingContextUpdates.length > 0) {
    report += '⚠️  Route Changes Without CONTEXT.md Update:\n';
    updates.missingContextUpdates.forEach(service => {
      report += `\n  Service: ${service}\n`;
      report += `  ✅ TODO: Update services/${service}/CONTEXT.md "API Endpoints" section\n`;
    });
    report += '\n';
  }

  // Migration added without schema docs
  if (updates.missingMigrationDocs.length > 0) {
    report += '⚠️  Migration Added — Verify Schema Docs:\n';
    updates.missingMigrationDocs.forEach(file => {
      report += `  File: ${file}\n`;
    });
    report += `  ✅ TODO: Update affected service CONTEXT.md "Database Schema" sections\n\n`;
  }

  // ADR added
  if (updates.newAdrWithoutIndex) {
    report += '📝 New ADR Added:\n';
    report += `  ✅ TODO: Update docs/adr/README.md index with new entry\n\n`;
  }

  // Architectural Changes
  if (updates.servicesChanged.size > 3) {
    report += '🏗️  Significant Changes Detected:\n';
    report += `  Services affected: ${Array.from(updates.servicesChanged).join(', ')}\n`;
    report += `  ✅ TODO:\n`;
    report += `     1. Consider creating ADR in docs/adr/\n`;
    report += `     2. Update docs/ARCHITECTURE.md if patterns changed\n`;
    report += `     3. Update root CLAUDE.md if global patterns changed\n\n`;
  }

  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '💡 TIP: Use git commit hooks to automate these checks\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  return report;
}

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('ℹ️  No staged changes detected');
    return;
  }

  const updates = analyzeChanges(changedFiles);
  const report = generateFeedbackReport(updates);

  if (report) {
    console.log(report);
  } else {
    console.log('✅ No context updates needed for these changes');
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeChanges, generateFeedbackReport };
