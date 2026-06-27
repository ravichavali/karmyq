import * as d3 from 'd3'

/**
 * Sprint 113 / BUG-027 — the single-owner pan/zoom contract, shared by every belonging-graph renderer
 * (the HEB radial in TrustGraphHEB and the egocentric hub in CommunityHubGraph). Kept in ONE place so
 * the fragile bits live once: the wheel is excluded so a graph embedded in a long scrollable page
 * doesn't hijack page scroll (button + pinch + drag still work), and the initial transform is seeded
 * directly onto `__zoom` rather than via `zoom.transform` (jsdom can't resolve the SVG extent through
 * `width.baseVal`, which `zoom.transform` reads). Both renderers drive the SAME behavior from the
 * buttons and the gestures, so no surface mounts two control clusters.
 */

type GraphRoot = d3.Selection<SVGGElement, unknown, null, undefined>

export interface GraphZoomHandle {
  behavior: d3.ZoomBehavior<SVGSVGElement, unknown>
  initialTransform: d3.ZoomTransform
}

/** Install pan/zoom on the svg, centring the root at (cx, cy). Returns the behavior + seeded transform. */
export function installGraphZoom(
  svgEl: SVGSVGElement,
  root: GraphRoot,
  opts: { width: number; height: number; cx: number; cy: number }
): GraphZoomHandle {
  const { width, height, cx, cy } = opts
  const behavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 4])
    // Pin the extent explicitly so the button controls' scaleBy/transform never read the SVG viewport
    // via width.baseVal (unsupported in jsdom) — and so gesture math stays deterministic.
    .extent([[0, 0], [width, height]])
    .filter((event: any) => event.type !== 'wheel' && !event.button)
    .on('zoom', (event) => root.attr('transform', event.transform.toString()))
  const svg = d3.select(svgEl)
  svg.call(behavior)
  // Drop double-click-to-zoom so rapid node clicks on interactive surfaces don't zoom.
  svg.on('dblclick.zoom', null)
  const initialTransform = d3.zoomIdentity.translate(cx, cy)
  ;(svgEl as unknown as { __zoom: d3.ZoomTransform }).__zoom = initialTransform
  root.attr('transform', initialTransform.toString())
  return { behavior, initialTransform }
}

/** Tear down any installed zoom and pin the root at the centre (the no-zoom path). */
export function clearGraphZoom(svgEl: SVGSVGElement, root: GraphRoot, cx: number, cy: number): void {
  d3.select(svgEl).on('.zoom', null)
  root.attr('transform', `translate(${cx},${cy})`)
}

/** Button-driven zoom: drive the same behavior the gestures use (applied instantly for jsdom determinism). */
export function zoomBy(svgEl: SVGSVGElement, behavior: d3.ZoomBehavior<SVGSVGElement, unknown>, factor: number): void {
  behavior.scaleBy(d3.select(svgEl), factor)
}

/** Reset the zoom to its seeded initial transform. */
export function zoomReset(
  svgEl: SVGSVGElement,
  behavior: d3.ZoomBehavior<SVGSVGElement, unknown>,
  initial: d3.ZoomTransform
): void {
  behavior.transform(d3.select(svgEl), initial)
}
