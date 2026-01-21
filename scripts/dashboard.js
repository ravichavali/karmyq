#!/usr/bin/env node
/**
 * Interactive Service Dashboard
 *
 * Shows real-time status of all Karmyq services
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const REGISTRY_PATH = path.join(__dirname, '../services/registry.json');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(colorize('ERROR: registry.json not found', colors.red));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

async function checkHealth(url, timeout = 2000) {
  return new Promise((resolve) => {
    const curl = exec(`curl -sf --max-time ${timeout / 1000} "${url}"`, (error) => {
      resolve(!error);
    });
  });
}

function getCriticalityColor(criticality) {
  switch (criticality) {
    case 'critical': return colors.red;
    case 'important': return colors.yellow;
    case 'optional': return colors.blue;
    default: return colors.gray;
  }
}

function getStatusIcon(isHealthy, criticality, status) {
  if (status === 'deprecated') return colorize('⊗', colors.gray);
  if (status === 'development') return colorize('◐', colors.cyan);
  if (!isHealthy) return colorize('✗', colors.red);
  return colorize('✓', colors.green);
}

function padRight(str, length) {
  return str + ' '.repeat(Math.max(0, length - str.length));
}

function padLeft(str, length) {
  return ' '.repeat(Math.max(0, length - str.length)) + str;
}

async function displayDashboard(registry, healthChecks = {}) {
  console.clear();

  // Header
  console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', colors.cyan));
  console.log(colorize('║', colors.cyan) + colorize('                    KARMYQ SERVICE DASHBOARD                                ', colors.bright + colors.cyan) + colorize('║', colors.cyan));
  console.log(colorize('╠════════════════════════════════════════════════════════════════════════════╣', colors.cyan));

  const now = new Date().toISOString();
  const stats = registry.statistics;
  console.log(colorize('║', colors.cyan) + ` Updated: ${now}                              ` + colorize('║', colors.cyan));
  console.log(colorize('║', colors.cyan) + ` Total: ${stats.total_services} | Production: ${colorize(stats.production_services, colors.green)} | Development: ${colorize(stats.development_services, colors.cyan)} | Deprecated: ${colorize(stats.deprecated_services, colors.gray)}     ` + colorize('║', colors.cyan));
  console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', colors.cyan));
  console.log('');

  // Table header
  console.log(colorize(
    padRight('Service', 22) +
    padLeft('Port', 6) + '  ' +
    padRight('Status', 12) + '  ' +
    padRight('Health', 8) + '  ' +
    padRight('Criticality', 12) + '  ' +
    'Consumers',
    colors.bright
  ));
  console.log(colorize('─'.repeat(80), colors.gray));

  // Sort services: production first, then by criticality
  const criticalityOrder = { critical: 0, important: 1, optional: 2, none: 3 };
  const statusOrder = { production: 0, development: 1, deprecated: 2 };

  const sortedServices = Object.entries(registry.services).sort(([, a], [, b]) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return criticalityOrder[a.criticality] - criticalityOrder[b.criticality];
  });

  // Display each service
  for (const [name, config] of sortedServices) {
    const isHealthy = healthChecks[name] !== undefined ? healthChecks[name] : null;
    const port = config.port || 'N/A';
    const portStr = port === 'N/A' ? padLeft(colorize(port, colors.gray), 6) : padLeft(port.toString(), 6);

    // Count consumers
    let consumers = 0;
    Object.values(registry.services).forEach(svc => {
      if (svc.dependencies?.services?.includes(name)) {
        consumers++;
      }
    });

    // Status
    let statusStr = config.status;
    if (config.status === 'production') {
      statusStr = colorize(statusStr, colors.green);
    } else if (config.status === 'development') {
      statusStr = colorize(statusStr, colors.cyan);
    } else {
      statusStr = colorize(statusStr, colors.gray);
    }

    // Health
    let healthStr;
    if (isHealthy === null) {
      healthStr = colorize('N/A', colors.gray);
    } else if (isHealthy) {
      healthStr = colorize('✓ UP', colors.green);
    } else {
      healthStr = colorize('✗ DOWN', colors.red);
    }

    // Criticality
    const critColor = getCriticalityColor(config.criticality);
    const critStr = colorize(config.criticality, critColor);

    // Icon
    const icon = getStatusIcon(isHealthy, config.criticality, config.status);

    console.log(
      `${icon} ` +
      padRight(name, 20) +
      portStr + '  ' +
      padRight(statusStr, 22) + '  ' +
      padRight(healthStr, 14) + '  ' +
      padRight(critStr, 20) + '  ' +
      (consumers > 0 ? colorize(consumers.toString(), colors.yellow) : colorize('0', colors.gray))
    );
  }

  console.log('');

  // Summary
  const healthyCount = Object.values(healthChecks).filter(h => h === true).length;
  const unhealthyCount = Object.values(healthChecks).filter(h => h === false).length;
  const criticalDown = sortedServices.filter(([name, config]) =>
    config.criticality === 'critical' &&
    config.status === 'production' &&
    healthChecks[name] === false
  ).length;

  console.log(colorize('HEALTH SUMMARY:', colors.bright));
  console.log(`  ${colorize('●', colors.green)} Healthy: ${healthyCount}`);
  console.log(`  ${colorize('●', colors.red)} Unhealthy: ${unhealthyCount}`);
  if (criticalDown > 0) {
    console.log(`  ${colorize('⚠', colors.red + colors.bright)} CRITICAL services down: ${colorize(criticalDown, colors.red + colors.bright)}`);
  }

  console.log('');
  console.log(colorize('Press Ctrl+C to exit | Refreshing every 5 seconds...', colors.dim));
}

async function checkAllServices(registry) {
  const healthChecks = {};
  const promises = [];

  for (const [name, config] of Object.entries(registry.services)) {
    if (config.health_check && config.status === 'production') {
      promises.push(
        checkHealth(config.health_check).then(isHealthy => {
          healthChecks[name] = isHealthy;
        })
      );
    }
  }

  await Promise.all(promises);
  return healthChecks;
}

async function main() {
  const registry = loadRegistry();

  // Initial display
  await displayDashboard(registry);

  // Refresh every 5 seconds
  setInterval(async () => {
    const healthChecks = await checkAllServices(registry);
    await displayDashboard(registry, healthChecks);
  }, 5000);

  // First health check
  const healthChecks = await checkAllServices(registry);
  await displayDashboard(registry, healthChecks);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n' + colorize('Dashboard stopped', colors.yellow));
  process.exit(0);
});

main();
