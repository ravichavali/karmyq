import axios, { InternalAxiosRequestConfig } from 'axios'
import { buildValidateInvitationUrl } from './socialGraphUrls'

// Module-level refresh state — MUST be outside interceptor function body.
// If declared inside, they reset on every request and the queue never works.
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

function drainPendingRequests(newToken: string) {
  pendingRequests.forEach(resolve => resolve(newToken))
  pendingRequests = []
}

const AUTH_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const COMMUNITY_API_URL = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002'
const REQUEST_API_URL = process.env.NEXT_PUBLIC_REQUEST_API_URL || 'http://localhost:3003'
const REPUTATION_API_URL = process.env.NEXT_PUBLIC_REPUTATION_API_URL || 'http://localhost:3004'
const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3005'
const MESSAGING_API_URL = process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:3006'
const SOCIAL_GRAPH_API_URL = process.env.NEXT_PUBLIC_SOCIAL_GRAPH_API_URL || 'http://localhost:3010'

// Export API configuration
export const API_CONFIG = {
  BASE_URL: AUTH_API_URL,
  COMMUNITY_API_URL,
  REQUEST_API_URL,
  REPUTATION_API_URL,
  NOTIFICATION_API_URL,
  MESSAGING_API_URL,
  SOCIAL_GRAPH_API_URL,
}

function authInterceptor(config: InternalAxiosRequestConfig) {
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
const reputationCommunityInterceptor = (config: InternalAxiosRequestConfig) => {
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

// Unwrap standardized API response format
// The backend now returns: { success: true, data: {...}, meta: {...} }
// We unwrap it so the frontend can access response.data.token instead of response.data.data.token
const responseInterceptor = (response: any) => {
  if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
    return {
      ...response,
      data: response.data.data,
      meta: response.data.meta,
      success: response.data.success
    }
  }
  return response
}

// Handle auth errors with refresh token support
const errorInterceptor = async (error: any) => {
  // Capture X-Request-Id from 5xx responses so ErrorBoundary can surface a reference ID
  if (error.response?.status >= 500) {
    const refId = error.response.headers?.['x-request-id']
    if (refId) error.refId = refId
  }

  if (error.response?.data && typeof error.response.data === 'object') {
    if ('error' in error.response.data && error.response.data.error) {
      // Backward-compat for pre-S94 envelopes that used { error: { code, message } }.
      // Never leave an object on data.error; JSX can only render a string safely.
      const e = error.response.data.error
      error.response.data.error = typeof e === 'string' ? e : (e.message ?? e.code ?? 'Request failed')
    }
  }

  const optionalEndpoints = ['/invitations', '/me/settings', '/me/karma']
  const url = error.config?.url || ''
  const isOptionalEndpoint = optionalEndpoints.some(ep => url.includes(ep))

  if (error.response?.status === 401 && !error.config?._retry && !isOptionalEndpoint) {
    if (typeof window === 'undefined') return Promise.reject(error)

    const storedRefreshToken = localStorage.getItem('refreshToken')
    if (!storedRefreshToken) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise(resolve => {
        pendingRequests.push((token: string) => {
          error.config.headers.Authorization = `Bearer ${token}`
          error.config._retry = true
          resolve(axios(error.config))
        })
      })
    }

    error.config._retry = true
    isRefreshing = true

    try {
      const response = await axios.post(`${AUTH_API_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken,
      })
      const { token: newToken, refreshToken: newRefreshToken } = response.data.data ?? response.data
      localStorage.setItem('token', newToken)
      localStorage.setItem('refreshToken', newRefreshToken)
      drainPendingRequests(newToken)
      error.config.headers.Authorization = `Bearer ${newToken}`
      return axios(error.config)
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }

  if (error.response?.status === 401 && isOptionalEndpoint) {
    console.warn('[API] 401 on optional endpoint, not logging out:', url)
  }

  return Promise.reject(error)
}

function createApiClient(baseURL: string) {
  const client = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })
  client.interceptors.request.use(authInterceptor)
  client.interceptors.response.use(responseInterceptor, errorInterceptor)
  return client
}

// Auth Service API
export const api = createApiClient(AUTH_API_URL)

// Community Service API
export const communityApi = createApiClient(COMMUNITY_API_URL)

// Request Service API
export const requestApi = createApiClient(REQUEST_API_URL)

// Reputation Service API
export const reputationApi = createApiClient(REPUTATION_API_URL)
reputationApi.interceptors.request.use(reputationCommunityInterceptor)

// Notification Service API
export const notificationApi = createApiClient(NOTIFICATION_API_URL)

// Messaging Service API
export const messagingApi = createApiClient(MESSAGING_API_URL)

// Social Graph Service API
export const socialGraphApi = createApiClient(SOCIAL_GRAPH_API_URL)

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

  // Caller identity is derived from the JWT server-side (ADR-064); no admin_user_id body.
  removeMember: (communityId: string, userId: string) =>
    communityApi.delete(`/communities/${communityId}/members/${userId}`),

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

  leaveCommunity: (communityId: string, userId: string) =>
    communityApi.delete(`/communities/${communityId}/members/${userId}`),

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

  // Activities
  getActivities: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/activities`),
  joinActivity: (communityId: string, activityId: string) =>
    communityApi.post(`/communities/${communityId}/activities/${activityId}/join`),
  leaveActivity: (communityId: string, activityId: string) =>
    communityApi.delete(`/communities/${communityId}/activities/${activityId}/leave`),
  createActivity: (communityId: string, data: object) =>
    communityApi.post(`/communities/${communityId}/activities`, data),

  // Governance
  getGovernanceState: (communityId: string) =>
    communityApi.get(`/communities/${communityId}/governance`),

  nominateForRole: (communityId: string, nominatedUserId: string, role: string) =>
    communityApi.post(`/communities/${communityId}/governance/nominate`, {
      nominated_user_id: nominatedUserId,
      role,
    }),

  ratifyNomination: (communityId: string, nominationId: string) =>
    communityApi.post(`/communities/${communityId}/governance/ratify/${nominationId}`),

  // Fission (Community Splits)
  createSplitProposal: (communityId: string, data: { group_a_name: string; group_b_name: string; rationale?: string }) =>
    communityApi.post(`/communities/${communityId}/splits`, data),

  getSplitProposal: (communityId: string, splitId: string) =>
    communityApi.get(`/communities/${communityId}/splits/${splitId}`),

  updateSplitAssignments: (communityId: string, splitId: string, changes: Array<{ userId: string; assignedTo: string }>) =>
    communityApi.put(`/communities/${communityId}/splits/${splitId}/assignments`, changes),

  startSplitVote: (communityId: string, splitId: string) =>
    communityApi.post(`/communities/${communityId}/splits/${splitId}/start-vote`),

  castSplitVote: (communityId: string, splitId: string, vote: 'yes' | 'no' | 'abstain') =>
    communityApi.post(`/communities/${communityId}/splits/${splitId}/vote`, { vote }),

  executeSplit: (communityId: string, splitId: string) =>
    communityApi.post(`/communities/${communityId}/splits/${splitId}/execute`),

  // Fusion
  createFusionProposal: (communityId: string, body: { target_community_id: string; merged_community_name: string; rationale?: string }) =>
    communityApi.post(`/communities/${communityId}/fusions`, body),

  getFusionProposal: (communityId: string, fusionId: string) =>
    communityApi.get(`/communities/${communityId}/fusions/${fusionId}`),

  acceptFusionProposal: (communityId: string, fusionId: string) =>
    communityApi.post(`/communities/${communityId}/fusions/${fusionId}/accept`),

  rejectFusionProposal: (communityId: string, fusionId: string) =>
    communityApi.post(`/communities/${communityId}/fusions/${fusionId}/reject`),

  startFusionVote: (communityId: string, fusionId: string) =>
    communityApi.post(`/communities/${communityId}/fusions/${fusionId}/start-vote`),

  castFusionVote: (communityId: string, fusionId: string, vote: 'yes' | 'no' | 'abstain') =>
    communityApi.post(`/communities/${communityId}/fusions/${fusionId}/vote`, { vote }),

  executeFusion: (communityId: string, fusionId: string) =>
    communityApi.post(`/communities/${communityId}/fusions/${fusionId}/execute`),
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

  // Day 7: Curated feed with match scores. Sprint 85/86 / ADR-066: view='home' returns the
  // decisions+requests union; view='community' returns the requests+activity+story union (no
  // decision band). Both yield { items: UnifiedFeedItem[] }; absent view keeps the legacy shape.
  getCuratedRequests: (params?: { minScore?: number; limit?: number; community_id?: string; trust_distance?: string; request_type?: string; view?: 'home' | 'community' }) =>
    requestApi.get('/requests/curated', { params }),

  // Sprint 89 / ADR-068: the community's weekly help-loop pulse for the warm Home hero.
  // Members-only (server gates on JWT communities). Envelope already unwrapped → read res.data.
  getCommunityPulse: (communityId: string) =>
    requestApi.get(`/requests/community/${communityId}/pulse`),

  // Sprint 100 / F2: the reachable, read-only list behind the pulse "N open asks across the
  // community" row — every open + unexpired ask in the community (own + already-offered included),
  // same predicate as the pulse count so rows === count. Members-only. → { items, count }.
  getCommunityOpenAsks: (communityId: string) =>
    requestApi.get(`/requests/community/${communityId}/open-asks`),

  // Sprint 90 / ADR-069: resolved retention windows + the member's own held/forgotten counts.
  // Backs the "What Karmyq remembers" transparency page. Members-only when community-scoped.
  getRetentionPolicy: (communityId?: string) =>
    requestApi.get('/requests/retention-policy', {
      params: communityId ? { communityId } : undefined,
    }),

  getRequest: (id: string) =>
    requestApi.get(`/requests/${id}`),

  createRequest: (data: {
    community_id?: string;
    post_to_all_communities?: boolean;
    title?: string;
    description: string;
    type?: string;
    request_type?: string;
    urgency?: string;
    payload?: any;
    requirements?: any;
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
    urgency?: 'urgent' | 'high' | 'medium' | 'low';
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

  // responder_id is optional and, since Sprint 101, ignored by the server — POST /matches derives the
  // responder from the verified JWT identity (ADR-064). Callers may still pass it for back-compat.
  createMatch: (data: {
    request_id: string;
    offer_id?: string;
    responder_id?: string;
    community_id?: string;
  }) =>
    requestApi.post('/matches', data),

  // ADR-064: the server authorizes these actions from the JWT identity, so the
  // client no longer sends a user_id. accept still sends scheduling input.
  acceptMatch: (id: string, travel_time_minutes?: number) =>
    requestApi.put(`/matches/${id}/accept`, { ...(travel_time_minutes !== undefined && { travel_time_minutes }) }),

  rejectMatch: (id: string) =>
    requestApi.put(`/matches/${id}/reject`, {}),

  completeMatch: (id: string) =>
    requestApi.put(`/matches/${id}/complete`, {}),

  // ADR-064: the server authorizes cancel from the JWT identity; no user_id sent.
  cancelMatch: (id: string) =>
    requestApi.delete(`/matches/${id}`),

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
  getNotifications: (userId: string, params?: { limit?: number; offset?: number }) =>
    notificationApi.get(`/notifications/${userId}`, { params }),

  getUnreadCount: (userId: string) =>
    notificationApi.get(`/notifications/${userId}/unread-count`),

  markAsRead: (notificationId: string, user_id: string) =>
    notificationApi.put(`/notifications/${notificationId}/read`, { user_id }),

  markAllAsRead: (userId: string) =>
    notificationApi.put(`/notifications/${userId}/read-all`),

  deleteNotification: (notificationId: string, user_id: string) =>
    notificationApi.delete(`/notifications/${notificationId}`, { data: { user_id } }),

  getPreferences: (userId: string) =>
    notificationApi.get(`/notifications/${userId}/preferences`),

  updatePreferences: (userId: string, preferences: {
    in_app_enabled?: boolean;
    push_enabled?: boolean;
    email_enabled?: boolean;
  }) =>
    notificationApi.put(`/notifications/${userId}/preferences`, preferences),

  // SSE connection URL (EventSource does not support custom headers in browsers)
  // We pass the access token as query param and backend derives stream user from JWT.
  getStreamUrl: (token: string) =>
    `${NOTIFICATION_API_URL}/notifications/stream?access_token=${encodeURIComponent(token)}`,
}

// Messaging Service API Methods
// Note: userId is extracted from JWT token on the backend, not passed as parameter
export const messagingService = {
  getConversations: () =>
    messagingApi.get('/conversations'),

  createConversation: (matchId: string, participantIds: string[]) =>
    messagingApi.post('/conversations', {
      match_id: matchId,
      participant_ids: participantIds,
    }),

  getConversation: (conversationId: string) =>
    messagingApi.get(`/conversations/${conversationId}`),

  getMessages: (conversationId: string, params?: { limit?: number; offset?: number }) =>
    messagingApi.get(`/conversations/${conversationId}/messages`, {
      params: params,
    }),

  sendMessage: (conversationId: string, content: string) =>
    messagingApi.post(`/conversations/${conversationId}/messages`, {
      content,
    }),

  getSocketUrl: () => MESSAGING_API_URL,

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
  getKarma: (userId: string, communityId?: string) =>
    reputationApi.get(`/reputation/karma/${userId}`, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  getMyKarma: (communityId: string) =>
    reputationApi.get('/reputation/me/karma', {
      params: { community_id: communityId },
    }),

  getKarmaHistory: (userId: string, params?: { limit?: number; offset?: number }, communityId?: string) =>
    reputationApi.get(`/reputation/history/${userId}`, {
      params,
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  getTrustScore: (userId: string, communityId?: string) =>
    communityId
      ? reputationApi.get(`/reputation/trust/${userId}/${communityId}`)
      : reputationApi.get(`/reputation/trust/${userId}`),

  getOverallTrustScore: (userId: string) =>
    reputationApi.get(`/reputation/trust/${userId}`),

  getCommunityTrust: (communityId: string) =>
    reputationApi.get(`/reputation/community-trust/${communityId}`, { headers: { 'X-Community-ID': communityId } }),

  getNetworkMetrics: (communityId: string) =>
    reputationApi.get(`/reputation/network-metrics/${communityId}`, { headers: { 'X-Community-ID': communityId } }),

  getLeaderboard: (communityId: string, params?: { limit?: number }) =>
    reputationApi.get(`/reputation/leaderboard/${communityId}`, {
      params,
      headers: { 'X-Community-ID': communityId },
    }),

  submitFeedback: (data: { match_id: string; to_user_id: string; community_id: string; rating: number }) =>
    reputationApi.post('/reputation/feedback', data),

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

  getGlobalEvolutionSetting: (userId: string) =>
    reputationApi.get(`/reputation/users/${userId}/evolution-global`),

  setGlobalEvolutionSetting: (userId: string, enabled: boolean) =>
    reputationApi.put(`/reputation/users/${userId}/evolution-global`, { global_evolution_enabled: enabled }),

  getEffectiveParams: (userId: string, communityId: string) =>
    reputationApi.get(`/reputation/users/${userId}/effective-params?communityId=${communityId}`),
}

// User Settings API Methods (Auth Service)
export const userSettingsService = {
  getPrivacySettings: () =>
    api.get('/users/me/settings'),

  updatePrivacySettings: (settings: { show_my_karma_to_me: boolean }) =>
    api.patch('/users/me/settings', settings),

  getRequestTypePreferences: () =>
    api.get('/preferences/request-types'),

  updateRequestTypePreference: (data: { request_type: string; subscribed: boolean }) =>
    api.post('/preferences/request-types', data),

  bulkUpdatePreferences: (preferences: Array<{ request_type: string; subscribed: boolean }>) =>
    api.put('/preferences/request-types/bulk', { preferences }),

  getInterests: () =>
    api.get('/preferences/interests'),

  addInterest: (data: { interest_type: string; interest_value: string }) =>
    api.post('/preferences/interests', data),

  removeInterest: (id: string) =>
    api.delete(`/preferences/interests/${id}`),
}

export type FoundingCircleStatus = 'new' | 'reviewed' | 'contacted' | 'archived'

export const foundingCircleAdminService = {
  listSubmissions: (params?: { status?: FoundingCircleStatus; limit?: number; offset?: number }) =>
    api.get('/founding-circle/submissions', { params }),

  updateSubmissionStatus: (id: string, status: FoundingCircleStatus) =>
    api.patch(`/founding-circle/submissions/${encodeURIComponent(id)}/status`, { status }),
}

// Feed API Methods (served by request-service)
export const feedService = {
  getFeed: (params?: { limit?: number; offset?: number }, communityId?: string) =>
    requestApi.get('/requests/feed', {
      params,
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  dismissItem: (feedItemId: string, communityId?: string) =>
    requestApi.post(`/requests/feed/dismiss/${feedItemId}`, {}, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  getPreferences: () =>
    requestApi.get('/requests/feed/preferences'),

  updatePreferences: (preferences: {
    show_community_activity?: boolean;
    show_open_requests?: boolean;
    show_completed_exchanges?: boolean;
    suggest_adjacent_requests?: boolean;
    exploration_level?: 'conservative' | 'balanced' | 'adventurous';
    show_explanations?: boolean;
    show_broader_stories?: boolean;
    allow_public_featuring?: boolean;
  }) =>
    requestApi.put('/requests/feed/preferences', preferences),
}

// Social Graph API Methods
export const socialGraphService = {
  generateInvitationCode: (communityId?: string) =>
    socialGraphApi.post('/invitations/generate', {}, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  validateInvitationCode: (invitationCode: string) =>
    axios.get(buildValidateInvitationUrl(SOCIAL_GRAPH_API_URL, invitationCode)),

  acceptInvitationCode: (invitationCode: string) =>
    socialGraphApi.post('/invitations/accept', { invitation_code: invitationCode }),

  getInvitations: (communityId?: string) =>
    socialGraphApi.get('/invitations', {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  getInviterStats: () =>
    socialGraphApi.get('/invitations/stats'),

  // Sprint 98 (BUG-098-001): pass the active community context so the badge's path
  // is scoped to the surface the user is looking at. Omitted => platform-wide scope.
  getTrustPath: (targetUserId: string, communityId?: string) =>
    socialGraphApi.get(`/paths/${targetUserId}`, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  getBatchTrustPaths: (targetUserIds: string[], communityId?: string) =>
    socialGraphApi.post('/paths/batch', { target_user_ids: targetUserIds }, {
      headers: communityId ? { 'X-Community-ID': communityId } : {},
    }),

  // (Sprint 98 BUG-098-006: the unused getNetwork() wrapper for the legacy /network
  // endpoint was removed — all trust-graph surfaces use getTrustGraph* below.)

  getTrustGraph: (communityId: string, center?: string) =>
    socialGraphApi.get(`/trust/graph/${encodeURIComponent(communityId)}${center ? `?center=${encodeURIComponent(center)}` : ''}`),

  getFullCommunityGraph: (communityId: string) =>
    socialGraphApi.get(`/trust/graph/${encodeURIComponent(communityId)}/full`),

  // Sprint 79 dropped click-to-recenter; the aggregate graph is always the
  // calling user's own ego-network across their communities (no ?center=).
  getTrustGraphAggregate: () =>
    socialGraphApi.get(`/trust/graph`),

  // Inter-community depth graph: the caller's communities as nodes, with organic
  // and fission-lineage links. Callers read `res.data` (interceptor unwraps the envelope).
  getCommunityGraph: () =>
    socialGraphApi.get('/trust/communities'),

  // Sprint 90 / ADR-070 — the caller's relationship memory in a community: activeCount + fading[] +
  // nearlyForgotten[] (each with decayTier). Backs the profile Memory section. Read `res.data`.
  getRelationshipMemory: (communityId: string) =>
    socialGraphApi.get(`/trust/me/memory?communityId=${encodeURIComponent(communityId)}`),

  // Nearly-forgotten bonds for the re-warming nudge (decayTier === 'nearly_forgotten').
  getFadingRelationships: (communityId: string) =>
    socialGraphApi.get(`/trust/relationships/fading?communityId=${encodeURIComponent(communityId)}`),
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

// Dibs API Methods (Sprint 42)
export const dibsService = {
  getDibsCandidate: (requestId: string, requestType?: string) =>
    requestApi.get(`/requests/${requestId}/dibs-candidate${requestType ? `?type=${requestType}` : ''}`),

  sendDibs: (requestId: string, providerUserId: string) =>
    requestApi.post(`/requests/${requestId}/dibs`, { provider_user_id: providerUserId }),

  getPendingDibsForProvider: () =>
    requestApi.get('/requests/dibs/pending-for-provider'),

  acceptDibs: (dibsId: string) =>
    requestApi.put(`/requests/dibs/${dibsId}/accept`),

  declineDibs: (dibsId: string) =>
    requestApi.put(`/requests/dibs/${dibsId}/decline`),
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

export const trustQuestionsService = {
  list: () => communityApi.get('/communities/trust-questions'),
  createQuestion: (data: { slug: string; question_text: string; subtext?: string; display_order: number }) =>
    communityApi.post('/communities/trust-questions', data),
  updateQuestion: (id: string, data: Partial<{ question_text: string; subtext: string; display_order: number; active: boolean }>) =>
    communityApi.put(`/communities/trust-questions/${id}`, data),
  deleteQuestion: (id: string) =>
    communityApi.delete(`/communities/trust-questions/${id}`),
  createChoice: (questionId: string, data: { value: string; label: string; description?: string; config_delta: object; display_order: number }) =>
    communityApi.post(`/communities/trust-questions/${questionId}/choices`, data),
  updateChoice: (questionId: string, choiceId: string, data: object) =>
    communityApi.put(`/communities/trust-questions/${questionId}/choices/${choiceId}`, data),
  deleteChoice: (questionId: string, choiceId: string) =>
    communityApi.delete(`/communities/trust-questions/${questionId}/choices/${choiceId}`),
}
