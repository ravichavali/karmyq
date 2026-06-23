import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared scaffolding for the dashboard's self-fetching D3 graph widgets
 * (NetworkGraph, CommunityDepthGraph). Owns three concerns those views had
 * each re-implemented:
 *   - lazy first-load: only fetch once the container scrolls into view
 *   - responsive width: track the container's pixel width via ResizeObserver
 *     (catches layout changes the window `resize` event misses, e.g. the
 *     People/Communities toggle)
 *   - fetch state: loading / error / data
 *
 * `fetcher` should resolve to the graph payload; pass a stable reference
 * (e.g. a module-level api call) or memoize it at the call site.
 *
 * `immediate` (Sprint 111): the full-page /network explorer is always visible, so it opts out of
 * lazy first-load — it starts `observed` and never constructs an IntersectionObserver. Card surfaces
 * (dashboard/profile) keep the default lazy behavior.
 */
export function useLazyGraphData<T>(
  fetcher: () => Promise<T>,
  { immediate = false }: { immediate?: boolean } = {}
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [observed, setObserved] = useState(immediate);
  const [width, setWidth] = useState(800);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy first-load: flip `observed` true the first time we scroll into view.
  // Immediate mode starts observed=true, so this short-circuits before touching IntersectionObserver.
  useEffect(() => {
    if (!containerRef.current || observed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setObserved(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [observed]);

  // Responsive width via ResizeObserver (fires on container changes, not just window).
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    // Guard on actual change: clientWidth is an integer, so an unchanged tick would
    // otherwise re-fire setState → a full D3 teardown/rebuild in the consumer.
    const update = () => setWidth((prev) => {
      const next = el.clientWidth || 800;
      return next === prev ? prev : next;
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (observed) load();
  }, [observed, load]);

  return { containerRef, observed, width, data, loading, error };
}
