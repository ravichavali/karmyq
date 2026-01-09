/**
 * Karmyq Synthetic User Simulation Service
 *
 * Continuously simulates realistic user behavior on the demo environment
 * to create a living, active platform for demos and investor presentations.
 *
 * Based on ADR-006: Synthetic User Simulation for Demo Environment
 */

import * as dotenv from 'dotenv';
import { Simulator } from './simulator';
import { SimulationConfig } from './types';
import defaultConfig from './config/default.json';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment or defaults
 */
function loadConfig(): SimulationConfig {
  const config: SimulationConfig = {
    ...defaultConfig,
    apiBaseUrl: process.env.API_BASE_URL || defaultConfig.apiBaseUrl,
    enabled: process.env.SIMULATION_ENABLED === 'true' || defaultConfig.enabled,
    environment: (process.env.ENVIRONMENT as any) || defaultConfig.environment
  };

  return config;
}

/**
 * Main entry point
 */
async function main() {
  const config = loadConfig();

  if (!config.enabled) {
    console.log('❌ Simulation is disabled (SIMULATION_ENABLED=false)');
    process.exit(0);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Karmyq Synthetic User Simulation Service');
  console.log('  Version 1.0.0 (Phase 1: Foundation)');
  console.log('='.repeat(60) + '\n');

  const simulator = new Simulator(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n📡 Received SIGINT, shutting down gracefully...');
    await simulator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n📡 Received SIGTERM, shutting down gracefully...');
    await simulator.stop();
    process.exit(0);
  });

  // Start simulation
  try {
    await simulator.start();
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { Simulator, loadConfig };
