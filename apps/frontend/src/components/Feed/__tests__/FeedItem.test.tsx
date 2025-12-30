import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedItem from '../FeedItem';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock useTrustPath hook
jest.mock('../../../hooks/useTrustPath', () => ({
  useTrustPath: jest.fn(() => ({
    trustPath: null,
    loading: false,
    error: null,
  })),
}));

const { useTrustPath } = require('../../../hooks/useTrustPath');

describe('FeedItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Community Activity Item', () => {
    const communityActivityItem = {
      id: 'item-1',
      type: 'community_activity' as const,
      priority: 10,
      created_at: '2024-01-15T10:00:00Z',
      data: {
        community_id: 'comm-1',
        community_name: 'Test Community',
        exchanges_completed_week: 15,
        recent_helpers: [
          { name: 'Alice', help_count: 5 },
          { name: 'Bob', help_count: 3 },
        ],
        new_members_count: 7,
        open_requests_count: 3,
      },
    };

    it('renders community activity with basic info', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.getByText('Test Community')).toBeInTheDocument();
      expect(screen.getByText('Your community')).toBeInTheDocument();
    });

    it('displays exchanges completed this week', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText(/exchanges completed this week/i)).toBeInTheDocument();
    });

    it('displays recent helpers', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.getByText(/Alice \(5\)/)).toBeInTheDocument();
      expect(screen.getByText(/Bob \(3\)/)).toBeInTheDocument();
    });

    it('displays new members count', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText(/new members this week/i)).toBeInTheDocument();
    });

    it('displays open requests section when requests exist', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.getByText(/3 requests need help/i)).toBeInTheDocument();
      expect(screen.getByText('View requests')).toBeInTheDocument();
    });

    it('does not display open requests when count is 0', () => {
      const itemWithNoRequests = {
        ...communityActivityItem,
        data: { ...communityActivityItem.data, open_requests_count: 0 },
      };
      render(<FeedItem item={itemWithNoRequests} />);

      expect(screen.queryByText(/requests need help/i)).not.toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = jest.fn();
      render(<FeedItem item={communityActivityItem} onDismiss={onDismiss} />);

      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledWith('item-1');
    });

    it('does not render dismiss button when onDismiss not provided', () => {
      render(<FeedItem item={communityActivityItem} />);

      expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
    });
  });

  describe('Open Request Item', () => {
    const openRequestItem = {
      id: 'item-2',
      type: 'open_request' as const,
      priority: 20,
      created_at: '2024-01-15T10:00:00Z',
      data: {
        request_id: 'req-1',
        requester_id: 'user-123',
        title: 'Need help moving furniture',
        description: 'Looking for someone with a truck to help move a couch',
        urgency: 'high',
        author_name: 'John Doe',
        community_name: 'Test Community',
        expected_duration: '2-3 hours',
        offers_count: 0,
        required_skills: ['Lifting', 'Driving'],
      },
    };

    it('renders open request with basic info', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('Need help moving furniture')).toBeInTheDocument();
      expect(screen.getByText('Looking for someone with a truck to help move a couch')).toBeInTheDocument();
      expect(screen.getByText('Posted by John Doe')).toBeInTheDocument();
    });

    it('displays urgency badge', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('displays "New - no offers yet" badge when offers_count is 0', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('New - no offers yet')).toBeInTheDocument();
    });

    it('does not display "New" badge when offers exist', () => {
      const itemWithOffers = {
        ...openRequestItem,
        data: { ...openRequestItem.data, offers_count: 2 },
      };
      render(<FeedItem item={itemWithOffers} />);

      expect(screen.queryByText('New - no offers yet')).not.toBeInTheDocument();
    });

    it('displays required skills', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('Lifting')).toBeInTheDocument();
      expect(screen.getByText('Driving')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Offer to Help')).toBeInTheDocument();
    });

    it('fetches trust path for requester', () => {
      render(<FeedItem item={openRequestItem} />);

      expect(useTrustPath).toHaveBeenCalledWith('user-123');
    });

    it('displays trust path when available', () => {
      useTrustPath.mockReturnValue({
        trustPath: {
          degrees_of_separation: 2,
          path: [
            { id: '1', name: 'You' },
            { id: '2', name: 'Alice' },
            { id: '3', name: 'John Doe' },
          ],
          trust_score: 75,
        },
        loading: false,
        error: null,
      });

      render(<FeedItem item={openRequestItem} />);

      expect(screen.getByText('2° Connection')).toBeInTheDocument();
    });

    it('displays loading skeleton while fetching trust path', () => {
      useTrustPath.mockReturnValue({
        trustPath: null,
        loading: true,
        error: null,
      });

      const { container } = render(<FeedItem item={openRequestItem} />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Suggested Request Item', () => {
    const suggestedRequestItem = {
      id: 'item-3',
      type: 'suggested_request' as const,
      priority: 15,
      created_at: '2024-01-15T10:00:00Z',
      data: {
        request_id: 'req-2',
        community_id: 'comm-2',
        title: 'Help with gardening',
        description: 'Need someone to help with spring planting',
        reason: 'You have gardening skills and this is in your neighborhood',
        match_score: 85,
        community_name: 'Gardening Community',
      },
    };

    it('renders suggested request with basic info', () => {
      render(<FeedItem item={suggestedRequestItem} />);

      expect(screen.getByText('Suggested for You')).toBeInTheDocument();
      expect(screen.getByText('Help with gardening')).toBeInTheDocument();
      expect(screen.getByText('Need someone to help with spring planting')).toBeInTheDocument();
    });

    it('displays reason for suggestion', () => {
      render(<FeedItem item={suggestedRequestItem} />);

      expect(screen.getByText('Why suggested:')).toBeInTheDocument();
      expect(screen.getByText('You have gardening skills and this is in your neighborhood')).toBeInTheDocument();
    });

    it('displays match score', () => {
      render(<FeedItem item={suggestedRequestItem} />);

      expect(screen.getByText('85% match')).toBeInTheDocument();
    });

    it('displays community name', () => {
      render(<FeedItem item={suggestedRequestItem} />);

      expect(screen.getByText(/Gardening Community/)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<FeedItem item={suggestedRequestItem} />);

      expect(screen.getByText('View Request')).toBeInTheDocument();
      expect(screen.getByText('Explore Community')).toBeInTheDocument();
    });
  });

  describe('Story Item', () => {
    const storyItem = {
      id: 'item-4',
      type: 'story' as const,
      priority: 5,
      created_at: '2024-01-15T10:00:00Z',
      data: {
        type: 'first_timer',
        title: 'First successful exchange!',
        description: 'Alice helped Bob move his furniture and earned their first karma points',
        community_name: 'Test Community',
      },
    };

    it('renders story with basic info', () => {
      render(<FeedItem item={storyItem} />);

      expect(screen.getByText('First successful exchange!')).toBeInTheDocument();
      expect(screen.getByText('Alice helped Bob move his furniture and earned their first karma points')).toBeInTheDocument();
    });

    it('displays appropriate icon for first_timer', () => {
      render(<FeedItem item={storyItem} />);

      expect(screen.getByText('🌱')).toBeInTheDocument();
    });

    it('displays appropriate icon for milestone', () => {
      const milestoneStory = {
        ...storyItem,
        data: { ...storyItem.data, type: 'milestone' },
      };
      render(<FeedItem item={milestoneStory} />);

      expect(screen.getByText('🏆')).toBeInTheDocument();
    });

    it('displays appropriate icon for pay_it_forward', () => {
      const payItForwardStory = {
        ...storyItem,
        data: { ...storyItem.data, type: 'pay_it_forward' },
      };
      render(<FeedItem item={payItForwardStory} />);

      expect(screen.getByText('🔄')).toBeInTheDocument();
    });

    it('displays appropriate icon for unexpected_match', () => {
      const unexpectedMatchStory = {
        ...storyItem,
        data: { ...storyItem.data, type: 'unexpected_match' },
      };
      render(<FeedItem item={unexpectedMatchStory} />);

      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('displays community name when available', () => {
      render(<FeedItem item={storyItem} />);

      expect(screen.getByText(/in Test Community/)).toBeInTheDocument();
    });
  });

  describe('Unknown Item Type', () => {
    it('renders nothing for unknown item type', () => {
      const unknownItem = {
        id: 'item-5',
        type: 'unknown_type' as any,
        priority: 10,
        created_at: '2024-01-15T10:00:00Z',
        data: {},
      };

      const { container } = render(<FeedItem item={unknownItem} />);

      expect(container.firstChild).toBeNull();
    });
  });
});
