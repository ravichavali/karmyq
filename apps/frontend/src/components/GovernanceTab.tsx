import { useState, useEffect, useCallback, useRef } from 'react'
import { communityService } from '@/lib/api'

interface GovernanceTabProps {
  communityId: string
  currentUserId: string
}

type GovernanceRole = 'admin' | 'moderator'
interface Person { user_id: string; name: string }
interface Nomination {
  id: string; nominated_user: Person; nominator: Person; role: GovernanceRole;
  ratification_count: number; required_ratifications: number; electorate_size: number;
  ratifiers: Person[];
  viewer: { can_ratify: boolean; reason: 'eligible' | 'nominee' | 'already_ratified' | 'not_in_electorate' }
}
interface GovernanceState {
  can_nominate: boolean;
  settings: { eligibility_threshold: number; template: string; quorum_policy: { version: 1; percentage: number; minimum: number } };
  maturity: { status: string; avg_trust_score: number };
  eligible_members: Array<Person & { eligibility_reason?: string }>;
  role_holders: Array<Person & { role: GovernanceRole }>;
  nominations: Nomination[];
}
const reasonCopy = {
  eligible: '', nominee: 'Your nomination', already_ratified: 'Already ratified',
  not_in_electorate: 'You joined after this nomination opened.',
}
function actionMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message
  return typeof message === 'string' ? message : 'The decision could not be completed. Please refresh and retry.'
}

export default function GovernanceTab({ communityId, currentUserId }: GovernanceTabProps) {
  const scope = JSON.stringify([communityId, currentUserId])
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const mounted = useRef(false)
  const requestId = useRef(0)
  const busy = useRef<object | null>(null)
  const [snapshot, setSnapshot] = useState<{ scope: string; data: GovernanceState } | null>(null)
  const state = snapshot?.scope === scope ? snapshot.data : null
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ scope: string; message: string } | null>(null)
  const [actionError, setActionError] = useState<{ scope: string; message: string } | null>(null)
  const [nominateTarget, setNominateTarget] = useState<string | null>(null)
  const [nominateRole, setNominateRole] = useState<GovernanceRole>('moderator')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const id = ++requestId.current
    const active = () => mounted.current && scopeRef.current === scope && id === requestId.current
    if (!active()) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await communityService.getGovernanceState(communityId)
      const data = res.data as GovernanceState
      if (!data || data.settings?.quorum_policy?.version !== 1 || typeof data.can_nominate !== 'boolean') {
        throw new Error('Unsupported governance response')
      }
      if (active()) setSnapshot({ scope, data })
    } catch {
      if (active()) setLoadError({ scope, message: 'Failed to load governance data.' })
    } finally {
      if (active()) setLoading(false)
    }
  }, [communityId, scope])

  useEffect(() => {
    mounted.current = true
    busy.current = null
    setSubmitting(false)
    setNominateTarget(null)
    setActionError(null)
    void load()
    return () => { mounted.current = false; requestId.current++ }
  }, [load])

  const perform = async (operation: () => Promise<unknown>) => {
    if (busy.current || !mounted.current || scopeRef.current !== scope) return
    const token = {}
    busy.current = token
    const active = () => mounted.current && scopeRef.current === scope && busy.current === token
    setSubmitting(true)
    setActionError(null)
    try {
      await operation()
      if (!active()) return
      setNominateTarget(null)
      await load()
    } catch (error) {
      if (!active()) return
      setActionError({ scope, message: actionMessage(error) })
      await load()
    } finally {
      if (active()) { busy.current = null; setSubmitting(false) }
    }
  }

  const rolesFor = (userId: string): GovernanceRole[] => {
    const role = state?.role_holders.find(holder => holder.user_id === userId)?.role
    return role === 'admin' ? [] : role === 'moderator' ? ['admin'] : ['moderator', 'admin']
  }
  const selectedRoleFor = (userId: string): GovernanceRole => {
    const roles = rolesFor(userId)
    return roles.includes(nominateRole) ? nominateRole : roles[0]
  }

  if (loadError?.scope === scope) return <div className="p-6 text-red-500" role="alert">
    {loadError.message} <button onClick={() => { void load() }}>Retry</button>
  </div>
  if (loading || !state) return <div className="p-6 text-gray-500">Loading governance data…</div>

  const { maturity, settings, eligible_members, nominations, role_holders } = state

  return (
    <div className="p-6 space-y-8">
      {actionError?.scope === scope && <p role="alert" className="text-red-600">{actionError.message}</p>}
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
        <span className="text-xs text-gray-400 ml-auto">{settings.template}</span>
      </div>
      <p className="text-sm text-gray-600">{settings.quorum_policy.percentage}% of eligible voters · at least {settings.quorum_policy.minimum}</p>

      {/* Current role holders */}
      {role_holders.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Governance Roles</h3>
          <div className="space-y-2">
            {role_holders.map(rh => (
              <div key={rh.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{rh.name}</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs ml-auto">{rh.role}</span>
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
            {nominations.map(nom => (
              <div key={nom.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{nom.nominated_user.name}</span>
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{nom.role}</span>
                    <p className="text-xs text-gray-500 mt-0.5">Nominated by {nom.nominator.name}</p>
                  </div>
                  {nom.viewer.can_ratify ? (
                    <button
                      onClick={() => { void perform(() => communityService.ratifyNomination(communityId, nom.id)) }}
                      disabled={submitting}
                      className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      Ratify
                    </button>
                  ) : <span className="text-xs text-gray-500">{reasonCopy[nom.viewer.reason]}</span>}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{nom.ratification_count} of {nom.required_ratifications} ratifications</span>
                    {nom.ratifiers.length > 0 && (
                      <span>by {nom.ratifiers.map(r => r.name).join(', ')}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{nom.required_ratifications} fixed when nominated from {nom.electorate_size} eligible voters.</p>
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
        {!state.can_nominate && <p className="text-sm text-gray-500">At least three other active members are needed to open a nomination.</p>}
        {eligible_members.length === 0 ? (
          <p className="text-sm text-gray-500">No members have reached the eligibility threshold yet.</p>
        ) : (
          <div className="space-y-2">
            {eligible_members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900">{m.name}</span>
                <span className="text-gray-400">
                  Eligible{m.eligibility_reason ? ` · ${m.eligibility_reason.replace(/_/g, ' ')}` : ''}
                </span>
                {state.can_nominate && rolesFor(m.user_id).length > 0 && <div className="ml-auto flex items-center gap-2">
                  {nominateTarget === m.user_id ? (
                    <>
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={selectedRoleFor(m.user_id)}
                        onChange={e => setNominateRole(e.target.value as GovernanceRole)}
                        disabled={submitting}
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        {rolesFor(m.user_id).map(role => <option key={role} value={role}>{role === 'admin' ? 'Admin' : 'Moderator'}</option>)}
                      </select>
                      <button
                        aria-label={`Submit nomination for ${m.name}`}
                        onClick={() => { void perform(() => communityService.nominateForRole(communityId, m.user_id, selectedRoleFor(m.user_id))) }}
                        disabled={submitting}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Submit
                      </button>
                      <button disabled={submitting} onClick={() => setNominateTarget(null)} className="text-xs text-gray-400">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      aria-label={`Nominate ${m.name}`}
                      disabled={submitting}
                      onClick={() => { setNominateTarget(m.user_id); setNominateRole(rolesFor(m.user_id)[0]) }}
                      className="text-xs px-2 py-1 border border-gray-200 rounded text-indigo-600 hover:bg-indigo-50"
                    >
                      Nominate
                    </button>
                  )}
                </div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
