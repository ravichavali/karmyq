/**
 * Sprint 62: Frontend platform coherence TDD tests
 *
 * Tests community-type awareness in the unified feed (migrated from the retired BrowseFeed to
 * UnifiedFeed in Sprint 86 — the group banner now lives on the canonical feed):
 * - Group banner appears only for group communities
 * - Empty state differs for group communities
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/dashboard', query: {}, push: jest.fn() }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock next/image
jest.mock('next/image', () => {
  return ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />;
});

// Mock API calls — UnifiedFeed calls requestService.getCuratedRequests on mount
jest.mock('../../src/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(() => Promise.resolve({ data: { requests: [] } })),
    createMatch: jest.fn(),
  },
}));

// Mock hooks used by UnifiedFeed internals
jest.mock('../../src/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false }),
}));

import UnifiedFeed from '../../src/components/Feed/UnifiedFeed';

describe('Sprint 62: Community Type in UnifiedFeed', () => {
  beforeEach(() => {
    // localStorage.getItem returns null by default in jsdom
    jest.clearAllMocks();
  });

  it('renders without group banner for mutual_aid community', async () => {
    render(<UnifiedFeed communityType="mutual_aid" noCommunities={false} />);
    // Banner text should not appear for mutual_aid
    expect(screen.queryByText(/This is a group community/i)).toBeNull();
  });

  it('renders without group banner when communityType is undefined', async () => {
    render(<UnifiedFeed noCommunities={false} />);
    expect(screen.queryByText(/This is a group community/i)).toBeNull();
  });

  it('renders group banner when communityType is group', async () => {
    render(<UnifiedFeed communityType="group" noCommunities={false} />);
    // Banner appears after the data fetch resolves (loading state clears)
    expect(await screen.findByText(/This is a group community/i)).toBeTruthy();
  });

  it('shows Activities reference in group banner', async () => {
    render(<UnifiedFeed communityType="group" noCommunities={false} />);
    const banner = await screen.findByText(/This is a group community/i);
    expect(banner.textContent).toContain('Activities');
  });
});
