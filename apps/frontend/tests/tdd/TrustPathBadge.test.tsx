import React from 'react';
import { render, screen } from '@testing-library/react';
import TrustPathBadge, { TrustPathBadgeSkeleton, TrustPath } from '../../src/components/TrustPathBadge';

describe('TrustPathBadge', () => {
  describe('Null/Empty States', () => {
    it('renders nothing when trustPath is null', () => {
      const { container } = render(<TrustPathBadge trustPath={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when degrees_of_separation is null', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: null,
        path: [],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when path is undefined', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for 4+ degree connections', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 4,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
          { id: '5', name: 'Dave' },
        ],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Compact Mode — Exchange connections', () => {
    it('renders "Direct connection" for 1° exchange', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('Direct connection')).toBeInTheDocument();
    });

    it('renders "Connected through [Name]" for 2° exchange', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('Connected through Alice')).toBeInTheDocument();
    });

    it('renders "Connected through [Name] → [Name]" for 3° exchange', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 3,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('Connected through Alice → Bob')).toBeInTheDocument();
    });

    it('renders as a <span> element (not block)', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild?.nodeName).toBe('SPAN');
    });

    it('applies text-xs class in compact mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('text-xs');
    });

    it('applies custom className in compact mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      const { container } = render(
        <TrustPathBadge trustPath={trustPath} compact className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Compact Mode — Badge colors', () => {
    it('applies success color for 1° exchange connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('bg-success-light', 'text-success', 'border-success');
    });

    it('applies primary color for 2° exchange connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('bg-primary-light', 'text-primary-dark', 'border-primary-medium');
    });

    it('applies surface/muted color for 3° exchange connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 3,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
        ],
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('bg-surface', 'text-text-muted', 'border-border');
    });

    it('applies accent color for community_member connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Admin' }, { id: '3', name: 'Other' }],
        connection_type: 'community_member',
        community_name: 'Test Community',
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('bg-accent-light', 'text-accent-dark', 'border-accent');
    });

    it('applies yellow color for invitation_chain connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Inviter' }, { id: '3', name: 'Other' }],
        connection_type: 'invitation_chain',
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(container.firstChild).toHaveClass('bg-yellow-50', 'text-yellow-800', 'border-yellow-300');
    });
  });

  describe('Compact Mode — Community and invitation text', () => {
    it('renders "Fellow member of [Community]" for 2° community connection (never via a person — BUG-029)', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Admin' }, { id: '3', name: 'Other' }],
        connection_type: 'community_member',
        community_name: 'Test Community',
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('Fellow member of Test Community')).toBeInTheDocument();
      expect(screen.queryByText(/via/i)).not.toBeInTheDocument();
    });

    it('renders "Joined through [Name]" for invitation_chain connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Inviter' }, { id: '3', name: 'Other' }],
        connection_type: 'invitation_chain',
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('Joined through Inviter')).toBeInTheDocument();
    });
  });

  describe('Full Mode', () => {
    it('renders full badge with border-l-4 container', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice', karma: 150 },
          { id: '3', name: 'Bob', karma: 200 },
        ],
        trust_score: 75,
      };
      const { container } = render(<TrustPathBadge trustPath={trustPath} />);

      expect(container.querySelector('.border-l-4')).toBeInTheDocument();
    });

    it('renders connection text in full mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
        trust_score: 75,
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getAllByText('Connected through Alice').length).toBeGreaterThan(0);
    });

    it('displays path nodes in full mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('never displays a numeric path trust score (ADR-082)', () => {
      // Sprint 112: the outward path carries no numeric trust_score; the badge conveys closeness via
      // degrees + relationship state, never a star rating or score number.
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      // No bare numeric score text should appear.
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });

    it('renders "You" in the path for the first node', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'Current User' },
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('applies custom className in full mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      const { container } = render(
        <TrustPathBadge trustPath={trustPath} className="my-custom-class" />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});

describe('TrustPathBadgeSkeleton', () => {
  it('renders loading skeleton in compact mode', () => {
    const { container } = render(<TrustPathBadgeSkeleton compact />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders loading skeleton in full mode with border-l-4', () => {
    const { container } = render(<TrustPathBadgeSkeleton />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(container.querySelector('.border-l-4')).toBeInTheDocument();
  });

  it('applies custom className to compact skeleton', () => {
    const { container } = render(<TrustPathBadgeSkeleton compact className="custom-skeleton" />);

    expect(container.firstChild).toHaveClass('custom-skeleton');
  });

  it('applies custom className to full skeleton', () => {
    const { container } = render(<TrustPathBadgeSkeleton className="custom-skeleton" />);

    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
