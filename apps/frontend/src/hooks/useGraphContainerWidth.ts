import { useEffect, useRef, useState } from 'react'

/**
 * Sprint 113 — the shared responsive-width tracker for belonging-graph renderers (TrustGraphHEB,
 * CommunityHubGraph). Returns a container ref to attach and the observed pixel width, falling back to
 * `defaultWidth` until measured. ResizeObserver is stubbed in jest.setup, so width falls back to the
 * default in tests.
 */
export function useGraphContainerWidth(defaultWidth = 700) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setWidth(el.clientWidth || defaultWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [defaultWidth])

  return { containerRef, width }
}
