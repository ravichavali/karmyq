import axios from 'axios'

const AUTH_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const COMMUNITY_API_URL = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002'
const REQUEST_API_URL = process.env.NEXT_PUBLIC_REQUEST_API_URL || 'http://localhost:3003'

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

// Community API Methods
export const communityService = {
  // Communities
  getCommunities: (params?: { status?: string; limit?: number; offset?: number }) =>
    communityApi.get('/communities', { params }),

  getCommunity: (id: string) =>
    communityApi.get(`/communities/${id}`),

  createCommunity: (data: { name: string; description: string; creator_id: string; max_members?: number }) =>
    communityApi.post('/communities', data),

  updateCommunity: (id: string, data: { name?: string; description?: string; max_members?: number; user_id: string }) =>
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
}

// Request Service API Methods
export const requestService = {
  // Help Requests
  getRequests: (params?: { community_id?: string; status?: string; type?: string; limit?: number; offset?: number }) =>
    requestApi.get('/requests', { params }),

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
