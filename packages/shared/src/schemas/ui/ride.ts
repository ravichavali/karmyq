import { UISchema } from './types';

export const rideUISchema: UISchema = {
  type: 'ride',
  version: 1,
  label: 'Ride Share',
  icon: '🚗',
  color: 'blue',
  description: 'Request a ride from community members',
  sections: [
    {
      id: 'trip',
      title: 'Trip Details',
      icon: '🚗',
      color: 'blue',
      fields: [
        {
          key: 'origin',
          type: 'location',
          label: 'Pick-up Location',
          required: true,
          placeholder: 'Where should you be picked up?',
        },
        {
          key: 'destination',
          type: 'location',
          label: 'Destination',
          required: true,
          placeholder: 'Where are you going?',
        },
        {
          key: 'seats_needed',
          type: 'select',
          label: 'Number of Seats Needed',
          required: true,
          defaultValue: '1',
          options: [1, 2, 3, 4, 5, 6].map((n) => ({
            value: String(n),
            label: `${n} ${n === 1 ? 'seat' : 'seats'}`,
          })),
        },
        {
          key: 'departure_time',
          type: 'datetime',
          label: 'Departure Time',
          required: true,
          helpText: 'When do you need to depart?',
        },
      ],
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'Optional ride preferences',
      fields: [
        {
          key: 'preferences.women_only',
          type: 'checkbox',
          label: 'Women-only ride',
          required: false,
          helpText: 'Prefer female driver/passengers only',
        },
        {
          key: 'preferences.pet_friendly',
          type: 'checkbox',
          label: 'Pet-friendly',
          required: false,
          helpText: 'Traveling with a pet',
        },
        {
          key: 'preferences.wheelchair_accessible',
          type: 'checkbox',
          label: 'Wheelchair accessible',
          required: false,
          helpText: 'Need wheelchair-accessible vehicle',
        },
      ],
    },
  ],
  summary: {
    fields: ['origin', 'destination', 'departure_time', 'seats_needed'],
    labels: {
      origin: 'From',
      destination: 'To',
      departure_time: 'When',
      seats_needed: 'Seats',
    },
  },
};
