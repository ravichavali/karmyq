import { Page } from '@playwright/test';

/**
 * API Helper utilities for E2E tests
 *
 * These utilities help interact with the backend APIs during tests.
 * Supports multi-tenant architecture with X-Community-ID headers.
 */

// API URL configuration
const API_URLS = {
  AUTH: process.env.AUTH_API_URL || 'http://localhost:3001',
  COMMUNITY: process.env.COMMUNITY_API_URL || 'http://localhost:3002',
  REQUEST: process.env.REQUEST_API_URL || 'http://localhost:3003',
  REPUTATION: process.env.REPUTATION_API_URL || 'http://localhost:3004',
  NOTIFICATION: process.env.NOTIFICATION_API_URL || 'http://localhost:3005',
  MESSAGING: process.env.MESSAGING_API_URL || 'http://localhost:3006',
  FEED: process.env.FEED_API_URL || 'http://localhost:3007',
  CLEANUP: process.env.CLEANUP_API_URL || 'http://localhost:3008',
};

export class ApiHelpers {
  private currentCommunityId: string | null = null;

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
   * Set the current community context for multi-tenant requests
   */
  setCommunityContext(communityId: string): void {
    this.currentCommunityId = communityId;
  }

  /**
   * Clear the community context
   */
  clearCommunityContext(): void {
    this.currentCommunityId = null;
  }

  /**
   * Make authenticated API request with multi-tenant support
   */
  async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {},
    communityId?: string
  ): Promise<Response> {
    const token = await this.getAuthToken();
    const effectiveCommunityId = communityId || this.currentCommunityId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers as Record<string, string>,
    };

    // Add X-Community-ID header for multi-tenant requests
    if (effectiveCommunityId) {
      headers['X-Community-ID'] = effectiveCommunityId;
    }

    return await this.page.request.fetch(url, {
      ...options,
      headers,
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
      `${API_URLS.COMMUNITY}/communities`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          creator_id: user.id,
        }),
      }
    );

    const result = await response.json();
    // Set community context for subsequent requests
    if (result.data?.id) {
      this.setCommunityContext(result.data.id);
    }
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
      `${API_URLS.REQUEST}/requests`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          requester_id: user.id,
        }),
      },
      data.community_id
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
      `${API_URLS.COMMUNITY}/communities/${communityId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ user_id: user.id }),
      }
    );
    this.clearCommunityContext();
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
    community_id?: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.REQUEST}/offers`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          responder_id: user.id,
        }),
      },
      data.community_id
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
    community_id?: string;
  }): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.REQUEST}/matches`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          requester_id: user.id,
        }),
      },
      data.community_id
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Complete a match with rating and feedback
   */
  async completeMatch(matchId: string, rating: number, feedback: string, communityId?: string): Promise<any> {
    const user = await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.REQUEST}/matches/${matchId}/complete`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: user.id,
          rating,
          feedback,
        }),
      },
      communityId
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's karma score
   */
  async getUserKarma(userId?: string, communityId?: string): Promise<any> {
    const user = userId ? { id: userId } : await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.REPUTATION}/reputation/karma/${user.id}`,
      {},
      communityId
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's karma history
   */
  async getUserKarmaHistory(userId?: string, communityId?: string): Promise<any> {
    const user = userId ? { id: userId } : await this.getCurrentUser();
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.REPUTATION}/reputation/karma/${user.id}/history`,
      {},
      communityId
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(params?: { limit?: number; offset?: number }): Promise<any> {
    const user = await this.getCurrentUser();
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));

    const url = `${API_URLS.NOTIFICATION}/notifications/${user.id}${queryParams.toString() ? '?' + queryParams : ''}`;
    const response = await this.makeAuthenticatedRequest(url);

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's feed
   */
  async getUserFeed(communityId?: string, params?: { limit?: number; offset?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));

    const url = `${API_URLS.FEED}/feed${queryParams.toString() ? '?' + queryParams : ''}`;
    const response = await this.makeAuthenticatedRequest(url, {}, communityId);

    const result = await response.json();
    return result.data;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(): Promise<any> {
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.MESSAGING}/messages/conversations`
    );

    const result = await response.json();
    return result.data;
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId: string, content: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(
      `${API_URLS.MESSAGING}/messages/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );

    const result = await response.json();
    return result.data;
  }
}

// Export API URLs for direct use
export { API_URLS };
