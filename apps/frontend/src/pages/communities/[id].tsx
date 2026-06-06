import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ActivitiesTab from '@/components/ActivitiesTab'
import CommunityHero from '@/components/community/CommunityHero'
import CommunityPulse from '@/components/community/CommunityPulse'
import BrowseTab from '@/components/community/tabs/BrowseTab'
import ActiveTab from '@/components/community/tabs/ActiveTab'
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'
import StewardshipTab from '@/components/community/tabs/StewardshipTab'
import { useCommunityData } from '@/hooks/useCommunityData'
import { useCommunityPulse } from '@/hooks/useCommunityPulse'
import { communityService } from '@/lib/api'
import { resolveCommunityTab, type CommunityTab } from '@/lib/communityTabs'

export default function CommunityDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const communityId = id as string | undefined

  const {
    community, loading, error, currentUser, norms, config, settings,
    stats, loadingStats, communityTrust, loadingTrust, networkMetrics,
    communityRequests, loadingRequests, memberTrustScores, communityCollectives,
    refetchCommunity, refetchNorms, refetchStats, refetchCommunityTrust, refetchNetworkMetrics,
    refetchCommunityRequests, refetchMemberTrustScores, refetchCommunityCollectives,
  } = useCommunityData(communityId)

  const [activeTab, setActiveTab] = useState<CommunityTab>('home')
  const [joiningCommunity, setJoiningCommunity] = useState(false)

  const { pulse, loading: loadingPulse } = useCommunityPulse(communityId, activeTab === 'home')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('token')) router.push('/login')
  }, [router])

  // URL tab sync + backwards-compat: resolve ANY legacy alias into the warm four-tab model, and
  // rewrite the URL to the canonical tab so old deep links never dead-end (ADR-068).
  useEffect(() => {
    const raw = router.query.tab as string | undefined
    if (!raw) return
    const resolved = resolveCommunityTab(raw)
    setActiveTab(resolved)
    if (resolved !== raw) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: resolved } },
        undefined,
        { shallow: true }
      )
    }
  }, [router.query.tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger tab-specific data fetches.
  useEffect(() => {
    if (!communityId) return
    if (activeTab === 'people') {
      refetchMemberTrustScores()
    } else if (activeTab === 'stewardship') {
      refetchCommunityRequests()
      if (!stats) refetchStats()
      if (!communityTrust) refetchCommunityTrust()
      if (!networkMetrics) refetchNetworkMetrics()
      refetchCommunityCollectives()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const membershipRecord = community?.members.find((m) => m.user_id === currentUser?.id)
  const isMember = membershipRecord?.status === 'active'
  const isPending = membershipRecord?.status === 'pending'
  const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active'
  const isModerator = membershipRecord?.role === 'moderator' && membershipRecord?.status === 'active'
  const isAdminOrMod = isAdmin || isModerator
  const pendingCount = isAdminOrMod
    ? (community?.members ?? []).filter((m) => m.status === 'pending').length
    : 0

  const handleJoinCommunity = async () => {
    if (!currentUser || !communityId || !community) return
    setJoiningCommunity(true)
    try {
      const joinRes = await communityService.joinCommunity(communityId, { user_id: currentUser.id })

      // Persist refreshed JWT so other pages reflect the new membership immediately
      const newToken = joinRes?.data?.token
      if (newToken && community.access_type === 'public') {
        localStorage.setItem('token', newToken)
        try {
          const payload = JSON.parse(atob(newToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload?.communities) {
            const stored = localStorage.getItem('user')
            if (stored) {
              const u = { ...JSON.parse(stored), communities: payload.communities }
              localStorage.setItem('user', JSON.stringify(u))
            }
          }
        } catch {
          // Non-fatal: token decode failed, communities list stays stale until next login
        }
      }

      await refetchCommunity()
      alert(
        community.access_type === 'public'
          ? 'Successfully joined the community!'
          : 'Join request submitted! Waiting for admin approval.'
      )
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to join community')
    } finally {
      setJoiningCommunity(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-subtle">Loading...</div>
      </div>
    )
  }

  if (error || !community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Community not found'}</div>
      </div>
    )
  }

  // The four warm tabs, plus a group-only Activities (ADR-068). Trust graph + Stewardship are
  // members-only; Home + People are open to everyone (including not-yet-members browsing the page).
  const tabs: { key: CommunityTab; label: string; show: boolean; dot?: boolean }[] = [
    { key: 'home', label: 'Home', show: true },
    { key: 'people', label: 'People', show: true, dot: isAdminOrMod && pendingCount > 0 },
    { key: 'connected', label: "How we're connected", show: !!isMember },
    { key: 'stewardship', label: 'Stewardship', show: !!isMember, dot: community.active_fusion_proposal != null || community.active_split_proposal != null },
    { key: 'activities', label: 'Activities', show: community.community_type === 'group' },
  ]

  const tabBtnClass = (tab: CommunityTab) =>
    `kq-tab ${activeTab === tab ? 'kq-tab-active' : 'kq-tab-inactive'}`

  return (
    <>
      <Head>
        <title>{community.name} - Karmyq</title>
      </Head>
      <Layout title={community.name}>
        <div className="kq-page py-8">
          <CommunityHero
            community={community}
            isMember={isMember ?? false}
            isPending={isPending ?? false}
            isAdmin={isAdmin ?? false}
            joiningCommunity={joiningCommunity}
            onJoin={handleJoinCommunity}
            onShowFission={() => setActiveTab('stewardship')}
          />

          <div className="border-b border-border mb-6">
            <nav className="kq-tabbar" aria-label="Tabs">
              {tabs.filter((t) => t.show).map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={tabBtnClass(tab.key)}>
                  <span className="relative">
                    {tab.label}
                    {tab.dot && activeTab !== tab.key && (
                      <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'home' && (
            <div className="space-y-2">
              <CommunityPulse pulse={pulse} loading={loadingPulse} />
              <BrowseTab community={community} communityId={communityId!} />
            </div>
          )}
          {activeTab === 'people' && (
            <ActiveTab
              community={community} norms={norms} memberTrustScores={memberTrustScores}
              currentUser={currentUser} isAdmin={isAdmin ?? false} isAdminOrMod={isAdminOrMod ?? false}
              isMember={isMember ?? false} communityId={communityId!}
              refetchCommunity={refetchCommunity} refetchNorms={refetchNorms}
            />
          )}
          {activeTab === 'connected' && isMember && (
            <TrustGraphTab communityId={communityId!} currentUserId={currentUser?.id ?? ''} />
          )}
          {activeTab === 'stewardship' && isMember && (
            <StewardshipTab
              community={community} communityId={communityId!} currentUser={currentUser}
              isAdmin={isAdmin ?? false} isAdminOrMod={isAdminOrMod ?? false}
              config={config} settings={settings} stats={stats} loadingStats={loadingStats}
              communityCollectives={communityCollectives}
              communityTrust={communityTrust} loadingTrust={loadingTrust} networkMetrics={networkMetrics}
              communityRequests={communityRequests} loadingRequests={loadingRequests}
              refetchCommunity={refetchCommunity}
              refetchCommunityRequests={refetchCommunityRequests}
              refetchCommunityCollectives={refetchCommunityCollectives}
            />
          )}
          {activeTab === 'activities' && (
            <ActivitiesTab communityId={communityId!} isAdmin={isAdmin ?? false} />
          )}
        </div>
      </Layout>
    </>
  )
}
