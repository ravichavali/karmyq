/**
 * Request templates and message pools for the Bay Area simulation
 */
import { pickRandom } from '../utils/random';

// ── Request templates ────────────────────────────────────────────────────────

interface RequestTemplate {
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  request_type: string;
  type_payload?: Record<string, unknown>;
}

const GENERIC_REQUESTS: RequestTemplate[] = [
  { title: 'Help moving boxes to storage unit', description: 'I have about 15 medium boxes that need to go from my apartment to a nearby storage unit. Could use another pair of hands for a couple of hours this weekend.', urgency: 'medium', request_type: 'generic' },
  { title: 'Dog walker needed — Tuesday mornings', description: 'My regular walker moved away. I need someone to walk my corgi, Biscuit, for about 30 min on Tuesday mornings. He\'s friendly and leash-trained.', urgency: 'medium', request_type: 'generic' },
  { title: 'Help assembling IKEA bookshelf', description: 'I have a KALLAX that I\'ve been putting off assembling for three weeks. Two people make it much easier. I have all the tools.', urgency: 'low', request_type: 'generic' },
  { title: 'Grocery run while I recover from surgery', description: 'Had minor surgery yesterday and can\'t drive for a few days. I\'d be grateful for a grocery pickup from the Safeway on Mission — will give you my list and pay you back via Venmo.', urgency: 'high', request_type: 'generic' },
  { title: 'Plant watering while I\'m away for a week', description: 'Going to visit family for 7 days. Have about 10 indoor plants that need watering every 2-3 days. Happy to do the same for you sometime.', urgency: 'medium', request_type: 'generic' },
  { title: 'Help sorting donations for clothing drive', description: 'Running a clothing donation drive for our local shelter. Need help sorting and folding about 4 large bags this Saturday afternoon. Takes about 2 hours, snacks provided.', urgency: 'low', request_type: 'generic' },
  { title: 'Ride to Oakland Airport on Friday 5am', description: 'Have an early flight and Lyft prices are brutal. Would split gas costs. Coming from Fremont, so probably 30 min out of the way.', urgency: 'high', request_type: 'generic' },
  { title: 'Tech help setting up new laptop', description: 'My 70-year-old mother just got a new MacBook and I\'m across the country. Could someone spend an hour with her to get her email and Zoom working? She\'s in Daly City.', urgency: 'medium', request_type: 'generic' },
  { title: 'Yard work — need help clearing overgrown corner', description: 'One corner of my yard has been overgrown for two seasons. I have all the tools — loppers, rake, yard bags. Looking for a few hours of help this weekend.', urgency: 'low', request_type: 'generic' },
  { title: 'Can someone hang 3 picture frames for me?', description: 'I\'m not great with walls and I keep making mistakes. Need someone who\'s comfortable with a drill and level to hang three framed photos properly.', urgency: 'low', request_type: 'generic' },
];

const RIDE_REQUESTS: RequestTemplate[] = [
  { title: 'Ride to UCSF for appointment Thursday 9am', description: 'Have a medical appointment at UCSF Parnassus on Thursday morning. Coming from Daly City. Happy to contribute to gas.', urgency: 'high', request_type: 'ride', type_payload: { destination: 'UCSF Parnassus, San Francisco', pickup_location: 'Daly City BART', date_needed: 'Thursday' } },
  { title: 'Need a ride to Home Depot and back', description: 'Buying lumber for a small project — too big for Uber. Would need maybe an hour total. Happy to treat you to coffee after.', urgency: 'medium', request_type: 'ride', type_payload: { destination: 'Home Depot', pickup_location: 'Mission District' } },
];

const SERVICE_REQUESTS: RequestTemplate[] = [
  { title: 'Dripping bathroom faucet — anyone handy?', description: 'Bathroom faucet has been dripping for a week. I have the replacement cartridge, just need someone who knows how to swap it. Should take less than an hour.', urgency: 'medium', request_type: 'service', type_payload: { service_type: 'home_repair', estimated_hours: 1 } },
  { title: 'Math tutoring for 7th grader — 2x per week', description: 'My daughter is struggling with pre-algebra this year. Looking for someone patient and good at explaining concepts to meet 2x per week after school.', urgency: 'medium', request_type: 'service', type_payload: { service_type: 'tutoring', subject: 'Math', frequency: '2x per week' } },
  { title: 'Spanish conversation practice partner', description: 'I\'m at B1 level and want to practice conversation. Would love to find someone fluent who wants English conversation practice in exchange.', urgency: 'low', request_type: 'service', type_payload: { service_type: 'tutoring', subject: 'Spanish conversation' } },
];

const BORROW_REQUESTS: RequestTemplate[] = [
  { title: 'Borrow a circular saw for the weekend', description: 'Building a raised garden bed and need a circular saw for cutting lumber. Need it Saturday-Sunday, will return it clean and in good condition.', urgency: 'medium', request_type: 'borrow', type_payload: { item: 'circular saw', return_by: 'Sunday evening' } },
  { title: 'Borrow a carpet cleaner / steam cleaner', description: 'Moving out of my apartment next week and need to deep clean the carpets. Would borrow for one day.', urgency: 'high', request_type: 'borrow', type_payload: { item: 'carpet cleaner', return_by: 'same day' } },
  { title: 'Need a ladder (8ft or taller) for one afternoon', description: 'Cleaning out my gutters before the rainy season. Just need it for Saturday afternoon.', urgency: 'low', request_type: 'borrow', type_payload: { item: '8ft ladder', return_by: 'same day' } },
];

const EVENT_REQUESTS: RequestTemplate[] = [
  { title: 'Volunteers needed for park cleanup Saturday', description: 'Organizing a 2-hour cleanup at Dolores Park this Saturday 9am-11am. Gloves and bags provided. Great way to meet neighbors.', urgency: 'low', request_type: 'event', type_payload: { event_type: 'volunteer', date: 'Saturday', duration_hours: 2 } },
  { title: 'Help needed at community food pantry — Thursday 4-7pm', description: 'Our local food pantry needs extra hands on Thursday to sort and distribute. No experience needed, very welcoming environment.', urgency: 'medium', request_type: 'event', type_payload: { event_type: 'volunteer', date: 'Thursday', duration_hours: 3 } },
];

export function pickRequest(): RequestTemplate {
  const all = [
    ...GENERIC_REQUESTS, ...GENERIC_REQUESTS, ...GENERIC_REQUESTS, // 3x weight
    ...RIDE_REQUESTS,
    ...SERVICE_REQUESTS,
    ...BORROW_REQUESTS,
    ...EVENT_REQUESTS,
  ];
  return pickRandom(all);
}

// ── Community templates ──────────────────────────────────────────────────────

export const COMMUNITY_TEMPLATES = [
  { name: 'Mission Neighbors', description: 'Helping each other in the Mission District — from Cesar Chavez to Duboce.', location: 'Mission District, San Francisco', category: 'neighborhood' },
  { name: 'Oakland Mutual Aid', description: 'East Bay neighbors supporting each other with everyday needs.', location: 'Oakland, CA', category: 'mutual_aid' },
  { name: 'Peninsula Parents Co-op', description: 'Palo Alto and Menlo Park parents sharing childcare, school pickups, and resources.', location: 'Palo Alto, CA', category: 'family' },
  { name: 'Fremont Tool Share & Repair', description: 'Share tools, fix things together, reduce waste. Fremont and surrounding East Bay.', location: 'Fremont, CA', category: 'sharing' },
  { name: 'South Bay Volunteers', description: 'Coordinating volunteering opportunities across San Jose and Santa Clara.', location: 'San Jose, CA', category: 'volunteer' },
  { name: 'Berkeley Community Care', description: 'Berkeley residents looking out for each other — groceries, rides, skills.', location: 'Berkeley, CA', category: 'neighborhood' },
  { name: 'Daly City & South SF Helpers', description: 'Connecting neighbors in Daly City and South San Francisco for mutual support.', location: 'Daly City, CA', category: 'neighborhood' },
  { name: 'Marin Mutual Aid', description: 'Helping across Marin County — from Sausalito to San Rafael.', location: 'Marin County, CA', category: 'mutual_aid' },
];

// ── Provider templates ────────────────────────────────────────────────────────

export interface ProviderTemplate {
  service_type: 'ride' | 'tradesperson' | 'tutor' | 'other';
  display_name: string;
  bio: string;
  pricing_notes: string;
  location_notes: string;
}

const RIDE_PROVIDERS: ProviderTemplate[] = [
  { service_type: 'ride', display_name: 'Reliable Rides with James', bio: 'Experienced driver offering rides around the Bay Area. Comfortable with groceries, appointments, and longer trips.', pricing_notes: 'Gas contribution appreciated — no fixed rate.', location_notes: 'Based in Oakland, serve East Bay and SF.' },
  { service_type: 'ride', display_name: 'East Bay Carpool Co.', bio: 'Happy to give rides to neighbors in need. Flexible daytime hours — great for medical appointments and errands.', pricing_notes: 'Pay what you can, or trade help later.', location_notes: 'Oakland and Berkeley, occasional Marin trips.' },
  { service_type: 'ride', display_name: 'Bay Area Airport Runs', bio: 'Early riser — I do SFO and OAK runs starting 4am. Reliable, luggage space available.', pricing_notes: 'Split gas — much cheaper than rideshare for airport runs.', location_notes: 'South Bay, Peninsula, and SF pickups.' },
  { service_type: 'ride', display_name: 'Mission District Rides', bio: 'SF native, know every shortcut. Happy to help neighbors get to appointments, groceries, or BART.', pricing_notes: 'Free for short trips within SF, gas share for longer.', location_notes: 'Mission District and adjacent SF neighborhoods.' },
  { service_type: 'ride', display_name: 'Peninsula Parent Carpool', bio: 'School-run specialist. Happy to add a neighbor\'s kid to my route — safety-certified vehicle.', pricing_notes: 'Monthly gas share arrangement preferred.', location_notes: 'Palo Alto, Menlo Park, Redwood City.' },
];

const SERVICE_PROVIDERS: ProviderTemplate[] = [
  { service_type: 'tradesperson', display_name: 'Handyman & Home Repairs', bio: 'Skilled in home repairs, furniture assembly, and light electrical work. 10+ years experience. I bring my own tools.', pricing_notes: 'Sliding scale — karma for short jobs, small cash for multi-hour work.', location_notes: 'Serving Mission, Noe Valley, and Bernal Heights.' },
  { service_type: 'tradesperson', display_name: 'Tech Help & Setup', bio: 'Software engineer by trade, happy to help with computers, phones, smart home setup, WiFi issues, and more.', pricing_notes: 'No charge for neighbors — karma or baked goods accepted.', location_notes: 'Berkeley and Oakland, remote help available anywhere.' },
  { service_type: 'tradesperson', display_name: 'Yard Work & Gardening', bio: 'Weekend gardener with a truck. I can help clear, plant, or maintain your yard. I know Bay Area native plants well.', pricing_notes: 'Small jobs free, larger jobs negotiable.', location_notes: 'East Bay and Peninsula.' },
  { service_type: 'tutor', display_name: 'Math & Science Tutoring', bio: 'Community college instructor — K-12 math and science tutoring. Patient with struggling learners.', pricing_notes: 'Free for K-8, ask about high school rates.', location_notes: 'San Jose and Santa Clara, or Zoom.' },
  { service_type: 'tutor', display_name: 'Language Exchange & Tutoring', bio: 'Fluent in English, Spanish, and Mandarin. Offering conversation practice and language tutoring for all levels.', pricing_notes: 'Language exchange preferred — mutual practice sessions.', location_notes: 'Anywhere via Zoom, in-person in SF.' },
];

const BORROW_PROVIDERS: ProviderTemplate[] = [
  { service_type: 'other', display_name: 'Fremont Tool Library', bio: 'I have a full set of tools — drills, circular saw, jigsaw, ladders, and more. Available to borrow for community members.', pricing_notes: 'Free to borrow — just return clean and in working order.', location_notes: 'Fremont — pickup and dropoff from my garage.' },
  { service_type: 'other', display_name: 'Camping Gear Lending', bio: 'Collection of camping and outdoor gear: tents, sleeping bags, camp stoves, coolers. First come, first served.', pricing_notes: 'No charge — just respect the gear and return on time.', location_notes: 'Oakland — flexible on pickup/dropoff timing.' },
  { service_type: 'other', display_name: 'Kitchen Equipment Share', bio: 'KitchenAid mixer, pasta maker, immersion blender, dehydrator, and more. Perfect for one-time cooking projects.', pricing_notes: 'Free to borrow — leave a review so others know what\'s available.', location_notes: 'Daly City — happy to leave items on porch for contactless pickup.' },
  { service_type: 'other', display_name: 'Party Supply Lending', bio: 'Tables, chairs, serving trays, punch bowls, and event supplies. Good for block parties and community events.', pricing_notes: 'No charge for community events — small deposit for unknown borrowers.', location_notes: 'South SF and Daly City.' },
  { service_type: 'other', display_name: 'Baby Gear Share', bio: 'Highchair, stroller, baby monitor, bouncer, and more. Great for visits or while you wait for delivery.', pricing_notes: 'Free — I have more than I need.', location_notes: 'Palo Alto and Menlo Park.' },
];

export function pickProvider(): ProviderTemplate {
  const all = [...RIDE_PROVIDERS, ...SERVICE_PROVIDERS, ...BORROW_PROVIDERS];
  return pickRandom(all);
}

// ── Messages ─────────────────────────────────────────────────────────────────

export const OFFER_MESSAGES = [
  'I can help with this! When works for you?',
  'Happy to assist — just let me know the details.',
  'This sounds like something I can do. Message me.',
  'I have availability this week, let\'s coordinate.',
  'Count me in — send me the specifics.',
  'I\'d be glad to help. What\'s the best way to connect?',
  'Available to help — what time works best?',
];

export const REPLY_MESSAGES = [
  'Thanks so much for offering to help!',
  'That works perfectly, thank you.',
  'Really appreciate this — what time works for you?',
  'You\'re a lifesaver, seriously.',
  'Sounds great — I\'ll send you the address.',
  'Perfect, see you then. Thank you!',
  'This community is amazing. Thank you.',
  'So grateful for the offer — let\'s connect.',
];

export const COMPLETION_FEEDBACKS = [
  { rating: 5, comment: 'Fantastic, showed up on time and was incredibly helpful. Would absolutely ask again.' },
  { rating: 5, comment: 'Went above and beyond. So grateful.' },
  { rating: 5, comment: 'Exactly what I needed. Quick, efficient, and friendly.' },
  { rating: 4, comment: 'Really helpful! Minor scheduling hiccup but worked out great.' },
  { rating: 5, comment: 'Wonderful experience. This is exactly what mutual aid should look like.' },
  { rating: 4, comment: 'Great help, very reliable. Highly recommend.' },
  { rating: 5, comment: 'Made a stressful situation much easier. Thank you.' },
];
