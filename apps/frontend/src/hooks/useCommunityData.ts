import { useEffect, useState } from 'react'
import { communityService, requestService, reputationService, collectiveService } from '@/lib/api'
import type { CommunityConfig } from '@/types/community-config'

export interface Member {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: string
  status: string
  joined_at: string
  invited_by_name?: string
  join_request_message?: string
}

export interface CommunitySettings {
  request_ttl_days: number
  offer_ttl_days: number
  match_ttl_days: number
  notification_ttl_days: number
  message_ttl_days: number
  session_ttl_days: number
  karma_decay_enabled: boolean
  karma_half_life_months: number
}

export interface SplitProposalSummary {
  id: string
  status: string
  group_a_name: string
  group_b_name: string
}

export interface Community {
  id: string
  name: string
  description: string
  current_members: number
  max_members: number
  access_type: 'public' | 'private'
  creator_id: string
  creator_name: string
  status: string
  members: Member[]
  community_type?: string
  size_alert?: 'approaching' | 'recommend_split' | 'urgent_split' | null
  active_split_proposal?: SplitProposalSummary | null
}

export function useCommunityData(communityId: string | undefined) {
  const [community, setCommunity] = useState<Community | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [norms, setNorms] = useState<any[]>([])
  const [config, setConfig] = useState<CommunityConfig | null>(null)
  const [settings, setSettings] = useState<CommunitySettings | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [communityTrust, setCommunityTrust] = useState<any>(null)
  const [loadingTrust, setLoadingTrust] = useState(false)
  const [networkMetrics, setNetworkMetrics] = useState<any>(null)
  const [communityRequests, setCommunityRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [memberTrustScores, setMemberTrustScores] = useState<Record<string, number | null>>({})
  const [communityCollectives, setCommunityCollectives] = useState<any[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user')
      if (userData) setCurrentUser(JSON.parse(userData))
    }
  }, [])

  useEffect(() => {
    if (communityId) {
      fetchCommunity()
      fetchNorms()
      fetchConfig()
      fetchSettings()
      fetchStats()
    }
  }, [communityId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCommunity = async () => {
    if (!communityId) return
    try {
      setLoading(true)
      const response = await communityService.getCommunity(communityId)
      setCommunity(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load community')
    } finally {
      setLoading(false)
    }
  }

  const fetchNorms = async () => {
    if (!communityId) return
    try {
      const response = await communityService.getNorms(communityId)
      setNorms(response.data.norms || response.data)
    } catch (err: any) {
      console.error('Failed to load norms', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const fetchConfig = async () => {
    if (!communityId) return
    try {
      const response = await communityService.getConfig(communityId)
      setConfig(response.data.config)
    } catch (err: any) {
      console.error('Failed to load configuration', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const fetchSettings = async () => {
    if (!communityId) return
    try {
      const response = await communityService.getSettings(communityId)
      setSettings(response.data)
    } catch {
      setSettings({
        request_ttl_days: 60, offer_ttl_days: 60, match_ttl_days: 90,
        notification_ttl_days: 30, message_ttl_days: 90, session_ttl_days: 30,
        karma_decay_enabled: true, karma_half_life_months: 6,
      })
    }
  }

  const fetchStats = async () => {
    if (!communityId) return
    try {
      setLoadingStats(true)
      const response = await communityService.getStats(communityId)
      setStats(response.data)
    } catch (err: any) {
      console.error('Failed to load statistics', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchCommunityTrust = async () => {
    if (!communityId) return
    try {
      setLoadingTrust(true)
      const response = await reputationService.getCommunityTrust(communityId)
      setCommunityTrust(response.data ?? null)
    } catch { /* non-fatal */ } finally {
      setLoadingTrust(false)
    }
  }

  const fetchNetworkMetrics = async () => {
    if (!communityId) return
    try {
      const response = await reputationService.getNetworkMetrics(communityId)
      setNetworkMetrics(response.data ?? null)
    } catch { /* non-fatal */ }
  }

  const fetchCommunityRequests = async (status?: string) => {
    if (!communityId) return
    try {
      setLoadingRequests(true)
      const response = await requestService.getRequests({
        community_id: communityId,
        status: status || undefined,
        limit: 50,
        include_admin_notes: true,
      })
      const data = response.data
      setCommunityRequests(Array.isArray(data) ? data : (data?.requests ?? []))
    } catch (err: any) {
      console.error('Failed to load community requests', { error: err instanceof Error ? err.message : String(err) })
      setCommunityRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchMemberTrustScores = async (members?: Member[]) => {
    const activeMembers = (members ?? community?.members ?? []).filter((m: any) => m.status === 'active')
    if (!activeMembers.length || !communityId) return
    const results = await Promise.allSettled(
      activeMembers.map((m: any) => reputationService.getTrustScore(m.user_id, communityId))
    )
    const scores: Record<string, number | null> = {}
    activeMembers.forEach((m: any, i: number) => {
      const r = results[i]
      scores[m.user_id] = r.status === 'fulfilled' ? (r.value.data?.data?.score ?? null) : null
    })
    setMemberTrustScores(scores)
  }

  const fetchCommunityCollectives = async () => {
    if (!communityId) return
    try {
      const response = await collectiveService.listCollectivesByCommunity(communityId)
      setCommunityCollectives(response.data.data ?? response.data ?? [])
    } catch { /* ignore */ }
  }

  return {
    community, loading, error, currentUser,
    norms, config, settings,
    stats, loadingStats,
    communityTrust, loadingTrust,
    networkMetrics,
    communityRequests, loadingRequests,
    memberTrustScores,
    communityCollectives,
    refetchCommunity: fetchCommunity,
    refetchNorms: fetchNorms,
    refetchStats: fetchStats,
    refetchCommunityTrust: fetchCommunityTrust,
    refetchNetworkMetrics: fetchNetworkMetrics,
    refetchCommunityRequests: fetchCommunityRequests,
    refetchMemberTrustScores: fetchMemberTrustScores,
    refetchCommunityCollectives: fetchCommunityCollectives,
  }
}
