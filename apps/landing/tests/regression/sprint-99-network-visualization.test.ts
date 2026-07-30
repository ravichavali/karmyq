/**
 * Sprint 99 — S99-005: NetworkVisualization resize.
 *
 * Walkthrough finding: on resize the canvas buffer was re-scaled but node positions were
 * never redistributed and the connection distance was computed once at mount, so after a
 * significant resize the dot field clustered/clamped to stale bounds.
 *
 * NOTE: the Sprint 99 plan hypothesised a "transform compounding / devicePixelRatio" bug.
 * That does not exist — assigning canvas.width already resets the 2D context transform on
 * every resize, so ctx.scale(dpr, dpr) never accumulates. The real fix is redistributing
 * node positions and recomputing the connection distance, covered here.
 */

import { connectionDistanceFor, rescaleNodes } from '../../src/lib/networkField'

describe('S99-005 networkField.connectionDistanceFor', () => {
  it('scales with the smaller dimension', () => {
    expect(connectionDistanceFor(1000, 500)).toBeCloseTo(100) // min(1000,500)*0.2
    expect(connectionDistanceFor(400, 900)).toBeCloseTo(80)
  })
})

describe('S99-005 networkField.rescaleNodes', () => {
  it('moves node positions proportionally when the canvas grows', () => {
    const nodes = [{ x: 400, y: 300, vx: 0, vy: 0, radius: 4, color: '#000' }]
    const out = rescaleNodes(nodes, 800, 600, 1600, 600)
    expect(out[0].x).toBeCloseTo(800) // 400 * (1600/800)
    expect(out[0].y).toBeCloseTo(300) // unchanged height
  })

  it('keeps every node inside the new bounds when the canvas shrinks', () => {
    const nodes = [
      { x: 790, y: 590, vx: 0, vy: 0, radius: 4, color: '#000' },
      { x: 10, y: 20, vx: 0, vy: 0, radius: 4, color: '#000' },
    ]
    const out = rescaleNodes(nodes, 800, 600, 300, 200)
    for (const n of out) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(300)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(200)
    }
  })

  it('is a no-op when dimensions are unchanged', () => {
    const nodes = [{ x: 123, y: 45, vx: 0.1, vy: -0.2, radius: 3, color: '#abc' }]
    const out = rescaleNodes(nodes, 800, 600, 800, 600)
    expect(out[0].x).toBeCloseTo(123)
    expect(out[0].y).toBeCloseTo(45)
  })

  it('handles a zero/uninitialised previous size without producing NaN', () => {
    const nodes = [{ x: 0, y: 0, vx: 0, vy: 0, radius: 4, color: '#000' }]
    const out = rescaleNodes(nodes, 0, 0, 800, 600)
    expect(Number.isNaN(out[0].x)).toBe(false)
    expect(Number.isNaN(out[0].y)).toBe(false)
  })
})
