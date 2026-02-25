import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FulfillmentPanel from '../../src/components/FulfillmentPanel';

const ridePayload = {
  origin: { lat: 37.7749, lng: -122.4194, address: '123 Main St, San Francisco, CA' },
  destination: { lat: 37.3382, lng: -121.8863, address: '456 Oak Ave, San Jose, CA' },
  departure_time: '2026-03-01T15:00:00Z',
};

describe('FulfillmentPanel', () => {
  describe('Non-ride types', () => {
    it('renders a generic accepted message for non-ride types', () => {
      render(
        <FulfillmentPanel requestType="service" payload={{ description: 'Help moving boxes' }} />
      );
      expect(screen.getByText(/accepted/i)).toBeInTheDocument();
      expect(screen.queryByText(/Add to Calendar/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Get Directions/i)).not.toBeInTheDocument();
    });

    it('renders generic message for generic type', () => {
      render(<FulfillmentPanel requestType="generic" payload={{}} />);
      expect(screen.getByText(/reminder/i)).toBeInTheDocument();
    });
  });

  describe('Ride type — calendar button', () => {
    it('renders Add to Calendar button for ride type', () => {
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          scheduledAt="2026-03-01T15:00:00Z"
          requestTitle="Ride to SFO"
        />
      );
      const calBtn = screen.getByText(/Add to Calendar/i);
      expect(calBtn).toBeInTheDocument();
    });

    it('calendar URL contains event title', () => {
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          scheduledAt="2026-03-01T15:00:00Z"
          requestTitle="Ride to SFO"
        />
      );
      const link = screen.getByText(/Add to Calendar/i).closest('a');
      expect(link?.href).toContain('calendar.google.com');
      expect(link?.href).toContain('Ride%3A+Ride+to+SFO');
    });

    it('calendar URL contains formatted start date', () => {
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          scheduledAt="2026-03-01T15:00:00Z"
          requestTitle="Airport Ride"
        />
      );
      const link = screen.getByText(/Add to Calendar/i).closest('a');
      // YYYYMMDDTHHmmssZ format → 20260301T150000Z
      expect(link?.href).toContain('20260301T150000Z');
    });

    it('uses departure_time from payload when scheduledAt not provided', () => {
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          requestTitle="Airport Ride"
        />
      );
      const link = screen.getByText(/Add to Calendar/i).closest('a');
      expect(link?.href).toContain('20260301T150000Z');
    });
  });

  describe('Ride type — maps button', () => {
    it('renders Get Directions button for ride type with destination', () => {
      render(<FulfillmentPanel requestType="ride" payload={ridePayload} />);
      expect(screen.getByText(/Get Directions/i)).toBeInTheDocument();
    });

    it('maps URL uses destination lat/lng', () => {
      render(<FulfillmentPanel requestType="ride" payload={ridePayload} />);
      const link = screen.getByText(/Get Directions/i).closest('a');
      expect(link?.href).toContain('google.com/maps');
      expect(link?.href).toContain('37.3382');
      expect(link?.href).toContain('-121.8863');
    });

    it('maps URL includes origin lat/lng as waypoint', () => {
      render(<FulfillmentPanel requestType="ride" payload={ridePayload} />);
      const link = screen.getByText(/Get Directions/i).closest('a');
      expect(link?.href).toContain('waypoints=37.7749%2C-122.4194');
    });

    it('maps URL sets travelmode to driving', () => {
      render(<FulfillmentPanel requestType="ride" payload={ridePayload} />);
      const link = screen.getByText(/Get Directions/i).closest('a');
      expect(link?.href).toContain('travelmode=driving');
    });

    it('does not render maps button when destination is missing', () => {
      const noDestPayload = { origin: ridePayload.origin, departure_time: '2026-03-01T15:00:00Z' };
      render(<FulfillmentPanel requestType="ride" payload={noDestPayload} />);
      expect(screen.queryByText(/Get Directions/i)).not.toBeInTheDocument();
    });
  });

  describe('Departure time display', () => {
    it('renders departure time when scheduledAt is provided', () => {
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          scheduledAt="2026-03-01T15:00:00Z"
        />
      );
      expect(screen.getByText(/Departure:/i)).toBeInTheDocument();
    });

    it('does not render departure time when neither scheduledAt nor departure_time exists', () => {
      const noTimePayload = { origin: ridePayload.origin, destination: ridePayload.destination };
      render(<FulfillmentPanel requestType="ride" payload={noTimePayload} />);
      expect(screen.queryByText(/Departure:/i)).not.toBeInTheDocument();
    });
  });

  describe('Travel time selector', () => {
    it('renders travel time options when onTravelTimeChange provided', () => {
      const onChange = jest.fn();
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          onTravelTimeChange={onChange}
        />
      );
      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('1 hr')).toBeInTheDocument();
      expect(screen.getByText('2 hr')).toBeInTheDocument();
    });

    it('calls onTravelTimeChange when a travel time is selected', () => {
      const onChange = jest.fn();
      render(
        <FulfillmentPanel
          requestType="ride"
          payload={ridePayload}
          onTravelTimeChange={onChange}
        />
      );
      fireEvent.click(screen.getByText('30 min'));
      expect(onChange).toHaveBeenCalledWith(30);
    });

    it('does not render travel time selector when onTravelTimeChange not provided', () => {
      render(<FulfillmentPanel requestType="ride" payload={ridePayload} />);
      expect(screen.queryByText('15 min')).not.toBeInTheDocument();
    });
  });

  describe('Null/empty payload handling', () => {
    it('does not crash with empty payload for ride type', () => {
      expect(() =>
        render(<FulfillmentPanel requestType="ride" payload={{}} />)
      ).not.toThrow();
    });

    it('does not crash with null-like values in payload', () => {
      const partialPayload = { origin: null, destination: null, departure_time: null };
      expect(() =>
        render(<FulfillmentPanel requestType="ride" payload={partialPayload} />)
      ).not.toThrow();
    });
  });
});
