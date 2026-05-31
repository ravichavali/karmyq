/**
 * API client for interacting with Karmyq services
 */

import axios, { AxiosInstance } from 'axios';
import { executeWithRetry } from './utils';

export class ApiClient {
  public client: AxiosInstance;

  constructor(private baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Set authorization token for requests
   */
  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authorization token
   */
  clearToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * Auth API - Login
   */
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await executeWithRetry(() =>
      this.client.post('/auth/login', { email, password })
    );
    return response.data.data;
  }

  /**
   * Request API - Browse requests
   */
  async browseRequests(params?: { limit?: number; offset?: number; requester_id?: string; status?: string }): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/requests', { params })
    );
    // API returns: { success: true, data: { requests: [...], count: N, total: N } }
    const requests = response.data.data?.requests || [];
    return Array.isArray(requests) ? requests : [];
  }

  /**
   * Request API - Get request details
   */
  async getRequest(requestId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.get(`/requests/${requestId}`)
    );
    return response.data.data;
  }

  /**
   * Request API - Create request
   */
  async createRequest(data: {
    community_id?: string;
    post_to_all_communities?: boolean;
    title: string;
    description: string;
    category?: string;
    urgency?: string;
    request_type?: string;
  }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/requests', data)
    );
    return response.data.data;
  }

  /**
   * Request API - Offer help on a request by creating a proposed match
   */
  async offerHelp(requestId: string, responderId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/matches', { request_id: requestId, responder_id: responderId })
    );
    return response.data.data;
  }

  /**
   * Request API - Get matches
   */
  async getMatches(params?: { status?: string }): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/matches', { params })
    );
    // API returns: { success: true, data: { matches: [...], count: N } }
    const matches = response.data.data?.matches || [];
    return Array.isArray(matches) ? matches : [];
  }

  /**
   * Request API - Complete match
   */
  async completeMatch(matchId: string, userId: string, feedback?: { rating: number; comment: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.put(`/matches/${matchId}/complete`, { user_id: userId, ...feedback })
    );
    return response.data.data;
  }

  /**
   * Messaging API - Get conversations
   */
  async getConversations(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/conversations')
    );
    return response.data.data || [];
  }

  /**
   * Messaging API - Get messages in conversation
   */
  async getMessages(conversationId: string): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get(`/conversations/${conversationId}/messages`)
    );
    return response.data.data || [];
  }

  /**
   * Messaging API - Send message
   */
  async sendMessage(conversationId: string, content: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/conversations/${conversationId}/messages`, { content })
    );
    return response.data.data;
  }

  /**
   * Community API - Get user's communities
   */
  async getCommunities(userId?: string): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/communities/my/communities', {
        params: userId ? { user_id: userId } : {}
      })
    );
    return response.data.data?.communities || response.data.data || [];
  }

  /**
   * Community API - Get community details
   */
  async getCommunity(communityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.get(`/communities/${communityId}`)
    );
    return response.data.data;
  }

  /**
   * Activity API - Get activities for a community
   */
  async getActivities(communityId: string): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get(`/communities/${communityId}/activities`)
    );
    const activities = response.data.data?.activities || response.data.data || [];
    return Array.isArray(activities) ? activities : [];
  }

  /**
   * Activity API - Create an activity in a community (admin only)
   */
  async createActivity(communityId: string, data: {
    title: string;
    activity_type: string;
    scheduled_at: string;
    description?: string;
    duration_minutes?: number;
    max_participants?: number;
  }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/communities/${communityId}/activities`, data)
    );
    return response.data.data;
  }

  /**
   * Activity API - Join an activity
   */
  async joinActivity(communityId: string, activityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/communities/${communityId}/activities/${activityId}/join`)
    );
    return response.data.data;
  }

  /**
   * Activity API - Leave an activity
   */
  async leaveActivity(communityId: string, activityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.delete(`/communities/${communityId}/activities/${activityId}/leave`)
    );
    return response.data.data;
  }

  /**
   * Feed API - Get dashboard feed
   */
  async getDashboard(): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.get('/feed/dashboard')
    );
    return response.data.data;
  }

  /**
   * Auth API - Register a new user
   */
  async register(data: { email: string; name: string; password: string }): Promise<{ token: string; user: any }> {
    const response = await executeWithRetry(() =>
      this.client.post('/auth/register', data)
    );
    return response.data.data;
  }

  /**
   * Community API - Create a new community
   */
  async createCommunity(data: { name: string; description?: string; location?: string; category?: string; access_type?: string; community_type?: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/communities', data)
    );
    return response.data.data;
  }

  /**
   * Community API - Discover available communities
   */
  async discoverCommunities(params?: { limit?: number }): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/communities', { params })
    );
    const communities = response.data.data?.communities || response.data.data || [];
    return Array.isArray(communities) ? communities : [];
  }

  /**
   * Community API - Join a community
   */
  async joinCommunity(communityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/communities/${communityId}/join`)
    );
    return response.data.data;
  }

  /**
   * Request API - Create a match
   */
  async createMatch(data: { request_id: string; offer_id?: string; responder_id: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/matches', data)
    );
    return response.data.data;
  }

  /**
   * Request API - Register as a service provider
   */
  async registerProvider(data: { service_type: string; display_name: string; bio?: string; pricing_notes?: string; location_notes?: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/providers', data)
    );
    return response.data.data;
  }

  /**
   * Request API - Get own provider profiles
   */
  async getMyProviderProfiles(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/providers/my')
    );
    return response.data.data || [];
  }

  /**
   * Request API - Accept a match (requester accepts a proposed match)
   */
  async acceptMatch(matchId: string, userId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.put(`/matches/${matchId}/accept`, { user_id: userId })
    );
    return response.data.data;
  }

  /**
   * Request API - Browse providers (public)
   */
  async getProviders(serviceType?: string): Promise<any[]> {
    const params = serviceType ? { service_type: serviceType } : {};
    const response = await executeWithRetry(() =>
      this.client.get('/providers', { params })
    );
    return response.data.data || [];
  }

  /**
   * Request API - Get provider profiles for a specific user (public)
   */
  async getProvidersByUser(userId: string): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/providers', { params: { user_id: userId } })
    );
    return response.data.data || [];
  }

  /**
   * Reputation API - Submit a review for a provider
   * Called by the requester after a match is completed.
   */
  async submitProviderReview(providerId: string, matchId: string, stars: number, reviewText: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/reputation/provider-reviews', {
        provider_id: providerId,
        match_id: matchId,
        stars,
        review_text: reviewText,
      })
    );
    return response.data.data;
  }

  /**
   * Request API - Create a provider collective
   */
  async createCollective(data: { name: string; service_types: string[]; description?: string; location_notes?: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/collectives', data)
    );
    return response.data.data;
  }

  /**
   * Request API - List all active collectives
   */
  async getCollectives(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/collectives')
    );
    return response.data.data || [];
  }

  /**
   * Request API - Get collectives the current user belongs to
   */
  async getMyCollectives(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/collectives/my')
    );
    return response.data.data || [];
  }

  /**
   * Request API - Join a collective (self-join using own provider profile)
   */
  async joinCollective(collectiveId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/collectives/${collectiveId}/members`, {})
    );
    return response.data.data;
  }

  async voteOnSplit(communityId: string, splitId: string, vote: 'yes' | 'no' | 'abstain'): Promise<any> {
    return this.client.post(`/communities/${communityId}/splits/${splitId}/vote`, { vote }).catch(() => null);
  }

  async voteOnFusion(communityId: string, fusionId: string, vote: 'yes' | 'no' | 'abstain'): Promise<any> {
    return this.client.post(`/communities/${communityId}/fusions/${fusionId}/vote`, { vote }).catch(() => null);
  }

  async executeSplit(communityId: string, splitId: string): Promise<any> {
    return this.client.post(`/communities/${communityId}/splits/${splitId}/execute`).catch(() => null);
  }

  async submitMatchFeedback(matchId: string, data: {
    from_user_id: string;
    helpfulness?: number;
    responsiveness?: number;
    clarity?: number;
    comment?: string;
    allow_featuring?: boolean;
  }): Promise<any> {
    return this.client.post(`/matches/${matchId}/feedback`, data).catch(() => null);
  }

  async callDibs(requestId: string, providerUserId: string): Promise<any> {
    return this.client.post(`/requests/${requestId}/dibs`, { provider_user_id: providerUserId }).catch(() => null);
  }

  async getPendingDibsForProvider(): Promise<any[]> {
    const res = await this.client.get(`/requests/dibs/pending-for-provider`).catch(() => null);
    return res?.data?.data || [];
  }

  async acceptDibs(dibsId: string): Promise<any> {
    return this.client.put(`/requests/dibs/${dibsId}/accept`, {}).catch(() => null);
  }

  async declineDibs(dibsId: string): Promise<any> {
    return this.client.put(`/requests/dibs/${dibsId}/decline`, {}).catch(() => null);
  }

  async getGovernanceState(communityId: string): Promise<any> {
    const res = await this.client.get(`/communities/${communityId}/governance`).catch(() => null);
    return res?.data?.data || null;
  }

  async getCommunityMembers(communityId: string): Promise<any[]> {
    const res = await this.client.get(`/communities/${communityId}/members`).catch(() => null);
    return res?.data?.data?.members || [];
  }

  async nominateMember(communityId: string, nominatedUserId: string, role: 'moderator' | 'admin'): Promise<any> {
    return this.client.post(`/communities/${communityId}/governance/nominate`, {
      nominated_user_id: nominatedUserId, role
    }).catch(() => null);
  }

  async ratifyNomination(communityId: string, nominationId: string): Promise<any> {
    return this.client.post(`/communities/${communityId}/governance/ratify/${nominationId}`, {}).catch(() => null);
  }

  /**
   * Request API - Link a collective to a community
   */
  async linkCollectiveToCommunity(collectiveId: string, communityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/collectives/${collectiveId}/communities`, { community_id: communityId })
    );
    return response.data.data;
  }
}
