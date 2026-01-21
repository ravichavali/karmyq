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
    ...(defaultConfig as SimulationConfig),
    apiBaseUrl: process.env.API_BASE_URL || defaultConfig.apiBaseUrl,
    enabled: process.env.SIMULATION_ENABLED === 'true' || defaultConfig.enabled,
    environment: (process.env.ENVIRONMENT as any) || defaultConfig.environment,

    // Override users config from environment
    users: {
      ...defaultConfig.users,
      total: process.env.TOTAL_USERS ? parseInt(process.env.TOTAL_USERS) : defaultConfig.users.total,
      concurrentSessions: {
        min: process.env.MIN_CONCURRENT_SESSIONS ? parseInt(process.env.MIN_CONCURRENT_SESSIONS) : defaultConfig.users.concurrentSessions.min,
        max: process.env.MAX_CONCURRENT_SESSIONS ? parseInt(process.env.MAX_CONCURRENT_SESSIONS) : defaultConfig.users.concurrentSessions.max
      },
      profiles: defaultConfig.users.profiles
    },

    // Override rate limit config from environment
    rateLimit: {
      respectLimits: process.env.RESPECT_RATE_LIMITS !== undefined ? process.env.RESPECT_RATE_LIMITS === 'true' : defaultConfig.rateLimit.respectLimits,
      minDelayMs: process.env.MIN_DELAY_MS ? parseInt(process.env.MIN_DELAY_MS) : defaultConfig.rateLimit.minDelayMs,
      maxRetries: process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : defaultConfig.rateLimit.maxRetries
    },

    // Override schedule config from environment
    schedule: {
      type: defaultConfig.schedule.type as 'continuous' | 'cron',
      businessHours: {
        enabled: process.env.BUSINESS_HOURS_ENABLED === 'true',
        start: process.env.BUSINESS_HOURS_START || defaultConfig.schedule.businessHours.start,
        end: process.env.BUSINESS_HOURS_END || defaultConfig.schedule.businessHours.end,
        timezone: process.env.BUSINESS_HOURS_TIMEZONE || defaultConfig.schedule.businessHours.timezone
      }
    }
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
