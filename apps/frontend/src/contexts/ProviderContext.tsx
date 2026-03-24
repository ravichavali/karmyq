import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { providerService } from '../lib/api'

interface ProviderProfile {
  id: string
  user_id: string
  service_type: string
  display_name: string
  is_active: boolean
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
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('karmyq_provider_mode')
      if (saved === 'provider') {
        setProviderModeState('provider')
      }
    }
  }, [])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      setLoading(false)
      return
    }

    // providerService.getMyProviders() hits GET /providers/my
    // The response interceptor unwraps { success, data } so res.data is the array directly
    providerService.getMyProviders()
      .then((res: any) => {
        const profiles = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        setProviderProfiles(profiles)
      })
      .catch(() => {
        setProviderProfiles([])
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
