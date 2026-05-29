/**
 * Main simulation orchestrator — WorkerPool architecture
 * Sprint 72: 10 concurrent async workers running 24/7
 */

import { SimulationConfig } from './types';
import { WorkerPool } from './worker-pool';
import { initPool, closePool, getUserCount, userExistsByEmail } from './db-user-loader';
import { registerNewUser } from './workflows';
import { FOUNDERS } from './data/realistic-data';

export class Simulator {
  private pool: WorkerPool | null = null;

  constructor(private config: SimulationConfig) {
    if (!config.databaseUrl || !config.jwtSecret) {
      console.error('❌ DATABASE_URL and JWT_SECRET must be set.');
      throw new Error('Missing DATABASE_URL or JWT_SECRET');
    }

    initPool(config.databaseUrl, config.jwtSecret);
  }

  async start() {
    console.log('🚀 Starting Karmyq simulation engine...');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Growth: ${this.config.growth.newUsersPerDay} new users/day → target ${this.config.growth.maxUsers} users`);


    await this.bootstrapFounders();

    const growthInterval = setInterval(
      () => this.maybeRegisterNewUser().catch(console.error),
      3 * 60 * 1000
    );

    this.pool = new WorkerPool(this.config);
    const workerCount = this.config.workers?.count ?? 10;
    await this.pool.start(workerCount);

    clearInterval(growthInterval);
  }

  async stop() {
    console.log('🛑 Stopping simulation...');
    if (this.pool) {
      this.pool.stop();
    }
    await closePool();
    console.log('✅ Simulation stopped');
  }

  /**
   * Bootstrap the named founders if they don't exist yet.
   */
  private async bootstrapFounders() {
    const { emailDomain, password } = this.config.growth;
    console.log('🌱 Checking founder accounts...');

    for (const founder of FOUNDERS) {
      const email = `${founder.firstName.toLowerCase()}.${founder.lastName.toLowerCase()}@${emailDomain}`;
      const exists = await userExistsByEmail(email);
      if (!exists) {
        try {
          const { ApiClient } = await import('./api-client');
          const client = new ApiClient(this.config.apiBaseUrl);
          const result = await client.register({
            email,
            name: `${founder.firstName} ${founder.lastName}`,
            password
          });
          if (result?.user) {
            console.log(`🌱 Created founder: ${founder.firstName} ${founder.lastName} <${email}>`);
          }
        } catch (error: any) {
          if (!error.message?.includes('already')) {
            console.error(`[founders] Failed to create ${email}:`, error.message);
          }
        }
      }
    }

    const count = await getUserCount();
    console.log(`🌱 Founders ready. Total sim users: ${count}`);
  }

  /**
   * Probabilistically register a new user based on target growth rate.
   * Called every 3 minutes via setInterval (~480 ticks/day).
   */
  private async maybeRegisterNewUser() {
    const { newUsersPerDay, maxUsers, emailDomain, password } = this.config.growth;

    const currentCount = await getUserCount();
    if (currentCount >= maxUsers) return;

    // ~480 growth ticks per day → probability per tick
    const probability = newUsersPerDay / 480;
    if (Math.random() > probability) return;

    const newUser = await registerNewUser(this.config.apiBaseUrl, emailDomain, password);
    if (newUser) {
      console.log(`[growth] New user registered: ${newUser.email}`);
    }
  }
}
