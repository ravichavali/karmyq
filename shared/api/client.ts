import axios, { AxiosInstance, AxiosError } from 'axios';

// Platform-agnostic storage interface
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Configuration
interface ApiClientConfig {
  baseURL: string;
  storage: StorageAdapter;
  onUnauthorized?: () => void;
}

class ApiClient {
  private client: AxiosInstance;
  private storage: StorageAdapter;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig) {
    this.storage = config.storage;
    this.onUnauthorized = config.onUnauthorized;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.storage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await this.storage.removeItem('token');
          this.onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(email: string, name: string, password: string) {
    const response = await this.client.post('/auth/register', {
      email,
      name,
      password,
    });

    if (response.data.token) {
      await this.storage.setItem('token', response.data.token);
    }

    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', {
      email,
      password,
    });

    if (response.data.token) {
      await this.storage.setItem('token', response.data.token);
    }

    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      await this.storage.removeItem('token');
    }
  }

  async verifyToken() {
    const response = await this.client.get('/auth/verify');
    return response.data;
  }

  // User endpoints
  async getUser(userId: string) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: string, updates: { name?: string; bio?: string; avatar_url?: string }) {
    const response = await this.client.put(`/users/${userId}`, updates);
    return response.data;
  }

  // Community endpoints (to be implemented)
  async getCommunities() {
    const response = await this.client.get('/communities');
    return response.data;
  }

  async getCommunity(communityId: string) {
    const response = await this.client.get(`/communities/${communityId}`);
    return response.data;
  }

  async createCommunity(data: { name: string; description: string; max_members?: number }) {
    const response = await this.client.post('/communities', data);
    return response.data;
  }

  // Request endpoints (to be implemented)
  async getHelpRequests(communityId: string) {
    const response = await this.client.get(`/requests/community/${communityId}`);
    return response.data;
  }

  async createHelpRequest(data: {
    community_id: string;
    title: string;
    description: string;
    category: string;
    urgency?: string;
  }) {
    const response = await this.client.post('/requests', data);
    return response.data;
  }

  // Helper to check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await this.storage.getItem('token');
    return !!token;
  }

  // Get the underlying axios instance for custom requests
  getClient(): AxiosInstance {
    return this.client;
  }
}

export default ApiClient;
