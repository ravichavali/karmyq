import { query } from '../database/db';

export interface NetworkCohesionMetrics {
  score: number;
  label: string;
  reciprocity: number;
  density: number;
  clustering: number;
  avgPathLength: number;
  uniqueEdges: number;
  activeMembers: number;
  computedAt: string;
}

function getCohesionLabel(score: number): string {
  if (score >= 80) return 'Highly Cohesive';
  if (score >= 60) return 'Cohesive';
  if (score >= 40) return 'Developing';
  if (score >= 20) return 'Emerging';
  return 'Fragile';
}

export async function computeNetworkCohesion(communityId: string): Promise<NetworkCohesionMetrics> {
  const computedAt = new Date().toISOString();

  // Active members: status = 'active' AND joined in last 90 days
  const activeMembersResult = await query(
    `SELECT COUNT(*) as count
     FROM community.members
     WHERE community_id = $1
       AND status = 'active'
       AND joined_at > NOW() - INTERVAL '90 days'`,
    [communityId]
  );
  const activeMembers = parseInt(activeMembersResult.rows[0]?.count ?? '0');

  if (activeMembers < 2) {
    return { score: 0, label: 'Fragile', reciprocity: 0, density: 0, clustering: 0, avgPathLength: 0, uniqueEdges: 0, activeMembers, computedAt };
  }

  // Get all completed matches for members of this community
  // directed pair: (requester_id, responder_id)
  const matchesResult = await query(
    `SELECT DISTINCT r.requester_id, m.responder_id
     FROM requests.matches m
     INNER JOIN requests.help_requests r ON m.request_id = r.id
     WHERE r.community_id = $1
       AND m.status = 'completed'
       AND m.responder_id IS NOT NULL
       AND m.updated_at > NOW() - INTERVAL '90 days'`,
    [communityId]
  );

  const directedPairs: Array<{ from: string; to: string }> = matchesResult.rows.map((row: any) => ({
    from: row.requester_id,
    to: row.responder_id,
  }));

  if (directedPairs.length === 0) {
    return { score: 0, label: 'Fragile', reciprocity: 0, density: 0, clustering: 0, avgPathLength: 0, uniqueEdges: 0, activeMembers, computedAt };
  }

  // Build adjacency sets for graph computation
  const directedSet = new Set<string>(directedPairs.map(p => `${p.from}:${p.to}`));
  const neighbors = new Map<string, Set<string>>();
  const undirectedEdgeSet = new Set<string>();

  for (const { from, to } of directedPairs) {
    if (!neighbors.has(from)) neighbors.set(from, new Set());
    if (!neighbors.has(to)) neighbors.set(to, new Set());
    neighbors.get(from)!.add(to);
    neighbors.get(to)!.add(from);
    const edgeKey = from < to ? `${from}:${to}` : `${to}:${from}`;
    undirectedEdgeSet.add(edgeKey);
  }

  const uniqueEdges = undirectedEdgeSet.size;
  const totalDirectedPairs = directedPairs.length;

  // Reciprocity: fraction of directed edges that have a reverse edge
  // Definition: bidirectional_directed_edges / total_directed_edges
  let bidirectionalPairs = 0;
  for (const { from, to } of directedPairs) {
    if (directedSet.has(`${to}:${from}`)) {
      bidirectionalPairs++;
    }
  }
  const reciprocity = totalDirectedPairs > 0 ? bidirectionalPairs / totalDirectedPairs : 0;

  // Density: 2 * unique_edges / (N * (N - 1))
  const N = activeMembers;
  const density = N > 1 ? (2 * uniqueEdges) / (N * (N - 1)) : 0;

  // Clustering Coefficient (Watts-Strogatz global)
  let clusteringSum = 0;
  let clusteringCount = 0;
  for (const [node, nbrs] of neighbors) {
    const k = nbrs.size;
    if (k < 2) continue;
    const nbrsArray = Array.from(nbrs);
    let actualEdges = 0;
    for (let i = 0; i < nbrsArray.length; i++) {
      for (let j = i + 1; j < nbrsArray.length; j++) {
        const a = nbrsArray[i];
        const b = nbrsArray[j];
        const edgeKey = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (undirectedEdgeSet.has(edgeKey)) actualEdges++;
      }
    }
    const possibleEdges = (k * (k - 1)) / 2;
    clusteringSum += actualEdges / possibleEdges;
    clusteringCount++;
  }
  const clustering = clusteringCount > 0 ? clusteringSum / clusteringCount : 0;

  // Average Path Length from auth.social_distances
  let avgPathLength = 0;
  let pathScore = 0;
  try {
    const distResult = await query(
      `SELECT AVG(degrees_of_separation) as avg_dist
       FROM auth.social_distances
       WHERE community_id = $1`,
      [communityId]
    );
    const rawAvg = parseFloat(distResult.rows[0]?.avg_dist ?? '0') || 0;
    avgPathLength = rawAvg;
    pathScore = rawAvg > 0 ? Math.max(0, 1 - (rawAvg / 4)) : 0;
  } catch {
    // table may not exist or be empty; pathScore stays 0
  }

  // Network Cohesion Score
  const rawScore = reciprocity * 0.30 + density * 0.20 + clustering * 0.30 + pathScore * 0.20;
  const score = Math.min(100, Math.max(0, Math.round(rawScore * 100)));
  const label = getCohesionLabel(score);

  return {
    score,
    label,
    reciprocity,
    density,
    clustering,
    avgPathLength,
    uniqueEdges,
    activeMembers,
    computedAt,
  };
}
