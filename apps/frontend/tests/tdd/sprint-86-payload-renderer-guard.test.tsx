/**
 * Sprint 86 hotfix — RequestPayloadRenderer must not crash on a payload whose shape doesn't
 * match its declared type.
 *
 * The ADR-067 seam fix makes payload_type actually match the renderer's switch cases, so the
 * type-specific detail components now run on real, heterogeneous DB data. Legacy/sim rows can
 * carry a `category` that maps to a payload_type (e.g. 'moving' → 'moving_help') while the
 * stored `payload` is a different shape (or near-empty). The detail components dereference
 * nested fields (`payload.current_address.address`, `payload.urgency_level.replace(...)`), so a
 * mismatch used to throw → React error boundary ("Something went wrong") on the dashboard.
 *
 * The renderer must degrade gracefully: render the type detail only when the payload matches the
 * type's shape; otherwise no-op (as ADR-067 claims). Well-formed payloads still render.
 */

import { render, screen } from '@testing-library/react'
import RequestPayloadRenderer from '@/components/Feed/RequestPayloadRenderer'

describe('RequestPayloadRenderer — shape guards (Sprint 86 hotfix)', () => {
  it('renders detail for a well-formed transportation payload', () => {
    render(
      <RequestPayloadRenderer
        type="transportation"
        payload={{
          pickup_location: { address: '1 A St', city: 'Town', state: 'TX' },
          dropoff_location: { address: 'PDX', city: 'Portland', state: 'OR' },
          passengers: 1,
          luggage: 'small',
          return_trip: false,
        } as any}
      />,
    )
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Dropoff')).toBeInTheDocument()
  })

  it('renders detail for a well-formed moving_help payload', () => {
    render(
      <RequestPayloadRenderer
        type="moving_help"
        payload={{
          current_address: { address: '1 A St', city: 'Town', state: 'TX', floor: 1, has_elevator: false },
          new_address: { address: '2 B St', city: 'Town', state: 'TX', floor: 3, has_elevator: false },
          distance_miles: 4,
          estimated_duration_hours: 3,
          truck_needed: true,
          heavy_items: true,
          num_helpers_needed: 2,
        } as any}
      />,
    )
    expect(screen.getByText('From')).toBeInTheDocument()
  })

  it('does NOT throw when the payload shape mismatches the type (legacy/sim data)', () => {
    // category='moving' → payload_type='moving_help', but the stored payload is a service shape.
    const mismatched = { service_category: 'moving', skill_level: 'intermediate', duration_hours: 2 } as any
    expect(() =>
      render(<RequestPayloadRenderer type="moving_help" payload={mismatched} />),
    ).not.toThrow()
    // graceful no-op: none of the moving detail labels render
    expect(screen.queryByText('From')).toBeNull()
  })

  it('does NOT throw for any type fed a near-empty/mismatched payload', () => {
    const types = ['transportation', 'moving_help', 'childcare', 'tech_help', 'home_repair', 'food'] as const
    for (const t of types) {
      expect(() =>
        render(<RequestPayloadRenderer type={t} payload={{ unrelated: true } as any} />),
      ).not.toThrow()
    }
  })

  it('no-ops on an empty payload (unchanged behavior)', () => {
    const { container } = render(<RequestPayloadRenderer type="moving_help" payload={{} as any} />)
    expect(container).toBeEmptyDOMElement()
  })
})
