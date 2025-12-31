/**
 * Realistic Data Factory - Generates realistic polymorphic requests
 *
 * Creates varied, natural-looking data:
 * - Realistic names (diverse, international)
 * - Polymorphic request payloads (ride, event, service, question)
 * - Natural community names and descriptions
 * - Realistic request patterns
 */

import { faker } from '@faker-js/faker';

export interface PolymorphicRequestPayload {
  type: 'ride' | 'event' | 'service' | 'question' | 'item';
  title: string;
  description: string;
  payload: any;
}

/**
 * Generate realistic polymorphic request
 */
export function generatePolymorphicRequest(): PolymorphicRequestPayload {
  const type = faker.helpers.arrayElement(['ride', 'event', 'service', 'question', 'item']);

  switch (type) {
    case 'ride':
      return generateRideRequest();
    case 'event':
      return generateEventRequest();
    case 'service':
      return generateServiceRequest();
    case 'question':
      return generateQuestionRequest();
    case 'item':
      return generateItemRequest();
    default:
      return generateServiceRequest();
  }
}

function generateRideRequest(): PolymorphicRequestPayload {
  const origins = ['SFO', 'Downtown', 'Train Station', 'Hospital', 'Airport'];
  const destinations = ['Home', 'Work', 'Grocery Store', 'Doctor Appointment', 'School'];

  const origin = faker.helpers.arrayElement(origins);
  const destination = faker.helpers.arrayElement(destinations);
  const seats = faker.number.int({ min: 1, max: 4 });
  const departureTime = faker.date.future();

  return {
    type: 'ride',
    title: `Need a ride from ${origin} to ${destination}`,
    description: `Looking for a ride for ${seats} ${seats === 1 ? 'person' : 'people'}`,
    payload: {
      origin: { address: origin, lat: 37.7749, lng: -122.4194 },
      destination: { address: destination, lat: 37.7849, lng: -122.4094 },
      departure_time: departureTime.toISOString(),
      seats_needed: seats
    }
  };
}

function generateEventRequest(): PolymorphicRequestPayload {
  const events = [
    { name: 'Hiking at Mt. Tam', location: 'Mt. Tamalpais' },
    { name: 'Coffee and Chat', location: 'Local Cafe' },
    { name: 'Board Game Night', location: 'Community Center' },
    { name: 'Farmers Market', location: 'Downtown Market' },
    { name: 'Park Cleanup', location: 'City Park' }
  ];

  const event = faker.helpers.arrayElement(events);
  const eventTime = faker.date.future();

  return {
    type: 'event',
    title: `Join me for ${event.name}`,
    description: `Would love some company! Happening ${eventTime.toLocaleDateString()}`,
    payload: {
      event_time: eventTime.toISOString(),
      location: { address: event.location, lat: 37.7749, lng: -122.4194 },
      max_participants: faker.number.int({ min: 2, max: 10 })
    }
  };
}

function generateServiceRequest(): PolymorphicRequestPayload {
  const services = [
    'help moving furniture',
    'yard work assistance',
    'computer repair help',
    'ride to airport',
    'babysitting for 2 hours',
    'dog walking',
    'meal prep help',
    'tutoring in math',
    'language practice (Spanish)',
    'guitar lesson'
  ];

  const service = faker.helpers.arrayElement(services);
  const skills = ['physical labor', 'tech skills', 'teaching', 'childcare', 'pet care', 'cooking'];

  return {
    type: 'service',
    title: `Need ${service}`,
    description: faker.lorem.sentence(),
    payload: {
      skills_needed: [faker.helpers.arrayElement(skills)],
      estimated_duration_hours: faker.number.int({ min: 1, max: 8 }),
      urgency: faker.helpers.arrayElement(['low', 'medium', 'high'])
    }
  };
}

function generateQuestionRequest(): PolymorphicRequestPayload {
  const questions = [
    'How do I fix a leaky faucet?',
    'What are good schools in the area?',
    'Recommendations for a plumber?',
    'Best places to buy fresh produce?',
    'Anyone know a good mechanic?',
    'Tips for first-time gardening?'
  ];

  const question = faker.helpers.arrayElement(questions);
  const categories = ['home', 'local', 'advice', 'recommendations'];

  return {
    type: 'question',
    title: question,
    description: 'Would appreciate any advice or recommendations!',
    payload: {
      category: faker.helpers.arrayElement(categories),
      accepts_multiple_answers: true
    }
  };
}

function generateItemRequest(): PolymorphicRequestPayload {
  const items = [
    { name: 'ladder', duration: 2 },
    { name: 'power drill', duration: 1 },
    { name: 'folding table', duration: 3 },
    { name: 'camping gear', duration: 7 },
    { name: 'bike rack', duration: 2 }
  ];

  const item = faker.helpers.arrayElement(items);

  return {
    type: 'item',
    title: `Can I borrow a ${item.name}?`,
    description: `Need it for a few days, will return in good condition`,
    payload: {
      item_name: item.name,
      borrow_duration_days: item.duration,
      willing_to_pay_deposit: faker.datatype.boolean()
    }
  };
}

/**
 * Generate realistic community name
 */
export function generateCommunityName(): string {
  const types = [
    // Geographic
    () => `${faker.location.city()} Neighbors`,
    () => `${faker.location.county()} Mutual Aid`,
    () => `${faker.location.street()} Community`,

    // Interest-based
    () => `${faker.helpers.arrayElement(['Tech', 'Art', 'Music', 'Book', 'Garden', 'Food'])} Lovers`,
    () => `${faker.helpers.arrayElement(['Yoga', 'Running', 'Cycling', 'Hiking'])} Group`,

    // Demographics
    () => `${faker.helpers.arrayElement(['Parents', 'Students', 'Professionals', 'Seniors'])} Network`,

    // Purpose
    () => `${faker.helpers.arrayElement(['Skill', 'Tool', 'Time', 'Resource'])} Share`,
    () => `${faker.helpers.arrayElement(['Care', 'Help', 'Support', 'Connection'])} Circle`
  ];

  return faker.helpers.arrayElement(types)();
}

/**
 * Generate realistic user name (diverse)
 */
export function generateRealisticName(): { firstName: string; lastName: string; fullName: string } {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`
  };
}

/**
 * Get activity level based on user index (power law distribution)
 */
export function getActivityLevel(
  index: number,
  total: number
): 'very_active' | 'active' | 'moderate' | 'occasional' {
  const percentile = index / total;

  if (percentile < 0.05) return 'very_active';  // 5% very active
  if (percentile < 0.25) return 'active';       // 20% active
  if (percentile < 0.70) return 'moderate';     // 45% moderate
  return 'occasional';                          // 30% occasional
}

/**
 * Get number of requests based on activity level
 */
export function getRequestsForActivityLevel(level: string): number {
  switch (level) {
    case 'very_active':
      return faker.number.int({ min: 15, max: 30 });
    case 'active':
      return faker.number.int({ min: 8, max: 15 });
    case 'moderate':
      return faker.number.int({ min: 3, max: 8 });
    case 'occasional':
      return faker.number.int({ min: 0, max: 3 });
    default:
      return 2;
  }
}

/**
 * Generate realistic community categories
 */
export function getCommunityCategory(): string {
  return faker.helpers.arrayElement([
    'neighborhood',
    'interest',
    'skill-share',
    'parents',
    'students',
    'professionals',
    'hobbies',
    'wellness'
  ]);
}

/**
 * Generate realistic community locations
 */
export function getCommunityLocation(): string {
  return faker.helpers.arrayElement([
    faker.location.city(),
    `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    faker.location.county(),
    `${faker.location.street()}, ${faker.location.city()}`
  ]);
}
