import axios from 'axios'

const AUTH_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const COMMUNITY_API_URL = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002'
const REQUEST_API_URL = process.env.NEXT_PUBLIC_REQUEST_API_URL || 'http://localhost:3003'
const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3005'
const MESSAGING_API_URL = process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:3006'

// Auth Service API
export const api = axios.create({
  baseURL: AUTH_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Community Service API
export const communityApi = axios.create({
  baseURL: COMMUNITY_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request Service API
export const requestApi = axios.create({
  baseURL: REQUEST_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Notification Service API
export const notificationApi = axios.create({
  baseURL: NOTIFICATION_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Messaging Service API
export const messagingApi = axios.create({
  baseURL: MESSAGING_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token to requests if available
const authInterceptor = (config: any) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
}

api.interceptors.request.use(authInterceptor)
communityApi.interceptors.request.use(authInterceptor)
requestApi.interceptors.request.use(authInterceptor)
notificationApi.interceptors.request.use(authInterceptor)
messagingApi.interceptors.request.use(authInterceptor)

// Handle auth errors
const errorInterceptor = (error: any) => {
  if (error.response?.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
  }
  return Promise.reject(error)
}

api.interceptors.response.use((response) => response, errorInterceptor)
communityApi.interceptors.response.use((response) => response, errorInterceptor)
requestApi.interceptors.response.use((response) => response, errorInterceptor)
notificationApi.interceptors.response.use((response) => response, errorInterceptor)
messagingApi.interceptors.response.use((response) => response, errorInterceptor)

// Community API Methods
export const communityService = {
  // Communities
  getCommunities: (params?: { status?: string; limit?: number; offset?: number; search?: string; location?: string; category?: string; has_space?: string; sort?: string }) =>
    communityApi.get('/communities', { params }),

  getMyCommunities: (user_id: string) =>
    communityApi.get('/communities/my/communities', { params: { user_id } }),

  getCommunity: (id: string) =>
    communityApi.get(`/communities/${id}`),

  createCommunity: (data: { name: string; description: string; location?: string; category?: string; creator_id: string; max_members?: number }) =>
    communityApi.post('/communities', data),

  updateCommunity: (id: string, data: { name?: string; description?: string; location?: string; category?: string; max_members?: number; user_id: string }) =>
    communityApi.put(`/communities/${id}`, data),

  archiveCommunity: (id: string, user_id: string) =>
    communityApi.delete(`/communities/${id}`, { data: { user_id } }),

  // Members
  getMembers: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/members`),

  addMember: (communityId: string, data: { user_id: string; invited_by?: string; role?: string }) =>
    communityApi.post(`/communities/${communityId}/members`, data),

  updateMember: (communityId: string, userId: string, data: { role?: string; status?: string; admin_user_id: string }) =>
    communityApi.put(`/communities/${communityId}/members/${userId}`, data),

  removeMember: (communityId: string, userId: string, admin_user_id: string) =>
    communityApi.delete(`/communities/${communityId}/members/${userId}`, { data: { admin_user_id } }),

  // Norms
  getNorms: (communityId: string, params?: { status?: string }) =>
    communityApi.get(`/communities/${communityId}/norms`, { params }),

  getNorm: (communityId: string, normId: string) =>
    communityApi.get(`/communities/${communityId}/norms/${normId}`),

  createNorm: (communityId: string, data: { description: string; rationale?: string; created_by: string }) =>
    communityApi.post(`/communities/${communityId}/norms`, data),

  approveNorm: (communityId: string, normId: string, user_id: string) =>
    communityApi.post(`/communities/${communityId}/norms/${normId}/approve`, { user_id }),

  archiveNorm: (communityId: string, normId: string, user_id: string) =>
    communityApi.delete(`/communities/${communityId}/norms/${normId}`, { data: { user_id } }),

  // Join/Leave Community
  joinCommunity: (communityId: string, data: { user_id: string; message?: string }) =>
    communityApi.post(`/communities/${communityId}/join`, data),

  leaveCommunity: (communityId: string, userId: string, admin_user_id: string) =>
    communityApi.delete(`/communities/${communityId}/members/${userId}`, { data: { admin_user_id } }),

  // Check membership status
  checkMembership: (communityId: string, userId: string) =>
    communityApi.get(`/communities/${communityId}/members`, { params: { user_id: userId } }),
}

// Request Service API Methods
export const requestService = {
  // Help Requests
  getRequests: (params?: { community_id?: string; status?: string; type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/requests', { params }),

  getMatchedRequests: (user_id: string, limit?: number) =>
    requestApi.get('/requests/matched/for-user', { params: { user_id, limit } }),

  getRequest: (id: string) =>
    requestApi.get(`/requests/${id}`),

  createRequest: (data: {
    community_id: string;
    requester_id: string;
    title: string;
    description: string;
    type: string;
    urgency?: string;
  }) =>
    requestApi.post('/requests', data),

  updateRequest: (id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    urgency?: string;
    user_id: string;
  }) =>
    requestApi.put(`/requests/${id}`, data),

  cancelRequest: (id: string, user_id: string) =>
    requestApi.delete(`/requests/${id}`, { data: { user_id } }),

  // Help Offers
  getOffers: (params?: { community_id?: string; status?: string; type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/offers', { params }),

  getOffer: (id: string) =>
    requestApi.get(`/offers/${id}`),

  createOffer: (data: {
    community_id: string;
    offerer_id: string;
    title: string;
    description: string;
    type: string;
  }) =>
    requestApi.post('/offers', data),

  updateOffer: (id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    user_id: string;
  }) =>
    requestApi.put(`/offers/${id}`, data),

  withdrawOffer: (id: string, user_id: string) =>
    requestApi.delete(`/offers/${id}`, { data: { user_id } }),

  // Matches
  getMatches: (params?: { request_id?: string; offer_id?: string; status?: string; limit?: number; offset?: number }) =>
    requestApi.get('/matches', { params }),

  getMatch: (id: string) =>
    requestApi.get(`/matches/${id}`),

  createMatch: (data: {
    request_id: string;
    offer_id?: string;
    responder_id: string;
  }) =>
    requestApi.post('/matches', data),

  completeMatch: (id: string, user_id: string) =>
    requestApi.put(`/matches/${id}/complete`, { user_id }),

  cancelMatch: (id: string, user_id: string) =>
    requestApi.delete(`/matches/${id}`, { data: { user_id } }),
}

// Notification Service API Methods
export const notificationService = {
  // Get user notifications
  getNotifications: (userId: string, params?: { limit?: number; offset?: number }) =>
    notificationApi.get(`/notifications/${userId}`, { params }),

  // Get unread count
  getUnreadCount: (userId: string) =>
    notificationApi.get(`/notifications/${userId}/unread-count`),

  // Mark notification as read
  markAsRead: (notificationId: string, user_id: string) =>
    notificationApi.put(`/notifications/${notificationId}/read`, { user_id }),

  // Mark all as read
  markAllAsRead: (userId: string) =>
    notificationApi.put(`/notifications/${userId}/read-all`),

  // Delete notification
  deleteNotification: (notificationId: string, user_id: string) =>
    notificationApi.delete(`/notifications/${notificationId}`, { data: { user_id } }),

  // Get preferences
  getPreferences: (userId: string) =>
    notificationApi.get(`/notifications/${userId}/preferences`),

  // Update preferences
  updatePreferences: (userId: string, preferences: {
    in_app_enabled?: boolean;
    push_enabled?: boolean;
    email_enabled?: boolean;
  }) =>
    notificationApi.put(`/notifications/${userId}/preferences`, preferences),

  // SSE connection URL
  getStreamUrl: (userId: string) =>
    `${NOTIFICATION_API_URL}/notifications/stream/${userId}`,
}

// Messaging Service API Methods
export const messagingService = {
  // Get user's conversations
  getConversations: (userId: string) =>
    messagingApi.get('/messages/conversations', { params: { user_id: userId } }),

  // Get or create conversation for a match
  createConversation: (matchId: string, participantIds: string[]) =>
    messagingApi.post('/messages/conversations', {
      match_id: matchId,
      participant_ids: participantIds,
    }),

  // Get conversation details
  getConversation: (conversationId: string, userId: string) =>
    messagingApi.get(`/messages/conversations/${conversationId}`, {
      params: { user_id: userId },
    }),

  // Get messages for a conversation
  getMessages: (conversationId: string, userId: string, params?: { limit?: number; offset?: number }) =>
    messagingApi.get(`/messages/conversations/${conversationId}/messages`, {
      params: { user_id: userId, ...params },
    }),

  // Send message (REST fallback)
  sendMessage: (conversationId: string, senderId: string, content: string) =>
    messagingApi.post(`/messages/conversations/${conversationId}/messages`, {
      sender_id: senderId,
      content,
    }),

  // WebSocket URL
  getSocketUrl: () => MESSAGING_API_URL,
}
