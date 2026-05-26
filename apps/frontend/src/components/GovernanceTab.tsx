import { useState, useEffect } from 'react'
import { communityService } from '@/lib/api'

interface GovernanceTabProps {
  communityId: string
}

export default function GovernanceTab({ communityId }: GovernanceTabProps) {
  const [state, setState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nominateTarget, setNominateTarget] = useState<string | null>(null)
  const [nominateRole, setNominateRole] = useState<'admin' | 'moderator'>('moderator')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    communityService.getGovernanceState(communityId)
      .then((res: any) => { setState(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load governance data'); setLoading(false) })
  }

  useEffect(() => { load() }, [communityId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNominate = async (userId: string) => {
    setSubmitting(true)
    try {
      await communityService.nominateForRole(communityId, userId, nominateRole)
      setNominateTarget(null)
      load()
    } catch {
      alert('Nomination failed. The member may not meet the eligibility threshold, or a nomination already exists.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRatify = async (nominationId: string) => {
    try {
      await communityService.ratifyNomination(communityId, nominationId)
      load()
    } catch {
      alert('Ratification failed.')
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading governance data…</div>
  if (error) return <div className="p-6 text-red-500">{error}</div>
  if (!state) return null

  const { maturity, settings, eligible_members, nominations, role_holders } = state

  return (
    <div className="p-6 space-y-8">
      {/* Maturity banner */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          maturity.status === 'mature'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {maturity.status === 'mature' ? 'Mature' : 'Constrained'}
        </span>
        <span className="text-sm text-gray-600">
          Community avg trust: <strong>{maturity.avg_trust_score}</strong> / threshold: <strong>{settings.eligibility_threshold}</strong>
        </span>
        <span className="text-xs text-gray-400 ml-auto">{settings.template} · quorum {settings.quorum_size}</span>
      </div>

      {/* Current role holders */}
      {role_holders.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Governance Roles</h3>
          <div className="space-y-2">
            {role_holders.map((rh: any) => (
              <div key={rh.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{rh.name}</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{rh.role}</span>
                <span className="text-gray-400 ml-auto">trust {Math.round(rh.trust_score)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active nominations */}
      {nominations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pending Nominations</h3>
          <div className="space-y-3">
            {nominations.map((nom: any) => (
              <div key={nom.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{nom.nominated_user.name}</span>
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{nom.role}</span>
                    <p className="text-xs text-gray-500 mt-0.5">Nominated by {nom.nominator.name}</p>
                  </div>
                  <button
                    onClick={() => handleRatify(nom.id)}
                    className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Ratify
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{nom.ratification_count} of {nom.required_ratifications} ratifications</span>
                    {nom.ratifiers.length > 0 && (
                      <span>by {nom.ratifiers.map((r: any) => r.name).join(', ')}</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (nom.ratification_count / nom.required_ratifications) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Eligible members */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Eligible Members (trust ≥ {settings.eligibility_threshold})
        </h3>
        {eligible_members.length === 0 ? (
          <p className="text-sm text-gray-500">No members have reached the eligibility threshold yet.</p>
        ) : (
          <div className="space-y-2">
            {eligible_members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{m.name}</span>
                <span className="text-gray-400">trust {Math.round(m.trust_score)} · {Math.round(m.karma)} karma</span>
                <div className="ml-auto flex items-center gap-2">
                  {nominateTarget === m.user_id ? (
                    <>
                      <select
                        value={nominateRole}
                        onChange={e => setNominateRole(e.target.value as 'admin' | 'moderator')}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleNominate(m.user_id)}
                        disabled={submitting}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Submit
                      </button>
                      <button onClick={() => setNominateTarget(null)} className="text-xs text-gray-400">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setNominateTarget(m.user_id)}
                      className="text-xs px-2 py-1 border rounded text-indigo-600 hover:bg-indigo-50"
                    >
                      Nominate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
