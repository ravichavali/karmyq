import { classifyDecayTier } from '@karmyq/shared';
import { buildMemoryResponse, enrichLinksWithDecay } from '../../src/routes/trustGraph';

describe('Sprint 90 — classifyDecayTier band boundaries', () => {
  const threshold = 0.5; // r = weight / 0.5 = weight * 2

  it('classifies r >= 3 as strong (boundary at r = 3)', () => {
    expect(classifyDecayTier(1.5, threshold)).toBe('strong'); // r = 3
    expect(classifyDecayTier(10, threshold)).toBe('strong');
  });

  it('classifies 2 <= r < 3 as warm (boundary at r = 2)', () => {
    expect(classifyDecayTier(1.0, threshold)).toBe('warm'); // r = 2
    expect(classifyDecayTier(1.49, threshold)).toBe('warm'); // r = 2.98
  });

  it('classifies 1.3 <= r < 2 as fading (boundary at r = 1.3)', () => {
    expect(classifyDecayTier(0.65, threshold)).toBe('fading'); // r = 1.3
    expect(classifyDecayTier(0.99, threshold)).toBe('fading'); // r = 1.98
  });

  it('classifies 1 <= r < 1.3 as nearly_forgotten (boundary at r = 1)', () => {
    expect(classifyDecayTier(0.5, threshold)).toBe('nearly_forgotten'); // r = 1
    expect(classifyDecayTier(0.64, threshold)).toBe('nearly_forgotten'); // r = 1.28
  });

  it('classifies r < 1 as swept', () => {
    expect(classifyDecayTier(0.49, threshold)).toBe('swept'); // r = 0.98
    expect(classifyDecayTier(0, threshold)).toBe('swept');
  });

  it('treats a non-positive threshold as never-disappearing', () => {
    expect(classifyDecayTier(0.1, 0)).toBe('strong');
    expect(classifyDecayTier(0, 0)).toBe('swept');
  });
});

describe('Sprint 90 — enrichLinksWithDecay (graph edge shape)', () => {
  it('adds currentWeight, disappearanceThreshold, decayTier per edge while preserving existing fields', () => {
    const links = [
      { source: 'a', target: 'b', raw_weight: 5, effective_weight: 1.5 }, // r = 3 → strong
      { source: 'a', target: 'c', raw_weight: 4, effective_weight: 0.5 }, // r = 1 → nearly_forgotten
    ];
    const enriched = enrichLinksWithDecay(links, 0.5);
    expect(enriched[0]).toMatchObject({
      source: 'a',
      target: 'b',
      effective_weight: 1.5,
      currentWeight: 1.5,
      disappearanceThreshold: 0.5,
      decayTier: 'strong',
    });
    expect(enriched[1].decayTier).toBe('nearly_forgotten');
  });
});

describe('Sprint 90 — buildMemoryResponse (memory endpoint shape)', () => {
  const threshold = 0.5;
  const rows = [
    { peer_id: 'p1', peer_name: 'Ana', current_weight: 2.0, last_interaction_at: null, match_completed_count: 5 }, // strong
    { peer_id: 'p2', peer_name: 'Ben', current_weight: 1.0, last_interaction_at: null, match_completed_count: 3 }, // warm
    { peer_id: 'p3', peer_name: 'Cy', current_weight: 0.8, last_interaction_at: null, match_completed_count: 2 }, // fading (r=1.6)
    { peer_id: 'p4', peer_name: 'Di', current_weight: 0.55, last_interaction_at: null, match_completed_count: 4 }, // nearly_forgotten (r=1.1)
    { peer_id: 'p5', peer_name: 'Ed', current_weight: 0.2, last_interaction_at: null, match_completed_count: 1 }, // swept (r=0.4) — excluded
  ];

  it('counts strong+warm as active and partitions fading vs nearly_forgotten, excluding swept', () => {
    const res = buildMemoryResponse(rows, threshold);
    expect(res.activeCount).toBe(2);
    expect(res.fading.map((r) => r.peerId)).toEqual(['p3']);
    expect(res.nearlyForgotten.map((r) => r.peerId)).toEqual(['p4']);
    // swept peer never surfaces
    const allPeers = [...res.fading, ...res.nearlyForgotten].map((r) => r.peerId);
    expect(allPeers).not.toContain('p5');
  });

  it('each returned relationship carries its decayTier and peer name', () => {
    const res = buildMemoryResponse(rows, threshold);
    expect(res.fading[0]).toMatchObject({ peerId: 'p3', peerName: 'Cy', decayTier: 'fading' });
    expect(res.nearlyForgotten[0]).toMatchObject({ peerName: 'Di', decayTier: 'nearly_forgotten' });
  });
});
