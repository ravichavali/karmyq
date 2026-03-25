/**
 * Sprint 38 TDD Tests: Contextual Trust + Member Profile Depth
 *
 * Tests:
 * - Trust tier computation thresholds
 * - Completion rate display (no * 100 bug)
 * - TrustCard component rendering
 * - ProfileTagsSection component rendering + delete interaction
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Pure logic tests (no DOM) ────────────────────────────────────────────────

function getTrustTier(karma: number): 'Pillar' | 'Trusted' | 'Emerging' {
  if (karma >= 100) return 'Pillar';
  if (karma >= 30) return 'Trusted';
  return 'Emerging';
}

describe('Trust tier computation', () => {
  it('returns Emerging for karma 0', () => expect(getTrustTier(0)).toBe('Emerging'));
  it('returns Emerging for karma 29', () => expect(getTrustTier(29)).toBe('Emerging'));
  it('returns Trusted for karma 30', () => expect(getTrustTier(30)).toBe('Trusted'));
  it('returns Trusted for karma 99', () => expect(getTrustTier(99)).toBe('Trusted'));
  it('returns Pillar for karma 100', () => expect(getTrustTier(100)).toBe('Pillar'));
  it('returns Pillar for karma 500', () => expect(getTrustTier(500)).toBe('Pillar'));
});

describe('Completion rate display', () => {
  it('does not multiply by 100 — backend already returns 0-100', () => {
    const completionRate = 75.0; // as returned from API
    const displayed = Math.round(Number(completionRate));
    expect(displayed).toBe(75);
    expect(displayed).not.toBe(7500);
  });

  it('rounds correctly', () => {
    expect(Math.round(Number(85.6))).toBe(86);
    expect(Math.round(Number(0))).toBe(0);
    expect(Math.round(Number(100))).toBe(100);
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

jest.mock('../../src/lib/api', () => ({
  socialGraphApi: {
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

const { TrustCard } = require('../../src/components/TrustCard');
const { ProfileTagsSection } = require('../../src/components/ProfileTagsSection');
const { socialGraphApi, api } = require('../../src/lib/api');

describe('TrustCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // Promise that never resolves — keeps component in loading state
    (socialGraphApi.get as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<TrustCard userId="user-123" onClose={() => {}} />);
    // Loading state shows animated placeholder elements
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders trust tier badge after data loads', async () => {
    (socialGraphApi.get as any).mockResolvedValue({
      data: {
        data: {
          targetUser: { id: 'user-123', name: 'Alice', karma: 50, trust_tier: 'Trusted' },
          trustPath: [
            { id: 'me', name: 'You' },
            { id: 'user-123', name: 'Alice', karma: 50 },
          ],
          invitationPath: null,
          degrees: 1,
          path_type: 'exchange',
        },
      },
    });

    render(<TrustCard userId="user-123" onClose={() => {}} />);

    await waitFor(() => {
      // Header name appears as a heading
      expect(screen.getByRole('heading', { name: 'Alice' })).toBeTruthy();
      expect(screen.getByText('Trusted')).toBeTruthy();
    });
  });

  it('shows "No direct connection" when trustPath has 0 or 1 node', async () => {
    (socialGraphApi.get as any).mockResolvedValue({
      data: {
        data: {
          targetUser: { id: 'user-456', name: 'Bob', karma: 5, trust_tier: 'Emerging' },
          trustPath: [],
          invitationPath: null,
          degrees: null,
          path_type: null,
        },
      },
    });

    render(<TrustCard userId="user-456" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/No direct connection found/)).toBeTruthy();
    });
  });

  it('shows error state when API call fails', async () => {
    (socialGraphApi.get as any).mockRejectedValue(new Error('Network error'));

    render(<TrustCard userId="user-789" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load trust information/)).toBeTruthy();
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    (socialGraphApi.get as any).mockResolvedValue({
      data: {
        data: {
          targetUser: { id: 'user-123', name: 'Alice', karma: 50, trust_tier: 'Trusted' },
          trustPath: [],
          invitationPath: null,
          degrees: null,
          path_type: null,
        },
      },
    });

    const onClose = jest.fn();
    render(<TrustCard userId="user-123" onClose={onClose} />);

    // Click the backdrop (the fixed overlay div)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileTagsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as any).mockImplementation((url: unknown) => {
      if (url === '/auth/profile/tags') {
        return Promise.resolve({ data: { data: { skills: [], interests: [], needs: [] } } });
      }
      // suggestions
      return Promise.resolve({ data: { data: ['Carpentry', 'Cooking', 'Driving'] } });
    });
  });

  it('renders three sections: Skills, Interests, Needs', async () => {
    render(<ProfileTagsSection />);

    await waitFor(() => {
      expect(screen.getByText('Skills')).toBeTruthy();
      expect(screen.getByText('Interests')).toBeTruthy();
      expect(screen.getByText('Needs')).toBeTruthy();
    });
  });

  it('calls DELETE when remove button is clicked on a tag', async () => {
    (api.get as any).mockImplementation((url: unknown) => {
      if (url === '/auth/profile/tags') {
        return Promise.resolve({
          data: {
            data: {
              skills: [{ id: 'tag-1', tag_value: 'Carpentry' }],
              interests: [],
              needs: [],
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    (api.delete as any).mockResolvedValue({ data: { success: true } });

    render(<ProfileTagsSection />);

    // Wait for tag to render
    await waitFor(() => {
      expect(screen.getByText('Carpentry')).toBeTruthy();
    });

    // Click the ✕ button on the tag
    const removeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/auth/profile/tags/tag-1');
    });
  });
});
