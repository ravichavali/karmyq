/**
 * Sprint 113 PR B / Task 9 — the belonging fractal made legible as three explicit zoom levels.
 *
 * S114 keeps the full `/network` explorer's Scale 1/2/3 framing and retires the community page's
 * duplicate Scale 1 sub-tab. The community page remains the Scale 2 home and links up to Scale 3.
 */

import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react';
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab';

// ReWarmingNudge fetches; stub it so the tab renders standalone.
jest.mock('@/components/relationships/ReWarmingNudge', () => () => <div data-testid="rewarm" />);
// BelongingGraph is the D3 surface; not under test in the framing assertions.
jest.mock('@/components/BelongingGraph', () => () => <div data-testid="belonging-graph" />);

const FRONTEND_ROOT = path.resolve(__dirname, '../..')
const networkSource = fs.readFileSync(path.join(FRONTEND_ROOT, 'src/pages/network.tsx'), 'utf8')

describe('Sprint 113 — /network explorer scale framing remains canonical', () => {
  it('keeps Scale 1, Scale 2, and Scale 3 framing in the explorer', () => {
    expect(networkSource).toContain('Scale 1 · My Network')
    expect(networkSource).toContain('Scale 2 · This Community')
    expect(networkSource).toContain('Scale 3 · Across Communities')
  })
});

describe('Sprint 113/S114 — community Trust Graph framing', () => {
  it('frames the community graph as Scale 2 only and links up to Scale 3', () => {
    render(<TrustGraphTab communityId="comm-1" currentUserId="me" />);

    expect(screen.getByText(/Scale 2 · This Community/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My Network' })).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /how communities connect/i });
    expect(link).toHaveAttribute('href', '/network?mode=communities');
  });
});
