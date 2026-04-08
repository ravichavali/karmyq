/**
 * Realistic data generators for all 5 polymorphic request types
 * Generates diverse, correlated demo data for the simulation service
 */

import { pickRandom, randomInt } from '../utils';

// ============================================================================
// Name Data
// ============================================================================

export const FIRST_NAMES = [
  'Maria', 'James', 'Priya', 'Wei', 'Fatima',
  'Carlos', 'Aisha', 'Liam', 'Yuki', 'Sarah',
  'Mohamed', 'Elena', 'David', 'Mei', 'Omar',
  'Sofia', 'Raj', 'Nadia', 'Lucas', 'Hannah',
  'Kwame', 'Isabella', 'Chen', 'Amara', 'Ethan',
  'Leila', 'Takeshi', 'Zara', 'Andre', 'Ingrid'
];

export const LAST_NAMES = [
  'Chen', 'Rodriguez', 'Patel', 'Kim', 'Okafor',
  'Mueller', 'Singh', 'Tanaka', 'Santos', 'Williams',
  'Ahmed', 'Thompson', 'Liu', 'Garcia', 'Nakamura',
  'Martinez', 'Sato', 'Brown', 'Ali', 'Johansson',
  'Nguyen', 'Davis', 'Hernandez', 'Park', 'Wilson',
  'Kumar', 'White', 'Zhao', 'Lopez', 'Anderson'
];

// ============================================================================
// Community Templates
// ============================================================================

export const COMMUNITIES = [
  {
    name: 'Portland Mutual Aid Network',
    description: 'A grassroots community helping neighbors in the Portland metro area with everyday needs.',
    location: 'Portland, OR',
    category: 'mutual_aid'
  },
  {
    name: 'Southeast PDX Helpers',
    description: 'Neighbors helping neighbors in Southeast Portland - from Hawthorne to Foster-Powell.',
    location: 'SE Portland, OR',
    category: 'neighborhood'
  },
  {
    name: 'PDX Parents Co-op',
    description: 'Portland parents sharing childcare, school pickups, and family resources.',
    location: 'Portland, OR',
    category: 'family'
  },
  {
    name: 'Portland Tool Library & Share',
    description: 'Borrow tools, share skills, and help with DIY projects across Portland.',
    location: 'Portland, OR',
    category: 'sharing'
  },
  {
    name: 'PDX Service Providers Network',
    description: 'Portland-area skilled helpers offering rides, repairs, tutoring, and care services to the community.',
    location: 'Portland, OR',
    category: 'professional'
  },
  {
    name: 'PDX Rides Collective',
    description: 'Portland drivers offering affordable rides to neighbors, airport runs, and medical appointments.',
    location: 'Portland, OR',
    category: 'professional'
  },
  {
    name: 'PDX Home Repair & Trades',
    description: 'Local handypeople, electricians, plumbers, and general contractors serving the Portland area.',
    location: 'Portland, OR',
    category: 'professional'
  },
  {
    name: 'Portland Tutors Network',
    description: 'Teachers, tutors, and educators offering academic support, test prep, and skill workshops.',
    location: 'Portland, OR',
    category: 'professional'
  },
  {
    name: 'Northeast PDX Community Circle',
    description: 'Neighbors in NE Portland helping with everyday tasks, errands, and community events.',
    location: 'NE Portland, OR',
    category: 'neighborhood'
  }
];

export const GROUP_COMMUNITIES = [
  {
    name: 'Portland Pickup Basketball Crew',
    description: 'Weekly pickup games at Laurelhurst Park. All skill levels welcome — just bring yourself and some water.',
    location: 'Portland, OR',
    category: 'sports',
    community_type: 'group',
    defaultActivityType: 'pickup_game',
  },
  {
    name: 'SE Portland Running Club',
    description: 'Group runs every Tuesday morning and Saturday afternoon. Routes vary from 3K to 10K.',
    location: 'Portland, OR',
    category: 'fitness',
    community_type: 'group',
    defaultActivityType: 'group_run',
  },
  {
    name: 'Hawthorne Yoga Collective',
    description: 'Community yoga sessions in Sewallcrest Park. Free, donation-based, all levels.',
    location: 'Portland, OR',
    category: 'wellness',
    community_type: 'group',
    defaultActivityType: 'workout',
  },
  {
    name: 'Portland Board Game Society',
    description: 'Weekly board game nights at rotating locations. From gateway games to heavy euros.',
    location: 'Portland, OR',
    category: 'social',
    community_type: 'group',
    defaultActivityType: 'social',
  },
];

export const ACTIVITY_TEMPLATES: Record<string, Array<{title: string, description: string, duration_minutes: number}>> = {
  pickup_game: [
    { title: 'Saturday Pickup Basketball', description: '5v5 at the park, all skill levels welcome', duration_minutes: 90 },
    { title: 'Sunday Morning Hoops', description: 'Casual run — show up and play', duration_minutes: 60 },
  ],
  group_run: [
    { title: 'Tuesday Morning Run', description: '5K loop around the park. Meet at the fountain.', duration_minutes: 45 },
    { title: 'Saturday Long Run', description: '8-10K depending on group pace. Coffee after!', duration_minutes: 75 },
  ],
  workout: [
    { title: 'Sunday Morning Yoga', description: 'All levels. Bring a mat if you have one.', duration_minutes: 60 },
    { title: 'Midweek Flow', description: 'Gentle 45-minute session, donations welcome', duration_minutes: 45 },
  ],
  social: [
    { title: 'Weekly Game Night', description: 'We have a mix of games — come and play whatever sounds fun', duration_minutes: 180 },
    { title: 'Strategy Saturday', description: 'Heavier games this week: Brass, Wingspan, or GMT games', duration_minutes: 240 },
  ],
};

export const FOUNDERS = [
  { firstName: 'Maria', lastName: 'Reyes', bio: 'Community organizer and mutual aid advocate in SE Portland.' },
  { firstName: 'James', lastName: 'Okafor', bio: 'Longtime Northeast Portland resident focused on neighbor connections.' },
  { firstName: 'Priya', lastName: 'Sharma', bio: 'Educator and community builder in the Portland school system.' },
  { firstName: 'Wei', lastName: 'Zhang', bio: 'Local small business owner who believes in neighborhood economies.' },
  { firstName: 'Fatima', lastName: 'Alhassan', bio: 'Social worker helping connect underserved Portland communities.' }
];

// ============================================================================
// Generic Requests
// ============================================================================

export const GENERIC_REQUESTS = [
  { title: 'Need help moving furniture this weekend', description: 'Moving a couch and bookshelf from my apartment to a new place about 10 minutes away. Could use an extra pair of hands!', urgency: 'medium' },
  { title: 'Grocery pickup for elderly neighbor', description: 'My neighbor Mrs. Johnson is recovering from surgery and needs someone to pick up her grocery order from Fred Meyer on Hawthorne.', urgency: 'high' },
  { title: 'Dog walking help while I recover', description: 'Sprained my ankle and my golden retriever still needs his daily walks. About 30 minutes around the neighborhood.', urgency: 'medium' },
  { title: 'Need someone to help assemble IKEA furniture', description: 'Just got a new desk and wardrobe from IKEA. The instructions are confusing - would love help from someone handy!', urgency: 'low' },
  { title: 'Looking for someone to water my plants', description: 'Going on vacation for a week and need someone to water my indoor plants every other day. I have about 15 plants.', urgency: 'low' },
  { title: 'Help needed sorting donations for shelter', description: 'Volunteering at the downtown shelter this Saturday. Need 2-3 people to help sort clothing and household donations.', urgency: 'medium' },
  { title: 'Need help with yard cleanup after storm', description: 'The windstorm knocked down branches all over my yard. Could use help with raking and hauling debris.', urgency: 'high' },
  { title: 'Looking for someone to help paint a room', description: 'Prepping my spare bedroom for a family member moving in. Need help painting walls - I have all the supplies.', urgency: 'low' },
  { title: 'Need a ride to my medical appointment', description: 'Have a doctor appointment at OHSU next Tuesday at 2pm. Need a ride from SE Portland and back.', urgency: 'high' },
  { title: 'Help moving boxes to storage unit', description: 'About 15 medium-sized boxes need to go from my garage to a storage unit in Sellwood. Have a truck but need help loading.', urgency: 'medium' },
  { title: 'Need help hanging shelves and curtain rods', description: 'Just moved into a new place and need to hang several shelves and curtain rods. I have the hardware but not confident with a drill.', urgency: 'low' },
  { title: 'Seeking help clearing out a garage', description: 'Cleaning out years of accumulated stuff. Need help organizing, sorting, and hauling items to donation centers.', urgency: 'low' }
];

// ============================================================================
// Ride Requests
// ============================================================================

/** Portland area coordinates for realistic locations */
function portlandLat(): number {
  return 45.4 + Math.random() * 0.2; // 45.4 to 45.6
}

function portlandLng(): number {
  return -122.8 + Math.random() * 0.3; // -122.8 to -122.5
}

function futureDateISO(minDays: number, maxDays: number): string {
  const offsetDays = randomInt(minDays, maxDays);
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

export const RIDE_REQUESTS = [
  {
    title: 'Ride to PDX Airport - early morning flight',
    description: 'Need a ride to Portland International Airport for a 7am flight. Would need to leave by 5am from SE Portland.',
    urgency: 'high',
    request_type: 'ride',
    payload: { origin: { lat: 45.5051, lng: -122.6750, address: '1234 SE Hawthorne Blvd, Portland, OR' }, destination: { lat: 45.5898, lng: -122.5951, address: 'Portland International Airport (PDX)' }, seats_needed: 1, departure_time: futureDateISO(1, 7) }
  },
  {
    title: 'Ride to OHSU for weekly appointment',
    description: 'Need a ride from NE Portland to OHSU campus on Marquam Hill. Appointment is at 10am, takes about an hour.',
    urgency: 'medium',
    request_type: 'ride',
    payload: { origin: { lat: 45.5389, lng: -122.6297, address: '2500 NE Broadway, Portland, OR' }, destination: { lat: 45.4994, lng: -122.6856, address: 'OHSU, 3181 SW Sam Jackson Park Rd' }, seats_needed: 1, departure_time: futureDateISO(2, 5) }
  },
  {
    title: 'Carpool to Saturday Market',
    description: 'Heading to Portland Saturday Market from Beaverton. Room for 3 more people - lets share the drive!',
    urgency: 'low',
    request_type: 'ride',
    payload: { origin: { lat: 45.4871, lng: -122.8037, address: '4800 SW Griffith Dr, Beaverton, OR' }, destination: { lat: 45.5224, lng: -122.6699, address: 'Portland Saturday Market, Waterfront Park' }, seats_needed: 3, departure_time: futureDateISO(3, 10) }
  },
  {
    title: 'Ride to Fred Meyer for groceries',
    description: 'Dont have a car and need to do a big grocery run at Fred Meyer on 82nd. Happy to chip in for gas.',
    urgency: 'medium',
    request_type: 'ride',
    payload: { origin: { lat: 45.4977, lng: -122.5801, address: '7950 SE Foster Rd, Portland, OR' }, destination: { lat: 45.4922, lng: -122.5784, address: 'Fred Meyer, 3805 SE 82nd Ave' }, seats_needed: 1, departure_time: futureDateISO(1, 3) }
  },
  {
    title: 'Need ride to job interview in Lake Oswego',
    description: 'Have an important job interview in Lake Oswego and my car is in the shop. Would really appreciate a ride!',
    urgency: 'high',
    request_type: 'ride',
    payload: { origin: { lat: 45.5155, lng: -122.6789, address: '1000 SW Broadway, Portland, OR' }, destination: { lat: 45.4207, lng: -122.6706, address: '200 A Ave, Lake Oswego, OR' }, seats_needed: 1, departure_time: futureDateISO(1, 4) }
  },
  {
    title: 'Ride to Costco - bulk shopping trip',
    description: 'Heading to Costco in Tigard to stock up. Have room for one more person if you want to share the trip.',
    urgency: 'low',
    request_type: 'ride',
    payload: { origin: { lat: 45.4568, lng: -122.7555, address: '7500 SW Nyberg St, Tualatin, OR' }, destination: { lat: 45.4151, lng: -122.7467, address: 'Costco, 7795 SW Dartmouth St, Tigard, OR' }, seats_needed: 2, departure_time: futureDateISO(2, 6) }
  },
  {
    title: 'Ride share to Mt Hood for hiking',
    description: 'Planning a day hike to Mirror Lake trail on Mt Hood this Saturday. Looking for 2-3 people to carpool with.',
    urgency: 'low',
    request_type: 'ride',
    payload: { origin: { lat: 45.5231, lng: -122.6765, address: 'Pioneer Courthouse Square, Portland, OR' }, destination: { lat: 45.3035, lng: -121.7118, address: 'Mirror Lake Trailhead, Mt Hood, OR' }, seats_needed: 3, departure_time: futureDateISO(3, 14) }
  },
  {
    title: 'Ride to PCC Sylvania for evening class',
    description: 'Need a ride from downtown Portland to PCC Sylvania campus for my 6pm class. Would need pickup around 5:15pm.',
    urgency: 'medium',
    request_type: 'ride',
    payload: { origin: { lat: 45.5152, lng: -122.6784, address: '900 SW 5th Ave, Portland, OR' }, destination: { lat: 45.4431, lng: -122.7098, address: 'PCC Sylvania, 12000 SW 49th Ave' }, seats_needed: 1, departure_time: futureDateISO(1, 5) }
  },
  {
    title: 'Airport pickup - arriving from Seattle',
    description: 'Landing at PDX at 3:30pm and need a ride to my apartment in NW Portland. Just one suitcase.',
    urgency: 'medium',
    request_type: 'ride',
    payload: { origin: { lat: 45.5898, lng: -122.5951, address: 'Portland International Airport (PDX)' }, destination: { lat: 45.5326, lng: -122.6962, address: '2100 NW Flanders St, Portland, OR' }, seats_needed: 1, departure_time: futureDateISO(2, 8) }
  },
  {
    title: 'Ride to Providence Portland for surgery prep',
    description: 'Need a ride to Providence Portland Medical Center for a pre-surgery consultation. Cannot drive myself due to medication.',
    urgency: 'high',
    request_type: 'ride',
    payload: { origin: { lat: 45.4751, lng: -122.6319, address: '6200 SE 92nd Ave, Portland, OR' }, destination: { lat: 45.5343, lng: -122.6129, address: 'Providence Portland, 4805 NE Glisan St' }, seats_needed: 1, departure_time: futureDateISO(1, 3) }
  },
  {
    title: 'Carpool to Blazers game',
    description: 'Going to the Blazers game at Moda Center this Friday. Driving from Hillsboro - room for 3!',
    urgency: 'low',
    request_type: 'ride',
    payload: { origin: { lat: 45.5229, lng: -122.9898, address: '300 E Main St, Hillsboro, OR' }, destination: { lat: 45.5316, lng: -122.6668, address: 'Moda Center, 1 N Center Court St' }, seats_needed: 3, departure_time: futureDateISO(2, 7) }
  }
];

// ============================================================================
// Borrow Requests
// ============================================================================

export const BORROW_REQUESTS = [
  {
    title: 'Need to borrow a pressure washer',
    description: 'Want to clean my deck and driveway before summer. Just need it for a weekend.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Pressure Washer', item_category: 'tools', duration_days: 2, condition_min: 'good' }
  },
  {
    title: 'Looking to borrow a projector for movie night',
    description: 'Hosting an outdoor movie night in the backyard. Need a projector for one evening.',
    urgency: 'medium',
    request_type: 'borrow',
    payload: { item_name: 'Home Projector', item_category: 'electronics', duration_days: 1, condition_min: 'good' }
  },
  {
    title: 'Need a stand mixer for holiday baking',
    description: 'Baking for a fundraiser this weekend. Would love to borrow a KitchenAid or similar stand mixer.',
    urgency: 'medium',
    request_type: 'borrow',
    payload: { item_name: 'Stand Mixer', item_category: 'kitchen', duration_days: 3, condition_min: 'fair' }
  },
  {
    title: 'Borrow a circular saw for weekend project',
    description: 'Building raised garden beds and need a circular saw to cut the lumber. Have experience with power tools.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Circular Saw', item_category: 'tools', duration_days: 2, condition_min: 'good' }
  },
  {
    title: 'Need to borrow camping gear for weekend trip',
    description: 'Taking the kids camping for the first time! Need a 4-person tent and sleeping bags if anyone has extras.',
    urgency: 'medium',
    request_type: 'borrow',
    payload: { item_name: '4-Person Tent and Sleeping Bags', item_category: 'camping', duration_days: 4, condition_min: 'fair' }
  },
  {
    title: 'Looking to borrow a folding table and chairs',
    description: 'Hosting a neighborhood potluck and need extra seating. Need 2 folding tables and 8-10 chairs.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Folding Tables and Chairs', item_category: 'party', duration_days: 1, condition_min: 'fair' }
  },
  {
    title: 'Borrow a tile saw for bathroom renovation',
    description: 'Retiling my bathroom floor this week. Need a wet tile saw for about 3 days.',
    urgency: 'medium',
    request_type: 'borrow',
    payload: { item_name: 'Wet Tile Saw', item_category: 'tools', duration_days: 3, condition_min: 'good' }
  },
  {
    title: 'Need to borrow a sewing machine',
    description: 'Making costumes for the school play. Need a basic sewing machine for about a week.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Sewing Machine', item_category: 'other', duration_days: 7, condition_min: 'good' }
  },
  {
    title: 'Borrow a kayak for the weekend',
    description: 'Want to paddle on the Willamette this weekend. Looking for a single or tandem kayak with paddles and PFD.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Kayak with Paddle and PFD', item_category: 'sports', duration_days: 2, condition_min: 'good' }
  },
  {
    title: 'Looking to borrow a dehydrator',
    description: 'Want to make dried fruit and jerky. Need a food dehydrator for about a week.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Food Dehydrator', item_category: 'kitchen', duration_days: 7, condition_min: 'fair' }
  },
  {
    title: 'Need a drill press for a woodworking project',
    description: 'Building custom shelving and need precision drilling. Would love to borrow a drill press for a few days.',
    urgency: 'low',
    request_type: 'borrow',
    payload: { item_name: 'Drill Press', item_category: 'tools', duration_days: 4, condition_min: 'good' }
  },
  {
    title: 'Borrow a telescope for kids astronomy night',
    description: 'My kids science class is doing a stargazing night. Looking for a telescope to borrow for one evening.',
    urgency: 'medium',
    request_type: 'borrow',
    payload: { item_name: 'Telescope', item_category: 'electronics', duration_days: 1, condition_min: 'good' }
  }
];

// ============================================================================
// Service Requests
// ============================================================================

export const SERVICE_REQUESTS = [
  {
    title: 'Need help fixing a leaky kitchen faucet',
    description: 'My kitchen faucet has been dripping constantly. I think it needs a new cartridge but Im not sure how to do it.',
    urgency: 'medium',
    request_type: 'service',
    payload: { service_category: 'plumbing', skill_level: 'intermediate', duration_hours: 2, location_type: 'requester_location' }
  },
  {
    title: 'Math tutoring for high school student',
    description: 'My daughter is struggling with Algebra 2. Looking for someone who can tutor her twice a week after school.',
    urgency: 'medium',
    request_type: 'service',
    payload: { service_category: 'tutoring', skill_level: 'intermediate', duration_hours: 1, location_type: 'requester_location' }
  },
  {
    title: 'Help setting up home WiFi network',
    description: 'Just got a new mesh router system and need help setting it up. Also want to secure my network properly.',
    urgency: 'low',
    request_type: 'service',
    payload: { service_category: 'tech_support', skill_level: 'intermediate', duration_hours: 2, location_type: 'requester_location' }
  },
  {
    title: 'Need help pruning fruit trees',
    description: 'Have 3 apple trees and 2 pear trees that need winter pruning. Looking for someone with experience.',
    urgency: 'low',
    request_type: 'service',
    payload: { service_category: 'gardening', skill_level: 'experienced', duration_hours: 4, location_type: 'requester_location' }
  },
  {
    title: 'Electrical outlet not working - need electrician',
    description: 'Two outlets in my living room stopped working after a power surge. Need someone who knows electrical work.',
    urgency: 'high',
    request_type: 'service',
    payload: { service_category: 'electrical', skill_level: 'experienced', duration_hours: 2, location_type: 'requester_location' }
  },
  {
    title: 'Need help building a raised garden bed',
    description: 'Want to build a 4x8 raised garden bed in my backyard. Have the lumber but need someone skilled with carpentry.',
    urgency: 'low',
    request_type: 'service',
    payload: { service_category: 'carpentry', skill_level: 'intermediate', duration_hours: 4, location_type: 'requester_location' }
  },
  {
    title: 'Dog sitting needed for a week',
    description: 'Going on vacation and need someone to watch my friendly labrador. He is well-behaved and loves walks.',
    urgency: 'high',
    request_type: 'service',
    payload: { service_category: 'pet_care', skill_level: 'beginner', duration_hours: 168, location_type: 'provider_location' }
  },
  {
    title: 'Help cleaning and organizing garage',
    description: 'My garage has gotten out of control. Need help deep cleaning, organizing, and setting up storage systems.',
    urgency: 'low',
    request_type: 'service',
    payload: { service_category: 'cleaning', skill_level: 'beginner', duration_hours: 6, location_type: 'requester_location' }
  },
  {
    title: 'Need help with basic tax preparation',
    description: 'Self-employed and need help organizing receipts and understanding deductions before filing. Not looking for a CPA, just guidance.',
    urgency: 'medium',
    request_type: 'service',
    payload: { service_category: 'financial', skill_level: 'intermediate', duration_hours: 3, location_type: 'remote' }
  },
  {
    title: 'Bicycle repair - flat tire and brakes',
    description: 'My commuter bike has a flat rear tire and the front brakes are squeaking badly. Need someone who can fix both.',
    urgency: 'medium',
    request_type: 'service',
    payload: { service_category: 'repair', skill_level: 'intermediate', duration_hours: 1, location_type: 'requester_location' }
  },
  {
    title: 'Need occasional elder care companion',
    description: 'My mother needs a companion to visit her twice a week for conversation and light meal prep. She lives alone in NE Portland.',
    urgency: 'medium',
    request_type: 'service',
    payload: { service_category: 'elder_care', skill_level: 'beginner', duration_hours: 3, location_type: 'requester_location' }
  },
  {
    title: 'Help setting up a small business website',
    description: 'Starting a small bakery and need help setting up a basic website with online ordering. I have a domain already.',
    urgency: 'low',
    request_type: 'service',
    payload: { service_category: 'tech_support', skill_level: 'experienced', duration_hours: 8, location_type: 'remote' }
  }
];

// ============================================================================
// Event Requests
// ============================================================================

export const EVENT_REQUESTS = [
  {
    title: 'Neighborhood park cleanup - volunteers needed',
    description: 'Organizing a cleanup of Laurelhurst Park this Saturday morning. Bringing trash bags and gloves - just need helping hands!',
    urgency: 'medium',
    request_type: 'event',
    payload: {
      event_type: 'community_cleanup', event_date: futureDateISO(3, 10),
      duration_hours: 3, location: { lat: 45.5218, lng: -122.6270, address: 'Laurelhurst Park, Portland, OR' },
      participants_needed: 10, roles: [{ name: 'General Volunteer', count: 8 }, { name: 'Team Lead', count: 2 }]
    }
  },
  {
    title: 'Community garden planting day',
    description: 'Spring planting day at the community garden! Come help plant veggies and flowers. All skill levels welcome.',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'volunteer', event_date: futureDateISO(5, 14),
      duration_hours: 4, location: { lat: 45.5122, lng: -122.6587, address: 'Community Garden, SE Division St, Portland, OR' },
      participants_needed: 15, roles: [{ name: 'Planter', count: 10 }, { name: 'Water/Setup', count: 5 }]
    }
  },
  {
    title: 'Free coding workshop for beginners',
    description: 'Teaching a free intro to Python programming at the library. Laptops provided - just bring your curiosity!',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'workshop', event_date: futureDateISO(7, 21),
      duration_hours: 2, location: { lat: 45.5211, lng: -122.6811, address: 'Multnomah County Library, 801 SW 10th Ave' },
      participants_needed: 5, roles: [{ name: 'Teaching Assistant', count: 3 }, { name: 'Setup/Logistics', count: 2 }]
    }
  },
  {
    title: 'Fundraiser bake sale for local food bank',
    description: 'Hosting a bake sale at the farmers market to raise money for Oregon Food Bank. Need bakers and booth volunteers!',
    urgency: 'medium',
    request_type: 'event',
    payload: {
      event_type: 'fundraiser', event_date: futureDateISO(5, 12),
      duration_hours: 5, location: { lat: 45.5098, lng: -122.6552, address: 'Portland Farmers Market, PSU Campus' },
      participants_needed: 8, roles: [{ name: 'Baker', count: 4 }, { name: 'Booth Volunteer', count: 3 }, { name: 'Cashier', count: 1 }]
    }
  },
  {
    title: 'Monthly community potluck - all welcome!',
    description: 'Our monthly community potluck dinner. Bring a dish to share and meet your neighbors. Families with kids especially welcome!',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'social', event_date: futureDateISO(3, 10),
      duration_hours: 3, location: { lat: 45.5254, lng: -122.6553, address: 'Sunnyside Community House, SE 35th Ave' },
      participants_needed: 5, roles: [{ name: 'Setup/Cleanup', count: 3 }, { name: 'Greeter', count: 2 }]
    }
  },
  {
    title: 'Trail restoration volunteer day at Forest Park',
    description: 'Helping the Forest Park Conservancy restore trails after winter damage. Physical work but very rewarding!',
    urgency: 'medium',
    request_type: 'event',
    payload: {
      event_type: 'volunteer', event_date: futureDateISO(7, 14),
      duration_hours: 6, location: { lat: 45.5648, lng: -122.7621, address: 'Forest Park, Leif Erikson Trailhead' },
      participants_needed: 20, roles: [{ name: 'Trail Worker', count: 15 }, { name: 'Tool Manager', count: 3 }, { name: 'First Aid', count: 2 }]
    }
  },
  {
    title: 'Pickup soccer game - Sunday mornings',
    description: 'Weekly pickup soccer at Fernhill Park. All skill levels welcome. We play rain or shine - this is Portland!',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'sports', event_date: futureDateISO(1, 7),
      duration_hours: 2, location: { lat: 45.5571, lng: -122.6404, address: 'Fernhill Park, NE 37th Ave, Portland, OR' },
      participants_needed: 6, roles: [{ name: 'Player', count: 6 }]
    }
  },
  {
    title: 'Cultural cooking class - Ethiopian cuisine',
    description: 'Learn to make injera, doro wat, and other Ethiopian dishes! All ingredients provided. Space is limited.',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'cultural', event_date: futureDateISO(7, 21),
      duration_hours: 3, location: { lat: 45.5163, lng: -122.6529, address: 'Community Kitchen, SE 28th Ave, Portland, OR' },
      participants_needed: 4, roles: [{ name: 'Kitchen Helper', count: 3 }, { name: 'Cleanup Crew', count: 1 }]
    }
  },
  {
    title: 'Free ESL conversation practice meetup',
    description: 'Weekly English conversation practice for non-native speakers. Friendly, supportive group. Coffee provided!',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'educational', event_date: futureDateISO(2, 7),
      duration_hours: 1.5, location: { lat: 45.5231, lng: -122.6588, address: 'Lucky Lab Brewing, SE Hawthorne, Portland, OR' },
      participants_needed: 3, roles: [{ name: 'Conversation Partner', count: 3 }]
    }
  },
  {
    title: 'Neighborhood emergency preparedness workshop',
    description: 'Learn how to prepare for earthquakes and other emergencies. Presenters from Portland NET. Free supplies distributed!',
    urgency: 'medium',
    request_type: 'event',
    payload: {
      event_type: 'educational', event_date: futureDateISO(10, 21),
      duration_hours: 2, location: { lat: 45.4906, lng: -122.5784, address: 'East Portland Community Center, SE 106th Ave' },
      participants_needed: 6, roles: [{ name: 'Setup Helper', count: 2 }, { name: 'Registration Desk', count: 2 }, { name: 'Supply Distribution', count: 2 }]
    }
  },
  {
    title: 'Bike repair workshop and tune-up day',
    description: 'Bring your bike for a free tune-up! Experienced mechanics will teach you basic maintenance while fixing your ride.',
    urgency: 'low',
    request_type: 'event',
    payload: {
      event_type: 'workshop', event_date: futureDateISO(5, 14),
      duration_hours: 4, location: { lat: 45.5289, lng: -122.6461, address: 'Community Cycling Center, NE Alberta St' },
      participants_needed: 4, roles: [{ name: 'Mechanic', count: 2 }, { name: 'Parts Organizer', count: 1 }, { name: 'Greeter/Check-in', count: 1 }]
    }
  }
];

// ============================================================================
// Random Request Generator
// ============================================================================

export interface GeneratedRequest {
  title: string;
  description: string;
  urgency: string;
  request_type: string;
  payload?: any;
}

/**
 * Generate a random request with weighted distribution:
 * generic 30%, ride 20%, borrow 15%, service 20%, event 15%
 */
export function generateRandomRequest(): GeneratedRequest {
  const roll = Math.random();

  if (roll < 0.30) {
    // Generic (30%)
    const req = pickRandom(GENERIC_REQUESTS);
    return {
      title: req.title,
      description: req.description,
      urgency: req.urgency,
      request_type: 'generic'
    };
  } else if (roll < 0.50) {
    // Ride (20%)
    const req = pickRandom(RIDE_REQUESTS);
    return {
      title: req.title,
      description: req.description,
      urgency: req.urgency,
      request_type: 'ride',
      payload: { ...req.payload, departure_time: futureDateISO(1, 14) }
    };
  } else if (roll < 0.65) {
    // Borrow (15%)
    const req = pickRandom(BORROW_REQUESTS);
    return {
      title: req.title,
      description: req.description,
      urgency: req.urgency,
      request_type: 'borrow',
      payload: { ...req.payload }
    };
  } else if (roll < 0.85) {
    // Service (20%)
    const req = pickRandom(SERVICE_REQUESTS);
    return {
      title: req.title,
      description: req.description,
      urgency: req.urgency,
      request_type: 'service',
      payload: { ...req.payload }
    };
  } else {
    // Event (15%)
    const req = pickRandom(EVENT_REQUESTS);
    return {
      title: req.title,
      description: req.description,
      urgency: req.urgency,
      request_type: 'event',
      payload: {
        ...req.payload,
        event_date: futureDateISO(3, 21)
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Provider templates
// ---------------------------------------------------------------------------

export interface ProviderTemplate {
  service_type: string;
  display_name_template: string; // {name} replaced with persona's first name
  bio: string;
  pricing_notes?: string;
  location_notes?: string;
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  // Rides
  { service_type: 'ride', display_name_template: 'Rides with {name}', bio: 'Happy to offer rides around the neighborhood. Just ask!', location_notes: 'Available within 5 miles' },
  { service_type: 'ride', display_name_template: '{name} – Rideshare', bio: 'I drive a reliable car and love helping neighbors get around.', pricing_notes: 'Gas contributions welcome' },
  { service_type: 'ride', display_name_template: '{name} Driver', bio: 'Available evenings and weekends for local trips.' },
  // Tradesperson / Handyperson
  { service_type: 'tradesperson', display_name_template: '{name} – Repairs & Help', bio: 'Handy with tools and minor repairs. Happy to help neighbors.' },
  { service_type: 'tradesperson', display_name_template: '{name} Handyperson', bio: 'Years of DIY experience — reach out for home fixes, plumbing, or carpentry.' },
  { service_type: 'tradesperson', display_name_template: '{name} Fix-It', bio: 'I enjoy sharing skills with my community.', pricing_notes: 'Skill-share or small donation appreciated' },
  { service_type: 'tradesperson', display_name_template: 'Errands & Tasks by {name}', bio: 'I run errands regularly and can handle odd jobs for neighbors.' },
  { service_type: 'tradesperson', display_name_template: '{name} – Errands & Delivery', bio: 'Going to the store anyway — happy to grab what you need.' },
  // Tutor / Care
  { service_type: 'tutor', display_name_template: '{name} – Tutoring & Support', bio: 'Experienced tutor in math, tech, and everyday skills. Happy to help.' },
  { service_type: 'tutor', display_name_template: '{name} Tutor', bio: 'I offer friendly study sessions and skill-building for all ages.' },
  { service_type: 'tutor', display_name_template: 'Learning with {name}', bio: 'Let\'s learn together — elder care, childcare, or academic support.', location_notes: 'Available remotely or in-person' },
  // Other
  { service_type: 'other', display_name_template: '{name} – General Help', bio: 'General helping hand in the community.' },
  { service_type: 'other', display_name_template: '{name} Community Helper', bio: 'Whatever you need, reach out and I will do my best.' },
  { service_type: 'other', display_name_template: 'Help by {name}', bio: 'Love being part of a mutual aid network.' },
];

export function pickProvider(firstName: string, excludeServiceTypes: string[] = []): { service_type: string; display_name: string; bio: string; pricing_notes?: string; location_notes?: string } {
  const available = PROVIDER_TEMPLATES.filter(t => !excludeServiceTypes.includes(t.service_type));
  const template = pickRandom(available.length > 0 ? available : PROVIDER_TEMPLATES);
  return {
    service_type: template.service_type,
    display_name: template.display_name_template.replace('{name}', firstName),
    bio: template.bio,
    ...(template.pricing_notes ? { pricing_notes: template.pricing_notes } : {}),
    ...(template.location_notes ? { location_notes: template.location_notes } : {}),
  };
}
