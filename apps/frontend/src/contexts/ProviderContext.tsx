import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { providerService } from '../lib/api'

interface ProviderProfile {
  id: string
  user_id: string
  service_type: string
  display_name: string
  is_active: boolean
  is_available?: boolean
  // Trust score fields from LEFT JOIN with reputation.provider_trust_scores
  // Postgres NUMERIC columns arrive as strings — use Number() when computing
  completion_rate?: string | number | null
  response_rate?: string | number | null
  avg_stars?: string | number | null
  total_reviews?: number | null
  trust_score?: string | number | null
}

interface ProviderContextValue {
  hasProviderProfile: boolean
  providerProfiles: ProviderProfile[]
  providerServiceTypes: string[]
  providerMode: 'member' | 'provider'
  setProviderMode: (mode: 'member' | 'provider') => void
  loading: boolean
}

const ProviderContext = createContext<ProviderContextValue | undefined>(undefined)

interface ProviderProviderProps {
  children: ReactNode
}

export const ProviderProvider: React.FC<ProviderProviderProps> = ({ children }) => {
  const [providerProfiles, setProviderProfiles] = useState<ProviderProfile[]>([])
  const [providerMode, setProviderModeState] = useState<'member' | 'provider'>('member')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      setLoading(false)
      return
    }

    // Restore persisted mode preference
    const saved = localStorage.getItem('karmyq_provider_mode')
    const restoredMode: 'member' | 'provider' = saved === 'provider' ? 'provider' : 'member'

    providerService.getMyProviders()
      .then((res: { data: ProviderProfile[] | ProviderProfile }) => {
        // The response interceptor unwraps {success, data} so res.data is the array directly
        const raw = Array.isArray(res.data) ? res.data : []
        const activeProfiles = raw.filter((p: ProviderProfile) => p.is_active)
        setProviderProfiles(activeProfiles)

        // Reset mode to member if user no longer has active profiles
        const effectiveMode = activeProfiles.length > 0 ? restoredMode : 'member'
        setProviderModeState(effectiveMode)
        if (effectiveMode !== restoredMode) {
          localStorage.removeItem('karmyq_provider_mode')
        }
      })
      .catch(() => {
        setProviderProfiles([])
        setProviderModeState('member')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const setProviderMode = (mode: 'member' | 'provider') => {
    setProviderModeState(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('karmyq_provider_mode', mode)
    }
  }

  const hasProviderProfile = providerProfiles.length > 0
  const providerServiceTypes = [...new Set(providerProfiles.map(p => p.service_type))]

  const value: ProviderContextValue = {
    hasProviderProfile,
    providerProfiles,
    providerServiceTypes,
    providerMode,
    setProviderMode,
    loading,
  }

  return (
    <ProviderContext.Provider value={value}>
      {children}
    </ProviderContext.Provider>
  )
}

export const useProvider = () => {
  const context = useContext(ProviderContext)
  if (context === undefined) {
    throw new Error('useProvider must be used within a ProviderProvider')
  }
  return context
}
