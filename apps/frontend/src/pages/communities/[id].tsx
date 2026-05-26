import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ActivitiesTab from '@/components/ActivitiesTab'
import CommunityHeader from '@/components/community/CommunityHeader'
import BrowseTab from '@/components/community/tabs/BrowseTab'
import ActiveTab from '@/components/community/tabs/ActiveTab'
import ProfileTab from '@/components/community/tabs/ProfileTab'
import { useCommunityData } from '@/hooks/useCommunityData'
import { communityService } from '@/lib/api'
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'

type ValidTab = 'overview' | 'people' | 'requests' | 'providers' | 'settings' | 'activities' | 'trust'

const OLD_TAB_MAP: Record<string, ValidTab> = {
  manage: 'people',
  pending: 'people',
  members: 'people',
  norms: 'people',
  config: 'settings',
  stats: 'requests',
  insights: 'requests',
  export: 'requests',
  links: 'settings',
}

const VALID_TABS: ValidTab[] = ['overview', 'people', 'requests', 'providers', 'settings', 'activities', 'trust']

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

  const [activeTab, setActiveTab] = useState<ValidTab>('overview')
  const [joiningCommunity, setJoiningCommunity] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('token')) router.push('/login')
  }, [router])

  // URL tab sync + backwards-compat redirect
  useEffect(() => {
    const raw = router.query.tab as string | undefined
    if (!raw) return
    if (VALID_TABS.includes(raw as ValidTab)) {
      setActiveTab(raw as ValidTab)
    } else if (OLD_TAB_MAP[raw]) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: OLD_TAB_MAP[raw] } },
        undefined,
        { shallow: true }
      )
      setActiveTab(OLD_TAB_MAP[raw])
    }
  }, [router.query.tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger tab-specific data fetches
  useEffect(() => {
    if (!communityId) return
    if (activeTab === 'people') {
      refetchMemberTrustScores()
    } else if (activeTab === 'requests') {
      refetchCommunityRequests()
      if (!stats) refetchStats()
      if (!communityTrust) refetchCommunityTrust()
      if (!networkMetrics) refetchNetworkMetrics()
    } else if (activeTab === 'providers') {
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
      await communityService.joinCommunity(communityId, { user_id: currentUser.id })
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

  const tabBtnClass = (tab: ValidTab) =>
    `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${
      activeTab === tab
        ? 'border-primary text-primary'
        : 'border-transparent text-text-muted hover:text-text hover:border-border'
    }`

  return (
    <>
      <Head>
        <title>{community.name} - Karmyq</title>
      </Head>
      <Layout title={community.name}>
        <div className="container mx-auto px-4 py-8">
          <CommunityHeader
            community={community}
            isMember={isMember ?? false}
            isPending={isPending ?? false}
            isAdmin={isAdmin ?? false}
            joiningCommunity={joiningCommunity}
            onJoin={handleJoinCommunity}
          />

          <div className="bg-surface-raised rounded-lg shadow-md mb-6">
            <div className="border-b border-border mb-6">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                {(['overview', 'people'] as ValidTab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={tabBtnClass(tab)}>
                    {tab === 'people' ? (
                      <span className="relative">
                        people
                        {isAdminOrMod && pendingCount > 0 && activeTab !== 'people' && (
                          <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </span>
                    ) : tab}
                  </button>
                ))}
                {community.community_type === 'group' && (
                  <button onClick={() => setActiveTab('activities')} className={tabBtnClass('activities')}>
                    Activities
                  </button>
                )}
                {isAdminOrMod && (['requests', 'providers'] as ValidTab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={tabBtnClass(tab)}>
                    {tab}
                  </button>
                ))}
                {isMember && (
                  <button onClick={() => setActiveTab('trust')} className={tabBtnClass('trust')}>
                    trust graph
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => setActiveTab('settings')} className={tabBtnClass('settings')}>
                    settings
                  </button>
                )}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <ProfileTab
                  section="overview"
                  community={community} config={config} settings={settings} stats={stats}
                  communityCollectives={communityCollectives} currentUser={currentUser}
                  isAdmin={isAdmin ?? false} communityId={communityId!}
                  refetchCommunityCollectives={refetchCommunityCollectives}
                />
              )}
              {activeTab === 'people' && (
                <ActiveTab
                  community={community} norms={norms} memberTrustScores={memberTrustScores}
                  currentUser={currentUser} isAdmin={isAdmin ?? false} isAdminOrMod={isAdminOrMod ?? false}
                  isMember={isMember ?? false} communityId={communityId!}
                  refetchCommunity={refetchCommunity} refetchNorms={refetchNorms}
                />
              )}
              {activeTab === 'requests' && (
                <BrowseTab
                  communityRequests={communityRequests} loadingRequests={loadingRequests}
                  loadingStats={loadingStats} stats={stats} communityTrust={communityTrust}
                  loadingTrust={loadingTrust} networkMetrics={networkMetrics}
                  community={community} communityId={communityId!}
                  isAdmin={isAdmin ?? false} isAdminOrMod={isAdminOrMod ?? false}
                  refetchCommunityRequests={refetchCommunityRequests}
                />
              )}
              {activeTab === 'providers' && (
                <ProfileTab
                  section="providers"
                  community={community} config={config} settings={settings} stats={stats}
                  communityCollectives={communityCollectives} currentUser={currentUser}
                  isAdmin={isAdmin ?? false} communityId={communityId!}
                  refetchCommunityCollectives={refetchCommunityCollectives}
                />
              )}
              {activeTab === 'settings' && (
                <ProfileTab
                  section="settings"
                  community={community} config={config} settings={settings} stats={stats}
                  communityCollectives={communityCollectives} currentUser={currentUser}
                  isAdmin={isAdmin ?? false} communityId={communityId!}
                  refetchCommunityCollectives={refetchCommunityCollectives}
                />
              )}
              {activeTab === 'activities' && (
                <ActivitiesTab communityId={communityId!} isAdmin={isAdmin ?? false} />
              )}
              {activeTab === 'trust' && (
                <TrustGraphTab communityId={communityId!} currentUserId={currentUser?.id ?? ''} />
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
