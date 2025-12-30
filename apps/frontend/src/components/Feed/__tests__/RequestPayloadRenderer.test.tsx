import React from 'react';
import { render, screen } from '@testing-library/react';
import RequestPayloadRenderer from '../RequestPayloadRenderer';
import {
  TransportationPayload,
  MovingHelpPayload,
  ChildcarePayload,
  TechHelpPayload,
  HomeRepairPayload,
  FoodPayload,
} from '../../../types/request-payloads';

describe('RequestPayloadRenderer', () => {
  describe('Null/Empty States', () => {
    it('renders nothing when payload is null', () => {
      const { container } = render(<RequestPayloadRenderer type="transportation" payload={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when payload is empty object', () => {
      const { container } = render(<RequestPayloadRenderer type="transportation" payload={{} as any} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Transportation Payload', () => {
    const transportationPayload: TransportationPayload = {
      pickup_location: {
        address: '123 Main St',
        city: 'Columbus',
        state: 'OH',
      },
      dropoff_location: {
        address: '456 Oak Ave',
        city: 'Cleveland',
        state: 'OH',
      },
      passengers: 2,
      luggage: 'medium',
      return_trip: true,
    };

    it('renders pickup and dropoff locations', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.getByText('Pickup')).toBeInTheDocument();
      expect(screen.getByText(/123 Main St, Columbus/)).toBeInTheDocument();
      expect(screen.getByText('Dropoff')).toBeInTheDocument();
      expect(screen.getByText(/456 Oak Ave, Cleveland/)).toBeInTheDocument();
    });

    it('renders passenger count', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.getByText(/Passengers:/)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders luggage type', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.getByText(/Luggage:/)).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('renders round trip badge when return_trip is true', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.getByText(/Round trip:/)).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('does not render round trip badge when return_trip is false', () => {
      const payload = { ...transportationPayload, return_trip: false };
      render(<RequestPayloadRenderer type="transportation" payload={payload} />);

      expect(screen.queryByText(/Round trip:/)).not.toBeInTheDocument();
    });
  });

  describe('Moving Help Payload', () => {
    const movingPayload: MovingHelpPayload = {
      current_address: {
        address: '789 Elm St',
        city: 'Columbus',
        state: 'OH',
        floor: 3,
        has_elevator: false,
      },
      new_address: {
        address: '321 Pine Rd',
        city: 'Cleveland',
        state: 'OH',
        floor: 1,
        has_elevator: true,
      },
      distance_miles: 25,
      estimated_duration_hours: 4,
      truck_needed: true,
      heavy_items: true,
      num_helpers_needed: 3,
    };

    it('renders current and new addresses with floor info', () => {
      render(<RequestPayloadRenderer type="moving_help" payload={movingPayload} />);

      expect(screen.getByText(/789 Elm St.*Floor 3.*no elevator/)).toBeInTheDocument();
      expect(screen.getByText(/321 Pine Rd.*Floor 1.*has elevator/)).toBeInTheDocument();
    });

    it('renders distance and duration', () => {
      render(<RequestPayloadRenderer type="moving_help" payload={movingPayload} />);

      expect(screen.getByText(/Distance:/)).toBeInTheDocument();
      expect(screen.getByText('25 miles')).toBeInTheDocument();
      expect(screen.getByText(/Est. duration:/)).toBeInTheDocument();
      expect(screen.getByText('4 hours')).toBeInTheDocument();
    });

    it('renders number of helpers needed', () => {
      render(<RequestPayloadRenderer type="moving_help" payload={movingPayload} />);

      expect(screen.getByText(/Helpers needed:/)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders truck needed badge', () => {
      render(<RequestPayloadRenderer type="moving_help" payload={movingPayload} />);

      expect(screen.getByText(/Truck needed:/)).toBeInTheDocument();
    });

    it('renders heavy items badge', () => {
      render(<RequestPayloadRenderer type="moving_help" payload={movingPayload} />);

      expect(screen.getByText(/Heavy items:/)).toBeInTheDocument();
    });
  });

  describe('Childcare Payload', () => {
    const childcarePayload: ChildcarePayload = {
      children: [
        { age: 5, special_needs: false },
        { age: 8, special_needs: true },
      ],
      location: {
        address: '555 Maple Dr',
        city: 'Columbus',
        state: 'OH',
      },
      duration_hours: 6,
      meal_prep_needed: true,
      homework_help_needed: true,
    };

    it('renders children ages', () => {
      render(<RequestPayloadRenderer type="childcare" payload={childcarePayload} />);

      expect(screen.getByText(/5 years old/)).toBeInTheDocument();
      expect(screen.getByText(/8 years old.*special needs/)).toBeInTheDocument();
    });

    it('renders location', () => {
      render(<RequestPayloadRenderer type="childcare" payload={childcarePayload} />);

      expect(screen.getByText(/555 Maple Dr, Columbus/)).toBeInTheDocument();
    });

    it('renders duration', () => {
      render(<RequestPayloadRenderer type="childcare" payload={childcarePayload} />);

      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText('6 hours')).toBeInTheDocument();
    });

    it('renders meal prep badge when needed', () => {
      render(<RequestPayloadRenderer type="childcare" payload={childcarePayload} />);

      expect(screen.getByText(/Meal prep:/)).toBeInTheDocument();
      expect(screen.getAllByText('Needed').length).toBeGreaterThan(0);
    });

    it('renders homework help badge when needed', () => {
      render(<RequestPayloadRenderer type="childcare" payload={childcarePayload} />);

      expect(screen.getByText(/Homework help:/)).toBeInTheDocument();
      expect(screen.getAllByText('Needed').length).toBeGreaterThan(0);
    });
  });

  describe('Tech Help Payload', () => {
    const techHelpPayload: TechHelpPayload = {
      device_type: 'laptop',
      issue_description: 'slow performance',
      remote_help_acceptable: true,
      urgency_level: 'urgent',
    };

    it('renders device type', () => {
      render(<RequestPayloadRenderer type="tech_help" payload={techHelpPayload} />);

      expect(screen.getByText('Device')).toBeInTheDocument();
      expect(screen.getByText('laptop')).toBeInTheDocument();
    });

    it('renders issue description', () => {
      render(<RequestPayloadRenderer type="tech_help" payload={techHelpPayload} />);

      expect(screen.getByText('Issue')).toBeInTheDocument();
      expect(screen.getByText('slow performance')).toBeInTheDocument();
    });

    it('renders urgency level', () => {
      render(<RequestPayloadRenderer type="tech_help" payload={techHelpPayload} />);

      expect(screen.getByText(/Urgency:/)).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('renders remote OK badge when acceptable', () => {
      render(<RequestPayloadRenderer type="tech_help" payload={techHelpPayload} />);

      expect(screen.getByText(/Remote OK:/)).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('does not render remote OK badge when not acceptable', () => {
      const payload = { ...techHelpPayload, remote_help_acceptable: false };
      render(<RequestPayloadRenderer type="tech_help" payload={payload} />);

      expect(screen.queryByText(/Remote OK:/)).not.toBeInTheDocument();
    });
  });

  describe('Home Repair Payload', () => {
    const homeRepairPayload: HomeRepairPayload = {
      repair_type: 'plumbing',
      location_in_home: 'kitchen',
      tools_available: true,
      materials_needed: true,
      estimated_duration_hours: 3,
    };

    it('renders repair type', () => {
      render(<RequestPayloadRenderer type="home_repair" payload={homeRepairPayload} />);

      expect(screen.getByText('Repair type')).toBeInTheDocument();
      expect(screen.getByText('plumbing')).toBeInTheDocument();
    });

    it('renders location in home', () => {
      render(<RequestPayloadRenderer type="home_repair" payload={homeRepairPayload} />);

      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('kitchen')).toBeInTheDocument();
    });

    it('renders estimated duration', () => {
      render(<RequestPayloadRenderer type="home_repair" payload={homeRepairPayload} />);

      expect(screen.getByText(/Est. duration:/)).toBeInTheDocument();
      expect(screen.getByText('3 hours')).toBeInTheDocument();
    });

    it('renders tools available badge', () => {
      render(<RequestPayloadRenderer type="home_repair" payload={homeRepairPayload} />);

      expect(screen.getByText(/Tools available:/)).toBeInTheDocument();
    });

    it('renders materials needed badge', () => {
      render(<RequestPayloadRenderer type="home_repair" payload={homeRepairPayload} />);

      expect(screen.getByText(/Materials needed:/)).toBeInTheDocument();
    });
  });

  describe('Food Payload', () => {
    const foodPayload: FoodPayload = {
      service_type: 'meal_prep',
      dietary_restrictions: ['vegetarian', 'gluten_free'],
      num_servings: 4,
      budget: '$30-50',
    };

    it('renders service type', () => {
      render(<RequestPayloadRenderer type="food" payload={foodPayload} />);

      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('meal prep')).toBeInTheDocument();
    });

    it('renders number of servings', () => {
      render(<RequestPayloadRenderer type="food" payload={foodPayload} />);

      expect(screen.getByText(/Servings:/)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('renders budget', () => {
      render(<RequestPayloadRenderer type="food" payload={foodPayload} />);

      expect(screen.getByText(/Budget:/)).toBeInTheDocument();
      expect(screen.getByText('$30-50')).toBeInTheDocument();
    });

    it('renders dietary restrictions', () => {
      render(<RequestPayloadRenderer type="food" payload={foodPayload} />);

      expect(screen.getByText(/vegetarian, gluten_free/)).toBeInTheDocument();
    });

    it('does not render dietary restrictions when empty', () => {
      const payload = { ...foodPayload, dietary_restrictions: [] };
      render(<RequestPayloadRenderer type="food" payload={payload} />);

      expect(screen.queryByText(/vegetarian/)).not.toBeInTheDocument();
    });
  });

  describe('Preferred Start Date', () => {
    const transportationPayload: TransportationPayload = {
      pickup_location: { address: '123 Main St', city: 'Columbus', state: 'OH' },
      dropoff_location: { address: '456 Oak Ave', city: 'Cleveland', state: 'OH' },
      passengers: 2,
      luggage: 'medium',
      return_trip: false,
    };

    it('renders preferred date when provided', () => {
      const preferredDate = '2024-12-25T14:30:00Z';
      render(
        <RequestPayloadRenderer
          type="transportation"
          payload={transportationPayload}
          preferredStartDate={preferredDate}
        />
      );

      expect(screen.getByText(/Preferred date:/)).toBeInTheDocument();
    });

    it('does not render preferred date when not provided', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.queryByText(/Preferred date:/)).not.toBeInTheDocument();
    });
  });

  describe('Requirements', () => {
    const transportationPayload: TransportationPayload = {
      pickup_location: { address: '123 Main St', city: 'Columbus', state: 'OH' },
      dropoff_location: { address: '456 Oak Ave', city: 'Cleveland', state: 'OH' },
      passengers: 2,
      luggage: 'medium',
      return_trip: false,
    };

    it('renders requirements when provided', () => {
      const requirements = {
        verified_driver: true,
        background_check: true,
        min_age: 25,
      };

      render(
        <RequestPayloadRenderer type="transportation" payload={transportationPayload} requirements={requirements} />
      );

      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText(/verified driver/i)).toBeInTheDocument();
      expect(screen.getByText(/background check/i)).toBeInTheDocument();
      expect(screen.getByText(/min age: 25/i)).toBeInTheDocument();
    });

    it('does not render requirements when empty', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} requirements={{}} />);

      expect(screen.queryByText('Requirements')).not.toBeInTheDocument();
    });

    it('does not render requirements when not provided', () => {
      render(<RequestPayloadRenderer type="transportation" payload={transportationPayload} />);

      expect(screen.queryByText('Requirements')).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    const transportationPayload: TransportationPayload = {
      pickup_location: { address: '123 Main St', city: 'Columbus', state: 'OH' },
      dropoff_location: { address: '456 Oak Ave', city: 'Cleveland', state: 'OH' },
      passengers: 2,
      luggage: 'medium',
      return_trip: false,
    };

    it('applies custom className', () => {
      const { container } = render(
        <RequestPayloadRenderer
          type="transportation"
          payload={transportationPayload}
          className="my-custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});
