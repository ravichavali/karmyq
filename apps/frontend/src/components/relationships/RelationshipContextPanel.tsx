import React from 'react'
import RelationshipLens from './RelationshipLens'
import {
  useRelationshipContext,
  type RelationshipContextTarget,
} from '@/hooks/useRelationshipContext'

/**
 * Sprint 116 / ADR-084 — the non-blocking wrapper that drops a reciprocal relationship lens onto any
 * of the four helping-decision surfaces. It owns only fetch/loading/error presentation; the geometry
 * and disclosure live in the deterministic <RelationshipLens/>. The surrounding decision action must
 * stay usable in every state below, so this component never renders a blocking control.
 */
export type RelationshipContextPanelProps = RelationshipContextTarget

export default function RelationshipContextPanel(props: RelationshipContextPanelProps) {
  const { data, loading, error } = useRelationshipContext(props)

  if (loading) {
    // Quiet placeholder — no spinner, no layout jump; the action below is already interactive.
    return (
      <div
        data-relationship-context="loading"
        className="my-3 h-2 w-28 animate-pulse rounded bg-border"
        aria-hidden="true"
      />
    )
  }

  if (error === 'unavailable') {
    return (
      <p data-relationship-context="unavailable" className="my-3 text-xs text-text-muted">
        Connection context isn’t available right now.
      </p>
    )
  }

  // 204 / 403 / 404 → nothing to show; never block or explain.
  if (!data) return null

  return (
    <section
      data-relationship-context="ready"
      aria-label="How you’re connected"
      className="my-3 rounded-lg border border-border bg-surface p-3"
    >
      <RelationshipLens context={data} />
    </section>
  )
}
