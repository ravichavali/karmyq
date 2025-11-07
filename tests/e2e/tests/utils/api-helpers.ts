import { Page } from '@playwright/test';

/**
 * API Helper utilities for E2E tests
 *
 * These utilities help interact with the backend APIs during tests
 */

export class ApiHelpers {
  constructor(private page: Page) {}

  /**
   * Get auth token from localStorage
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => localStorage.getItem('token'));
  }

  /**
   * Get current user from localStorage
   */
  async getCurrentUser(): Promise<any> {
    const userStr = await this.page.evaluate(() => localStorage.getItem('user'));
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();

    return await this.page.request.fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });
  }

  /**
   * Create a test community
   */
  async createTestCommunity(data: {
    name: string;
    description: string;
    location?: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          creator_id: user.id,
        }),
      }
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Create a test help request
   */
  async createTestRequest(data: {
    community_id: string;
    title: string;
    description: string;
    type: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/requests`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          requester_id: user.id,
        }),
      }
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Clean up test data
   */
  async deleteTestCommunity(communityId: string): Promise<void> {
    const user = await this.getCurrentUser();
    await this.makeAuthenticatedRequest(
      `${process.env.COMMUNITY_API_URL || 'http://localhost:3002'}/communities/${communityId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ user_id: user.id }),
      }
    );
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp, timeout = 5000): Promise<any> {
    const response = await this.page.waitForResponse(
      (response) => {
        const url = response.url();
        return typeof urlPattern === 'string'
          ? url.includes(urlPattern)
          : urlPattern.test(url);
      },
      { timeout }
    );

    return await response.json();
  }

  /**
   * Create an offer for a request
   */
  async createTestOffer(data: {
    request_id: string;
    message: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/offers`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          responder_id: user.id,
        }),
      }
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Create a match between requester and responder
   */
  async createTestMatch(data: {
    request_id: string;
    offer_id: string;
    responder_id: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/matches`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          requester_id: user.id,
        }),
      }
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Complete a match with rating and feedback
   */
  async completeMatch(matchId: string, rating: number, feedback: string): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REQUEST_API_URL || 'http://localhost:3003'}/matches/${matchId}/complete`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: user.id,
          rating,
          feedback,
        }),
      }
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's karma score
   */
  async getUserKarma(userId?: string): Promise<any> {
    const user = userId ? { id: userId } : await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}`
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's karma history
   */
  async getUserKarmaHistory(userId?: string): Promise<any> {
    const user = userId ? { id: userId } : await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${process.env.REPUTATION_API_URL || 'http://localhost:3004'}/karma/${user.id}/history`
    );

    const result = await response.json();
    return result.data;
  }
}
