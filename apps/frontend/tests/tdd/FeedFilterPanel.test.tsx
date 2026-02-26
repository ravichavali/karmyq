import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedFilterPanel from '../../src/components/FeedFilterPanel';

const DEFAULT_TYPES = [
  { value: 'ride', label: 'Ride' },
  { value: 'service', label: 'Service' },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof FeedFilterPanel>> = {}) {
  const props = {
    filterTrustDistance: '',
    filterRequestType: '',
    availableTypes: DEFAULT_TYPES,
    onTrustDistanceChange: jest.fn(),
    onRequestTypeChange: jest.fn(),
    onClear: jest.fn(),
    ...overrides,
  };
  return { ...render(<FeedFilterPanel {...props} />), props };
}

describe('FeedFilterPanel', () => {
  describe('rendering', () => {
    it('renders with data-testid="filter-panel"', () => {
      renderPanel();
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('shows all trust distance options', () => {
      renderPanel();
      expect(screen.getByText('Direct')).toBeInTheDocument();
      expect(screen.getByText('2nd degree')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
    });

    it('shows "All" option in both trust and request type sections', () => {
      renderPanel();
      const allButtons = screen.getAllByText('All');
      expect(allButtons).toHaveLength(2);
    });

    it('shows available request type options', () => {
      renderPanel();
      expect(screen.getByText('Ride')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
    });

    it('shows Clear filters button', () => {
      renderPanel();
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  describe('trust distance filter', () => {
    it('calls onTrustDistanceChange with "1" when Direct is clicked', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByText('Direct'));
      expect(props.onTrustDistanceChange).toHaveBeenCalledWith('1');
    });

    it('calls onTrustDistanceChange with "2" when 2nd degree is clicked', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByText('2nd degree'));
      expect(props.onTrustDistanceChange).toHaveBeenCalledWith('2');
    });

    it('calls onTrustDistanceChange with "3" when Community is clicked', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByText('Community'));
      expect(props.onTrustDistanceChange).toHaveBeenCalledWith('3');
    });

    it('calls onTrustDistanceChange with "" when trust All is clicked', () => {
      const { props } = renderPanel();
      // First "All" button is the trust distance one
      fireEvent.click(screen.getAllByText('All')[0]);
      expect(props.onTrustDistanceChange).toHaveBeenCalledWith('');
    });
  });

  describe('request type filter', () => {
    it('calls onRequestTypeChange with "ride" when Ride is clicked', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByText('Ride'));
      expect(props.onRequestTypeChange).toHaveBeenCalledWith('ride');
    });

    it('calls onRequestTypeChange with "" when request type All is clicked', () => {
      const { props } = renderPanel();
      // Second "All" button is the request type one
      fireEvent.click(screen.getAllByText('All')[1]);
      expect(props.onRequestTypeChange).toHaveBeenCalledWith('');
    });
  });

  describe('clear filters', () => {
    it('calls onClear when Clear filters is clicked', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByText('Clear filters'));
      expect(props.onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('active filter highlighting', () => {
    it('does not mark any trust option as active when filterTrustDistance is empty', () => {
      renderPanel({ filterTrustDistance: '' });
      // The "All" trust button (value='') should have the active style
      const allTrustButton = screen.getAllByText('All')[0];
      expect(allTrustButton.className).toContain('bg-primary');
    });

    it('highlights Direct when filterTrustDistance is "1"', () => {
      renderPanel({ filterTrustDistance: '1' });
      expect(screen.getByText('Direct').className).toContain('bg-primary');
    });

    it('highlights Ride when filterRequestType is "ride"', () => {
      renderPanel({ filterRequestType: 'ride' });
      expect(screen.getByText('Ride').className).toContain('bg-primary');
    });
  });
});
