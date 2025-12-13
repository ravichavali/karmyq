import cron from 'node-cron';
import { calculateAllCommunityMetrics } from '../services/healthMetricsService';
import { detectAllCommunityMilestones } from '../services/milestoneDetector';

/**
 * Daily Health Metrics Calculator
 * Social Karma v2.0: Automated community health tracking
 *
 * Runs daily at 2:00 AM to calculate health metrics for all communities
 */
export function initHealthMetricsCalculator(): void {
  // Run daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('=== Starting Daily Health Metrics Calculation ===');
    console.log(`Time: ${new Date().toISOString()}`);

    try {
      // Step 1: Calculate health metrics for all communities
      await calculateAllCommunityMetrics();

      // Step 2: Detect milestone achievements
      await detectAllCommunityMilestones();

      console.log('=== Daily Health Metrics Calculation Complete ===');
    } catch (error) {
      console.error('=== Error in Daily Health Metrics Calculation ===');
      console.error(error);
    }
  });

  console.log('✅ Health metrics calculator initialized (runs daily at 2:00 AM)');

  // Optional: Run on startup in development mode
  if (process.env.RUN_METRICS_ON_STARTUP === 'true') {
    console.log('Running health metrics calculation on startup (development mode)');
    setTimeout(async () => {
      try {
        await calculateAllCommunityMetrics();
        await detectAllCommunityMilestones();
        console.log('Startup health metrics calculation complete');
      } catch (error) {
        console.error('Error in startup health metrics calculation:', error);
      }
    }, 5000); // Wait 5 seconds for services to initialize
  }
}

/**
 * Manual trigger for health metrics calculation
 * Useful for testing or manual recalculation
 */
export async function manualCalculateHealthMetrics(): Promise<void> {
  console.log('=== Manual Health Metrics Calculation Triggered ===');

  try {
    await calculateAllCommunityMetrics();
    await detectAllCommunityMilestones();
    console.log('=== Manual Health Metrics Calculation Complete ===');
  } catch (error) {
    console.error('=== Error in Manual Health Metrics Calculation ===');
    console.error(error);
    throw error;
  }
}
