import { useEffect, useState } from 'react'
import { skillsService, type MemberSkill } from '@/lib/api'

const vouchLabel = (n: number) => `${n} ${n === 1 ? 'vouch' : 'vouches'}`

export default function MemberSkills({ userId }: { userId: string }) {
  const [skills, setSkills] = useState<MemberSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [busyTag, setBusyTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setLoading(true)
    setSkills([])
    setError(null)
    skillsService.getUserSkills(userId)
      .then(res => { if (current) setSkills(res.data) })
      .catch(() => { if (current) setSkills([]) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [userId])

  // ADR-100: vouching is allowed after a completed match (the server decides can_endorse). The local
  // count moves only after the server accepts the change, so a failure leaves the previous state.
  const toggleVouch = async (skill: MemberSkill) => {
    const withdrawing = !!skill.endorsed_by_me
    setBusyTag(skill.tag_id)
    setError(null)
    try {
      if (withdrawing) await skillsService.withdrawEndorsement(skill.tag_id)
      else await skillsService.endorse(skill.tag_id)
      setSkills(prev => prev.map(s => s.tag_id !== skill.tag_id ? s : {
        ...s,
        endorsed_by_me: !withdrawing,
        endorsement_count: Math.max(0, (s.endorsement_count ?? 0) + (withdrawing ? -1 : 1)),
      }))
    } catch {
      setError('Could not update your vouch. Please try again.')
    } finally {
      setBusyTag(null)
    }
  }

  if (loading) return <p className="text-sm text-text-muted" role="status">Loading skills…</p>
  if (!skills.length) return <p className="text-sm text-text-muted">No shared skills to show.</p>
  return <div>
    <ul className="flex flex-wrap gap-2" aria-label="Member skills">
      {skills.map(skill => {
        const count = skill.endorsement_count ?? 0
        const showButton = skill.endorsed_by_me || skill.can_endorse
        return <li key={skill.tag_id} className="flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-sm text-primary-dark">
          <span>{skill.label}</span>
          {count > 0 && <span className="text-xs text-text-muted">{vouchLabel(count)}</span>}
          {showButton && <button
            type="button"
            className="text-xs font-medium underline disabled:opacity-50"
            disabled={busyTag === skill.tag_id}
            aria-label={`${skill.endorsed_by_me ? 'Withdraw vouch' : 'Vouch'} for ${skill.label}`}
            onClick={() => toggleVouch(skill)}
          >
            {skill.endorsed_by_me ? 'Withdraw vouch' : 'Vouch'}
          </button>}
        </li>
      })}
    </ul>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>
}
