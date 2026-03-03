/**
 * Generates organic invitee personas — realistic Bay Area residents
 * whose character type is randomly assigned with a distribution
 * that reflects real-world mutual aid network growth.
 */

import { Persona, BayAreaRegion, ProfileType, ActionWeights, TemporalPattern, SocialBias, REGION_LOCATIONS } from './types';

// Bay Area-appropriate diverse name pools
const FIRST_NAMES = [
  // Latino/Latina (heavy Mission/Bay Area presence)
  'Sofia', 'Carlos', 'Elena', 'Miguel', 'Lucia', 'Andres', 'Gabriela', 'Diego',
  // East/South Asian (Fremont, Peninsula, South Bay)
  'Mei', 'Raj', 'Yuki', 'Preethi', 'Kevin', 'Amy', 'Jason', 'Ananya',
  // African/African American (Oakland, East Bay)
  'Amara', 'Kwame', 'Aisha', 'Darius', 'Imani', 'Marcus', 'Zara', 'Kofi',
  // Arab/Middle Eastern (Fremont, South Bay)
  'Layla', 'Omar', 'Nadia', 'Hassan', 'Sara', 'Tariq',
  // White/European
  'Emma', 'Liam', 'Hannah', 'Noah', 'Ingrid', 'Lars', 'Claire', 'Ben',
  // Mixed/common Bay Area
  'Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey',
];

const LAST_NAMES = [
  'Chen', 'Rodriguez', 'Patel', 'Kim', 'Okafor', 'Singh', 'Tanaka', 'Santos',
  'Williams', 'Ahmed', 'Thompson', 'Liu', 'Garcia', 'Nakamura', 'Martinez',
  'Brown', 'Nguyen', 'Davis', 'Hernandez', 'Park', 'Kumar', 'Zhao', 'Lopez',
  'Anderson', 'Ali', 'Wilson', 'Johnson', 'Johansson', 'Reyes', 'Torres',
  'Flores', 'Ramirez', 'Diaz', 'Morales', 'Walker', 'Jackson', 'Lee',
];

// Organic growth profile distribution (mirrors real mutual aid dynamics)
const PROFILE_DISTRIBUTION: { type: ProfileType; weight: number }[] = [
  { type: 'activeHelper',     weight: 0.25 },
  { type: 'requester',        weight: 0.35 },
  { type: 'browser',          weight: 0.25 },
  { type: 'communityBuilder', weight: 0.08 },
  { type: 'socialUser',       weight: 0.07 },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: { type: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.type;
  }
  return items[items.length - 1].type;
}

const BASE_WEIGHTS: Record<ProfileType, ActionWeights> = {
  activeHelper: {
    browseRequests: 0.8, createRequest: 0.1, offerHelp: 0.8, acceptOffer: 0.4,
    completeMatch: 0.85, sendMessage: 0.4, generateInvite: 0.25,
    joinCommunity: 0.5, createCommunity: 0.05,
    registerAsProvider: 0.6, joinCollective: 0.5,
  },
  requester: {
    browseRequests: 0.7, createRequest: 0.85, offerHelp: 0.2, acceptOffer: 0.9,
    completeMatch: 0.8, sendMessage: 0.6, generateInvite: 0.2,
    joinCommunity: 0.7, createCommunity: 0.03,
    registerAsProvider: 0.1, joinCollective: 0.1,
  },
  browser: {
    browseRequests: 0.9, createRequest: 0.2, offerHelp: 0.3, acceptOffer: 0.5,
    completeMatch: 0.6, sendMessage: 0.2, generateInvite: 0.3,
    joinCommunity: 0.5, createCommunity: 0.1,
    registerAsProvider: 0.2, joinCollective: 0.2,
  },
  communityBuilder: {
    browseRequests: 0.5, createRequest: 0.2, offerHelp: 0.5, acceptOffer: 0.6,
    completeMatch: 0.7, sendMessage: 0.6, generateInvite: 0.8,
    joinCommunity: 0.7, createCommunity: 0.4,
    registerAsProvider: 0.3, joinCollective: 0.6,
  },
  socialUser: {
    browseRequests: 0.6, createRequest: 0.3, offerHelp: 0.4, acceptOffer: 0.5,
    completeMatch: 0.6, sendMessage: 0.9, generateInvite: 0.8,
    joinCommunity: 0.7, createCommunity: 0.15,
    registerAsProvider: 0.4, joinCollective: 0.7,
  },
};

const BASE_TEMPORAL: Record<ProfileType, TemporalPattern> = {
  activeHelper:     { peakHours: [9,10,15,16], activeHours: [11,12,13,14,17,18], activeDays: [5,6,0], offPeakMultiplier: 0.08 },
  requester:        { peakHours: [8,9,10,11,12], activeHours: [13,14,19,20], activeDays: [1,2,3,4,5], offPeakMultiplier: 0.05 },
  browser:          { peakHours: [12,13,20,21], activeHours: [10,11,14,15,19], activeDays: [0,5,6], offPeakMultiplier: 0.03 },
  communityBuilder: { peakHours: [8,9,19,20,21], activeHours: [10,11,17,18], activeDays: [0,1,2,3,4,5,6], offPeakMultiplier: 0.1 },
  socialUser:       { peakHours: [7,8,12,13,19,20], activeHours: [9,10,11,14,15,16,17,18], activeDays: [0,1,2,3,4,5,6], offPeakMultiplier: 0.15 },
};

const BASE_SOCIAL_BIAS: Record<ProfileType, SocialBias> = {
  activeHelper:     { reciprocity: 1.0, inviteAfterHelped: false, requestAfterMatch: false, crossCommunityGrowth: 0.3 },
  requester:        { reciprocity: 1.8, inviteAfterHelped: true,  requestAfterMatch: true,  crossCommunityGrowth: 0.5 },
  browser:          { reciprocity: 1.2, inviteAfterHelped: true,  requestAfterMatch: false, crossCommunityGrowth: 0.4 },
  communityBuilder: { reciprocity: 1.3, inviteAfterHelped: true,  requestAfterMatch: false, crossCommunityGrowth: 0.8 },
  socialUser:       { reciprocity: 1.1, inviteAfterHelped: true,  requestAfterMatch: false, crossCommunityGrowth: 1.0 },
};

export function generatePersona(
  invitedBy: string,
  inviterRegion: BayAreaRegion,
  inviteeRegions: BayAreaRegion[],
  existingEmails: Set<string>
): Persona {
  const firstName = pickRandom(FIRST_NAMES);
  const lastName = pickRandom(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const emailSlug = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 900) + 100}`;
  const email = `${emailSlug}@test.karmyq.com`;

  // Avoid duplicate emails (retry logic handled by caller)
  if (existingEmails.has(email)) {
    return generatePersona(invitedBy, inviterRegion, inviteeRegions, existingEmails);
  }

  const profileType = weightedPick(PROFILE_DISTRIBUTION);
  const region = pickRandom(inviteeRegions.length > 0 ? inviteeRegions : [inviterRegion]);
  const location = pickRandom(REGION_LOCATIONS[region]);
  const id = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${emailSlug.slice(-3)}`;

  return {
    id,
    name,
    email,
    password: 'password123',
    backstory: `${name} lives in ${location} and found Karmyq through a mutual connection.`,
    motivation: 'Help and be helped by neighbors.',
    location,
    region,
    profileType,
    actionWeights: { ...BASE_WEIGHTS[profileType] },
    temporalPattern: { ...BASE_TEMPORAL[profileType] },
    socialBias: { ...BASE_SOCIAL_BIAS[profileType] },
    inviteeRegions: [region, inviterRegion],
  };
}
