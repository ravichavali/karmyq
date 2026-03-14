import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import TrustScoreBadge from '@/components/providers/TrustScoreBadge'
import CollectiveForm from '@/components/providers/CollectiveForm'
import CollectiveMembersList from '@/components/providers/CollectiveMembersList'
import { collectiveService, providerService } from '../../../lib/api'
import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
}

export default function CollectiveDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [collective, setCollective] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [myProviderId, setMyProviderId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [linkingCommunity, setLinkingCommunity] = useState(false)
  const [communityIdInput, setCommunityIdInput] = useState('')

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!userStr) { router.push('/login'); return }
    setCurrentUser(JSON.parse(userStr))
  }, [])

  useEffect(() => {
    if (currentUser && id) {
      fetchCollective()
      fetchMyProvider()
    }
  }, [currentUser, id])

  async function fetchCollective() {
    setLoading(true)
    try {
      const response = await collectiveService.getCollective(id as string)
      setCollective(response.data)
    } catch (err) {
      console.error('Failed to fetch collective', err)
    } finally {
      setLoading(false)
    }
    try {
      const statsResponse = await collectiveService.getCollectiveStats(id as string)
      setStats(statsResponse.data.data ?? statsResponse.data)
    } catch {}
  }

  async function fetchMyProvider() {
    try {
      const response = await providerService.getMyProviders()
      const providers: any[] = response.data ?? []
      if (providers.length > 0) setMyProviderId(providers[0].id)
    } catch {}
  }

  async function handleUpdate(data: any) {
    await collectiveService.updateCollective(id as string, data)
    setEditing(false)
    fetchCollective()
  }

  async function handleLinkCommunity(e: React.FormEvent) {
    e.preventDefault()
    if (!communityIdInput.trim()) return
    try {
      await collectiveService.linkCommunity(id as string, communityIdInput.trim())
      setCommunityIdInput('')
      setLinkingCommunity(false)
      fetchCollective()
    } catch (err: any) {
      alert(err?.message ?? 'Failed to link community')
    }
  }

  if (!currentUser || loading) {
    return <Layout><div className="flex items-center justify-center py-24 text-text-muted text-sm">Loading...</div></Layout>
  }

  if (!collective) {
    return <Layout><div className="flex items-center justify-center py-24 text-text-muted text-sm">Collective not found.</div></Layout>
  }

  const isCreator = currentUser?.id === collective.created_by
  const isAdmin = isCreator || collective.members?.some(
    (m: any) => m.provider_id === myProviderId && m.role === 'admin'
  )

  return (
    <Layout>
      <Head><title>{collective.name} — Karmyq</title></Head>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="bg-surface-raised rounded-xl border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-karmyq-teal-500 to-karmyq-green-600 rounded-lg flex items-center justify-center text-white text-lg font-bold">
                {collective.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-text">{collective.name}</h1>
                <p className="text-sm text-text-subtle">{collective.member_count ?? 0} provider{collective.member_count !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <TrustScoreBadge score={collective.avg_trust_score} />
          </div>

          {collective.description && <p className="mt-4 text-sm text-text-muted">{collective.description}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {collective.service_types?.map((type: string) => (
              <span key={type} className="text-xs bg-primary-light text-primary rounded-full px-2 py-0.5">
                {SERVICE_TYPE_LABELS[type] ?? type}
              </span>
            ))}
            {collective.location_notes && (
              <span className="text-xs text-text-subtle">{collective.location_notes}</span>
            )}
          </div>

          {isAdmin && (
            <button onClick={() => setEditing(e => !e)} className="mt-4 text-sm text-primary hover:underline">
              {editing ? 'Cancel edit' : 'Edit collective'}
            </button>
          )}
        </div>

        {editing && (
          <div className="bg-surface-raised rounded-xl border border-border p-6">
            <CollectiveForm initial={collective} onSubmit={handleUpdate} submitLabel="Save changes" />
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Requests matched', value: stats.total_requests_matched },
              { label: 'Fulfillment rate', value: `${stats.fulfillment_rate}%` },
              { label: 'Avg completion time', value: stats.avg_completion_hours != null ? `${stats.avg_completion_hours}h` : '—' },
              { label: 'Communities served', value: stats.communities_served_count },
              { label: 'Available now', value: stats.available_member_count },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-raised rounded-xl border border-border p-4">
                <p className="text-2xl font-bold text-text">{value}</p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Communities served */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-text">Communities served</h2>
            {isAdmin && (
              <button
                onClick={() => setLinkingCommunity(l => !l)}
                className="text-sm text-primary hover:underline"
              >
                + Link community
              </button>
            )}
          </div>

          {collective.communities?.length === 0 && (
            <p className="text-sm text-text-muted">No communities linked yet.</p>
          )}
          <div className="space-y-2">
            {collective.communities?.map((c: any) => (
              <div key={c.community_id} className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-text">{c.community_name}</span>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      await collectiveService.unlinkCommunity(id as string, c.community_id)
                      fetchCollective()
                    }}
                    className="text-xs text-text-muted hover:text-red-500 transition"
                  >
                    Unlink
                  </button>
                )}
              </div>
            ))}
          </div>

          {linkingCommunity && (
            <form onSubmit={handleLinkCommunity} className="mt-3 flex gap-2">
              <input
                type="text"
                value={communityIdInput}
                onChange={e => setCommunityIdInput(e.target.value)}
                placeholder="Community ID"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm hover:bg-primary-dark transition">
                Link
              </button>
            </form>
          )}
        </div>

        {/* Members */}
        <div className="bg-surface-raised rounded-xl border border-border p-5">
          <CollectiveMembersList
            collectiveId={id as string}
            members={collective.members ?? []}
            currentUserId={currentUser?.id}
            currentUserProviderId={myProviderId}
            isCollectiveAdmin={isAdmin}
            onMembershipChanged={fetchCollective}
            onAvailabilityChanged={fetchCollective}
          />
        </div>
      </div>
    </Layout>
  )
}
