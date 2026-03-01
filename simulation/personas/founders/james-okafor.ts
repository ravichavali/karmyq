import { Persona } from '../types';

export const jamesOkafor: Persona = {
  id: 'james-okafor',
  name: 'James Okafor',
  email: 'james.okafor@test.karmyq.com',
  password: 'password123',
  backstory: 'General contractor who grew up in Oakland. His father ran a community repair shop in West Oakland for 30 years — fix what you can, give away what you can\'t sell. James has his dad\'s instinct: show up, do the thing, don\'t make it complicated. Joined Karmyq when Maria asked him to help someone move.',
  motivation: 'Keep doing what his dad did, just at a bigger scale.',
  location: 'Oakland, CA',
  region: 'Oakland',
  profileType: 'activeHelper',
  actionWeights: {
    browseRequests:   0.9,
    createRequest:    0.1,
    offerHelp:        0.9,
    acceptOffer:      0.4,
    completeMatch:    0.9,
    sendMessage:      0.4,
    generateInvite:   0.3,
    joinCommunity:    0.5,
    createCommunity:  0.1,
  },
  temporalPattern: {
    peakHours:         [8, 9, 14, 15, 16],
    activeHours:       [10, 11, 12, 13],
    activeDays:        [5, 6, 1], // Sat, Sun, Mon most active
    offPeakMultiplier: 0.05,
  },
  socialBias: {
    reciprocity:           1.0,
    inviteAfterHelped:     false,
    requestAfterMatch:     false,
    crossCommunityGrowth:  0.3,
  },
  inviteeRegions: ['Oakland', 'Berkeley', 'East_Bay_Other', 'Fremont'],
};
