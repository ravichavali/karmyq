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
import { isFirstEverJoin, beginArrival } from '@/lib/session'
import { resolveCommunityTab, resolveStewardshipSection, type CommunityTab, type StewardshipSection } from '@/lib/communityTabs'
import { canViewCommunityStats } from '@/lib/community/statsVisibility'

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
  const [stewardshipSection, setStewardshipSection] = useState<StewardshipSection | undefined>(undefined)
  const [joiningCommunity, setJoiningCommunity] = useState(false)

  const membershipRecord = community?.members.find((m) => m.user_id === currentUser?.id)
  const isMember = membershipRecord?.status === 'active'
  const isPending = membershipRecord?.status === 'pending'
  const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active'
  const isModerator = membershipRecord?.role === 'moderator' && membershipRecord?.status === 'active'
  const isAdminOrMod = isAdmin || isModerator
  const pendingCount = isAdminOrMod
    ? (community?.members ?? []).filter((m) => m.status === 'pending').length
    : 0

  // The pulse and the community feed are members-only (the server returns 403 to non-members), so
  // only fetch the pulse when an actual member is viewing Home — a visitor/pending user would just
  // get a 403 and a broken feed.
  const { pulse, loading: loadingPulse } = useCommunityPulse(communityId, activeTab === 'home' && !!isMember)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('token')) router.push('/login')
  }, [router])

  // URL tab sync + backwards-compat: resolve ANY legacy alias into the warm four-tab model, and
  // rewrite the URL to the canonical tab so old deep links never dead-end (ADR-068). Stewardship
  // aliases (?tab=settings/fission/…) also carry their original sub-section so the link opens there.
  useEffect(() => {
    const raw = router.query.tab as string | undefined
    if (!raw) return
    const resolved = resolveCommunityTab(raw)
    setActiveTab(resolved)
    setStewardshipSection(resolved === 'stewardship' ? resolveStewardshipSection(raw) : undefined)
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
      // S99-001: GET /communities/:id/stats is admin-only (403 for members). Only admins fetch it.
      if (canViewCommunityStats({ isAdmin: !!isAdmin }) && !stats) refetchStats()
      if (!communityTrust) refetchCommunityTrust()
      if (!networkMetrics) refetchNetworkMetrics()
      refetchCommunityCollectives()
    }
  }, [activeTab, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinCommunity = async () => {
    if (!currentUser || !communityId || !community) return
    // Sprint 119: same first-join arrival as the communities index (S118/ADR-085) — the shared
    // helpers keep the two join surfaces from drifting.
    const isFirstJoin = isFirstEverJoin(currentUser)
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

      if (isFirstJoin && community.access_type === 'public') {
        beginArrival({ path: 'open', userId: currentUser.id, communityId, communityName: community.name })
        router.push('/welcome')
        return
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
        <div role="alert" className="kq-card border-error bg-error-light text-error">
          {error || 'Community not found'}
        </div>
      </div>
    )
  }

  // The four warm tabs, plus a group-only Activities (ADR-068). Trust graph + Stewardship are
  // members-only; Home + People are open to everyone (including not-yet-members browsing the page).
  const pendingMemberLabel =
    pendingCount === 1 ? '1 pending member request' : `${pendingCount} pending member requests`
  const stewardshipAttentionLabel = 'stewardship decision needs attention'
  const tabs: { key: CommunityTab; label: string; show: boolean; dot?: boolean; indicatorLabel?: string }[] = [
    { key: 'home', label: 'Home', show: true },
    {
      key: 'people',
      label: 'People',
      show: true,
      dot: isAdminOrMod && pendingCount > 0,
      indicatorLabel: isAdminOrMod && pendingCount > 0 ? pendingMemberLabel : undefined,
    },
    { key: 'connected', label: "How we're connected", show: !!isMember },
    {
      key: 'stewardship',
      label: 'Stewardship',
      show: !!isMember,
      dot: community.active_fusion_proposal != null || community.active_split_proposal != null,
      indicatorLabel:
        community.active_fusion_proposal != null || community.active_split_proposal != null
          ? stewardshipAttentionLabel
          : undefined,
    },
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
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={tabBtnClass(tab.key)}
                  aria-label={tab.indicatorLabel ? `${tab.label}, ${tab.indicatorLabel}` : tab.label}
                >
                  <span className="relative">
                    {tab.label}
                    {tab.dot && activeTab !== tab.key && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-3 h-2 w-2 rounded-full border border-surface bg-warn"
                      />
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'home' && (
            isMember ? (
              <div className="space-y-2">
                <CommunityPulse pulse={pulse} loading={loadingPulse} communityId={communityId!} />
                <BrowseTab community={community} communityId={communityId!} />
              </div>
            ) : (
              // Visitors/pending users aren't members yet — the community feed + pulse are member-
              // only (server returns 403), so invite them in rather than render a broken feed.
              <div className="kq-finite-state">
                <div className="text-3xl mb-2">🏡</div>
                <p className="kq-headline text-[22px]">
                  {isPending ? 'Your request is pending' : 'Join to see the neighbourhood'}
                </p>
                <p className="kq-lede mt-1">
                  {isPending
                    ? 'Once a steward approves you, this is where open asks and the weekly pulse will live.'
                    : 'Open asks and this week’s pulse are shared with members. Join to see who needs a hand here.'}
                </p>
              </div>
            )
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
              initialSection={stewardshipSection}
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
