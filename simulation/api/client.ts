/**
 * API client for the Karmyq simulation
 * Thin axios wrapper with retry/backoff and structured logging.
 * TARGET_API_URL is the base — nginx handles all routing by path prefix.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { log } from '../utils/logger';

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const wait = Math.pow(2, attempt) * BASE_DELAY_MS;
        log('warn', 'sim-api', `Rate limited on ${label}, retrying in ${wait}ms`, { attempt });
        await sleep(wait);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

export class SimApiClient {
  private http: AxiosInstance;
  private personaId: string;

  constructor(baseUrl: string, personaId: string) {
    this.personaId = personaId;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: DEFAULT_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  setToken(token: string) {
    this.http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    delete this.http.defaults.headers.common['Authorization'];
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async register(email: string, name: string, password: string) {
    const res = await withRetry(
      () => this.http.post('/auth/register', { email, name, password }),
      'register'
    );
    return res.data.data as { token: string; user: { id: string; email: string; name: string } };
  }

  async login(email: string, password: string) {
    const res = await withRetry(
      () => this.http.post('/auth/login', { email, password }),
      'login'
    );
    return res.data.data as { token: string; user: { id: string; email: string } };
  }

  // -------------------------------------------------------------------------
  // Communities
  // -------------------------------------------------------------------------

  async getMyCommunities(): Promise<any[]> {
    const res = await withRetry(() => this.http.get('/communities/my/communities'), 'getMyCommunities');
    const data = res.data.data;
    return Array.isArray(data) ? data : (data?.communities ?? []);
  }

  async discoverCommunities(limit = 20): Promise<any[]> {
    const res = await withRetry(() => this.http.get('/communities', { params: { limit } }), 'discoverCommunities');
    const data = res.data.data;
    return Array.isArray(data) ? data : (data?.communities ?? []);
  }

  async createCommunity(data: { name: string; description: string; location: string; category: string }) {
    const res = await withRetry(() => this.http.post('/communities', data), 'createCommunity');
    return res.data.data;
  }

  async joinCommunity(communityId: string) {
    const res = await withRetry(() => this.http.post(`/communities/${communityId}/join`), 'joinCommunity');
    return res.data.data;
  }

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------

  async browseRequests(limit = 20, offset = 0): Promise<any[]> {
    const res = await withRetry(
      () => this.http.get('/requests', { params: { limit, offset } }),
      'browseRequests'
    );
    const data = res.data.data;
    return Array.isArray(data) ? data : (data?.requests ?? []);
  }

  async createRequest(data: {
    community_id?: string;
    post_to_all_communities?: boolean;
    title: string;
    description: string;
    urgency?: string;
    request_type?: string;
    type_payload?: Record<string, unknown>;
  }) {
    const res = await withRetry(() => this.http.post('/requests', data), 'createRequest');
    return res.data.data;
  }

  // -------------------------------------------------------------------------
  // Matches
  // -------------------------------------------------------------------------

  async getMatches(status?: string): Promise<any[]> {
    const res = await withRetry(
      () => this.http.get('/matches', { params: status ? { status } : {} }),
      'getMatches'
    );
    const data = res.data.data;
    return Array.isArray(data) ? data : (data?.matches ?? []);
  }

  async offerHelp(requestId: string, responderId: string) {
    const res = await withRetry(
      () => this.http.post('/matches', { request_id: requestId, responder_id: responderId }),
      'offerHelp'
    );
    return res.data.data;
  }

  async acceptMatch(matchId: string, userId: string) {
    const res = await withRetry(
      () => this.http.put(`/matches/${matchId}/accept`, { user_id: userId }),
      'acceptMatch'
    );
    return res.data.data;
  }

  async completeMatch(matchId: string, feedback: { rating: number; comment: string }) {
    const res = await withRetry(
      () => this.http.put(`/matches/${matchId}/complete`, feedback),
      'completeMatch'
    );
    return res.data.data;
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  async getConversations(): Promise<any[]> {
    const res = await withRetry(() => this.http.get('/conversations'), 'getConversations');
    return res.data.data ?? [];
  }

  async getMessages(conversationId: string): Promise<any[]> {
    const res = await withRetry(
      () => this.http.get(`/conversations/${conversationId}/messages`),
      'getMessages'
    );
    return res.data.data ?? [];
  }

  async sendMessage(conversationId: string, content: string) {
    const res = await withRetry(
      () => this.http.post(`/conversations/${conversationId}/messages`, { content }),
      'sendMessage'
    );
    return res.data.data;
  }

  // -------------------------------------------------------------------------
  // Invitations
  // -------------------------------------------------------------------------

  async generateInvite(communityId: string) {
    const res = await withRetry(
      () => this.http.post('/invitations/generate', { community_id: communityId }),
      'generateInvite'
    );
    return res.data.data as { code: string; url: string };
  }

  async acceptInvite(invitationCode: string) {
    const res = await withRetry(
      () => this.http.post('/invitations/accept', { invitation_code: invitationCode }),
      'acceptInvite'
    );
    return res.data.data;
  }

  // -------------------------------------------------------------------------
  // Feed
  // -------------------------------------------------------------------------

  async getDashboard() {
    const res = await withRetry(() => this.http.get('/feed/dashboard'), 'getDashboard');
    return res.data.data;
  }
}
