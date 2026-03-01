import { Persona } from '../types';

export const fatimaAlHassan: Persona = {
  id: 'fatima-alhassan',
  name: 'Fatima Al-Hassan',
  email: 'fatima.alhassan@test.karmyq.com',
  password: 'password123',
  backstory: 'Pediatric nurse and mother of two in Fremont. Has lived in the same neighborhood for nine years and knows everyone on her street. Helps people instinctively but skeptically — she needs to trust something before recommending it. Joined Karmyq after her neighbor\'s car broke down and she saw how many people responded to help. Took her three weeks to post anything herself.',
  motivation: 'Make sure her East Bay neighborhood has the same energy she saw that day.',
  location: 'Fremont, CA',
  region: 'Fremont',
  profileType: 'browser',
  actionWeights: {
    browseRequests:   0.8,
    createRequest:    0.3,
    offerHelp:        0.4,
    acceptOffer:      0.6,
    completeMatch:    0.7,
    sendMessage:      0.4,
    generateInvite:   0.5,
    joinCommunity:    0.4,
    createCommunity:  0.4,
  },
  temporalPattern: {
    // Nurses work shifts — active early morning before work
    peakHours:         [5, 6, 7, 20, 21],
    activeHours:       [8, 9, 22],
    activeDays:        [0, 3, 4, 6], // Off days (nurse schedule)
    offPeakMultiplier: 0.02,
  },
  socialBias: {
    reciprocity:           1.3,
    inviteAfterHelped:     true,
    requestAfterMatch:     false,
    crossCommunityGrowth:  0.4,
  },
  inviteeRegions: ['Fremont', 'East_Bay_Other', 'Oakland'],
};

/**
 * Fatima's ramp-up schedule:
 * - Week 1-2: offPeakMultiplier stays low, action weights halved
 * - Week 3+:  full weights kick in
 * This is applied by the temporal scheduler based on account age.
 */
export const FATIMA_RAMP_WEEKS = 2;
