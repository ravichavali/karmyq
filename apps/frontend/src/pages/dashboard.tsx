import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'
import WelcomeModal from '@/components/WelcomeModal'
import TabBar, { TabId } from '@/components/TabBar'
import BrowseFeed from '@/components/BrowseFeed'
import CommitmentsTab from '@/components/CommitmentsTab'
import MyRequestsTab from '@/components/MyRequestsTab'
import type { BrowseMode } from '@/components/BrowseModeControl'
import SpeedDialFab from '@/components/SpeedDialFab'
import RequestWizard from '@/components/RequestWizard'
import { useProvider } from '@/contexts/ProviderContext'
// Onboarding: see src/lib/onboarding/workflows.ts → 'feed'
import { useOnboarding } from '@/hooks/useOnboarding'
import OnboardingOverlay from '@/components/OnboardingOverlay'
import { WORKFLOWS } from '@/lib/onboarding/workflows'


interface Community {
  id: string
  name: string
  community_type?: 'mutual_aid' | 'group'
}


export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [activeCommunityId, setActiveCommunityId] = useState<string>('')

  // Tab shell state
  const [activeTab, setActiveTab] = useState<TabId>('browse')
  const [showWizard, setShowWizard] = useState(false)
  const [pendingDibsCount, setPendingDibsCount] = useState(0)

  const [browseMode, setBrowseMode] = useState<BrowseMode>(() => {
    if (typeof window === 'undefined') return 'provider'
    return (localStorage.getItem('karmyq_browse_mode') as BrowseMode) ?? 'provider'
  })
  const handleBrowseModeChange = (mode: BrowseMode) => {
    setBrowseMode(mode)
    localStorage.setItem('karmyq_browse_mode', mode)
  }

  const { hasProviderProfile, isAvailable, providerServiceTypes } = useProvider()
  const isOnDuty = hasProviderProfile && isAvailable
  const { shouldShow: showFeedOnboarding, markSeen: markFeedSeen } = useOnboarding('feed')

  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      fetchCommunities(parsedUser.id)
    }

    setLoading(false)
  }, [router])

  // Honor ?tab= query param once router is ready (e.g. notification links → helping tab)
  useEffect(() => {
    if (!router.isReady) return
    const tabParam = router.query.tab as string | undefined
    if (tabParam === 'helping' || tabParam === 'asks') {
      setActiveTab(tabParam)
    }
  }, [router.isReady, router.query.tab])

  // Scroll to top on tab switch before the browser paints the new content
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  const fetchCommunities = async (userId: string) => {
    try {
      setLoading(true)
      const communitiesRes = await communityService.getMyCommunities(userId)
      setUserCommunities(communitiesRes?.data?.communities || [])
    } catch (err) {
      console.error('Failed to load communities', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-text-muted mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showFeedOnboarding && (
        <OnboardingOverlay workflow={WORKFLOWS.feed} onDismiss={markFeedSeen} />
      )}
      <Head>
        <title>Dashboard - Karmyq</title>
      </Head>
      <Layout>
        <WelcomeModal user={user} />

        {/* Community selector row */}
        <div className="bg-surface-raised border-b border-border px-4 py-2 flex items-center gap-3">
          <label className="text-sm font-medium text-text-muted shrink-0">Community:</label>
          <select
            value={activeCommunityId}
            onChange={(e) => setActiveCommunityId(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All communities</option>
            {userCommunities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {isOnDuty && (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              On duty
            </span>
          )}
        </div>

        {/* Zero-community state — shown when user hasn't joined any community yet */}
        {!loading && userCommunities.length === 0 ? (
          <div className="max-w-md mx-auto px-4 py-16 text-center">
            <div className="text-5xl mb-4">🏘️</div>
            <h2 className="text-xl font-semibold text-text mb-2">You haven't joined a community yet</h2>
            <p className="text-text-muted text-sm mb-8">
              Communities are where requests, activities, and mutual aid happen.
              Join one near you to see your feed.
            </p>
            <Link
              href="/communities"
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors inline-flex"
            >
              Find Communities
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop tab bar */}
            <TabBar
              activeTab={activeTab}
              onChange={(tab) => { window.scrollTo(0, 0); setActiveTab(tab) }}
              browseLabel={undefined}
              dibsCount={pendingDibsCount}
            />

            {/* Tab content */}
            <div className="pb-20 md:pb-0">
              {activeTab === 'browse' && (
                <div key="browse">
                  <BrowseFeed
                    communityId={activeCommunityId || undefined}
                    communityType={userCommunities.find(c => c.id === activeCommunityId)?.community_type}
                    isOnDuty={isOnDuty}
                    providerServiceTypes={providerServiceTypes ?? []}
                    noCommunities={userCommunities.length === 0}
                    browseMode={browseMode}
                    onBrowseModeChange={handleBrowseModeChange}
                  />
                </div>
              )}
              {activeTab === 'helping' && <div key="helping"><CommitmentsTab onDibsLoaded={setPendingDibsCount} communityId={activeCommunityId} /></div>}
              {activeTab === 'asks' && <div key="asks"><MyRequestsTab onNewRequest={() => setShowWizard(true)} /></div>}
            </div>
          </>
        )}

        <SpeedDialFab
          activeTab={activeTab}
          onGetHelp={() => setShowWizard(true)}
          onGetService={() => setShowWizard(true)}
        />
        {showWizard && (
          <RequestWizard
            onClose={() => setShowWizard(false)}
            onSuccess={() => {}}
          />
        )}
      </Layout>
    </>
  )
}
