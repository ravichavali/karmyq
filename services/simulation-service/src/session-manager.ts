/**
 * Session manager for simulated users
 */

import { SimulatedUser, UserSession, ActionLog, SimulationConfig } from './types';
import { ApiClient } from './api-client';
import { delay } from './utils';

export class SessionManager {
  private client: ApiClient;

  constructor(private config: SimulationConfig) {
    this.client = new ApiClient(config.apiBaseUrl);
  }

  /**
   * Start a new user session
   */
  async startSession(user: SimulatedUser): Promise<UserSession> {
    console.log(`[${user.email}] Starting session (${user.profile.name})`);

    // Login
    try {
      if (!user.password) {
        throw new Error('User password not provided');
      }

      const loginData = await this.client.login(user.email, user.password);
      user.token = loginData.token;
      this.client.setToken(loginData.token);

      const session: UserSession = {
        user,
        startedAt: new Date(),
        actions: [],
        isActive: true
      };

      user.currentSession = session;

      this.logAction(session, 'login', true, 0);
      return session;

    } catch (error: any) {
      console.error(`[${user.email}] Login failed:`, error.message);
      throw error;
    }
  }

  /**
   * End a user session
   */
  async endSession(session: UserSession): Promise<void> {
    console.log(`[${session.user.email}] Ending session (${session.actions.length} actions)`);

    session.isActive = false;
    session.user.currentSession = undefined;
    this.client.clearToken();

    this.logAction(session, 'logout', true, 0);
  }

  /**
   * Log an action to the session
   */
  logAction(session: UserSession, type: string, success: boolean, duration: number, error?: string) {
    const log: ActionLog = {
      type,
      timestamp: new Date(),
      success,
      duration,
      error
    };

    session.actions.push(log);

    if (!success && error) {
      console.error(`[${session.user.email}] Action ${type} failed: ${error}`);
    }
  }

  /**
   * Execute action with logging and rate limiting
   */
  async executeAction<T>(
    session: UserSession,
    actionType: string,
    actionFn: () => Promise<T>
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      const result = await actionFn();
      const duration = Date.now() - startTime;

      this.logAction(session, actionType, true, duration);

      // Respect rate limits - minimum delay between actions
      await delay(this.config.rateLimit.minDelayMs);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logAction(session, actionType, false, duration, error.message);
      return null;
    }
  }

  /**
   * Get API client (for workflows to use)
   */
  getClient(): ApiClient {
    return this.client;
  }
}
