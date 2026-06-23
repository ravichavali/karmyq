import React from 'react'

interface BelongingPulseProps {
  peopleCount: number
  /** Omit when the membership read is unavailable — the community clause is then dropped entirely. */
  communityCount?: number
}

/**
 * Sprint 111 / ADR-081 — the honest belonging stat line. Copy says "connected to" (the graph encodes
 * trust connections), never "helped". Pluralization is explicit (no Intl.PluralRules) so the exact
 * wording is testable and stable.
 */
export default function BelongingPulse({ peopleCount, communityCount }: BelongingPulseProps) {
  const people = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`
  const base = `You're connected to ${people}`
  const text =
    communityCount == null
      ? `${base}.`
      : `${base} across ${communityCount} ${communityCount === 1 ? 'community' : 'communities'}.`

  return <p className="text-text-muted text-sm">{text}</p>
}
