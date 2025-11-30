import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { storage } from '@/utils/storage';

// Platform-specific API host configuration
// Use EXPO_PUBLIC_API_HOST from .env (set to your computer's local IP)
// This works for: web, iOS simulator, iOS device, Android emulator, Android device
// Default fallbacks if env var not set:
// - Android emulator: 10.0.2.2
// - Everything else: localhost
const BASE_HOST = process.env.EXPO_PUBLIC_API_HOST ||
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

// Service ports matching docker-compose
const SERVICES = {
  auth: `http://${BASE_HOST}:3001`,
  community: `http://${BASE_HOST}:3002`,
  request: `http://${BASE_HOST}:3003`,
  reputation: `http://${BASE_HOST}:3004`,
  notification: `http://${BASE_HOST}:3005`,
  messaging: `http://${BASE_HOST}:3006`,
  feed: `http://${BASE_HOST}:3007`,
};

// Create axios instance with auth interceptor
const createClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(async (config) => {
    const token = await storage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
};

// Create clients for each service
const authClient = createClient(SERVICES.auth);
const communityClient = createClient(SERVICES.community);
const requestClient = createClient(SERVICES.request);
const reputationClient = createClient(SERVICES.reputation);
const notificationClient = createClient(SERVICES.notification);
const messagingClient = createClient(SERVICES.messaging);
const feedClient = createClient(SERVICES.feed);

export const api = {
  // Auth (port 3001)
  login: (email: string, password: string) =>
    authClient.post('/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    authClient.post('/auth/register', { name, email, password }),

  getProfile: () => authClient.get('/auth/verify'),

  // Feed (port 3007) - userId comes from JWT token
  getFeed: () =>
    feedClient.get('/feed'),

  // Communities (port 3002)
  getCommunities: () => communityClient.get('/communities'),

  getCommunity: (id: string) => communityClient.get(`/communities/${id}`),

  joinCommunity: (id: string) =>
    communityClient.post(`/communities/${id}/join`),

  leaveCommunity: (id: string) =>
    communityClient.post(`/communities/${id}/leave`),

  // Requests (port 3003)
  getRequests: (params?: { community_id?: string; status?: string; type?: string; requester_id?: string; limit?: number; offset?: number }) => {
    return requestClient.get('/requests', { params: params || {} });
  },

  getRequest: (id: string) => requestClient.get(`/requests/${id}`),

  createRequest: (data: {
    title?: string;
    description: string;
    community_id?: string;
    post_to_all_communities?: boolean;
    type: string;
    urgency?: string;
  }) => requestClient.post('/requests', data),

  updateRequest: (id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    urgency?: string;
    user_id: string;
  }) => requestClient.put(`/requests/${id}`, data),

  cancelRequest: (id: string, user_id: string) =>
    requestClient.delete(`/requests/${id}`, { data: { user_id } }),

  offerHelp: (requestId: string, message?: string) =>
    requestClient.post(`/requests/${requestId}/offer`, { message }),

  // Matches (port 3003)
  getMatches: (params?: { request_id?: string; offer_id?: string; status?: string; limit?: number; offset?: number }) =>
    requestClient.get('/matches', { params }),

  getMatch: (id: string) => requestClient.get(`/matches/${id}`),

  acceptMatch: (id: string, user_id: string) =>
    requestClient.put(`/matches/${id}/accept`, { user_id }),

  declineMatch: (id: string, user_id: string) =>
    requestClient.put(`/matches/${id}/reject`, { user_id }),

  completeMatch: (id: string, user_id: string) =>
    requestClient.put(`/matches/${id}/complete`, { user_id }),

  cancelMatch: (id: string, user_id: string) =>
    requestClient.delete(`/matches/${id}`, { data: { user_id } }),

  // Messages (port 3006) - Match-based messaging
  getMatchMessages: (matchId: string) =>
    messagingClient.get(`/match/${matchId}/messages`),

  sendMatchMessage: (matchId: string, content: string, senderId: string) =>
    messagingClient.post(`/match/${matchId}/messages`, { content, sender_id: senderId }),

  markMatchMessagesRead: (matchId: string, userId: string) =>
    messagingClient.put(`/match/${matchId}/messages/read`, { user_id: userId }),

  // Legacy conversation-based messaging (kept for backwards compatibility)
  getConversations: () => messagingClient.get('/messages/conversations'),

  getMessages: (conversationId: string) =>
    messagingClient.get(`/messages/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, content: string) =>
    messagingClient.post(`/messages/conversations/${conversationId}/messages`, { content }),

  // Notifications (port 3005)
  getNotifications: () => notificationClient.get('/notifications'),

  markNotificationRead: (id: string) =>
    notificationClient.put(`/notifications/${id}/read`),

  // Reputation (port 3004)
  getKarma: (userId: string) =>
    reputationClient.get(`/reputation/karma/${userId}`),

  getTrustScore: (userId: string, communityId: string) =>
    reputationClient.get(`/reputation/trust/${userId}/${communityId}`),

  getReputationHistory: (userId: string) =>
    reputationClient.get(`/reputation/history/${userId}`),

  getBadges: (userId: string) =>
    reputationClient.get(`/reputation/badges/${userId}`),
};

export default api;
