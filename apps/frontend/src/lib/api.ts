import axios from 'axios'

const AUTH_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const COMMUNITY_API_URL = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002'
const REQUEST_API_URL = process.env.NEXT_PUBLIC_REQUEST_API_URL || 'http://localhost:3003'
const REPUTATION_API_URL = process.env.NEXT_PUBLIC_REPUTATION_API_URL || 'http://localhost:3004'
const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3005'
const MESSAGING_API_URL = process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:3006'
const FEED_API_URL = process.env.NEXT_PUBLIC_FEED_API_URL || 'http://localhost:3007'
const SOCIAL_GRAPH_API_URL = process.env.NEXT_PUBLIC_SOCIAL_GRAPH_API_URL || 'http://localhost:3010'

// Export API configuration
export const API_CONFIG = {
  BASE_URL: AUTH_API_URL,
  COMMUNITY_API_URL,
  REQUEST_API_URL,
  REPUTATION_API_URL,
  NOTIFICATION_API_URL,
  MESSAGING_API_URL,
  FEED_API_URL,
  SOCIAL_GRAPH_API_URL,
}

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

// Reputation Service API
export const reputationApi = axios.create({
  baseURL: REPUTATION_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Feed Service API
export const feedApi = axios.create({
  baseURL: FEED_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Social Graph Service API
export const socialGraphApi = axios.create({
  baseURL: SOCIAL_GRAPH_API_URL,
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

// Decode JWT payload without verification (for extracting community context client-side)
function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

// Inject X-Community-ID into every reputation request.
// Reads from stored user object first; falls back to JWT payload.
// Without this, tenantMiddleware returns 400 for pages that don't pass communityId explicitly.
const reputationCommunityInterceptor = (config: any) => {
  if (typeof window === 'undefined') return config
  // Skip if the caller already set X-Community-ID
  if (config.headers['X-Community-ID'] || config.headers['x-community-id']) return config

  let communityId: string | undefined

  const userData = localStorage.getItem('user')
  if (userData) {
    try {
      const user = JSON.parse(userData)
      communityId = user.communities?.[0]?.id
    } catch { /* ignore */ }
  }

  // Fallback: decode JWT to get communities
  if (!communityId) {
    const token = localStorage.getItem('token')
    if (token) {
      const payload = decodeJwtPayload(token)
      communityId = payload?.communities?.[0]?.id
    }
  }

  if (communityId) {
    config.headers['X-Community-ID'] = communityId
  }
  return config
}

api.interceptors.request.use(authInterceptor)
communityApi.interceptors.request.use(authInterceptor)
requestApi.interceptors.request.use(authInterceptor)
notificationApi.interceptors.request.use(authInterceptor)
messagingApi.interceptors.request.use(authInterceptor)
reputationApi.interceptors.request.use(authInterceptor)
reputationApi.interceptors.request.use(reputationCommunityInterceptor)
feedApi.interceptors.request.use(authInterceptor)
socialGraphApi.interceptors.request.use(authInterceptor)

// Unwrap standardized API response format
// The backend now returns: { success: true, data: {...}, meta: {...} }
// We unwrap it so the frontend can access response.data.token instead of response.data.data.token
const responseInterceptor = (response: any) => {
  // If response has the standardized format, unwrap the data
  if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
    return {
      ...response,
      data: response.data.data, // Unwrap the data property
      meta: response.data.meta, // Preserve meta for debugging
      success: response.data.success
    }
  }
  return response
}

// Handle auth errors
const errorInterceptor = (error: any) => {
  // Transform error response to match expected format
  if (error.response?.data && typeof error.response.data === 'object') {
    // New format: { success: false, error: { code, message } }
    if ('error' in error.response.data && error.response.data.error) {
      error.response.data.error = error.response.data.error.message || error.response.data.error
    }
  }

  // Only logout on 401 for critical auth endpoints, not for optional features
  if (error.response?.status === 401) {
    // Endpoints that should NOT trigger logout (optional features)
    const optionalEndpoints = [
      '/invitations',      // Invitation chain is optional
      '/me/settings',      // Privacy settings are optional
      '/me/karma',         // Karma display is optional
    ]

    const url = error.config?.url || ''
    const isOptionalEndpoint = optionalEndpoints.some(endpoint => url.includes(endpoint))

    // Only force logout if it's NOT an optional endpoint
    if (!isOptionalEndpoint && typeof window !== 'undefined') {
      console.warn('[API] 401 Unauthorized - logging out')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else {
      console.warn('[API] 401 on optional endpoint, not logging out:', url)
    }
  }
  return Promise.reject(error)
}

api.interceptors.response.use(responseInterceptor, errorInterceptor)
communityApi.interceptors.response.use(responseInterceptor, errorInterceptor)
requestApi.interceptors.response.use(responseInterceptor, errorInterceptor)
notificationApi.interceptors.response.use(responseInterceptor, errorInterceptor)
messagingApi.interceptors.response.use(responseInterceptor, errorInterceptor)
reputationApi.interceptors.response.use(responseInterceptor, errorInterceptor)
socialGraphApi.interceptors.response.use(responseInterceptor, errorInterceptor)
feedApi.interceptors.response.use(responseInterceptor, errorInterceptor)

// Community API Methods
export const communityService = {
  // Communities
  getCommunities: (params?: { status?: string; limit?: number; offset?: number; search?: string; location?: string; category?: string; has_space?: string; sort?: string; mode?: string; lat?: number; lng?: number; tags?: string }) =>
    communityApi.get('/communities', { params }),

  getCommunityTags: () =>
    communityApi.get('/communities/tags'),

  getMyCommunities: (user_id: string) =>
    communityApi.get('/communities/my/communities', { params: { user_id } }),

  getCommunity: (id: string) =>
    communityApi.get(`/communities/${id}`),

  createCommunity: (data: { name: string; description: string; location?: string; category?: string; creator_id: string; max_members?: number; access_type?: 'public' | 'private' }) =>
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

  // Settings (Admin only)
  getSettings: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/settings`),

  updateSettings: (communityId: string, data: {
    request_ttl_days?: number;
    offer_ttl_days?: number;
    match_ttl_days?: number;
    notification_ttl_days?: number;
    message_ttl_days?: number;
    session_ttl_days?: number;
    karma_decay_enabled?: boolean;
    karma_half_life_months?: number;
    user_id: string;
  }) =>
    communityApi.patch(`/communities/${communityId}/settings`, data),

  getDecayPreview: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/settings/decay-preview`),

  // Statistics (Admin only)
  getStats: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/stats`),

  // Data Export (Admin only)
  exportCommunityData: (communityId: string, params?: {
    format?: 'json' | 'csv';
    members?: boolean;
    requests?: boolean;
    matches?: boolean;
    norms?: boolean;
    settings?: boolean;
    karma?: boolean;
    date_start?: string;
    date_end?: string;
  }) =>
    communityApi.get(`/communities/${communityId}/export`, {
      params,
      responseType: params?.format === 'csv' ? 'blob' : 'json',
    }),

  exportMembers: (communityId: string, format: 'json' | 'csv' = 'csv') =>
    communityApi.get(`/communities/${communityId}/export/members`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    }),

  exportActivity: (communityId: string, format: 'json' | 'csv' = 'csv') =>
    communityApi.get(`/communities/${communityId}/export/activity`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    }),

  // Configuration Management
  getConfig: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/config`),

  updateConfig: (communityId: string, config: any) =>
    communityApi.put(`/communities/${communityId}/config`, config),

  getConfigTemplates: (params?: { sort_by?: string; public_only?: boolean }) =>
    communityApi.get('/communities/config-templates', { params }),

  copyConfigFrom: (communityId: string, sourceId: string, includeRequestTypes = true) =>
    communityApi.post(`/communities/${communityId}/config/copy-from/${sourceId}`, {
      include_request_types: includeRequestTypes
    }),

  getThrivingCommunities: (minMembers = 5) =>
    communityApi.get('/communities/configs/public', { params: { min_members: minMembers } }),
}

// Admin Schema Management (Server-Driven UI - Phase 2)
export const uiSchemaService = {
  getAdminSchemas: (params?: { status?: string; type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/admin/schemas', { params }),

  getAdminSchema: (id: string) =>
    requestApi.get(`/admin/schemas/${id}`),

  createSchema: (data: {
    type: string;
    label: string;
    icon: string;
    color: string;
    description?: string;
    sections: any[];
  }) =>
    requestApi.post('/admin/schemas', data),

  updateSchema: (type: string, schema: any) =>
    requestApi.put(`/admin/schemas/${type}`, schema),

  publishSchema: (type: string) =>
    requestApi.post(`/admin/schemas/${type}/publish`),

  archiveSchema: (type: string) =>
    requestApi.post(`/admin/schemas/${type}/archive`),

  getSchemaVersions: (id: string) =>
    requestApi.get(`/admin/schemas/${id}/versions`),

  rollbackSchema: (id: string, version: number) =>
    requestApi.post(`/admin/schemas/${id}/rollback/${version}`),

  createSchemaVariant: (id: string, data: {
    variant_name: string;
    rollout_percentage: number;
  }) =>
    requestApi.post(`/admin/schemas/${id}/variants`, data),

  validateSchema: (schema: any) =>
    requestApi.post(`/schemas/${schema.type}/validate`, { schema }),
}

// Community Links API Methods (Sprint 15 - Fractal Community Model)
export const communityLinksService = {
  getLinks: (communityId: string, status?: string) =>
    communityApi.get(`/communities/${communityId}/links`, { params: status ? { status } : undefined }),

  proposeLink: (communityId: string, data: {
    target_community_id: string;
    link_type?: 'sister' | 'parent_child' | 'split_origin';
    trust_carry_factor?: number;
    show_in_sister_feeds?: boolean;
  }) =>
    communityApi.post(`/communities/${communityId}/links`, data),

  approveLink: (communityId: string, linkId: string) =>
    communityApi.put(`/communities/${communityId}/links/${linkId}`, { action: 'approve' }),

  updateLink: (communityId: string, linkId: string, data: {
    trust_carry_factor?: number;
    show_in_sister_feeds?: boolean;
  }) =>
    communityApi.put(`/communities/${communityId}/links/${linkId}`, data),

  removeLink: (communityId: string, linkId: string) =>
    communityApi.delete(`/communities/${communityId}/links/${linkId}`),
}

// Request Service API Methods
export const requestService = {
  // UI Schemas (Server-Driven UI)
  getSchemas: () =>
    requestApi.get('/schemas'),

  getSchema: (type: string) =>
    requestApi.get(`/schemas/${type}`),

  // Help Requests
  getRequests: (params?: { community_id?: string; status?: string; type?: string; requester_id?: string; limit?: number; offset?: number; include_admin_notes?: boolean }) =>
    requestApi.get('/requests', { params }),

  getMatchedRequests: (user_id: string, limit?: number) =>
    requestApi.get('/requests/matched/for-user', { params: { user_id, limit } }),

  // Day 7: Curated feed with match scores
  getCuratedRequests: (params?: { minScore?: number; limit?: number; community_id?: string; trust_distance?: string; request_type?: string }) =>
    requestApi.get('/requests/curated', { params }),

  getRequest: (id: string) =>
    requestApi.get(`/requests/${id}`),

  createRequest: (data: {
    community_id?: string;
    post_to_all_communities?: boolean;
    title?: string;
    description: string;
    type?: string; // Legacy field for backward compatibility
    request_type?: string; // New polymorphic type field
    urgency?: string;
    payload?: any; // Type-specific payload (e.g., ride origin/destination)
    requirements?: any; // Type-specific requirements
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

  adminTriageRequest: (id: string, data: {
    community_id: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    note?: string;
  }) =>
    requestApi.patch(`/requests/${id}/admin-triage`, data),

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
  getMatches: (params?: { request_id?: string; offer_id?: string; status?: string; user_id?: string; limit?: number; offset?: number }) =>
    requestApi.get('/matches', { params }),

  getMatch: (id: string) =>
    requestApi.get(`/matches/${id}`),

  createMatch: (data: {
    request_id: string;
    offer_id?: string;
    responder_id: string;
    community_id?: string;
  }) =>
    requestApi.post('/matches', data),

  acceptMatch: (id: string, user_id: string, travel_time_minutes?: number) =>
    requestApi.put(`/matches/${id}/accept`, { user_id, ...(travel_time_minutes !== undefined && { travel_time_minutes }) }),

  rejectMatch: (id: string, user_id: string) =>
    requestApi.put(`/matches/${id}/reject`, { user_id }),

  completeMatch: (id: string, user_id: string) =>
    requestApi.put(`/matches/${id}/complete`, { user_id }),

  cancelMatch: (id: string, user_id: string) =>
    requestApi.delete(`/matches/${id}`, { data: { user_id } }),

  // Boost / Urgent / Propose Match (Sprint 36)
  boostRequest: (id: string, data: { community_id: string }) =>
    requestApi.post(`/requests/${id}/boost`, data),

  removeBoost: (id: string, data: { community_id: string }) =>
    requestApi.delete(`/requests/${id}/boost`, { data }),

  markUrgent: (id: string, data: { community_id: string; urgent: boolean }) =>
    requestApi.patch(`/requests/${id}/urgent`, data),

  proposeMatch: (id: string, data: { user_id: string; community_id: string }) =>
    requestApi.post(`/requests/${id}/propose-match`, data),
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
// Note: userId is extracted from JWT token on the backend, not passed as parameter
export const messagingService = {
  // Get user's conversations (userId from JWT)
  getConversations: () =>
    messagingApi.get('/conversations'),

  // Get or create conversation for a match
  createConversation: (matchId: string, participantIds: string[]) =>
    messagingApi.post('/conversations', {
      match_id: matchId,
      participant_ids: participantIds,
    }),

  // Get conversation details (userId from JWT)
  getConversation: (conversationId: string) =>
    messagingApi.get(`/conversations/${conversationId}`),

  // Get messages for a conversation (userId from JWT)
  getMessages: (conversationId: string, params?: { limit?: number; offset?: number }) =>
    messagingApi.get(`/conversations/${conversationId}/messages`, {
      params: params,
    }),

  // Send message (REST fallback) - senderId from JWT
  sendMessage: (conversationId: string, content: string) =>
    messagingApi.post(`/conversations/${conversationId}/messages`, {
      content,
    }),

  // WebSocket URL
  getSocketUrl: () => MESSAGING_API_URL,

  // Match-based messaging
  getMatchConversation: (matchId: string) =>
    messagingApi.get(`/match/${matchId}`),

  sendMatchMessage: (matchId: string, content: string) =>
    messagingApi.post(`/match/${matchId}/messages`, { content }),

  getMatchUnreadCount: (matchId: string) =>
    messagingApi.get(`/match/${matchId}/unread`),

  markMatchRead: (matchId: string) =>
    messagingApi.put(`/match/${matchId}/read`),
}

// Reputation Service API Methods
export const reputationService = {
  // Get user karma
  getKarma: (userId: string, communityId?: string) =>
    reputationApi.get(`/reputation/karma/${userId}`, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Get current user's karma with decay (authenticated)
  getMyKarma: (communityId: string) =>
    reputationApi.get('/reputation/me/karma', {
      params: { community_id: communityId },
    }),

  // Get karma history
  getKarmaHistory: (userId: string, params?: { limit?: number; offset?: number }, communityId?: string) =>
    reputationApi.get(`/reputation/history/${userId}`, {
      params,
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Get trust score — community-specific or overall (weighted average across all communities)
  getTrustScore: (userId: string, communityId?: string) =>
    communityId
      ? reputationApi.get(`/reputation/trust/${userId}/${communityId}`)
      : reputationApi.get(`/reputation/trust/${userId}`),

  // Get overall trust score with community breakdown
  getOverallTrustScore: (userId: string) =>
    reputationApi.get(`/reputation/trust/${userId}`),

  // Get community trust score (ADR-040)
  getCommunityTrust: (communityId: string) =>
    reputationApi.get(`/reputation/community-trust/${communityId}`, { headers: { 'X-Community-ID': communityId } }),

  // Get network cohesion metrics for a community
  getNetworkMetrics: (communityId: string) =>
    reputationApi.get(`/reputation/network-metrics/${communityId}`, { headers: { 'X-Community-ID': communityId } }),

  // Get leaderboard
  getLeaderboard: (communityId: string, params?: { limit?: number }) =>
    reputationApi.get(`/reputation/leaderboard/${communityId}`, {
      params,
      headers: { 'X-Community-ID': communityId },
    }),
  submitFeedback: (data: { match_id: string; to_user_id: string; community_id: string; rating: number }) =>
    reputationApi.post('/reputation/feedback', data),

  // Trust Evolution (Sprint 30)
  getTrustConfig: (userId: string, communityId: string) =>
    reputationApi.get(`/reputation/trust-config/${userId}/${communityId}`),

  updateTrustConfig: (userId: string, communityId: string, data: { evolution_enabled: boolean }) =>
    reputationApi.put(`/reputation/trust-config/${userId}/${communityId}`, data),

  getTrustEvolutionHistory: (userId: string, communityId: string, params?: { limit?: number; offset?: number }) =>
    reputationApi.get(`/reputation/trust-config/${userId}/${communityId}/history`, { params }),

  getCommunityEvolutionStatus: (communityId: string) =>
    reputationApi.get(`/reputation/communities/${communityId}/trust-evolution`),

  updateCommunityEvolution: (communityId: string, data: { community_evolution_enabled?: boolean; cross_community_prior?: number }) =>
    reputationApi.put(`/reputation/communities/${communityId}/trust-evolution`, data),

  getCommunityEvolutionSummary: (communityId: string) =>
    reputationApi.get(`/reputation/community/${communityId}/evolution/summary`),

  getCommunityEvolutionHistory: (communityId: string, params?: { limit?: number; offset?: number }) =>
    reputationApi.get(`/reputation/community/${communityId}/evolution/history`, { params }),

  toggleCommunityEvolution: (communityId: string, enabled: boolean) =>
    reputationApi.put(`/reputation/community/${communityId}/evolution/toggle`, { enabled }),

  // Sprint 32: Global evolution opt-out + effective params
  getGlobalEvolutionSetting: (userId: string) =>
    reputationApi.get(`/reputation/users/${userId}/evolution-global`),

  setGlobalEvolutionSetting: (userId: string, enabled: boolean) =>
    reputationApi.put(`/reputation/users/${userId}/evolution-global`, { global_evolution_enabled: enabled }),

  getEffectiveParams: (userId: string, communityId: string) =>
    reputationApi.get(`/reputation/users/${userId}/effective-params?communityId=${communityId}`),
}

// User Settings API Methods (Auth Service)
export const userSettingsService = {
  // Get current user's privacy settings
  getPrivacySettings: () =>
    api.get('/users/me/settings'),

  // Update current user's privacy settings
  updatePrivacySettings: (settings: { show_my_karma_to_me: boolean }) =>
    api.patch('/users/me/settings', settings),

  // Day 8: Request Type Preferences
  getRequestTypePreferences: () =>
    api.get('/preferences/request-types'),

  updateRequestTypePreference: (data: { request_type: string; subscribed: boolean }) =>
    api.post('/preferences/request-types', data),

  bulkUpdatePreferences: (preferences: Array<{ request_type: string; subscribed: boolean }>) =>
    api.put('/preferences/request-types/bulk', { preferences }),

  // Day 8: User Interests
  getInterests: () =>
    api.get('/preferences/interests'),

  addInterest: (data: { interest_type: string; interest_value: string }) =>
    api.post('/preferences/interests', data),

  removeInterest: (id: string) =>
    api.delete(`/preferences/interests/${id}`),
}

// Feed Service API Methods
export const feedService = {
  // Get user feed
  getFeed: (params?: { limit?: number; offset?: number }, communityId?: string) =>
    feedApi.get('/feed', {
      params,
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Dismiss feed item
  dismissItem: (feedItemId: string, communityId?: string) =>
    feedApi.post(`/feed/${feedItemId}/dismiss`, {}, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Get feed preferences
  getPreferences: () =>
    feedApi.get('/feed/preferences'),

  // Update feed preferences
  updatePreferences: (preferences: {
    show_requests?: boolean;
    show_offers?: boolean;
    show_matches?: boolean;
    show_community_updates?: boolean;
  }) =>
    feedApi.put('/feed/preferences', preferences),
}

// Social Graph API Methods
export const socialGraphService = {
  // Generate invitation code
  generateInvitationCode: (communityId?: string) =>
    socialGraphApi.post('/invitations/generate', {}, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Validate invitation code (public endpoint)
  validateInvitationCode: (invitationCode: string) =>
    axios.get(`${SOCIAL_GRAPH_API_URL}/invitations/validate/${invitationCode}`),

  // Accept invitation code
  acceptInvitationCode: (invitationCode: string) =>
    socialGraphApi.post('/invitations/accept', { invitation_code: invitationCode }),

  // Get invitation history
  getInvitations: (communityId?: string) =>
    socialGraphApi.get('/invitations', {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // Get inviter statistics
  getInviterStats: () =>
    socialGraphApi.get('/invitations/stats'),

  // Get trust path to a specific user
  getTrustPath: (targetUserId: string) =>
    socialGraphApi.get(`/paths/${targetUserId}`),

  // Get trust paths to multiple users (for feed ranking)
  getBatchTrustPaths: (targetUserIds: string[]) =>
    socialGraphApi.post('/paths/batch', { target_user_ids: targetUserIds }),

  // Get network information
  getNetwork: () => socialGraphApi.get('/network'),
}

export const providerService = {
  listProviders: (params?: { service_type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/providers', { params }),

  getMyProviders: () =>
    requestApi.get('/providers/my'),

  getProvider: (id: string) =>
    requestApi.get(`/providers/${id}`),

  createProvider: (data: any) =>
    requestApi.post('/providers', data),

  updateProvider: (id: string, data: any) =>
    requestApi.put(`/providers/${id}`, data),

  deleteProvider: (id: string) =>
    requestApi.delete(`/providers/${id}`),

  getProviderTrust: (id: string) =>
    reputationApi.get(`/reputation/provider-trust/${id}`),

  getProviderReviews: (id: string) =>
    reputationApi.get(`/reputation/provider-reviews/${id}`),

  submitReview: (data: any) =>
    reputationApi.post('/reputation/provider-reviews', data),

  updateAvailability: (providerId: string, isAvailable: boolean) =>
    requestApi.patch(`/providers/${providerId}/availability`, { is_available: isAvailable }),
}

export const collectiveService = {
  listCollectives: (params?: { service_type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/collectives', { params }),

  getMyCollectives: () =>
    requestApi.get('/collectives/my'),

  getCollective: (id: string) =>
    requestApi.get(`/collectives/${id}`),

  createCollective: (data: any) =>
    requestApi.post('/collectives', data),

  updateCollective: (id: string, data: any) =>
    requestApi.put(`/collectives/${id}`, data),

  deleteCollective: (id: string) =>
    requestApi.delete(`/collectives/${id}`),

  joinCollective: (id: string, providerId?: string) =>
    requestApi.post(`/collectives/${id}/members`, providerId ? { provider_id: providerId } : {}),

  leaveCollective: (id: string, providerId: string) =>
    requestApi.delete(`/collectives/${id}/members/${providerId}`),

  linkCommunity: (id: string, communityId: string) =>
    requestApi.post(`/collectives/${id}/communities`, { community_id: communityId }),

  unlinkCommunity: (id: string, communityId: string) =>
    requestApi.delete(`/collectives/${id}/communities/${communityId}`),

  getCollectiveStats: (id: string) =>
    requestApi.get(`/collectives/${id}/stats`),

  listCollectivesByCommunity: (communityId: string) =>
    requestApi.get('/collectives', { params: { community_id: communityId } }),

  discoverCollectives: (params?: { unlinked_from?: string; limit?: number }) =>
    requestApi.get('/collectives', { params }),
}
