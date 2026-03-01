/**
 * Persona type definitions for the Karmyq organic simulation
 */

export type ProfileType = 'communityBuilder' | 'activeHelper' | 'socialUser' | 'requester' | 'browser';

export interface ActionWeights {
  [key: string]: number;
  browseRequests: number;
  createRequest: number;
  offerHelp: number;
  acceptOffer: number;
  completeMatch: number;
  sendMessage: number;
  generateInvite: number;
  joinCommunity: number;
  createCommunity: number;
}

/**
 * Time-of-day activity pattern: hour (0-23) → activity multiplier (0-1)
 * A flat { peak: [...hours], base: number } structure is easier to define
 * and gets expanded to an hourly map at runtime.
 */
export interface TemporalPattern {
  // Hours (0-23) when this persona is most active
  peakHours: number[];
  // Hours (0-23) when this persona is moderately active
  activeHours: number[];
  // Days of week (0=Sun, 6=Sat) that are active
  activeDays: number[];
  // Multiplier applied outside peak/active hours (0-1, 0 = completely inactive)
  offPeakMultiplier: number;
}

/**
 * Social tendencies: who this persona is more likely to interact with
 */
export interface SocialBias {
  // More likely to help users who helped them (reciprocity factor 0-2, 1=neutral)
  reciprocity: number;
  // More likely to invite after being helped
  inviteAfterHelped: boolean;
  // More likely to post a request after completing a match
  requestAfterMatch: boolean;
  // Tendency to grow across communities (vs stay in one)
  crossCommunityGrowth: number; // 0-1
}

export interface Persona {
  id: string;                    // Stable slug, e.g. "maria-reyes"
  name: string;                  // Display name
  email: string;                 // @test.karmyq.com
  password: string;
  backstory: string;
  motivation: string;
  location: string;              // Neighborhood / city
  region: BayAreaRegion;
  profileType: ProfileType;
  actionWeights: ActionWeights;
  temporalPattern: TemporalPattern;
  socialBias: SocialBias;
  // For organic growth — location used to assign invitees nearby
  inviteeRegions: BayAreaRegion[];
}

export type BayAreaRegion =
  | 'SF_Mission'
  | 'SF_Other'
  | 'Oakland'
  | 'Berkeley'
  | 'East_Bay_Other'
  | 'Palo_Alto'
  | 'Peninsula'
  | 'South_Bay'
  | 'Marin'
  | 'Daly_City'
  | 'Fremont'
  | 'Other_Bay_Area';

export const REGION_LOCATIONS: Record<BayAreaRegion, string[]> = {
  SF_Mission:    ['Mission District, San Francisco', 'Noe Valley, San Francisco', 'Castro, San Francisco'],
  SF_Other:      ['SOMA, San Francisco', 'Richmond District, San Francisco', 'Sunset District, San Francisco'],
  Oakland:       ['Oakland, CA', 'Temescal, Oakland', 'Rockridge, Oakland', 'Fruitvale, Oakland'],
  Berkeley:      ['Berkeley, CA', 'North Berkeley', 'South Berkeley'],
  East_Bay_Other:['Alameda, CA', 'El Cerrito, CA', 'Richmond, CA'],
  Palo_Alto:     ['Palo Alto, CA', 'Menlo Park, CA', 'Mountain View, CA'],
  Peninsula:     ['Redwood City, CA', 'San Mateo, CA', 'Burlingame, CA'],
  South_Bay:     ['San Jose, CA', 'Santa Clara, CA', 'Sunnyvale, CA', 'Cupertino, CA'],
  Marin:         ['San Rafael, CA', 'Mill Valley, CA', 'Sausalito, CA'],
  Daly_City:     ['Daly City, CA', 'South San Francisco, CA'],
  Fremont:       ['Fremont, CA', 'Union City, CA', 'Newark, CA'],
  Other_Bay_Area:['Concord, CA', 'Walnut Creek, CA', 'Pleasanton, CA'],
};

/**
 * Runtime state tracked per persona during a simulation run.
 * Stored in memory by the orchestrator, not persisted.
 */
export interface PersonaState {
  persona: Persona;
  token: string | null;
  tokenExpiresAt: number;        // Unix ms
  userId: string | null;
  communityIds: string[];
  // Social graph context (refreshed each tick)
  recentlyHelped: boolean;       // Someone helped me recently → boost create-request
  recentlyHelpedSomeone: boolean;// I helped someone → boost invite
  pendingOfferCount: number;     // Open proposed matches waiting for my acceptance
  helpedReciprocally: boolean;   // Helped someone who helped me → reduce invite urgency
  // Growth tracking
  inviteCodesPending: string[];  // Codes I've generated but haven't been accepted yet
}

/**
 * Stored credentials + initial state after seeding
 */
export interface SeededUser {
  personaId: string;
  name: string;
  email: string;
  password: string;
  userId: string;
  communityIds: string[];
  location: string;
  region: BayAreaRegion;
  type: 'founder' | 'invited' | 'generated';
  invitedBy?: string;            // personaId of inviter
  inviteDepth: number;           // 0 = founder, 1 = direct invite, etc.
  createdAt: string;
}
