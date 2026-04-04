import { socialGraphApi } from './api'

export interface TrustPathNode {
  id: string
  name: string
  karma?: number
  invited_at?: string
}

export interface TrustPath {
  degrees_of_separation: number | null
  path: TrustPathNode[] | null
  trust_score?: number
  cached?: boolean
  computed_at?: string
  message?: string
}

export interface TrustPathResponse {
  success: boolean
  data: TrustPath
}

/**
 * Social Graph API Client
 * Provides methods to interact with the social graph service
 */
export const socialGraphClient = {
  /**
   * Get the shortest trust path between current user and target user
   * @param targetUserId - UUID of target user
   * @returns Trust path data or null if no connection
   */
  async getPath(targetUserId: string): Promise<TrustPath | null> {
    try {
      const response = await socialGraphApi.get<TrustPathResponse>(
        `/paths/${targetUserId}`
      )
      return response.data.data
    } catch (error: any) {
      // If 404 or no connection found, return null (not an error)
      if (error.response?.status === 404) {
        return null
      }
      console.error('[SocialGraph] Error fetching path', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  /**
   * Get trust paths for multiple users (batch operation)
   * Used by feed service for ranking
   * @param targetUserIds - Array of target user UUIDs (max 50)
   * @returns Map of userId -> trust path data
   */
  async getBatchPaths(
    targetUserIds: string[]
  ): Promise<Record<string, TrustPath>> {
    try {
      const response = await socialGraphApi.post('/paths/batch', {
        target_user_ids: targetUserIds.slice(0, 50), // Max 50 users
      })

      // Convert array response to map for easier lookup
      const pathMap: Record<string, TrustPath> = {}
      if (Array.isArray(response.data)) {
        response.data.forEach((item: any) => {
          pathMap[item.target_user_id] = {
            degrees_of_separation: item.degrees_of_separation,
            path: item.path,
            trust_score: item.trust_score,
            cached: item.cached,
          }
        })
      }
      return pathMap
    } catch (error) {
      console.error('[SocialGraph] Error fetching batch paths', { error: error instanceof Error ? error.message : String(error) })
      return {}
    }
  },

  /**
   * Generate an invitation code for current user
   * @returns Invitation code and shareable URL
   */
  async generateInvitation(): Promise<{
    code: string
    url: string
    created_at: string
    expires_at: string | null
  } | null> {
    try {
      const response = await socialGraphApi.post('/invitations/generate')
      return response.data
    } catch (error) {
      console.error('[SocialGraph] Error generating invitation', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  /**
   * Get invitation history for current user
   * @returns Sent and received invitations
   */
  async getInvitationHistory(): Promise<{
    sent: any[]
    received: any
  } | null> {
    try {
      const response = await socialGraphApi.get('/invitations')
      return response.data
    } catch (error) {
      console.error('[SocialGraph] Error fetching invitation history', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  /**
   * Get inviter statistics for current user
   * @returns Gamification metrics
   */
  async getInviterStats(): Promise<{
    total_invitations_sent: number
    total_invitations_accepted: number
    acceptance_rate: number
    avg_invitee_karma: number
    inviter_tier: string
    [key: string]: any
  } | null> {
    try {
      const response = await socialGraphApi.get('/invitations/stats')
      return response.data
    } catch (error) {
      console.error('[SocialGraph] Error fetching inviter stats', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },
}

export default socialGraphClient
