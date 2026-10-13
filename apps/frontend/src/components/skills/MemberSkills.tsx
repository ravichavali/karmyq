import { useEffect, useState } from 'react'
import { skillsService, type MemberSkill } from '@/lib/api'

export default function MemberSkills({ userId }: { userId: string }) {
  const [skills, setSkills] = useState<MemberSkill[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let current = true
    setLoading(true)
    setSkills([])
    skillsService.getUserSkills(userId)
      .then(res => { if (current) setSkills(res.data) })
      .catch(() => { if (current) setSkills([]) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [userId])
  if (loading) return <p className="text-sm text-text-muted" role="status">Loading skills…</p>
  if (!skills.length) return <p className="text-sm text-text-muted">No shared skills to show.</p>
  return <ul className="flex flex-wrap gap-2" aria-label="Member skills">
    {skills.map(skill => <li key={skill.tag_id} className="rounded-full bg-primary-light px-3 py-1 text-sm text-primary-dark">{skill.label}</li>)}
  </ul>
}
