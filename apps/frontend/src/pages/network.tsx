import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '@/components/Layout'
import BelongingGraph from '@/components/BelongingGraph'
import { mergeGraphData, normalizeCommunityDepthGraph, normalizePersonGraph, type DepthLink, type DepthNode } from '@/components/graphs/normalizeGraphData'
import type { BelongingMode, GraphData } from '@/components/graphs/types'
import { socialGraphService, communityService } from '@/lib/api'

// Sprint 111 / ADR-081 — the full-page belonging explorer. It owns explorer state (mode, ego depth,
// search focus, and ego-only progressive expansion); BelongingGraph stays a presentational wrapper.

type ExplorerMode = Extract<BelongingMode, 'ego' | 'community' | 'communities'>
const VALID_MODES: ExplorerMode[] = ['ego', 'community', 'communities']
const MAX_EXPANSIONS = 3

// The three explicit zoom levels of one belonging structure (S113 Task 9). Naming each scale in the
// header is what makes My Network (ego) and This Community (member topology) read as adjacent zoom
// levels rather than two near-identical "my network" tabs. Module-scope constant — pure copy.
const SCALE_FRAMING: Record<ExplorerMode, { scale: string; blurb: string }> = {
  ego: {
    scale: 'Scale 1 · My Network',
    blurb: 'You and your first-degree connections — the network that travels with you across communities.',
  },
  community: {
    scale: 'Scale 2 · This Community',
    blurb: 'The whole-community member topology — how everyone in this one community connects.',
  },
  communities: {
    scale: 'Scale 3 · Across Communities',
    blurb: 'Communities as nodes — how your communities connect to others. The level-up from people to communities.',
  },
}

interface Expansion {
  nodeId: string
  data: GraphData
}

interface StoredUser {
  id: string
  name?: string
}

interface MembershipSummary {
  id: string
  name: string
}

export default function NetworkPage() {
  const router = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)
  const [memberships, setMemberships] = useState<MembershipSummary[]>([])

  const [depth, setDepth] = useState<1 | 2 | 3>(1)
  const [baseline, setBaseline] = useState<GraphData | null>(null)
  const [expansions, setExpansions] = useState<Expansion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandError, setExpandError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined)

  // ── mode + selected community from the URL ───────────────────────────────────────────────────
  const rawMode = router.query.mode as string | undefined
  const mode: ExplorerMode = VALID_MODES.includes(rawMode as ExplorerMode)
    ? (rawMode as ExplorerMode)
    : 'ego'
  // The URL is the single source of truth for the selected community, so the displayed graph always
  // agrees with `?id=` and browser back/forward works. The picker writes to the URL (see below).
  const communityId = (router.query.id as string | undefined) ?? undefined

  // Current mode, mirrored into a ref so async ego-expansion callbacks can detect a mode switch that
  // happened while their request was in flight (and drop the stale result).
  const modeRef = useRef<ExplorerMode>(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const selectCommunity = useCallback(
    (id: string | undefined) => {
      const query: Record<string, string> = { ...(router.query as Record<string, string>), mode: 'community' }
      if (id) query.id = id
      else delete query.id
      router.replace({ pathname: '/network', query })
    },
    [router]
  )

  // Normalize an absent/invalid mode in the URL to ego.
  useEffect(() => {
    if (!router.isReady) return
    if (!VALID_MODES.includes(rawMode as ExplorerMode)) {
      router.replace({ pathname: '/network', query: { ...router.query, mode: 'ego' } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, rawMode])

  // ── client auth bootstrap (guarded localStorage read) ────────────────────────────────────────
  useEffect(() => {
    let parsed: StoredUser | null = null
    try {
      const token = localStorage.getItem('token')
      const raw = localStorage.getItem('user')
      if (token && raw) {
        const candidate = JSON.parse(raw)
        if (candidate && typeof candidate.id === 'string') parsed = candidate
      }
    } catch {
      parsed = null
    }
    if (!parsed) {
      router.replace('/login')
      return
    }
    setUser(parsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load memberships once for the community picker.
  useEffect(() => {
    if (!user) return
    communityService
      .getMyCommunities(user.id)
      .then((res: any) => {
        // getMyCommunities returns `{ communities: [...], count, total }` (an object), not a bare
        // array — `res.data ?? []` kept the object, so the community picker's `memberships.map`
        // threw "map is not a function" and crashed `?mode=community`. Extract the array defensively.
        const list = res.data?.communities ?? res.data?.data ?? res.data
        setMemberships(Array.isArray(list) ? (list as MembershipSummary[]) : [])
      })
      .catch(() => setMemberships([]))
  }, [user])

  // ── baseline fetch per mode ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false
    // A new baseline invalidates any progressive expansions.
    setExpansions([])
    setFocusedNodeId(undefined)
    setExpandError(null)

    const loadBaseline = async (): Promise<GraphData | null> => {
      if (mode === 'ego') return normalizePersonGraph((await socialGraphService.getNeighborhood(user.id, { depth })).data)
      if (mode === 'community') {
        if (!communityId) return null
        return normalizePersonGraph((await socialGraphService.getFullCommunityGraph(communityId)).data)
      }
      const res = await socialGraphService.getCommunityGraph()
      return normalizeCommunityDepthGraph(res.data as { nodes: DepthNode[]; links: DepthLink[] })
    }

    setLoading(true)
    setError(null)
    loadBaseline()
      .then(data => {
        if (!cancelled) setBaseline(data)
      })
      .catch(() => {
        if (!cancelled) setError('Couldn’t load this network.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, mode, depth, communityId])

  // ── ego progressive expansion (FIFO three) ───────────────────────────────────────────────────
  const expandNode = useCallback(
    async (nodeId: string) => {
      if (!user) return
      setExpandError(null)
      try {
        const res = await socialGraphService.getNeighborhood(nodeId, { depth: 1 })
        // Drop a response that arrived after the user left ego mode — otherwise an aggregate-ego
        // neighborhood would contaminate a community/communities graph.
        if (modeRef.current !== 'ego') return
        const data = normalizePersonGraph(res.data)
        setExpansions(prev => {
          const without = prev.filter(e => e.nodeId !== nodeId)
          return [...without, { nodeId, data }].slice(-MAX_EXPANSIONS)
        })
      } catch {
        if (modeRef.current === 'ego') setExpandError('Couldn’t expand that node. Try again.')
      }
    },
    [user]
  )

  const collapseNode = useCallback((nodeId: string) => {
    setExpansions(prev => prev.filter(e => e.nodeId !== nodeId))
  }, [])

  const mergedGraph = useMemo<GraphData | null>(() => {
    if (!baseline) return null
    // Expansions are an ego-only concept; never merge them into community/communities graphs (a defence
    // in depth alongside clearing expansions on mode change and dropping stale expansion responses).
    if (mode !== 'ego' || expansions.length === 0) return baseline
    return mergeGraphData(baseline, ...expansions.map(e => e.data))
  }, [baseline, expansions, mode])

  // Sprint 115 / ADR-083 — stable ego layout identity. Memoized so a search/focus/expansion render can
  // never invalidate the pure orbit geometry; supplied only in ego mode.
  const baselineNodeIds = useMemo(
    () => (mode === 'ego' ? baseline?.nodes.map(node => node.id) : undefined),
    [mode, baseline]
  )
  const expansionRootIds = useMemo(
    () => (mode === 'ego' ? expansions.map(expansion => expansion.nodeId) : undefined),
    [mode, expansions]
  )

  const expansionLabel = useCallback(
    (nodeId: string) => {
      const fromMerged = mergedGraph?.nodes.find(n => n.id === nodeId)?.name
      return fromMerged ?? nodeId
    },
    [mergedGraph]
  )

  // Search only matches the currently loaded node set; it focuses a result, not a global directory.
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !mergedGraph) return []
    return mergedGraph.nodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, mergedGraph])

  // ego depth-legibility readout (BUG: depth changes felt inert under the privacy scope because the
  // seed graph is sparse — 2→8 nodes is imperceptible on a big canvas). A literal count makes even a
  // tiny depth change legible, and a zero count drives an honest sparse/empty state. Not a depth-logic
  // change — the recursive neighborhood query genuinely expands; this just narrates it.
  // Count the DEPTH baseline, not `mergedGraph` — click-to-expand merges in nodes beyond {depth} hops,
  // so counting the merged graph would mis-attribute them to "within {depth} hops".
  const peopleInScope = mode === 'ego' && baseline && user
    ? baseline.nodes.filter(n => n.id !== user.id).length
    : 0
  const egoIsSparse = mode === 'ego' && !loading && !error && baseline !== null && peopleInScope === 0
  // Sprint 120 PR C (F-5): a member with zero or one connection got an empty canvas and no next
  // step. The prompt names the one thing that actually grows the graph and links to where it happens.
  const egoNeedsGrowthPrompt =
    mode === 'ego' && !loading && !error && baseline !== null && peopleInScope <= 1

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <header className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-text">{SCALE_FRAMING[mode].scale}</h1>
              <p className="text-sm text-text-muted mt-0.5 max-w-[64ch]">{SCALE_FRAMING[mode].blurb}</p>
            </div>
            <div className="flex items-center gap-2" role="tablist" aria-label="Graph mode">
              {VALID_MODES.map(m => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => router.replace({ pathname: '/network', query: { ...router.query, mode: m } })}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    // Sprint 120 PR C (F-6): the active pill was the only indigo in a green product.
                    mode === m ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:text-text'
                  }`}
                >
                  {m === 'ego' ? 'My Network' : m === 'community' ? 'This Community' : 'Across Communities'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {mode === 'community' && (
              <select
                data-testid="community-picker"
                aria-label="Choose a community"
                value={communityId ?? ''}
                onChange={e => selectCommunity(e.target.value || undefined)}
                className="px-3 py-1.5 rounded-md text-sm bg-surface text-text border border-border"
              >
                <option value="">Select a community…</option>
                {memberships.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {mode === 'ego' && (
              <label className="flex items-center gap-2 text-sm text-text-muted">
                Depth
                <input
                  data-testid="depth-slider"
                  type="range"
                  min={1}
                  max={3}
                  step={1}
                  value={depth}
                  onChange={e => setDepth(Number(e.target.value) as 1 | 2 | 3)}
                />
                <span className="text-text tabular-nums">{depth}</span>
              </label>
            )}

            <div className="relative">
              <input
                data-testid="node-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={mode === 'communities' ? 'Find a community…' : 'Find a member…'}
                className="px-3 py-1.5 rounded-md text-sm bg-surface text-text border border-border"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-56 max-h-56 overflow-auto rounded-md border border-border bg-surface shadow-lg">
                  {suggestions.map(n => (
                    <li key={n.id}>
                      <button
                        data-testid={`suggestion-${n.id}`}
                        onClick={() => {
                          setFocusedNodeId(n.id)
                          setSearch('')
                        }}
                        className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-primary hover:text-white"
                      >
                        {n.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ego depth-legibility readout — names exactly how many people the current depth surfaces so
              a small expansion is still visible (sparse seed graph under the privacy scope). */}
          {mode === 'ego' && mergedGraph && !egoIsSparse && (
            <p className="text-sm text-text" data-testid="depth-readout">
              Showing <span className="font-semibold tabular-nums">{peopleInScope}</span>{' '}
              {peopleInScope === 1 ? 'person' : 'people'} within{' '}
              <span className="font-semibold tabular-nums">{depth}</span> {depth === 1 ? 'hop' : 'hops'}.
            </p>
          )}

          {egoNeedsGrowthPrompt && (
            <p className="text-sm text-text">
              Your network grows from the help you give and receive.{' '}
              <Link
                href="/dashboard"
                data-testid="sparse-network-cta"
                className="text-primary font-medium hover:underline"
              >
                Browse asks you can fill →
              </Link>
            </p>
          )}

          {/* Discoverability: the controls are not self-evident, so spell out what each does. */}
          <p className="text-xs text-text-muted">
            {mode === 'ego'
              ? 'Drag Depth to 2–3 for friends-of-friends · use the + / − controls to zoom · click a person to expand their network.'
              : 'Use the + / − controls to zoom and drag to pan · type above to find and focus a node.'}
          </p>

          {mode === 'community' && mergedGraph?.meta?.truncated && mergedGraph.meta.totalActiveMembers != null && (
            <p className="text-xs text-amber-500">
              Showing {mergedGraph.nodes.length} of {mergedGraph.meta.totalActiveMembers} active members.
              Bond counts describe only the members shown.
            </p>
          )}
          {mode === 'ego' && mergedGraph?.meta?.truncated && (
            <p className="text-xs text-amber-500">
              Showing the closest connections only — some distant ones are hidden.
            </p>
          )}

          {expandError && (
            <div className="flex items-center gap-3 text-sm text-rose-400">
              <span>{expandError}</span>
              <button onClick={() => setExpandError(null)} className="underline">
                Dismiss
              </button>
            </div>
          )}

          {mode === 'ego' && expansions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {expansions.map(e => (
                <button
                  key={e.nodeId}
                  onClick={() => collapseNode(e.nodeId)}
                  className="px-2.5 py-1 rounded-full text-xs bg-primary/15 text-primary hover:bg-primary/25"
                >
                  Collapse {expansionLabel(e.nodeId)} ✕
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="flex-1 relative">
          {error ? (
            <div className="flex items-center justify-center h-full text-rose-400 text-sm">{error}</div>
          ) : loading && !mergedGraph ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading network…</div>
          ) : egoIsSparse ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
              <p className="text-text text-sm font-medium">No connections in view yet</p>
              <p className="text-text-muted text-sm max-w-[48ch]">
                {depth < 3
                  ? 'Try raising Depth to reach friends-of-friends, or come back as you complete more help exchanges — connections grow from the help you give and receive.'
                  : 'Connections grow from the help you give and receive. As you complete more exchanges, the people you’re woven to will appear here.'}
              </p>
            </div>
          ) : mergedGraph && user ? (
            <BelongingGraph
              mode={mode}
              currentUserId={user.id}
              communityId={communityId}
              graphData={mergedGraph}
              load="immediate"
              height={520}
              focusedNodeId={focusedNodeId}
              baselineNodeIds={baselineNodeIds}
              expansionRootIds={expansionRootIds}
              onNodeActivate={mode === 'ego' ? expandNode : undefined}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              {mode === 'community' && !communityId ? 'Choose a community to begin.' : 'Loading network…'}
            </div>
          )}
        </main>
      </div>
    </Layout>
  )
}
