import React from 'react'
import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import BelongingGraphRenderer from '@/components/graphs/BelongingGraphRenderer'
import type { GraphData } from '@/components/graphs/types'
import {
  lastForceGraphProps,
  resetForceGraphMock,
} from '../mocks/reactForceGraph2DMock'

/**
 * Sprint 111/S114 graph interaction contract.
 *
 * Canvas nodes are not DOM-queryable, so this locks the renderer boundary instead of SVG internals:
 * callbacks are handed to GraphCanvas, node activation opens privacy-safe DOM chrome, and focused
 * nodes dim unrelated canvas draws via the canvas callback.
 */

const peopleGraph: GraphData = {
  nodes: [
    { id: 'me', name: 'Me Myself', trust_score: 1, karma: 0, isCurrentUser: true },
    { id: 'peer-1', name: 'Peer One', trust_score: 2, karma: 3 },
    { id: 'peer-2', name: 'Peer Two', trust_score: 1, karma: 1 },
  ],
  links: [
    { source: 'me', target: 'peer-1', raw_weight: 2, effective_weight: 2 },
    { source: 'peer-1', target: 'peer-2', raw_weight: 1, effective_weight: 1 },
  ],
}

beforeEach(() => {
  resetForceGraphMock()
})

describe('BelongingGraphRenderer canvas boundary', () => {
  it('passes node click and hover callbacks to GraphCanvas', () => {
    render(<BelongingGraphRenderer graphData={peopleGraph} currentUserId="me" mode="ego" />)
    expect(typeof lastForceGraphProps.onNodeClick).toBe('function')
    expect(typeof lastForceGraphProps.onNodeHover).toBe('function')
  })

  it('opens a structure-only detail panel from a canvas node click', () => {
    render(<BelongingGraphRenderer graphData={peopleGraph} currentUserId="me" mode="ego" />)

    act(() => {
      lastForceGraphProps.onNodeClick({ id: 'peer-1' })
    })

    expect(screen.getByText('Connections')).toBeInTheDocument()
    expect(screen.queryByText(/trust score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/karma/i)).not.toBeInTheDocument()
  })

  it('uses focusedNodeId to dim unrelated canvas nodes', () => {
    render(
      <BelongingGraphRenderer
        graphData={peopleGraph}
        currentUserId="me"
        mode="ego"
        focusedNodeId="peer-2"
      />
    )

    const ctx = mockCanvasContext()
    lastForceGraphProps.nodeCanvasObject({ id: 'me', name: 'Me Myself', x: 0, y: 0 }, ctx, 1)
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.alphaValues).toContain(0.18)
  })
})

function mockCanvasContext() {
  const ctx: any = {
    alphaValues: [] as number[],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
  }
  let alpha = 1
  Object.defineProperty(ctx, 'globalAlpha', {
    get: () => alpha,
    set: value => {
      alpha = value
      ctx.alphaValues.push(value)
    },
  })
  return ctx as CanvasRenderingContext2D & { alphaValues: number[] }
}
