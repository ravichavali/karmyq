import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { socialGraphService } from '../lib/api';
import { useLazyGraphData } from '../hooks/useLazyGraphData';

// TrustGraphHEB uses D3 and must be client-only.
const TrustGraphHEB = dynamic(() => import('./graphs/TrustGraphHEB'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading your network…</div>
  ),
});

interface TrustNode {
  id: string;
  name: string;
  trust_score: number;
  karma: number;
  isCurrentUser?: boolean;
}

interface TrustLink {
  source: string;
  target: string;
  raw_weight: number;
  effective_weight: number;
}

interface NetworkGraphProps {
  currentUserId: string;
  height?: number;
}

/**
 * Dashboard "Your Network" view: a static, clustered HEB ego-graph of the people
 * the current user is connected to across their communities (ADR-063). Unified
 * with the other trust-graph views — uniform node sizing, cluster colors, amber
 * "your" edges. Progressive click-to-expand was removed in Sprint 79; the HEB
 * component owns node selection and its own detail panel.
 */
export default function NetworkGraph({ currentUserId, height = 400 }: NetworkGraphProps) {
  const fetcher = useCallback(
    () => socialGraphService.getTrustGraphAggregate().then((res) => res.data as { nodes: TrustNode[]; links: TrustLink[] }),
    []
  );
  const { containerRef, observed, data, loading, error } = useLazyGraphData(fetcher);
  const graphData = data ?? { nodes: [], links: [] };

  return (
    <div ref={containerRef} style={{ width: '100%', height }} className="relative bg-slate-900/50 rounded-lg overflow-hidden">
      {!observed || loading ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          {observed ? 'Loading your network…' : 'Scroll to load your network…'}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-rose-400 text-sm">{error}</div>
      ) : (
        <TrustGraphHEB graphData={graphData} currentUserId={currentUserId} mode="ego" height={height} />
      )}
    </div>
  );
}
