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
  setProviderMode: (mode: 'member' | 'provider') => void | Promise<void>
  updateProviderAvailability: (providerId: string, isAvailable: boolean) => void
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

    providerService.getMyProviders()
      .then((res: { data: ProviderProfile[] | ProviderProfile }) => {
        // The response interceptor unwraps {success, data} so res.data is the array directly
        const raw = Array.isArray(res.data) ? res.data : []
        const activeProfiles = raw.filter((p: ProviderProfile) => p.is_active)
        setProviderProfiles(activeProfiles)

        // Default: providers start in provider mode unless they explicitly chose member.
        // 'member' saved → respect it. 'provider' saved → respect it.
        // No preference saved + has profiles → default to provider mode.
        const defaultMode: 'member' | 'provider' = activeProfiles.length > 0 ? 'provider' : 'member'
        const restoredMode: 'member' | 'provider' = saved === 'member' ? 'member' : (saved === 'provider' ? 'provider' : defaultMode)
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

  const setProviderMode = async (mode: 'member' | 'provider') => {
    setProviderModeState(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('karmyq_provider_mode', mode)
    }
    const isAvailable = mode === 'provider'
    for (const profile of providerProfiles) {
      try {
        await providerService.updateAvailability(profile.id, isAvailable)
        updateProviderAvailability(profile.id, isAvailable)
      } catch {
        // best-effort — local state already reflects the new mode
      }
    }
  }

  const updateProviderAvailability = (providerId: string, isAvailable: boolean) => {
    setProviderProfiles(prev =>
      prev.map(p => p.id === providerId ? { ...p, is_available: isAvailable } : p)
    )
  }

  const hasProviderProfile = providerProfiles.length > 0
  const providerServiceTypes = [...new Set(providerProfiles.map(p => p.service_type))]

  const value: ProviderContextValue = {
    hasProviderProfile,
    providerProfiles,
    providerServiceTypes,
    providerMode,
    setProviderMode,
    updateProviderAvailability,
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
