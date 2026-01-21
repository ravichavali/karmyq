#!/usr/bin/env node
/**
 * Service Dependency Analysis Tool
 *
 * Generates:
 * - Dependency graph (Mermaid diagram)
 * - Impact analysis (what breaks if X fails)
 * - Circular dependency detection
 * - Version drift detection
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../services/registry.json');
const OUTPUT_DIR = path.join(__dirname, '../services');

// Load registry
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('ERROR: registry.json not found');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

// Generate Mermaid dependency graph
function generateDependencyGraph(registry) {
  let mermaid = '```mermaid\ngraph TD\n';

  // Add nodes
  Object.entries(registry.services).forEach(([name, config]) => {
    const status = config.status;
    const criticality = config.criticality;

    let style = '';
    if (status === 'deprecated') {
      style = ':::deprecated';
    } else if (criticality === 'critical') {
      style = ':::critical';
    } else if (criticality === 'important') {
      style = ':::important';
    }

    mermaid += `  ${name}["${name}\\nPort: ${config.port || 'N/A'}\\n${criticality}"]${style}\n`;
  });

  mermaid += '\n';

  // Add edges (service dependencies)
  Object.entries(registry.services).forEach(([name, config]) => {
    if (config.dependencies && config.dependencies.services) {
      config.dependencies.services.forEach(dep => {
        mermaid += `  ${name} --> ${dep}\n`;
      });
    }
  });

  mermaid += '\n';

  // Add infrastructure dependencies
  Object.entries(registry.services).forEach(([name, config]) => {
    if (config.dependencies && config.dependencies.infrastructure) {
      config.dependencies.infrastructure.forEach(infra => {
        mermaid += `  ${name} -.-> ${infra}[(${infra})]\n`;
      });
    }
  });

  // Add styles
  mermaid += '\n  classDef critical fill:#ff6b6b,stroke:#c92a2a,color:#fff\n';
  mermaid += '  classDef important fill:#ffd93d,stroke:#f08c00,color:#000\n';
  mermaid += '  classDef deprecated fill:#868e96,stroke:#495057,color:#fff\n';
  mermaid += '```\n';

  return mermaid;
}

// Find all consumers of a service
function findConsumers(serviceName, registry) {
  const consumers = [];

  Object.entries(registry.services).forEach(([name, config]) => {
    if (config.dependencies && config.dependencies.services) {
      if (config.dependencies.services.includes(serviceName)) {
        consumers.push(name);
      }
    }
  });

  return consumers;
}

// Calculate impact radius (recursive)
function calculateImpactRadius(serviceName, registry, visited = new Set()) {
  if (visited.has(serviceName)) {
    return [];
  }

  visited.add(serviceName);
  const consumers = findConsumers(serviceName, registry);

  let impacted = [...consumers];
  consumers.forEach(consumer => {
    const recursiveImpact = calculateImpactRadius(consumer, registry, visited);
    impacted = [...impacted, ...recursiveImpact];
  });

  return [...new Set(impacted)]; // Remove duplicates
}

// Generate impact analysis
function generateImpactAnalysis(registry) {
  let markdown = '# Service Impact Analysis\n\n';
  markdown += `**Generated**: ${new Date().toISOString()}\n\n`;
  markdown += '## Impact Radius\n\n';
  markdown += 'If a service fails, what else breaks?\n\n';

  const productionServices = Object.entries(registry.services)
    .filter(([_, config]) => config.status === 'production')
    .map(([name]) => name);

  productionServices.forEach(serviceName => {
    const impacted = calculateImpactRadius(serviceName, registry);
    const criticality = registry.services[serviceName].criticality;

    markdown += `### ${serviceName} (${criticality})\n\n`;

    if (impacted.length === 0) {
      markdown += '- ✅ No direct dependents (leaf service)\n\n';
    } else {
      markdown += `- ⚠️ Impacts **${impacted.length}** service(s):\n`;
      impacted.forEach(s => {
        const depCriticality = registry.services[s].criticality;
        markdown += `  - ${s} (${depCriticality})\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}

// Detect circular dependencies
function detectCircularDeps(registry) {
  const visited = new Set();
  const stack = new Set();
  const cycles = [];

  function dfs(node, path = []) {
    if (stack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart);
      cycles.push([...cycle, node]);
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    stack.add(node);

    const config = registry.services[node];
    if (config && config.dependencies && config.dependencies.services) {
      config.dependencies.services.forEach(dep => {
        dfs(dep, [...path, node]);
      });
    }

    stack.delete(node);
  }

  Object.keys(registry.services).forEach(service => {
    dfs(service);
  });

  return cycles;
}

// Check version drift in dependencies
function checkVersionDrift() {
  const servicesDir = path.join(__dirname, '../services');
  const packageJsons = [];

  // Read all service package.json files
  fs.readdirSync(servicesDir).forEach(serviceDir => {
    const pkgPath = path.join(servicesDir, serviceDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      packageJsons.push({ service: serviceDir, dependencies: pkg.dependencies || {} });
    }
  });

  // Find common dependencies with different versions
  const allDeps = {};
  packageJsons.forEach(({ service, dependencies }) => {
    Object.entries(dependencies).forEach(([dep, version]) => {
      if (!allDeps[dep]) {
        allDeps[dep] = {};
      }
      allDeps[dep][version] = allDeps[dep][version] || [];
      allDeps[dep][version].push(service);
    });
  });

  // Filter to only show deps with version drift
  const drifted = {};
  Object.entries(allDeps).forEach(([dep, versions]) => {
    if (Object.keys(versions).length > 1) {
      drifted[dep] = versions;
    }
  });

  return drifted;
}

// Generate version drift report
function generateVersionDriftReport(drift) {
  if (Object.keys(drift).length === 0) {
    return '# Version Drift Report\n\n✅ No version drift detected. All services use consistent dependency versions.\n';
  }

  let markdown = '# Version Drift Report\n\n';
  markdown += `**Generated**: ${new Date().toISOString()}\n\n`;
  markdown += '⚠️ **Warning**: The following dependencies have version drift across services:\n\n';

  Object.entries(drift).forEach(([dep, versions]) => {
    markdown += `## ${dep}\n\n`;
    Object.entries(versions).forEach(([version, services]) => {
      markdown += `- **${version}**: ${services.join(', ')}\n`;
    });
    markdown += '\n';
  });

  markdown += '## Recommendation\n\n';
  markdown += 'Hoist common dependencies to root `package.json` to ensure version consistency.\n';

  return markdown;
}

// Main execution
function main() {
  console.log('🔍 Analyzing services...\n');

  const registry = loadRegistry();

  // 1. Generate dependency graph
  console.log('📊 Generating dependency graph...');
  const dependencyGraph = generateDependencyGraph(registry);
  const graphPath = path.join(OUTPUT_DIR, 'dependency-graph.md');

  let graphMarkdown = '# Service Dependency Graph\n\n';
  graphMarkdown += `**Generated**: ${new Date().toISOString()}\n\n`;
  graphMarkdown += '## Legend\n\n';
  graphMarkdown += '- 🔴 Red nodes: **Critical** services (system fails if down)\n';
  graphMarkdown += '- 🟡 Yellow nodes: **Important** services (degraded experience if down)\n';
  graphMarkdown += '- ⚪ White nodes: **Optional** services\n';
  graphMarkdown += '- 🔘 Gray nodes: **Deprecated** services\n';
  graphMarkdown += '- Solid arrows: Service dependencies\n';
  graphMarkdown += '- Dotted arrows: Infrastructure dependencies\n\n';
  graphMarkdown += dependencyGraph;

  fs.writeFileSync(graphPath, graphMarkdown);
  console.log(`   ✓ Written to ${graphPath}`);

  // 2. Generate impact analysis
  console.log('💥 Calculating impact radius...');
  const impactAnalysis = generateImpactAnalysis(registry);
  const impactPath = path.join(OUTPUT_DIR, 'impact-analysis.md');
  fs.writeFileSync(impactPath, impactAnalysis);
  console.log(`   ✓ Written to ${impactPath}`);

  // 3. Detect circular dependencies
  console.log('🔄 Detecting circular dependencies...');
  const cycles = detectCircularDeps(registry);
  if (cycles.length > 0) {
    console.log(`   ⚠️  Found ${cycles.length} circular dependency chain(s):`);
    cycles.forEach(cycle => {
      console.log(`      ${cycle.join(' → ')}`);
    });
  } else {
    console.log('   ✓ No circular dependencies detected');
  }

  // 4. Check version drift
  console.log('📦 Checking version drift...');
  const drift = checkVersionDrift();
  const driftReport = generateVersionDriftReport(drift);
  const driftPath = path.join(OUTPUT_DIR, 'version-drift.md');
  fs.writeFileSync(driftPath, driftReport);

  if (Object.keys(drift).length > 0) {
    console.log(`   ⚠️  Found version drift in ${Object.keys(drift).length} package(s)`);
    console.log(`   📄 Details in ${driftPath}`);
  } else {
    console.log('   ✓ No version drift detected');
  }

  console.log('\n✅ Analysis complete!\n');
  console.log('Generated files:');
  console.log(`  - ${graphPath}`);
  console.log(`  - ${impactPath}`);
  console.log(`  - ${driftPath}`);
}

main();
