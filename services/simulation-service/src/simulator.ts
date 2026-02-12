/**
 * Main simulation orchestrator
 */

import { SimulatedUser, SimulationConfig, UserSession, Workflow } from './types';
import { SessionManager } from './session-manager';
import { assignProfile } from './profiles';
import { delay, randomInt, isBusinessHours, timeUnitToMs } from './utils';
import {
  browseWorkflow,
  createRequestWorkflow,
  offerHelpWorkflow,
  messageWorkflow,
  completeMatchWorkflow,
  joinCommunityWorkflow,
  acceptOfferWorkflow,
  createCommunityWorkflow
} from './workflows';
import { initPool, closePool, getRandomUser } from './db-user-loader';

export class Simulator {
  private sessionManager: SessionManager;
  private activeSessions: Map<string, UserSession> = new Map();
  private isRunning: boolean = false;

  constructor(private config: SimulationConfig) {
    this.sessionManager = new SessionManager(config);

    if (!config.databaseUrl || !config.jwtSecret) {
      console.error('❌ DATABASE_URL and JWT_SECRET must be set.');
      throw new Error('Missing DATABASE_URL or JWT_SECRET');
    }

    // Initialize database connection for loading users
    initPool(config.databaseUrl, config.jwtSecret);
  }

  /**
   * Start the simulation
   */
  async start() {
    console.log('🚀 Starting synthetic user simulation...');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Total simulated users: ${this.config.users.total}`);
    console.log(`Concurrent sessions: ${this.config.users.concurrentSessions.min}-${this.config.users.concurrentSessions.max}`);

    this.isRunning = true;

    // Main simulation loop
    while (this.isRunning) {
      try {
        // Check if we're within business hours (if enabled)
        if (this.config.schedule.businessHours.enabled && !isBusinessHours(this.config.schedule.businessHours)) {
          console.log('⏰ Outside business hours, waiting...');
          await delay(5 * 60 * 1000); // Wait 5 minutes
          continue;
        }

        // Determine how many sessions should be active
        const targetSessions = randomInt(
          this.config.users.concurrentSessions.min,
          this.config.users.concurrentSessions.max
        );

        // Start new sessions if below target
        while (this.activeSessions.size < targetSessions) {
          const user = await this.createSimulatedUser();
          await this.startUserSession(user);
        }

        // Wait before next check (1-5 minutes)
        await delay(randomInt(60, 300) * 1000);

      } catch (error: any) {
        console.error('❌ Simulation error:', error.message);
        await delay(60 * 1000); // Wait 1 minute before retrying
      }
    }
  }

  /**
   * Stop the simulation
   */
  async stop() {
    console.log('🛑 Stopping simulation...');
    this.isRunning = false;

    // End all active sessions
    for (const session of this.activeSessions.values()) {
      await this.sessionManager.endSession(session);
    }

    this.activeSessions.clear();
    await closePool();
    console.log('✅ Simulation stopped');
  }

  /**
   * Create a simulated user by querying a random user from the database
   */
  private async createSimulatedUser(): Promise<SimulatedUser> {
    const dbUser = await getRandomUser();
    const profile = assignProfile(this.config.users.profiles);

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      profile
    };
  }

  /**
   * Start a user session and run their workflow
   */
  private async startUserSession(user: SimulatedUser) {
    try {
      // Start session
      const session = await this.sessionManager.startSession(user);
      this.activeSessions.set(user.id, session);

      // Run session in background
      this.runUserSession(session).catch(error => {
        console.error(`[${user.email}] Session error:`, error.message);
      });

    } catch (error: any) {
      console.error(`Failed to start session for ${user.email}:`, error.message);
    }
  }

  /**
   * Run a user's session workflow
   */
  private async runUserSession(session: UserSession) {
    const { user } = session;
    const profile = user.profile;

    console.log(`[${user.email}] Running ${profile.name} session`);

    try {
      // Determine session duration
      const sessionDuration = randomInt(
        profile.sessionDuration.min,
        profile.sessionDuration.max
      ) * timeUnitToMs(profile.sessionDuration.unit);

      const sessionEnd = Date.now() + sessionDuration;

      // Perform actions during session
      while (Date.now() < sessionEnd && session.isActive) {
        await this.performRandomAction(session);

        // Wait between actions (1-3 minutes)
        await delay(randomInt(60, 180) * 1000);
      }

    } finally {
      // End session
      await this.sessionManager.endSession(session);
      this.activeSessions.delete(user.id);
    }
  }

  /**
   * Perform a random action based on user profile
   */
  private async performRandomAction(session: UserSession) {
    // Check if user has communities
    const client = this.sessionManager.getClient(session);
    const communities = await this.sessionManager.executeAction(
      session,
      'checkCommunities',
      () => client.getCommunities(session.user.id)
    );

    const hasCommunities = communities && communities.length > 0;

    // If user has NO communities, always join communities first
    if (!hasCommunities) {
      console.log(`[${session.user.email}] Performing action: joinCommunity (no communities)`);
      await joinCommunityWorkflow({ session, config: this.config, sessionManager: this.sessionManager });
      return;
    }

    const actions = session.user.profile.actions;
    const workflows: Array<{ weight: number; workflow: Workflow; name: string }> = [];

    // If user has communities, add join community as a low-weight option (occasional expansion)
    workflows.push({
      weight: 0.05, // 5% chance to join more communities
      workflow: joinCommunityWorkflow,
      name: 'joinCommunity'
    });

    // Build weighted workflow list
    if (actions.browseRequests) {
      workflows.push({
        weight: actions.browseRequests.weight,
        workflow: browseWorkflow,
        name: 'browse'
      });
    }

    if (actions.createRequests) {
      workflows.push({
        weight: actions.createRequests.weight,
        workflow: createRequestWorkflow,
        name: 'createRequest'
      });
    }

    if (actions.offerHelp) {
      workflows.push({
        weight: actions.offerHelp.weight,
        workflow: offerHelpWorkflow,
        name: 'offerHelp'
      });
    }

    if (actions.sendMessages) {
      workflows.push({
        weight: actions.sendMessages.weight,
        workflow: messageWorkflow,
        name: 'sendMessage'
      });
    }

    if (actions.completeMatches) {
      workflows.push({
        weight: actions.completeMatches.weight,
        workflow: completeMatchWorkflow,
        name: 'completeMatch'
      });
    }

    if (actions.acceptOffers) {
      workflows.push({
        weight: actions.acceptOffers.weight,
        workflow: acceptOfferWorkflow,
        name: 'acceptOffer'
      });
    }

    if (actions.createCommunities) {
      workflows.push({
        weight: actions.createCommunities.weight,
        workflow: createCommunityWorkflow,
        name: 'createCommunity'
      });
    }

    // Select random workflow based on weights
    const totalWeight = workflows.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const wf of workflows) {
      random -= wf.weight;
      if (random <= 0) {
        console.log(`[${session.user.email}] Performing action: ${wf.name}`);
        await wf.workflow({ session, config: this.config, sessionManager: this.sessionManager });
        return;
      }
    }
  }
}
