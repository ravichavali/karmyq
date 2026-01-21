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
  async browseRequests(params?: { limit?: number; offset?: number }): Promise<any[]> {
    const response = await executeWithRetry(() =>
      this.client.get('/requests', { params })
    );
    return response.data.data || [];
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
    community_ids: string[];
    title: string;
    description: string;
    category?: string;
    urgency?: string;
  }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post('/requests', data)
    );
    return response.data.data;
  }

  /**
   * Request API - Create offer
   */
  async createOffer(requestId: string, message: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/requests/${requestId}/offers`, { message })
    );
    return response.data.data;
  }

  /**
   * Request API - Accept offer
   */
  async acceptOffer(offerId: string): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/offers/${offerId}/accept`)
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
    return response.data.data || [];
  }

  /**
   * Request API - Complete match
   */
  async completeMatch(matchId: string, feedback?: { rating: number; comment: string }): Promise<any> {
    const response = await executeWithRetry(() =>
      this.client.post(`/matches/${matchId}/complete`, feedback)
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
}
