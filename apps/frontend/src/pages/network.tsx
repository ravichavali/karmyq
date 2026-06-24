import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import BelongingGraph from '@/components/BelongingGraph'
import { mergeGraphData, normalizeCommunityDepthGraph, type DepthLink, type DepthNode } from '@/components/graphs/normalizeGraphData'
import type { BelongingMode, GraphData } from '@/components/graphs/types'
import { socialGraphService, communityService } from '@/lib/api'

// Sprint 111 / ADR-081 — the full-page belonging explorer. It owns explorer state (mode, ego depth,
// search focus, and ego-only progressive expansion); BelongingGraph stays a presentational wrapper.

type ExplorerMode = Extract<BelongingMode, 'ego' | 'community' | 'communities'>
const VALID_MODES: ExplorerMode[] = ['ego', 'community', 'communities']
const MAX_EXPANSIONS = 3

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
      .then((res: any) => setMemberships((res.data ?? []) as MembershipSummary[]))
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
      if (mode === 'ego') return (await socialGraphService.getNeighborhood(user.id, { depth })).data as GraphData
      if (mode === 'community') {
        if (!communityId) return null
        return (await socialGraphService.getFullCommunityGraph(communityId)).data as GraphData
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
        const data = res.data as GraphData
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

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <header className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-semibold text-text">Your Network</h1>
            <div className="flex items-center gap-2" role="tablist" aria-label="Graph mode">
              {VALID_MODES.map(m => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => router.replace({ pathname: '/network', query: { ...router.query, mode: m } })}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white' : 'bg-surface text-text-muted hover:text-text'
                  }`}
                >
                  {m === 'ego' ? 'People' : m === 'community' ? 'Community' : 'Communities'}
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
                        className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-indigo-600 hover:text-white"
                      >
                        {n.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Discoverability: the controls are not self-evident, so spell out what each does. */}
          <p className="text-xs text-text-muted">
            {mode === 'ego'
              ? 'Drag Depth to 2–3 for friends-of-friends · scroll to zoom · click a person to expand their network.'
              : 'Scroll to zoom and pan · type above to find and focus a node.'}
          </p>

          {mergedGraph?.meta?.truncated && (
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
                  className="px-2.5 py-1 rounded-full text-xs bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
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
          ) : mergedGraph && user ? (
            <BelongingGraph
              mode={mode}
              currentUserId={user.id}
              communityId={communityId}
              graphData={mergedGraph}
              load="immediate"
              height={520}
              focusedNodeId={focusedNodeId}
              onNodeActivate={mode === 'ego' ? expandNode : undefined}
              enableZoom
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
