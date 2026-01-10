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
  completeMatchWorkflow
} from './workflows';
import { loadUserCredentials, getRandomUser, UserCredentials } from './credentials-loader';

export class Simulator {
  private sessionManager: SessionManager;
  private activeSessions: Map<string, UserSession> = new Map();
  private isRunning: boolean = false;
  private userCredentials: UserCredentials[] = [];
  private usedUserIds: Set<string> = new Set();

  constructor(private config: SimulationConfig) {
    this.sessionManager = new SessionManager(config);

    // Load user credentials
    this.userCredentials = loadUserCredentials(config.environment);

    if (this.userCredentials.length === 0) {
      console.error('❌ No user credentials loaded. Cannot start simulation.');
      console.error('   Create users first: node create-simulated-users.js --env production --count 20');
      throw new Error('No user credentials available');
    }
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
        // Check if we're within business hours
        if (!isBusinessHours(this.config.schedule.businessHours)) {
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
          const user = this.createSimulatedUser();
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
    console.log('✅ Simulation stopped');
  }

  /**
   * Create a simulated user from loaded credentials
   */
  private createSimulatedUser(): SimulatedUser {
    // Get a random user that's not currently active
    const availableUsers = this.userCredentials.filter(
      u => !this.usedUserIds.has(u.userId)
    );

    if (availableUsers.length === 0) {
      // All users are active, reuse a random one
      const userCreds = getRandomUser(this.userCredentials);
      if (!userCreds) {
        throw new Error('No user credentials available');
      }

      // Assign profile based on credentials
      const profile = assignProfile(this.config.users.profiles);

      return {
        id: userCreds.userId,
        email: userCreds.email,
        name: userCreds.name,
        password: userCreds.password,
        profile
      };
    }

    // Use an available user
    const userCreds = availableUsers[randomInt(0, availableUsers.length - 1)];
    this.usedUserIds.add(userCreds.userId);

    // Assign profile based on credentials
    const profile = assignProfile(this.config.users.profiles);

    return {
      id: userCreds.userId,
      email: userCreds.email,
      name: userCreds.name,
      password: userCreds.password,
      profile
    };
  }

  /**
   * Generate random name
   */
  private generateRandomName(): string {
    const firstNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore'];

    return `${firstNames[randomInt(0, firstNames.length - 1)]} ${lastNames[randomInt(0, lastNames.length - 1)]}`;
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
    const actions = session.user.profile.actions;
    const workflows: Array<{ weight: number; workflow: Workflow; name: string }> = [];

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
