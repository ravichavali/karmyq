import { SimulationConfig, SimulatedUser } from './types';
import { getRandomUser, generateToken } from './db-user-loader';
import { ApiClient } from './api-client';
import { assignProfile, selectWorkflow } from './profiles';
import { delay, randomInt } from './utils';

export class WorkerPool {
  private isRunning = false;

  constructor(private config: SimulationConfig) {}

  async start(workerCount: number): Promise<void> {
    this.isRunning = true;
    console.log(`🔧 Starting ${workerCount} simulation workers (24/7)...`);
    await Promise.all(
      Array.from({ length: workerCount }, (_, i) => this.runWorker(i))
    );
  }

  stop(): void {
    this.isRunning = false;
  }

  private async runWorker(id: number): Promise<void> {
    console.log(`[worker-${id}] started`);
    while (this.isRunning) {
      try {
        const dbUser = await getRandomUser();
        const profile = assignProfile(this.config.users.profiles);
        const user: SimulatedUser = { id: dbUser.id, email: dbUser.email, name: dbUser.name, profile };

        const token = await generateToken({ id: dbUser.id, email: dbUser.email, name: dbUser.name });
        const client = new ApiClient(this.config.apiBaseUrl);
        client.setToken(token);

        const workflow = await selectWorkflow(user, client, this.config);
        await workflow();

        await delay(randomInt(
          this.config.workers?.delayMs?.min ?? 5_000,
          this.config.workers?.delayMs?.max ?? 30_000
        ));
      } catch (err: any) {
        console.error(`[worker-${id}] error: ${err.message}`);
        await delay(10_000);
      }
    }
    console.log(`[worker-${id}] stopped`);
  }
}
