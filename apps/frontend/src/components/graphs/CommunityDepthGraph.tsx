import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { socialGraphService } from '../../lib/api';
import { useLazyGraphData } from '../../hooks/useLazyGraphData';

interface DepthNode {
  id: string;
  name: string;
  member_count: number;
  status: string;
  is_member: boolean;
}

interface DepthLink {
  source: string;
  target: string;
  weight: number;
  type: 'organic' | 'fission';
}

interface CommunityDepthGraphProps {
  height?: number;
}

const EMPTY_GRAPH: { nodes: DepthNode[]; links: DepthLink[] } = { nodes: [], links: [] };

const ORGANIC_COLOR = '#64748b'; // slate-500
const FISSION_COLOR = '#a78bfa'; // violet-400
const MEMBER_FILL = '#10b981'; // emerald-500
const OTHER_FILL = '#818cf8'; // indigo-400

/**
 * Inter-community depth view (ADR-063): communities are nodes, organic trust
 * ties are solid slate edges (width ∝ weight), and fission lineage (parent→child
 * splits) are dashed violet edges. The user's own communities are emphasized
 * with an emerald fill + white ring. Self-fetching with lazy IntersectionObserver
 * load, mirroring NetworkGraph.
 */
export default function CommunityDepthGraph({ height = 400 }: CommunityDepthGraphProps) {
  const [selectedNode, setSelectedNode] = useState<DepthNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetcher = useCallback(
    () => socialGraphService.getCommunityGraph().then((res) => res.data as { nodes: DepthNode[]; links: DepthLink[] }),
    []
  );
  const { containerRef, observed, width, data: fetched, loading, error } = useLazyGraphData(fetcher);
  const data = fetched ?? EMPTY_GRAPH;

  // Render the graph.
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    // Sprint 101 — bounded deterministic ordering. The ring order was raw API order, so a member
    // and its well-connected neighbours could land on opposite sides, maximizing edge length and
    // label churn between renders. Order by membership, then degree (compute it from links because
    // DepthNode carries none), then name — a stable, formulaic sort (no force sim, no hand-placement)
    // that clusters the emphasized + busiest nodes together and keeps the layout reproducible.
    const degreeById = new Map<string, number>();
    data.nodes.forEach((node) => degreeById.set(node.id, 0));
    data.links.forEach((link) => {
      degreeById.set(link.source, (degreeById.get(link.source) ?? 0) + 1);
      degreeById.set(link.target, (degreeById.get(link.target) ?? 0) + 1);
    });
    const orderedNodes = [...data.nodes].sort((a, b) => {
      const memberDiff = Number(b.is_member) - Number(a.is_member);
      if (memberDiff) return memberDiff;
      const degreeDiff = (degreeById.get(b.id) ?? 0) - (degreeById.get(a.id) ?? 0);
      if (degreeDiff) return degreeDiff;
      return a.name.localeCompare(b.name);
    });

    // Deterministic circular layout — few nodes, so no force sim needed.
    const positions = new Map<string, { x: number; y: number }>();
    const n = orderedNodes.length;
    orderedNodes.forEach((node, i) => {
      // Single node sits at center; otherwise spread evenly on the ring.
      if (n === 1) {
        positions.set(node.id, { x: cx, y: cy });
      } else {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        positions.set(node.id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      }
    });

    const maxWeight = Math.max(...data.links.map(l => l.weight), 1);

    const edgesGroup = svg.append('g').attr('class', 'edges');
    const nodesGroup = svg.append('g').attr('class', 'nodes');
    const labelsGroup = svg.append('g').attr('class', 'labels');

    data.links.forEach(link => {
      const s = positions.get(link.source);
      const t = positions.get(link.target);
      if (!s || !t) return;
      const isFission = link.type === 'fission';
      edgesGroup
        .append('line')
        .attr('x1', s.x)
        .attr('y1', s.y)
        .attr('x2', t.x)
        .attr('y2', t.y)
        .attr('stroke', isFission ? FISSION_COLOR : ORGANIC_COLOR)
        .attr('stroke-width', isFission ? 2 : 1 + (link.weight / maxWeight) * 4)
        .attr('stroke-opacity', isFission ? 0.9 : 0.5)
        .attr('stroke-dasharray', isFission ? '6,4' : 'none');
    });

    data.nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      const isMember = node.is_member;

      const circle = nodesGroup
        .append('circle')
        .attr('cx', pos.x)
        .attr('cy', pos.y)
        .attr('r', isMember ? 10 : 7)
        .attr('fill', isMember ? MEMBER_FILL : OTHER_FILL)
        .attr('stroke', isMember ? '#ffffff' : 'rgba(255,255,255,0.3)')
        .attr('stroke-width', isMember ? 2.5 : 1)
        .style('cursor', 'pointer');

      circle
        .on('mouseenter', function () {
          d3.select(this).attr('stroke', '#ffffff').attr('stroke-width', 3);
          setSelectedNode(node);
        })
        .on('mouseleave', function () {
          d3.select(this)
            .attr('stroke', isMember ? '#ffffff' : 'rgba(255,255,255,0.3)')
            .attr('stroke-width', isMember ? 2.5 : 1);
        })
        .on('click', function () {
          setSelectedNode(node);
        });

      const labelText = node.name || 'Unknown';
      labelsGroup
        .append('text')
        .attr('x', pos.x)
        .attr('y', pos.y - (isMember ? 14 : 11))
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#e2e8f0')
        .attr('font-weight', isMember ? 'bold' : 'normal')
        .text(labelText.length > 18 ? labelText.slice(0, 16) + '…' : labelText);
    });
  }, [data, width, height]);

  const tooFewCommunities = !loading && observed && data.nodes.length < 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height }} className="relative bg-slate-900/50 rounded-lg overflow-hidden">
      {!observed || loading ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          {observed ? 'Loading your communities…' : 'Scroll to load your communities…'}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-rose-400 text-sm">{error}</div>
      ) : tooFewCommunities ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-6">
          Join more communities to see how they connect through shared trust and fission lineage.
        </div>
      ) : (
        <>
          <svg ref={svgRef} width={width} height={height} className="overflow-visible" />

          {/* Legend */}
          <div className="absolute top-2 right-2 bg-slate-800/90 backdrop-blur rounded-lg p-3 text-xs space-y-1.5 border border-slate-700">
            <div className="font-semibold text-slate-200 mb-1">Communities</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              <span className="text-slate-300">Your community</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-indigo-400" />
              <span className="text-slate-300">Connected community</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-slate-500" />
              <span className="text-slate-300">Organic trust</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 border-t-2 border-dashed border-violet-400" />
              <span className="text-slate-300">Fission lineage</span>
            </div>
          </div>

          {/* Detail panel */}
          {selectedNode && (
            <div className="absolute bottom-2 left-2 bg-slate-800/90 backdrop-blur rounded-lg p-3 text-xs border border-slate-700 max-w-[220px]">
              <div className="font-semibold text-slate-100 mb-1">{selectedNode.name}</div>
              <div className="text-slate-300">Members: {selectedNode.member_count}</div>
              <div className="text-slate-300">Status: {selectedNode.status}</div>
              {selectedNode.is_member && <div className="text-emerald-400 mt-1">You're a member</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
