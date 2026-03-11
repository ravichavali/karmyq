/**
 * API client for interacting with Karmyq services
 */

import axios, { AxiosInstance } from 'axios';
import { SimulatedUser } from './types';
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
  async createCommunity(data: { name: string; description?: string; location?: string; category?: string; access_type?: string }): Promise<any> {
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
      this.client.post('/requests/providers', data)
    );
    return response.data.data;
  }

  /**
   * Request API - Get own provider profiles
   */
  async getMyProviderProfiles(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/requests/providers/my')
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
      this.client.get('/requests/providers', { params })
    );
    return response.data.data || [];
  }

  /**
   * Request API - Create a provider collective
   */
  async createCollective(data: { name: string; service_types: string[]; description?: string; location_notes?: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/requests/collectives', data)
    );
    return response.data.data;
  }

  /**
   * Request API - List all active collectives
   */
  async getCollectives(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/requests/collectives')
    );
    return response.data.data || [];
  }

  /**
   * Request API - Get collectives the current user belongs to
   */
  async getMyCollectives(): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/requests/collectives/my')
    );
    return response.data.data || [];
  }

  /**
   * Request API - Join a collective (self-join using own provider profile)
   */
  async joinCollective(collectiveId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/requests/collectives/${collectiveId}/members`, {})
    );
    return response.data.data;
  }

  /**
   * Request API - Link a collective to a community
   */
  async linkCollectiveToCommunity(collectiveId: string, communityId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/requests/collectives/${collectiveId}/communities`, { community_id: communityId })
    );
    return response.data.data;
  }
}
