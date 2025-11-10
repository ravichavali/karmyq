import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// API configuration - can be overridden in app.json extra config
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001';

class ApiService {
  private authApi: AxiosInstance;
  private communityApi: AxiosInstance;
  private requestApi: AxiosInstance;
  private reputationApi: AxiosInstance;
  private notificationApi: AxiosInstance;
  private messagingApi: AxiosInstance;
  private feedApi: AxiosInstance;

  constructor() {
    // Create API instances for each service
    this.authApi = this.createApiInstance(API_BASE_URL);
    this.communityApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3002')}`);
    this.requestApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3003')}`);
    this.reputationApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3004')}`);
    this.notificationApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3005')}`);
    this.messagingApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3006')}`);
    this.feedApi = this.createApiInstance(`${API_BASE_URL.replace(':3001', ':3007')}`);
  }

  private createApiInstance(baseURL: string): AxiosInstance {
    const instance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    instance.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle auth errors
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('user');
          // Redirect to login handled by app navigation
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.authApi.post('/login', { email, password });
    if (response.data.token) {
      await SecureStore.setItemAsync('auth_token', response.data.token);
      await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async register(data: { name: string; email: string; password: string }) {
    const response = await this.authApi.post('/register', data);
    if (response.data.token) {
      await SecureStore.setItemAsync('auth_token', response.data.token);
      await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async logout() {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user');
  }

  async getCurrentUser() {
    const userJson = await SecureStore.getItemAsync('user');
    return userJson ? JSON.parse(userJson) : null;
  }

  // Community methods
  async getCommunities(params?: any) {
    const response = await this.communityApi.get('/communities', { params });
    return response.data;
  }

  async getCommunity(id: string) {
    const response = await this.communityApi.get(`/communities/${id}`);
    return response.data;
  }

  async joinCommunity(communityId: string, userId: string) {
    const response = await this.communityApi.post(`/communities/${communityId}/join`, {
      user_id: userId,
    });
    return response.data;
  }

  // Request methods
  async getRequests(params?: any) {
    const response = await this.requestApi.get('/requests', { params });
    return response.data;
  }

  async createRequest(data: any) {
    const response = await this.requestApi.post('/requests', data);
    return response.data;
  }

  async respondToRequest(requestId: string, data: any) {
    const response = await this.requestApi.post(`/matches`, {
      request_id: requestId,
      ...data,
    });
    return response.data;
  }

  // Feed methods
  async getFeed(userId: string, limit = 20) {
    const response = await this.feedApi.get('/feed', {
      params: { limit },
      headers: { 'x-user-id': userId },
    });
    return response.data;
  }

  // Messaging methods
  async getConversations(userId: string) {
    const response = await this.messagingApi.get('/messages/conversations', {
      params: { user_id: userId },
    });
    return response.data;
  }

  async getMessages(conversationId: string, userId: string) {
    const response = await this.messagingApi.get(
      `/messages/conversations/${conversationId}/messages`,
      { params: { user_id: userId } }
    );
    return response.data;
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const response = await this.messagingApi.post(
      `/messages/conversations/${conversationId}/messages`,
      { sender_id: senderId, content }
    );
    return response.data;
  }

  // Reputation methods
  async getReputation(userId: string) {
    const response = await this.reputationApi.get(`/reputation/karma/${userId}`);
    return response.data;
  }

  // Notification methods
  async registerPushToken(userId: string, pushToken: string) {
    // TODO: Add endpoint to backend to store push tokens
    const response = await this.notificationApi.post(`/notifications/${userId}/push-token`, {
      token: pushToken,
    });
    return response.data;
  }
}

export const api = new ApiService();
