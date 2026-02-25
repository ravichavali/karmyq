import React from 'react';
import { render, screen } from '@testing-library/react';
import KarmaBadge from '../../src/components/KarmaBadge';

describe('KarmaBadge', () => {
  describe('Null/empty states', () => {
    it('renders nothing when karma is 0', () => {
      const { container } = render(<KarmaBadge karma={0} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when karma is negative', () => {
      const { container } = render(<KarmaBadge karma={-5} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Karma display', () => {
    it('renders karma value', () => {
      render(<KarmaBadge karma={142} />);
      expect(screen.getByText('142')).toBeInTheDocument();
    });

    it('renders star icon', () => {
      render(<KarmaBadge karma={50} />);
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('includes karma value in accessible title', () => {
      render(<KarmaBadge karma={100} />);
      const badge = screen.getByTitle(/100 karma/);
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Trust score stars', () => {
    it('renders no stars when trustScore is 0', () => {
      const { container } = render(<KarmaBadge karma={50} trustScore={0} />);
      // No filled star SVGs should appear in the stars container
      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(0);
    });

    it('renders stars when trustScore is > 0', () => {
      const { container } = render(<KarmaBadge karma={50} trustScore={60} />);
      // trustScore 60 → 3 stars out of 5
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('caps stars at 5 for max trust score', () => {
      const { container } = render(<KarmaBadge karma={50} trustScore={100} />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(5);
    });

    it('includes trust score in title when provided', () => {
      render(<KarmaBadge karma={50} trustScore={80} />);
      expect(screen.getByTitle(/trust score 80/)).toBeInTheDocument();
    });

    it('does not include trust score in title when not provided', () => {
      render(<KarmaBadge karma={50} />);
      const badge = screen.getByTitle('50 karma');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Rendering as inline span', () => {
    it('renders as a span element', () => {
      const { container } = render(<KarmaBadge karma={10} />);
      expect(container.firstChild?.nodeName).toBe('SPAN');
    });

    it('applies custom className', () => {
      const { container } = render(<KarmaBadge karma={10} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
