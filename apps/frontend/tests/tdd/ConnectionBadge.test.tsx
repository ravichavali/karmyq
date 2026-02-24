import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ConnectionBadge from '../../src/components/requests/ConnectionBadge';

// Mock socialGraphClient
jest.mock('../../src/lib/socialGraphClient', () => ({
  socialGraphClient: {
    getPath: jest.fn(),
  },
}));

const { socialGraphClient } = require('../../src/lib/socialGraphClient');

describe('ConnectionBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading state', () => {
    it('renders nothing while loading', async () => {
      socialGraphClient.getPath.mockReturnValue(new Promise(() => {})); // never resolves

      const { container } = render(<ConnectionBadge requesterId="user-1" />);

      expect(container.firstChild).toBeNull();
    });

    it('calls getPath with the provided requesterId', async () => {
      socialGraphClient.getPath.mockResolvedValue(null);

      await act(async () => {
        render(<ConnectionBadge requesterId="user-abc" />);
      });

      expect(socialGraphClient.getPath).toHaveBeenCalledWith('user-abc');
    });
  });

  describe('No badge states', () => {
    it('renders nothing when path is null', async () => {
      socialGraphClient.getPath.mockResolvedValue(null);

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toBeNull();
    });

    it('renders nothing when degrees_of_separation is null', async () => {
      socialGraphClient.getPath.mockResolvedValue({ degrees_of_separation: null, path: [] });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toBeNull();
    });

    it('renders nothing for 4+ degree connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 4,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'A' }, { id: '3', name: 'B' }, { id: '4', name: 'C' }, { id: '5', name: 'D' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toBeNull();
    });
  });

  describe('Badge text', () => {
    it('renders "Direct connection" for 1° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      await act(async () => {
        render(<ConnectionBadge requesterId="user-1" />);
      });

      expect(screen.getByText('Direct connection')).toBeInTheDocument();
    });

    it('renders "Connected through [Name]" for 2° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }, { id: '3', name: 'Bob' }],
      });

      await act(async () => {
        render(<ConnectionBadge requesterId="user-1" />);
      });

      expect(screen.getByText('Connected through Alice')).toBeInTheDocument();
    });

    it('renders "Connected through 2 people" for 3° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 3,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'Alice' },
          { id: '3', name: 'Bob' },
          { id: '4', name: 'Charlie' },
        ],
      });

      await act(async () => {
        render(<ConnectionBadge requesterId="user-1" />);
      });

      expect(screen.getByText('Connected through 2 people')).toBeInTheDocument();
    });
  });

  describe('Badge element', () => {
    it('renders as a <span> element (not block or button)', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild?.nodeName).toBe('SPAN');
    });

    it('applies text-xs class for compact display', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toHaveClass('text-xs');
    });

    it('uses cursor-pointer when onClick is provided', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" onClick={() => {}} />));
      });

      expect(container!.firstChild).toHaveClass('cursor-pointer');
    });

    it('uses cursor-default when onClick is not provided', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toHaveClass('cursor-default');
    });

    it('calls onClick when clicked', async () => {
      const onClick = jest.fn();
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      await act(async () => {
        render(<ConnectionBadge requesterId="user-1" onClick={onClick} />);
      });

      fireEvent.click(screen.getByText('Direct connection'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Badge colors', () => {
    it('applies success color for 1° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toHaveClass('bg-success-light', 'text-success', 'border-success');
    });

    it('applies primary color for 2° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 2,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }, { id: '3', name: 'Bob' }],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toHaveClass('bg-primary-light', 'text-primary-dark', 'border-primary-medium');
    });

    it('applies muted color for 3° connection', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 3,
        path: [
          { id: '1', name: 'You' },
          { id: '2', name: 'A' },
          { id: '3', name: 'B' },
          { id: '4', name: 'C' },
        ],
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(<ConnectionBadge requesterId="user-1" />));
      });

      expect(container!.firstChild).toHaveClass('bg-surface', 'text-text-muted', 'border-border');
    });
  });

  describe('Re-fetch on requesterId change', () => {
    it('re-fetches when requesterId prop changes', async () => {
      socialGraphClient.getPath.mockResolvedValue({
        degrees_of_separation: 1,
        path: [{ id: '1', name: 'You' }, { id: '2', name: 'Alice' }],
      });

      const { rerender } = render(<ConnectionBadge requesterId="user-1" />);
      await act(async () => {});

      rerender(<ConnectionBadge requesterId="user-2" />);
      await act(async () => {});

      expect(socialGraphClient.getPath).toHaveBeenCalledWith('user-1');
      expect(socialGraphClient.getPath).toHaveBeenCalledWith('user-2');
      expect(socialGraphClient.getPath).toHaveBeenCalledTimes(2);
    });
  });
});
