/**
 * Main simulation orchestrator with organic user growth
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
  createCommunityWorkflow,
  registerAsProviderWorkflow,
  createCollectiveWorkflow,
  joinCollectiveWorkflow,
  browseProvidersWorkflow,
  scheduleActivityWorkflow,
  joinActivityWorkflow,
  registerNewUser
} from './workflows';
import { initPool, closePool, getRandomUser, getUserCount, userExistsByEmail } from './db-user-loader';
import { FOUNDERS } from './data/realistic-data';

export class Simulator {
  private sessionManager: SessionManager;
  private activeSessions: Map<string, UserSession> = new Map();
  private isRunning: boolean = false;
  private registrationsToday: number = 0;
  private registrationWindowStart: number = Date.now();

  constructor(private config: SimulationConfig) {
    this.sessionManager = new SessionManager(config);

    if (!config.databaseUrl || !config.jwtSecret) {
      console.error('❌ DATABASE_URL and JWT_SECRET must be set.');
      throw new Error('Missing DATABASE_URL or JWT_SECRET');
    }

    initPool(config.databaseUrl, config.jwtSecret);
  }

  async start() {
    console.log('🚀 Starting synthetic user simulation...');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Growth: ${this.config.growth.newUsersPerDay} new users/day → target ${this.config.growth.maxUsers} users`);

    this.isRunning = true;

    // Bootstrap founders on first start
    await this.bootstrapFounders();

    // Main simulation loop
    while (this.isRunning) {
      try {
        if (this.config.schedule.businessHours.enabled && !isBusinessHours(this.config.schedule.businessHours)) {
          console.log('⏰ Outside business hours, waiting...');
          await delay(5 * 60 * 1000);
          continue;
        }

        // Reset daily registration counter if 24h have passed
        if (Date.now() - this.registrationWindowStart > 24 * 60 * 60 * 1000) {
          this.registrationsToday = 0;
          this.registrationWindowStart = Date.now();
        }

        // Organic growth: register new users at configured rate
        await this.maybeRegisterNewUser();

        // Determine how many sessions should be active
        const targetSessions = randomInt(
          this.config.users.concurrentSessions.min,
          this.config.users.concurrentSessions.max
        );

        // Start new sessions if below target
        const userCount = await getUserCount();
        if (userCount > 0) {
          while (this.activeSessions.size < targetSessions) {
            const user = await this.createSimulatedUser();
            if (user) await this.startUserSession(user);
            else break; // No users in DB yet
          }
        }

        // Wait 1-5 minutes before next loop
        await delay(randomInt(60, 300) * 1000);

      } catch (error: any) {
        console.error('❌ Simulation error:', error.message);
        await delay(60 * 1000);
      }
    }
  }

  async stop() {
    console.log('🛑 Stopping simulation...');
    this.isRunning = false;
    for (const session of this.activeSessions.values()) {
      await this.sessionManager.endSession(session);
    }
    this.activeSessions.clear();
    await closePool();
    console.log('✅ Simulation stopped');
  }

  /**
   * Bootstrap the 5 named founders if they don't exist yet.
   * Founders get the COMMUNITY_BUILDER profile — they create communities and invite others.
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
          // May already exist in DB — that's fine
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
   * Loop runs every 1-5 min (avg ~3 min = ~480 loops/day).
   * Probability per loop = newUsersPerDay / 480.
   */
  private async maybeRegisterNewUser() {
    const { newUsersPerDay, maxUsers, emailDomain, password } = this.config.growth;

    // Don't grow past max
    const currentCount = await getUserCount();
    if (currentCount >= maxUsers) return;

    // Don't exceed daily rate
    if (this.registrationsToday >= newUsersPerDay) return;

    // Probability: target newUsersPerDay in ~480 loop ticks/day
    const probability = newUsersPerDay / 480;
    if (Math.random() > probability) return;

    const newUser = await registerNewUser(this.config.apiBaseUrl, emailDomain, password);
    if (newUser) {
      this.registrationsToday++;
      console.log(`[growth] Day registrations: ${this.registrationsToday}/${newUsersPerDay}`);

      // Give new user an immediate "onboarding" session — join communities
      const profile = assignProfile(this.config.users.profiles);
      const simUser: SimulatedUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        profile
      };
      await this.startUserSession(simUser);
    }
  }

  private async createSimulatedUser(): Promise<SimulatedUser | null> {
    try {
      const dbUser = await getRandomUser();
      const profile = assignProfile(this.config.users.profiles);
      return { id: dbUser.id, email: dbUser.email, name: dbUser.name, profile };
    } catch {
      return null;
    }
  }

  private async startUserSession(user: SimulatedUser) {
    try {
      const session = await this.sessionManager.startSession(user);
      this.activeSessions.set(user.id, session);
      this.runUserSession(session).catch(error => {
        console.error(`[${user.email}] Session error:`, error.message);
      });
    } catch (error: any) {
      console.error(`Failed to start session for ${user.email}:`, error.message);
    }
  }

  private async runUserSession(session: UserSession) {
    const { user } = session;
    const profile = user.profile;
    console.log(`[${user.email}] Running ${profile.name} session`);

    try {
      const sessionDuration = randomInt(
        profile.sessionDuration.min,
        profile.sessionDuration.max
      ) * timeUnitToMs(profile.sessionDuration.unit);

      const sessionEnd = Date.now() + sessionDuration;

      while (Date.now() < sessionEnd && session.isActive) {
        await this.performRandomAction(session);
        await delay(randomInt(60, 180) * 1000);
      }
    } finally {
      await this.sessionManager.endSession(session);
      this.activeSessions.delete(user.id);
    }
  }

  private async performRandomAction(session: UserSession) {
    const client = this.sessionManager.getClient(session);
    const communities = await this.sessionManager.executeAction(
      session,
      'checkCommunities',
      () => client.getCommunities(session.user.id)
    );

    const hasCommunities = communities && communities.length > 0;

    if (!hasCommunities) {
      console.log(`[${session.user.email}] Performing action: joinCommunity (no communities)`);
      await joinCommunityWorkflow({ session, config: this.config, sessionManager: this.sessionManager });
      return;
    }

    const actions = session.user.profile.actions;
    const workflows: Array<{ weight: number; workflow: Workflow; name: string }> = [];

    workflows.push({ weight: 0.05, workflow: joinCommunityWorkflow, name: 'joinCommunity' });

    if (actions.browseRequests) workflows.push({ weight: actions.browseRequests.weight, workflow: browseWorkflow, name: 'browse' });
    if (actions.createRequests) workflows.push({ weight: actions.createRequests.weight, workflow: createRequestWorkflow, name: 'createRequest' });
    if (actions.offerHelp) workflows.push({ weight: actions.offerHelp.weight, workflow: offerHelpWorkflow, name: 'offerHelp' });
    if (actions.sendMessages) workflows.push({ weight: actions.sendMessages.weight, workflow: messageWorkflow, name: 'sendMessage' });
    if (actions.completeMatches) workflows.push({ weight: actions.completeMatches.weight, workflow: completeMatchWorkflow, name: 'completeMatch' });
    if (actions.acceptOffers) workflows.push({ weight: actions.acceptOffers.weight, workflow: acceptOfferWorkflow, name: 'acceptOffer' });
    if (actions.createCommunities) workflows.push({ weight: actions.createCommunities.weight, workflow: createCommunityWorkflow, name: 'createCommunity' });
    if (actions.registerAsProvider) workflows.push({ weight: actions.registerAsProvider.weight, workflow: registerAsProviderWorkflow, name: 'registerAsProvider' });
    if (actions.createCollective) workflows.push({ weight: actions.createCollective.weight, workflow: createCollectiveWorkflow, name: 'createCollective' });
    if (actions.joinCollective) workflows.push({ weight: actions.joinCollective.weight, workflow: joinCollectiveWorkflow, name: 'joinCollective' });
    if (actions.browseProviders) workflows.push({ weight: actions.browseProviders.weight, workflow: browseProvidersWorkflow, name: 'browseProviders' });
    if (actions.scheduleActivity) workflows.push({ weight: actions.scheduleActivity.weight, workflow: scheduleActivityWorkflow, name: 'scheduleActivity' });
    if (actions.joinActivity) workflows.push({ weight: actions.joinActivity.weight, workflow: joinActivityWorkflow, name: 'joinActivity' });

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
