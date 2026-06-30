import fs from 'fs'
import path from 'path'
import React from 'react'
import { render, screen } from '@testing-library/react'
import type { RelationshipContext } from '@karmyq/shared'
import RelationshipLens from '@/components/relationships/RelationshipLens'
import {
  BOND_DEPTH_WIDTH,
  PERSON_RADIUS,
  buildRelationshipLensModel,
} from '@/components/relationships/relationshipLensModel'

const IDS = {
  viewer: '11111111-1111-4111-8111-111111111111',
  bridgeA: '22222222-2222-4222-8222-222222222222',
  bridgeB: '33333333-3333-4333-8333-333333333333',
  counterpart: '44444444-4444-4444-8444-444444444444',
  viewerOnly: '55555555-5555-4555-8555-555555555555',
  counterpartOnly: '66666666-6666-4666-8666-666666666666',
  sharedA: '77777777-7777-4777-8777-777777777777',
  sharedB: '88888888-8888-4888-8888-888888888888',
  oak: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
} as const

const community = { id: IDS.oak, name: 'Oak Circle' }

function context(overrides: Partial<RelationshipContext> = {}): RelationshipContext {
  return {
    viewer: { id: IDS.viewer, name: 'Maria' },
    counterpart: {
      id: IDS.counterpart,
      name: 'Dev',
      role: 'provider',
      provider: { serviceType: 'home_repair', collectiveName: 'Marin Helping Hands' },
    },
    request: {
      id: '99999999-9999-4999-8999-999999999999',
      visibilityScope: 'platform',
      reachability: 'trust_network',
    },
    path: {
      scope: 'platform',
      degrees: 3,
      nodes: [
        { id: IDS.viewer, name: 'Maria' },
        { id: IDS.bridgeA, name: 'Elena' },
        { id: IDS.bridgeB, name: 'Sam' },
        { id: IDS.counterpart, name: 'Dev' },
      ],
    },
    networks: {
      viewer: [
        { id: IDS.viewerOnly, name: 'Ari', communities: [community] },
        { id: IDS.sharedB, name: 'Zoe', communities: [community] },
        { id: IDS.sharedA, name: 'Lee', communities: [community] },
      ],
      counterpart: [
        { id: IDS.counterpartOnly, name: 'Nia', communities: [community] },
        { id: IDS.sharedA, name: 'Lee', communities: [community] },
        { id: IDS.sharedB, name: 'Zoe', communities: [community] },
      ],
      shared: [
        { id: IDS.sharedB, name: 'Zoe', communities: [community] },
        { id: IDS.sharedA, name: 'Lee', communities: [community] },
      ],
      truncated: false,
    },
    links: [
      {
        source: IDS.viewer,
        target: IDS.bridgeA,
        relationship_state: 'warm',
        bond_depth: 'forming',
      },
      {
        source: IDS.bridgeA,
        target: IDS.bridgeB,
        relationship_state: 'strong',
        bond_depth: 'growing',
      },
      {
        source: IDS.bridgeB,
        target: IDS.counterpart,
        relationship_state: 'fading',
        bond_depth: 'established',
      },
      {
        source: IDS.viewer,
        target: IDS.viewerOnly,
        relationship_state: 'warm',
        bond_depth: 'forming',
      },
      {
        source: IDS.counterpart,
        target: IDS.counterpartOnly,
        relationship_state: 'warm',
        bond_depth: 'growing',
      },
    ],
    summary:
      'You and Dev are connected through Elena and Sam. Your networks overlap through Oak Circle.',
    ...overrides,
  }
}

describe('Sprint 116 reciprocal relationship lens model', () => {
  it('uses mirrored anchors, a center path, overlap slots, and outward one-sided fans', () => {
    const model = buildRelationshipLensModel(context(), 1000, 400)
    const byId = new Map(model.nodes.map(node => [node.id, node]))

    expect(byId.get(IDS.viewer)).toMatchObject({ role: 'viewer', x: 280, y: 200 })
    expect(byId.get(IDS.counterpart)).toMatchObject({ role: 'counterpart', x: 720, y: 200 })
    expect(byId.get(IDS.bridgeA)).toMatchObject({ role: 'path', x: 426.67, y: 200 })
    expect(byId.get(IDS.bridgeB)).toMatchObject({ role: 'path', x: 573.33, y: 200 })
    expect(byId.get(IDS.sharedA)).toMatchObject({ role: 'shared', x: 500, y: 112 })
    expect(byId.get(IDS.sharedB)).toMatchObject({ role: 'shared', x: 500, y: 288 })
    expect(byId.get(IDS.viewerOnly)).toMatchObject({ role: 'viewer_network', x: 196, y: 132 })
    expect(byId.get(IDS.counterpartOnly)).toMatchObject({
      role: 'counterpart_network',
      x: 804,
      y: 132,
    })
  })

  it('is stable after network/link input reorder and keeps every person the same size', () => {
    const original = context()
    const reordered = context({
      networks: {
        ...original.networks,
        viewer: [...original.networks.viewer].reverse(),
        counterpart: [...original.networks.counterpart].reverse(),
        shared: [...original.networks.shared].reverse(),
      },
      links: [...original.links].reverse(),
    })

    expect(buildRelationshipLensModel(reordered, 1000, 400)).toEqual(
      buildRelationshipLensModel(original, 1000, 400)
    )
    expect(buildRelationshipLensModel(original, 1000, 400).nodes.every(node => node.r === PERSON_RADIUS)).toBe(true)
  })

  it('maps only coarse bond depth to the three locked line widths', () => {
    expect(BOND_DEPTH_WIDTH).toEqual({ forming: 1.2, growing: 1.9, established: 2.8 })
    expect(buildRelationshipLensModel(context(), 1000, 400).links.map(link => link.width)).toEqual(
      [1.2, 1.2, 1.9, 2.8, 1.9]
    )
  })

  it('contains no D3 dependency in either geometry or rendering', () => {
    for (const file of ['relationshipLensModel.ts', 'RelationshipLens.tsx']) {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/components/relationships', file),
        'utf8'
      )
      expect(source).not.toMatch(/from ['"]d3['"]|require\(['"]d3['"]\)/)
    }
  })
})

describe('Sprint 116 reciprocal relationship lens renderer', () => {
  it('renders accessible equal people, edge meanings, community labels, and text fallback', () => {
    const { container } = render(<RelationshipLens context={context()} width={1000} height={400} />)

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1000 400')
    expect(container.querySelectorAll('g[data-person-id]')).toHaveLength(8)
    expect(container.querySelectorAll(`circle[r="${PERSON_RADIUS}"]`)).toHaveLength(8)
    expect(container.querySelector('[data-person-id="' + IDS.viewer + '"] title')).toHaveTextContent(
      'Maria, you'
    )
    expect(
      container.querySelector('[data-person-id="' + IDS.counterpart + '"] title')
    ).toHaveTextContent('Dev, service provider')
    expect(container.querySelector('[data-provider-badge]')).toHaveTextContent('Home repair')
    expect(container.querySelector('[data-provider-badge]')).toHaveTextContent('Marin Helping Hands')
    expect(container.querySelectorAll('line[data-relationship-edge]')).toHaveLength(5)
    expect(container.querySelector('line[stroke-width="2.8"] title')).toHaveTextContent(
      'established shared history; fading relationship state'
    )
    expect(screen.getAllByText('Oak Circle').length).toBeGreaterThan(0)
    expect(screen.getByText(context().summary)).toBeInTheDocument()
  })

  it('does not encode relationship state through brightness or opacity', () => {
    const { container } = render(<RelationshipLens context={context()} />)
    const edges = [...container.querySelectorAll('line[data-relationship-edge]')]

    expect(new Set(edges.map(edge => edge.getAttribute('stroke'))).size).toBe(1)
    expect(edges.every(edge => edge.getAttribute('opacity') === null)).toBe(true)
    expect(screen.getByText(/Line thickness shows coarse shared history/i)).toBeInTheDocument()
  })
})
