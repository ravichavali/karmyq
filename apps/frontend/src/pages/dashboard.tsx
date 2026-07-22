import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { communityService } from '@/lib/api'
import { clearAuthSession, hasOnboarded } from '@/lib/session'
import Layout from '@/components/Layout'
import WelcomeModal from '@/components/WelcomeModal'
import TabBar, { TabId } from '@/components/TabBar'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import EmptyState from '@/components/EmptyState'
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
  // Membership fetch is tracked separately from auth bootstrap so the page never renders the
  // zero-community empty state before getMyCommunities resolves (BUG-097-001). Starts true
  // because an authenticated mount always fetches memberships.
  const [communitiesLoading, setCommunitiesLoading] = useState(true)

  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [activeCommunityId, setActiveCommunityId] = useState<string>('')
  const [communityLoadError, setCommunityLoadError] = useState<string | null>(null)

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
  // Sprint 120 PR C (F-1): the WelcomeModal owns the visit for a user who has never onboarded, so
  // the feed workflow tour must not stack behind it. Read from storage rather than the `user` state
  // (which is populated in a later effect) so the decision is available at mount.
  const [welcomeModalOwnsThisVisit] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null')
      return !!stored?.id && !hasOnboarded(stored.id)
    } catch {
      return false
    }
  })
  const { shouldShow: showFeedOnboarding, markSeen: markFeedSeen } = useOnboarding('feed', {
    suppressed: welcomeModalOwnsThisVisit,
  })

  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      setLoading(false)
      return
    }

    if (!userData) {
      clearAuthSession()
      router.push('/login')
      setLoading(false)
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      if (!parsedUser?.id) {
        throw new Error('Missing user id in local storage')
      }
      setUser(parsedUser)
      fetchCommunities(parsedUser.id)
    } catch {
      clearAuthSession()
      router.push('/login')
      setLoading(false)
      return
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
      setCommunitiesLoading(true)
      setCommunityLoadError(null)
      const communitiesRes = await communityService.getMyCommunities(userId)
      setUserCommunities(communitiesRes?.data?.communities || [])
    } catch (err) {
      setCommunityLoadError('We could not load your communities. You can retry now.')
      console.error('Failed to load communities', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setCommunitiesLoading(false)
    }
  }

  if (!user || loading || communitiesLoading) {
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
        <div className="border-b border-border-light bg-surface-raised/60">
          <div className="kq-chrome-page flex items-center gap-3 py-3">
            <label className="text-sm font-medium text-text-muted shrink-0">Community:</label>
            {/* Sprint 120 PR C (F-3): an unconstrained <select> takes its intrinsic width from the
                longest option, so a churned community name ("… — Group B — Group B") pushed the
                375px page to 470px and gave the whole document a horizontal scrollbar. min-w-0 on
                the flex parent + max-w-full caps it; the option text truncates instead. */}
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <select
                value={activeCommunityId}
                onChange={(e) => setActiveCommunityId(e.target.value)}
                className="w-full max-w-full text-sm border border-border rounded-lg bg-surface px-2 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All communities</option>
                {userCommunities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* On-duty status now lives solely in the topbar On duty/Off duty toggle (clickable,
                single source of truth) — the redundant read-only pill here was removed. */}
          </div>
        </div>
        {communityLoadError && (
          <div className="kq-page mt-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-warn bg-warn-light px-3 py-2 text-sm text-warn">
              <span>{communityLoadError}</span>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => fetchCommunities(user.id)}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Zero-community state — shown only after memberships resolve to genuinely empty.
            A fetch failure surfaces the retry banner above instead of this false empty state. */}
        {!communitiesLoading && !communityLoadError && userCommunities.length === 0 ? (
          <div className="kq-page py-16">
            <EmptyState
              icon="🏘️"
              heading="Join a community to see requests"
              body="Communities are where requests, activities, and mutual aid happen. Join one near you to see your feed."
              ctaLabel="Find Communities"
              ctaHref="/communities"
            />
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
                  <section className="kq-page-header kq-page">
                    <p className="kq-eyebrow">Home</p>
                    <h1 className="kq-headline">Good to see you, {user.name ?? 'neighbour'}.</h1>
                    <p className="kq-lede">A calm queue of asks you can fill, led by the relationships that make help possible. Decisions you owe wait in the Helping tab.</p>
                  </section>
                  <UnifiedFeed
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
