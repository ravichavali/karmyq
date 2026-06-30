import React, { useMemo } from 'react'
import type { RelationshipContext } from '@karmyq/shared'
import {
  PERSON_RADIUS,
  buildRelationshipLensModel,
  type RelationshipLensNode,
} from './relationshipLensModel'

export interface RelationshipLensProps {
  context: RelationshipContext
  width?: number
  height?: number
}

const ROLE_FILL: Record<RelationshipLensNode['role'], string> = {
  viewer: '#f59e0b',
  counterpart: '#14b8a6',
  path: '#94a3b8',
  shared: '#a78bfa',
  viewer_network: '#cbd5e1',
  counterpart_network: '#cbd5e1',
}

const humanize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ')

function personTitle(node: RelationshipLensNode, context: RelationshipContext) {
  if (node.id === context.viewer.id) return `${node.name}, you`
  if (node.id === context.counterpart.id && context.counterpart.role === 'provider') {
    return `${node.name}, service provider`
  }
  if (node.role === 'shared') return `${node.name}, in both visible networks`
  if (node.role === 'path') return `${node.name}, on the disclosed connection path`
  return node.name
}

function Person({ node, context }: { node: RelationshipLensNode; context: RelationshipContext }) {
  const communityNames = node.communities.map(community => community.name).join(' · ')
  return (
    <g data-person-id={node.id} role="group" aria-label={personTitle(node, context)}>
      <title>{personTitle(node, context)}</title>
      <circle
        cx={node.x}
        cy={node.y}
        r={PERSON_RADIUS}
        fill={ROLE_FILL[node.role]}
        stroke="#334155"
        strokeWidth="1.5"
      />
      <text x={node.x} y={node.y + PERSON_RADIUS + 16} textAnchor="middle" fontSize="12" fill="#334155">
        {node.name}
      </text>
      {communityNames && (
        <text
          className="community-label"
          x={node.x}
          y={node.y + PERSON_RADIUS + 30}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
        >
          {communityNames}
        </text>
      )}
    </g>
  )
}

export default function RelationshipLens({
  context,
  width = 680,
  height = 320,
}: RelationshipLensProps) {
  const model = useMemo(
    () => buildRelationshipLensModel(context, width, height),
    [context, width, height]
  )
  const counterpart = model.nodes.find(node => node.id === context.counterpart.id)!
  const provider = context.counterpart.role === 'provider' ? context.counterpart.provider : null

  return (
    <figure aria-labelledby={`relationship-lens-summary-${context.request.id}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`How ${context.viewer.name} and ${context.counterpart.name} are connected`}
      >
        <title>{`How ${context.viewer.name} and ${context.counterpart.name} are connected`}</title>
        {model.links.map(link => (
          <line
            key={link.key}
            data-relationship-edge={link.key}
            x1={link.sourceX}
            y1={link.sourceY}
            x2={link.targetX}
            y2={link.targetY}
            stroke="#64748b"
            strokeWidth={link.width}
            strokeLinecap="round"
          >
            <title>{`${link.bondDepth} shared history; ${humanize(link.relationshipState).toLowerCase()} relationship state`}</title>
          </line>
        ))}
        {model.nodes.map(item => (
          <Person key={item.id} node={item} context={context} />
        ))}
        {provider && (
          <g
            data-provider-badge
            transform={`translate(${counterpart.x + PERSON_RADIUS + 8} ${counterpart.y - PERSON_RADIUS - 16})`}
            aria-label={`${humanize(provider.serviceType)} provider${provider.collectiveName ? `, ${provider.collectiveName}` : ''}`}
          >
            <rect width="142" height={provider.collectiveName ? 36 : 24} rx="8" fill="#ecfeff" stroke="#0f766e" />
            <text x="8" y="15" fontSize="10" fill="#0f766e">
              {humanize(provider.serviceType)}
            </text>
            {provider.collectiveName && (
              <text x="8" y="29" fontSize="9" fill="#475569">
                {provider.collectiveName}
              </text>
            )}
          </g>
        )}
      </svg>
      <p id={`relationship-lens-summary-${context.request.id}`}>{context.summary}</p>
      <p className="text-xs text-slate-500">
        Line thickness shows coarse shared history: forming, growing, or established.
      </p>
      {context.networks.truncated && (
        <p className="text-xs text-slate-500">Showing a bounded view of both visible networks.</p>
      )}
    </figure>
  )
}
