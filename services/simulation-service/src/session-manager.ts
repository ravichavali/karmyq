/**
 * Session manager for simulated users
 */

import { SimulatedUser, UserSession, ActionLog, SimulationConfig } from './types';
import { ApiClient } from './api-client';
import { generateToken } from './db-user-loader';
import { delay } from './utils';

export class SessionManager {
  private sessions: Map<string, ApiClient> = new Map();

  constructor(private config: SimulationConfig) {}

  /**
   * Start a new user session
   */
  async startSession(user: SimulatedUser): Promise<UserSession> {
    console.log(`[${user.email}] Starting session (${user.profile.name})`);

    // Create dedicated API client for this user
    const client = new ApiClient(this.config.apiBaseUrl);

    // Generate JWT token directly (bypasses login API)
    try {
      const token = await generateToken({ id: user.id, email: user.email, name: user.name });
      user.token = token;
      client.setToken(token);

      const session: UserSession = {
        user,
        startedAt: new Date(),
        actions: [],
        isActive: true
      };

      user.currentSession = session;

      // Store client for this session
      this.sessions.set(user.id, client);

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

    // Clean up client for this session
    const client = this.sessions.get(session.user.id);
    if (client) {
      client.clearToken();
      this.sessions.delete(session.user.id);
    }

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
   * Get API client for a specific session
   */
  getClient(session: UserSession): ApiClient {
    const client = this.sessions.get(session.user.id);
    if (!client) {
      throw new Error(`No API client found for user ${session.user.email}`);
    }
    return client;
  }
}
