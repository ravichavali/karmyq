import React, { useRef, useState } from 'react'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'
import GraphCanvas from './GraphCanvas'
import GraphZoomControls from './GraphZoomControls'
import { describeNodeDetail } from './graphCanvasModel'
import type { BelongingMode, GraphData, TrustNode } from './types'

interface BelongingGraphRendererProps {
  graphData: GraphData
  currentUserId: string
  mode: BelongingMode
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}

export default function BelongingGraphRenderer({
  graphData,
  currentUserId,
  mode,
  groupMap,
  groupALabel = 'Group A',
  groupBLabel = 'Group B',
  onSwitchGroup,
  height = 560,
  focusedNodeId,
  onNodeActivate,
  enableZoom = false,
}: BelongingGraphRendererProps) {
  const { containerRef, width } = useGraphContainerWidth()
  const graphRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  const selectedNode = selectedNodeId ? graphData.nodes.find(node => node.id === selectedNodeId) : null

  if (mode === 'community' && graphData.links.length === 0 && graphData.nodes.length <= 1) {
    return <EmptyGraphState body="This community doesn't have any trust connections yet." detail="Connections appear as members complete help exchanges." />
  }

  if (mode === 'ego' && graphData.links.length === 0 && graphData.nodes.length <= 1) {
    return <EmptyGraphState body="You don't have any trust connections yet." detail="Connections appear as you complete help exchanges with others." />
  }

  if (mode === 'communities' && graphData.nodes.length < 2) {
    return <EmptyGraphState body="Join more communities to see how they connect." detail="Communities link through shared trust and fission lineage." />
  }

  const handleNodeClick = (nodeId: string) => {
    if (onNodeActivate) {
      onNodeActivate(nodeId)
      return
    }
    setSelectedNodeId(previous => (previous === nodeId ? null : nodeId))
  }

  const zoomBy = (factor: number) => {
    const currentZoom = graphRef.current?.zoom() ?? 1
    graphRef.current?.zoom(currentZoom * factor, 200)
  }

  const resetZoom = () => {
    graphRef.current?.zoomToFit(200, 40)
  }

  return (
    <div ref={containerRef} className="relative">
      {enableZoom && graphData.nodes.length > 0 && (
        <GraphZoomControls
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onReset={resetZoom}
        />
      )}
      <GraphCanvas
        graphData={graphData}
        mode={mode}
        currentUserId={currentUserId}
        width={width}
        height={height}
        focusedNodeId={focusedNodeId}
        hoveredNodeId={hoveredNodeId}
        enableZoom={enableZoom}
        onNodeHover={setHoveredNodeId}
        onNodeClick={handleNodeClick}
        graphRef={graphRef}
      />
      <GraphLegend mode={mode} groupALabel={groupALabel} groupBLabel={groupBLabel} />
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          graphData={graphData}
          currentUserId={currentUserId}
          mode={mode}
          groupMap={groupMap}
          groupALabel={groupALabel}
          groupBLabel={groupBLabel}
          onSwitchGroup={onSwitchGroup}
          switching={switching}
          setSwitching={setSwitching}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}

function EmptyGraphState({ body, detail }: { body: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <p className="text-text-muted text-sm">{body}</p>
      <p className="text-text-muted text-xs">{detail}</p>
    </div>
  )
}

function GraphLegend({
  mode,
  groupALabel,
  groupBLabel,
}: {
  mode: BelongingMode
  groupALabel: string
  groupBLabel: string
}) {
  if (mode === 'fission') {
    return (
      <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> {groupALabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> {groupBLabel}
        </span>
        <span className="flex items-center gap-1 text-green-600">- within-group tie</span>
        <span className="flex items-center gap-1 text-red-500">- cross-group tie</span>
        <span className="text-gray-400">white ring = you; dashed = no connections</span>
      </div>
    )
  }

  if (mode === 'communities') {
    return (
      <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Your community
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400" /> Connected community
        </span>
        <span className="flex items-center gap-1 text-slate-500">- organic trust</span>
        <span className="flex items-center gap-1 text-violet-400">- fission lineage</span>
        <span className="text-text-muted">size = membership</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
      <span className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> You
      </span>
      <span className="flex items-center gap-1 text-orange-500">- your connections</span>
      <span className="flex items-center gap-1 text-indigo-500">- close-knit group</span>
      <span className="flex items-center gap-1 text-slate-400">- bridge between groups</span>
    </div>
  )
}

function NodeDetailPanel({
  node,
  graphData,
  currentUserId,
  mode,
  groupMap,
  groupALabel,
  groupBLabel,
  onSwitchGroup,
  switching,
  setSwitching,
  onClose,
}: {
  node: TrustNode
  graphData: GraphData
  currentUserId: string
  mode: BelongingMode
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel: string
  groupBLabel: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  switching: boolean
  setSwitching: (value: boolean) => void
  onClose: () => void
}) {
  const currentGroup = groupMap?.[node.id] ?? null
  const rows = describeNodeDetail(node, graphData, currentUserId, mode).map(row =>
    mode === 'fission' && row.label === 'Group'
      ? { ...row, value: currentGroup === 'group_a' ? groupALabel : currentGroup === 'group_b' ? groupBLabel : 'unassigned' }
      : row
  )
  const targetGroupLabel = currentGroup === 'group_a' ? groupBLabel : groupALabel

  return (
    <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
      <div className="font-semibold text-text mb-2">{node.name}</div>
      <div className="grid grid-cols-2 gap-2 text-text-muted">
        {rows.map(row => row.tone === 'self' ? (
          <span key={row.label} className="col-span-2 text-indigo-500">{row.label}</span>
        ) : (
          <React.Fragment key={row.label}>
            <span>{row.label}</span>
            <span className="text-text">{row.value}</span>
          </React.Fragment>
        ))}
      </div>
      {mode === 'fission' && onSwitchGroup && node.id !== currentUserId && currentGroup && (
        <button
          type="button"
          disabled={switching}
          onClick={async () => {
            setSwitching(true)
            try {
              await onSwitchGroup(node.id, currentGroup)
              onClose()
            } finally {
              setSwitching(false)
            }
          }}
          className={`mt-3 w-full py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
            currentGroup === 'group_a'
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {switching ? 'Moving...' : `Move to ${targetGroupLabel}`}
        </button>
      )}
    </div>
  )
}
