/**
 * Realistic Data Factory - Generates realistic polymorphic requests
 *
 * Creates varied, natural-looking data:
 * - Realistic names (diverse, international)
 * - Polymorphic request payloads matching Zod schemas exactly
 * - Natural community names and descriptions
 * - Realistic request patterns
 */

import { faker } from '@faker-js/faker';

export type RequestType = 'generic' | 'ride' | 'service' | 'event' | 'borrow';

export interface PolymorphicRequestPayload {
  type: RequestType;
  title: string;
  description: string;
  payload: Record<string, any>;
}

/**
 * Generate realistic polymorphic request with Zod-valid payloads
 */
export function generatePolymorphicRequest(): PolymorphicRequestPayload {
  const type = faker.helpers.weightedArrayElement<RequestType>([
    { value: 'generic', weight: 2 },
    { value: 'ride', weight: 3 },
    { value: 'service', weight: 3 },
    { value: 'event', weight: 1 },
    { value: 'borrow', weight: 2 },
  ]);

  switch (type) {
    case 'ride':
      return generateRideRequest();
    case 'event':
      return generateEventRequest();
    case 'service':
      return generateServiceRequest();
    case 'borrow':
      return generateBorrowRequest();
    case 'generic':
    default:
      return generateGenericRequest();
  }
}

function generateGenericRequest(): PolymorphicRequestPayload {
  const requests = [
    { title: 'How do I fix a leaky faucet?', description: 'Would appreciate any advice or recommendations from someone who has dealt with this!' },
    { title: 'What are good schools in the area?', description: 'Just moved here and looking for elementary school recommendations for my kids.' },
    { title: 'Recommendations for a plumber?', description: 'Need a reliable plumber for some bathroom work. Reasonable pricing preferred.' },
    { title: 'Best places to buy fresh produce?', description: 'Looking for farmers markets or local stores with good quality produce.' },
    { title: 'Anyone know a good mechanic?', description: 'My car is making strange noises and I need a trustworthy mechanic.' },
    { title: 'Tips for first-time gardening?', description: 'Starting a garden this spring and would love advice from experienced gardeners.' },
    { title: 'Looking for walking buddy', description: 'Want to start a regular walking routine, looking for someone to walk with in the mornings.' },
    { title: 'Advice on local internet providers', description: 'Moving to the area and need recommendations for reliable internet service.' },
  ];

  const req = faker.helpers.arrayElement(requests);
  return {
    type: 'generic',
    title: req.title,
    description: req.description,
    payload: {},
  };
}

/**
 * Ride request - matches RidePayloadSchema exactly
 * Required: origin (LocationSchema), destination (LocationSchema), seats_needed (1-10), departure_time (ISO datetime)
 * Optional: preferences { women_only?, pet_friendly?, wheelchair_accessible? }
 */
function generateRideRequest(): PolymorphicRequestPayload {
  const routes = [
    { origin: 'SFO Airport Terminal 2', destination: 'Downtown San Francisco' },
    { origin: 'Central Train Station', destination: 'Westside Medical Center' },
    { origin: 'University Campus', destination: 'Grocery Store on Main St' },
    { origin: 'Oak Park Apartments', destination: 'Tech Campus Building 4' },
    { origin: 'Sunrise Retirement Home', destination: 'City General Hospital' },
    { origin: 'Maple Street Elementary', destination: 'Sports Complex East' },
    { origin: 'Harbor View Mall', destination: 'Lakewood Community Center' },
    { origin: 'Pine Ridge Neighborhood', destination: 'International Airport' },
  ];

  const route = faker.helpers.arrayElement(routes);
  const seats = faker.number.int({ min: 1, max: 4 });
  const departureTime = faker.date.future({ years: 0.25 });

  const payload: Record<string, any> = {
    origin: {
      address: route.origin,
      lat: parseFloat((37.7 + faker.number.float({ min: 0, max: 0.15 })).toFixed(6)),
      lng: parseFloat((-122.5 + faker.number.float({ min: 0, max: 0.2 })).toFixed(6)),
    },
    destination: {
      address: route.destination,
      lat: parseFloat((37.7 + faker.number.float({ min: 0, max: 0.15 })).toFixed(6)),
      lng: parseFloat((-122.5 + faker.number.float({ min: 0, max: 0.2 })).toFixed(6)),
    },
    departure_time: departureTime.toISOString(),
    seats_needed: seats,
  };

  // 40% chance of adding preferences
  if (faker.datatype.boolean(0.4)) {
    payload.preferences = {};
    if (faker.datatype.boolean(0.2)) payload.preferences.women_only = true;
    if (faker.datatype.boolean(0.15)) payload.preferences.pet_friendly = true;
    if (faker.datatype.boolean(0.1)) payload.preferences.wheelchair_accessible = true;
  }

  return {
    type: 'ride',
    title: `Need a ride from ${route.origin} to ${route.destination}`,
    description: `Looking for a ride for ${seats} ${seats === 1 ? 'person' : 'people'} on ${departureTime.toLocaleDateString()}`,
    payload,
  };
}

/**
 * Service request - matches ServicePayloadSchema exactly
 * Required: service_category (enum of 15 values)
 * Optional: skill_level_required, estimated_duration_hours, budget_range, preferred_schedule, location_type, certifications_required
 */
function generateServiceRequest(): PolymorphicRequestPayload {
  const categories = [
    'plumbing', 'electrical', 'carpentry', 'tutoring', 'consulting',
    'repair', 'cleaning', 'gardening', 'pet_care', 'childcare',
    'elder_care', 'tech_support', 'legal', 'financial', 'other'
  ] as const;

  const categoryDescriptions: Record<string, { titles: string[]; descriptions: string[] }> = {
    plumbing: {
      titles: ['Need plumber for kitchen sink', 'Bathroom pipe leaking', 'Faucet replacement needed'],
      descriptions: ['The kitchen sink has been dripping for a week', 'Water pressure issue in the bathroom', 'Old faucet needs replacing with a modern one'],
    },
    tutoring: {
      titles: ['Math tutor for high school student', 'Spanish language lessons', 'SAT prep help needed'],
      descriptions: ['Looking for weekly algebra and geometry help', 'Want to learn conversational Spanish', 'Need structured SAT preparation program'],
    },
    cleaning: {
      titles: ['Deep clean before move-out', 'Weekly house cleaning', 'Post-renovation cleanup'],
      descriptions: ['Moving out and need thorough cleaning', 'Looking for regular weekly cleaning service', 'Dust and debris from renovation work'],
    },
    gardening: {
      titles: ['Spring garden prep help', 'Tree trimming needed', 'Lawn care and landscaping'],
      descriptions: ['Need help preparing garden beds for planting', 'Several trees need professional trimming', 'Regular lawn maintenance and garden design'],
    },
    tech_support: {
      titles: ['WiFi network setup', 'Computer running slowly', 'Smart home setup help'],
      descriptions: ['Need help setting up mesh WiFi system', 'Laptop needs cleanup and optimization', 'Want to set up smart lights and thermostat'],
    },
    pet_care: {
      titles: ['Dog walking needed weekdays', 'Pet sitting for vacation', 'Help with new puppy training'],
      descriptions: ['Need daily walks for my golden retriever', 'Going on vacation for 10 days, need reliable pet sitter', 'New puppy needs basic obedience training'],
    },
  };

  const category = faker.helpers.arrayElement([...categories]);
  const catInfo = categoryDescriptions[category] || {
    titles: [`Need help with ${category.replace('_', ' ')}`],
    descriptions: [`Looking for someone skilled in ${category.replace('_', ' ')}`],
  };

  const payload: Record<string, any> = {
    service_category: category,
    location_type: faker.helpers.arrayElement(['remote', 'on_site', 'hybrid']),
  };

  // 60% chance of skill level
  if (faker.datatype.boolean(0.6)) {
    payload.skill_level_required = faker.helpers.arrayElement(['beginner', 'intermediate', 'expert']);
  }

  // 50% chance of duration
  if (faker.datatype.boolean(0.5)) {
    payload.estimated_duration_hours = faker.number.float({ min: 0.5, max: 8, multipleOf: 0.5 });
  }

  // 40% chance of budget
  if (faker.datatype.boolean(0.4)) {
    const min = faker.number.int({ min: 20, max: 100 });
    payload.budget_range = {
      min,
      max: min + faker.number.int({ min: 20, max: 200 }),
      currency: 'USD',
    };
  }

  // 30% chance of schedule preference
  if (faker.datatype.boolean(0.3)) {
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    payload.preferred_schedule = {
      days: faker.helpers.arrayElements([...allDays], { min: 1, max: 3 }),
      time_of_day: faker.helpers.arrayElement(['morning', 'afternoon', 'evening', 'flexible']),
    };
  }

  return {
    type: 'service',
    title: faker.helpers.arrayElement(catInfo.titles),
    description: faker.helpers.arrayElement(catInfo.descriptions),
    payload,
  };
}

/**
 * Event request - matches EventPayloadSchema exactly
 * Required: event_type (enum), event_date (ISO datetime), event_duration_hours (0.5-24), location, participants_needed (1-1000)
 * Optional: roles, requirements, recurring
 */
function generateEventRequest(): PolymorphicRequestPayload {
  const eventTypes = [
    'volunteer', 'community_cleanup', 'fundraiser', 'workshop',
    'meetup', 'sports', 'cultural', 'educational', 'social', 'other'
  ] as const;

  const eventTemplates: Record<string, { titles: string[]; addresses: string[] }> = {
    volunteer: {
      titles: ['Volunteers needed for food bank', 'Help at the animal shelter', 'Community garden volunteers'],
      addresses: ['Food Bank on 5th Ave', 'City Animal Shelter', 'Community Garden Plot B'],
    },
    community_cleanup: {
      titles: ['Park cleanup day', 'Beach cleanup event', 'Neighborhood street cleanup'],
      addresses: ['Central Park Pavilion', 'Ocean Beach Parking Lot', 'Main Street Meeting Point'],
    },
    workshop: {
      titles: ['Woodworking basics workshop', 'First aid certification class', 'Financial literacy seminar'],
      addresses: ['Community Center Room 4', 'Red Cross Training Center', 'Library Conference Room'],
    },
    meetup: {
      titles: ['Coffee and chat for newcomers', 'Board game night', 'Photography walk group'],
      addresses: ['Blue Bottle Coffee downtown', 'Community Center Hall', 'Golden Gate Park entrance'],
    },
    sports: {
      titles: ['Pickup basketball game', 'Community soccer match', 'Morning yoga in the park'],
      addresses: ['Lincoln Park Courts', 'Civic Center Soccer Field', 'Dolores Park lawn area'],
    },
  };

  const eventType = faker.helpers.arrayElement([...eventTypes]);
  const template = eventTemplates[eventType] || {
    titles: [`${eventType.replace('_', ' ')} gathering`],
    addresses: ['Community Center'],
  };

  const eventDate = faker.date.future({ years: 0.25 });
  const isVirtual = faker.datatype.boolean(0.2);

  const payload: Record<string, any> = {
    event_type: eventType,
    event_date: eventDate.toISOString(),
    event_duration_hours: faker.helpers.arrayElement([1, 2, 3, 4, 6, 8]),
    location: {
      address: isVirtual ? 'Online' : faker.helpers.arrayElement(template.addresses),
      is_virtual: isVirtual,
      ...(isVirtual ? { virtual_link: 'https://zoom.us/j/' + faker.string.numeric(10) } : {
        lat: parseFloat((37.7 + faker.number.float({ min: 0, max: 0.15 })).toFixed(6)),
        lng: parseFloat((-122.5 + faker.number.float({ min: 0, max: 0.2 })).toFixed(6)),
      }),
    },
    participants_needed: faker.number.int({ min: 2, max: 50 }),
  };

  // 30% chance of roles
  if (faker.datatype.boolean(0.3)) {
    payload.roles = [
      { role_name: 'Organizer', count: 1, description: 'Help coordinate the event' },
      { role_name: 'Volunteer', count: faker.number.int({ min: 2, max: 10 }) },
    ];
  }

  // 20% chance of requirements
  if (faker.datatype.boolean(0.2)) {
    payload.requirements = {
      age_minimum: faker.helpers.arrayElement([0, 16, 18, 21]),
      background_check: faker.datatype.boolean(0.3),
    };
  }

  return {
    type: 'event',
    title: faker.helpers.arrayElement(template.titles),
    description: `Join us on ${eventDate.toLocaleDateString()} for this community ${eventType.replace('_', ' ')} event!`,
    payload,
  };
}

/**
 * Borrow request - matches BorrowPayloadSchema exactly
 * Required: item_category (enum of 8 values), duration_days (1-30)
 * Optional: condition_min, images, return_date
 */
function generateBorrowRequest(): PolymorphicRequestPayload {
  const categories = ['tools', 'electronics', 'kitchen', 'books', 'sports', 'camping', 'party', 'other'] as const;

  const itemsByCategory: Record<string, string[]> = {
    tools: ['power drill', 'circular saw', 'ladder', 'pressure washer', 'nail gun', 'sander'],
    electronics: ['projector', 'speaker system', 'camera', 'laptop', 'external monitor'],
    kitchen: ['stand mixer', 'food processor', 'waffle maker', 'large cooler', 'chafing dishes'],
    books: ['textbook set', 'reference manual', 'cookbook collection', 'novel series'],
    sports: ['bicycle', 'surfboard', 'camping tent', 'kayak', 'ski gear'],
    camping: ['tent', 'sleeping bags', 'camp stove', 'cooler', 'hiking poles'],
    party: ['folding tables', 'chairs set', 'canopy tent', 'string lights', 'punchbowl set'],
    other: ['folding cart', 'storage bins', 'hand truck', 'step stool'],
  };

  const category = faker.helpers.arrayElement([...categories]);
  const items = itemsByCategory[category] || ['item'];
  const item = faker.helpers.arrayElement(items);
  const duration = faker.number.int({ min: 1, max: 14 });

  const payload: Record<string, any> = {
    item_category: category,
    duration_days: duration,
  };

  // 50% chance of condition preference
  if (faker.datatype.boolean(0.5)) {
    payload.condition_min = faker.helpers.arrayElement(['fair', 'good', 'like_new', 'new']);
  }

  // 30% chance of return date
  if (faker.datatype.boolean(0.3)) {
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + duration);
    payload.return_date = returnDate.toISOString();
  }

  return {
    type: 'borrow',
    title: `Can I borrow a ${item}?`,
    description: `Need it for about ${duration} days. Will return in good condition. Happy to leave a deposit if needed.`,
    payload,
  };
}

/**
 * Generate realistic community name
 */
export function generateCommunityName(): string {
  const types = [
    () => `${faker.location.city()} Neighbors`,
    () => `${faker.location.county()} Mutual Aid`,
    () => `${faker.location.street()} Community`,
    () => `${faker.helpers.arrayElement(['Tech', 'Art', 'Music', 'Book', 'Garden', 'Food'])} Lovers`,
    () => `${faker.helpers.arrayElement(['Yoga', 'Running', 'Cycling', 'Hiking'])} Group`,
    () => `${faker.helpers.arrayElement(['Parents', 'Students', 'Professionals', 'Seniors'])} Network`,
    () => `${faker.helpers.arrayElement(['Skill', 'Tool', 'Time', 'Resource'])} Share`,
    () => `${faker.helpers.arrayElement(['Care', 'Help', 'Support', 'Connection'])} Circle`,
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
    fullName: `${firstName} ${lastName}`,
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

  if (percentile < 0.05) return 'very_active';
  if (percentile < 0.25) return 'active';
  if (percentile < 0.70) return 'moderate';
  return 'occasional';
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
    'wellness',
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
    `${faker.location.street()}, ${faker.location.city()}`,
  ]);
}
