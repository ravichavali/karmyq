import { useEffect, useRef, useState } from 'react'
import { skillsService, type SkillDirectoryEntry, type SkillSearchMember } from '@/lib/api'
import MemberSkills from './MemberSkills'

export default function FindASkillPanel({ communityId, isMember }: { communityId: string; isMember: boolean }) {
  const [directory, setDirectory] = useState<SkillDirectoryEntry[]>([])
  const [skill, setSkill] = useState('')
  const [results, setResults] = useState<SkillSearchMember[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const revision = useRef(0)
  useEffect(() => {
    let current = true
    setDirectory([])
    setResults(null)
    setSelected(null)
    setMessage('')
    setSearching(false)
    if (isMember) skillsService.getCommunitySkillDirectory(communityId)
      .then(res => { if (current) setDirectory(res.data) })
      .catch(() => { if (current) setMessage('Skills are unavailable right now. Please try again later.') })
    return () => { current = false; revision.current++ }
  }, [communityId, isMember])

  const search = async (text: string) => {
    if (!text.trim()) return
    const requestRevision = ++revision.current
    setSkill(text)
    setSearching(true)
    setMessage('')
    setResults(null)
    setSelected(null)
    try {
      const res = await skillsService.searchCommunitySkills(communityId, text.trim())
      if (revision.current === requestRevision) setResults(res.data)
    } catch {
      if (revision.current === requestRevision) setMessage('Skills are unavailable right now. Please try again later.')
    } finally {
      if (revision.current === requestRevision) setSearching(false)
    }
  }
  if (!isMember) return null
  return <section className="kq-card mb-6" aria-label="Skill discovery">
    <h2 className="section-heading">Find a skill</h2>
    <p className="text-sm text-text-muted mb-4">Find people who share a skill in this community. Matches use the full skill name.</p>
    <div className="flex flex-wrap gap-2 mb-4">
      {directory.map(entry => <button key={entry.skill_key} type="button" onClick={() => search(entry.skill_key)}
        className="rounded-full border border-border px-3 py-1 text-sm hover:bg-primary-light">
        {entry.label} ({entry.member_count})
      </button>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); void search(skill) }} className="flex gap-2 mb-4">
      <label className="flex-1"> <span className="sr-only">Skill</span>
        <input value={skill} onChange={event => setSkill(event.target.value)} maxLength={100} placeholder="e.g. Carpentry"
          className="w-full rounded border border-border px-3 py-2" />
      </label>
      <button type="submit" disabled={!skill.trim() || searching} className="btn-primary">Search</button>
    </form>
    {searching && <p role="status">Searching…</p>}
    {message && <p role="status" className="text-sm text-text-muted">{message}</p>}
    {!message && directory.length === 0 && results === null && <p className="text-sm text-text-muted">No skills shared yet.</p>}
    {results?.length === 0 && <p className="text-sm text-text-muted">No matching members found.</p>}
    <ul className="space-y-3">{results?.map(member => <li key={member.user_id}>
      <p className="font-medium">{member.name}</p>
      <p className="text-sm text-text-muted">{member.skills.map(skill => skill.label).join(', ')}</p>
      <button type="button" className="text-sm text-primary underline" onClick={() => setSelected(selected === member.user_id ? null : member.user_id)}>View skills</button>
      {selected === member.user_id && <MemberSkills key={member.user_id} userId={member.user_id} />}
    </li>)}</ul>
  </section>
}
