import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    apiClient.post('/api/auth/register', { name, email, password }),

  getProfile: () => apiClient.get('/api/auth/me'),

  // Feed
  getFeed: (userId: string) =>
    apiClient.get(`/api/feed/user/${userId}`),

  // Communities
  getCommunities: () => apiClient.get('/api/communities'),

  getCommunity: (id: string) => apiClient.get(`/api/communities/${id}`),

  joinCommunity: (id: string) =>
    apiClient.post(`/api/communities/${id}/join`),

  leaveCommunity: (id: string) =>
    apiClient.post(`/api/communities/${id}/leave`),

  // Requests
  getRequests: (communityId?: string) => {
    const params = communityId ? { community_id: communityId } : {};
    return apiClient.get('/api/requests', { params });
  },

  getRequest: (id: string) => apiClient.get(`/api/requests/${id}`),

  createRequest: (data: {
    title: string;
    description: string;
    community_id: string;
    category?: string;
  }) => apiClient.post('/api/requests', data),

  offerHelp: (requestId: string, message?: string) =>
    apiClient.post(`/api/requests/${requestId}/offer`, { message }),

  // Messages
  getConversations: () => apiClient.get('/api/messages/conversations'),

  getMessages: (conversationId: string) =>
    apiClient.get(`/api/messages/conversations/${conversationId}`),

  sendMessage: (conversationId: string, content: string) =>
    apiClient.post(`/api/messages/conversations/${conversationId}`, { content }),

  // Notifications
  getNotifications: () => apiClient.get('/api/notifications'),

  markNotificationRead: (id: string) =>
    apiClient.put(`/api/notifications/${id}/read`),

  // Reputation
  getKarma: (userId: string) =>
    apiClient.get(`/api/reputation/karma/${userId}`),

  getTrustScore: (userId: string) =>
    apiClient.get(`/api/reputation/trust/${userId}`),
};

export default api;
