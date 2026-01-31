import React from 'react';
import { render, screen } from '@testing-library/react';
import TrustPathBadge, { TrustPathBadgeSkeleton, TrustPath } from '../TrustPathBadge';

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
  });

  describe('Compact Mode', () => {
    it('renders 1° connection badge in compact mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('1° connection')).toBeInTheDocument();
    });

    it('renders 2° connection badge in compact mode', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      expect(screen.getByText('2° connection')).toBeInTheDocument();
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

  describe('Full Mode', () => {
    it('renders full badge with 2° connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice', karma: 150 },
          { id: '3', name: 'Bob', karma: 200 },
        ],
        trust_score: 75,
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText('2° Connection')).toBeInTheDocument();
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('displays trust score when provided', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
        trust_score: 85,
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('does not display trust score when 0', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
        trust_score: 0,
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('does not display trust score when undefined', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      // Should not have any trust score display
      const container = screen.getByText('You').closest('div');
      expect(container).not.toHaveTextContent(/\d+/); // No numbers except in degree badge
    });

    it('displays invitation date when available', () => {
      const inviteDate = '2024-01-15T10:00:00Z';
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice', invited_at: inviteDate },
          { id: '3', name: 'Bob' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText(/Connected/)).toBeInTheDocument();
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

  describe('Degree Colors', () => {
    it('applies green color for 1° connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      const badge = screen.getByText('1° connection');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300');
    });

    it('applies blue color for 2° connection', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 2,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      const badge = screen.getByText('2° connection');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-300');
    });

    it('applies yellow color for 3° connection', () => {
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

      const badge = screen.getByText('3° connection');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-300');
    });

    it('applies orange color for 4° connection', () => {
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
      render(<TrustPathBadge trustPath={trustPath} compact />);

      const badge = screen.getByText('4° connection');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800', 'border-orange-300');
    });

    it('applies gray color for connections > 4 degrees', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 5,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
          { id: '5', name: 'Dave' },
          { id: '6', name: 'Eve' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} compact />);

      const badge = screen.getByText('5° connection');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
    });
  });

  describe('Path Rendering', () => {
    it('renders path with multiple people', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 3,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('renders "You" with special styling for first node', () => {
      const trustPath: TrustPath = {
        degrees_of_separation: 1,
        path: [
          { id: '1', name: 'Current User' }, // Name doesn't matter, should show "You"
          { id: '2', name: 'Alice' },
        ],
      };
      render(<TrustPathBadge trustPath={trustPath} />);

      const youElement = screen.getByText('You');
      expect(youElement).toHaveClass('font-semibold', 'text-blue-700');
    });
  });
});

describe('TrustPathBadgeSkeleton', () => {
  it('renders loading skeleton in compact mode', () => {
    const { container } = render(<TrustPathBadgeSkeleton compact />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders loading skeleton in full mode', () => {
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
