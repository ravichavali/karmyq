import { useEffect, useState } from 'react'
import GovernanceTab from '@/components/GovernanceTab'
import FissionTab from '@/components/community/tabs/FissionTab'
import FusionTab from '@/components/community/tabs/FusionTab'
import ProfileTab from '@/components/community/tabs/ProfileTab'
import StewardRequestsAdmin from '@/components/community/StewardRequestsAdmin'
import type { Community } from '@/hooks/useCommunityData'
import type { StewardshipSection } from '@/lib/communityTabs'

interface Props {
  community: Community
  communityId: string
  currentUser: any
  isAdmin: boolean
  isAdminOrMod: boolean
  config: any
  settings: any
  stats: any
  loadingStats: boolean
  communityCollectives: any[]
  communityTrust: any
  loadingTrust: boolean
  networkMetrics: any
  communityRequests: any[]
  loadingRequests: boolean
  refetchCommunity: () => Promise<void>
  refetchCommunityRequests: (status?: string) => Promise<void>
  refetchCommunityCollectives: () => Promise<void>
  /** The sub-section a legacy deep link (`?tab=settings`, `?tab=fission`, …) resolved to. */
  initialSection?: StewardshipSection
}

type Section = StewardshipSection

/**
 * Sprint 89 / ADR-068 — Stewardship: where the community's management lives, one altitude below
 * the warm Home. Decisions/Split/Fusion are open to all members; the steward-request manager,
 * settings, and providers are admin-only. This is a *relocation* — it composes the existing
 * components under a warm sub-nav, it does not re-implement any management surface.
 */
export default function StewardshipTab({
  community, communityId, currentUser, isAdmin, isAdminOrMod,
  config, settings, stats, loadingStats, communityCollectives,
  communityTrust, loadingTrust, networkMetrics,
  communityRequests, loadingRequests,
  refetchCommunity, refetchCommunityRequests, refetchCommunityCollectives,
  initialSection,
}: Props) {
  const showSplit = isAdmin || community.active_split_proposal != null
  const showFusion = isAdmin || community.active_fusion_proposal != null

  // Sub-sections available to this viewer, in display order. Everyone sees Decisions first.
  const sections: { key: Section; label: string; dot?: boolean }[] = [
    { key: 'decisions', label: 'Decisions' },
    ...(showSplit ? [{ key: 'split' as Section, label: 'Split', dot: community.active_split_proposal != null }] : []),
    ...(showFusion ? [{ key: 'fusion' as Section, label: 'Fusion', dot: community.active_fusion_proposal != null }] : []),
    ...(isAdminOrMod ? [{ key: 'requests' as Section, label: 'Steward requests' }] : []),
    ...(isAdmin ? [{ key: 'settings' as Section, label: 'Settings' }] : []),
    ...(isAdmin ? [{ key: 'providers' as Section, label: 'Providers' }] : []),
  ]

  const [section, setSection] = useState<Section>(initialSection ?? 'decisions')

  // A legacy deep link (`?tab=settings`, `?tab=fission`, …) resolves to a Stewardship sub-section
  // after mount; honour it so the old link opens where it meant to, not on the default Decisions.
  useEffect(() => {
    if (initialSection) setSection(initialSection)
  }, [initialSection])

  // Fall back to Decisions if the chosen sub-section isn't available to this viewer (e.g. a member
  // deep-linked to an admin-only Settings section).
  const active = sections.some((s) => s.key === section) ? section : 'decisions'

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Stewardship sections">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
              active === s.key
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-text-muted border-border hover:border-primary'
            }`}
          >
            {s.label}
            {s.dot && <span className="ml-1 text-xs text-amber-500">●</span>}
          </button>
        ))}
      </nav>

      <div>
        {active === 'decisions' && (
          <GovernanceTab communityId={communityId} currentUserId={currentUser?.id ?? ''} />
        )}
        {active === 'split' && (
          <FissionTab community={community} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} onRefresh={refetchCommunity} />
        )}
        {active === 'fusion' && (
          <FusionTab community={community} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} onRefresh={refetchCommunity} />
        )}
        {active === 'requests' && isAdminOrMod && (
          <StewardRequestsAdmin
            communityRequests={communityRequests} loadingRequests={loadingRequests}
            loadingStats={loadingStats} stats={stats} communityTrust={communityTrust}
            loadingTrust={loadingTrust} networkMetrics={networkMetrics}
            community={community} communityId={communityId}
            isAdmin={isAdmin} isAdminOrMod={isAdminOrMod}
            refetchCommunityRequests={refetchCommunityRequests}
          />
        )}
        {active === 'settings' && isAdmin && (
          <ProfileTab
            section="settings"
            community={community} config={config} settings={settings} stats={stats}
            communityCollectives={communityCollectives} currentUser={currentUser}
            isAdmin={isAdmin} communityId={communityId}
            refetchCommunityCollectives={refetchCommunityCollectives}
          />
        )}
        {active === 'providers' && isAdmin && (
          <ProfileTab
            section="providers"
            community={community} config={config} settings={settings} stats={stats}
            communityCollectives={communityCollectives} currentUser={currentUser}
            isAdmin={isAdmin} communityId={communityId}
            refetchCommunityCollectives={refetchCommunityCollectives}
          />
        )}
      </div>
    </div>
  )
}
