/**
 * S99-005 — pure geometry helpers for the hero NetworkVisualization, extracted so the resize
 * behaviour is testable without a canvas. On resize the dot field must be redistributed to the
 * new bounds (it was previously laid out once at mount and then clamped to stale dimensions)
 * and the connection distance must track the new size.
 */

export interface FieldNode {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

/** Links draw when nodes are closer than 20% of the smaller canvas dimension. */
export function connectionDistanceFor(width: number, height: number): number {
  return Math.min(width, height) * 0.2
}

/**
 * Scale node positions proportionally from the previous canvas size to the new one and clamp
 * them inside the new bounds. A zero/uninitialised previous dimension falls back to keeping the
 * coordinate clamped (never NaN).
 */
export function rescaleNodes(
  nodes: FieldNode[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): FieldNode[] {
  const sx = oldWidth > 0 ? newWidth / oldWidth : 1
  const sy = oldHeight > 0 ? newHeight / oldHeight : 1
  return nodes.map((n) => ({
    ...n,
    x: Math.max(0, Math.min(newWidth, n.x * sx)),
    y: Math.max(0, Math.min(newHeight, n.y * sy)),
  }))
}
