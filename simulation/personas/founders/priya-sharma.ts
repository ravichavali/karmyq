import { Persona } from '../types';

export const priyaSharma: Persona = {
  id: 'priya-sharma',
  name: 'Priya Sharma',
  email: 'priya.sharma@test.karmyq.com',
  password: 'password123',
  backstory: 'Product manager at a Series B startup in Palo Alto. Has lived in four Bay Area cities in ten years and knows people everywhere. Organizes the annual Caltrain corridor neighborhood cleanup, runs a Slack for her condo building, and has group chats for every context of her life. Joined Karmyq to stop managing everything in WhatsApp.',
  motivation: 'Connect people who should know each other but don\'t yet.',
  location: 'Palo Alto, CA',
  region: 'Palo_Alto',
  profileType: 'socialUser',
  actionWeights: {
    browseRequests:   0.6,
    createRequest:    0.3,
    offerHelp:        0.5,
    acceptOffer:      0.5,
    completeMatch:    0.6,
    sendMessage:      0.9,
    generateInvite:   1.0,
    joinCommunity:    0.8,
    createCommunity:      0.3,
    registerAsProvider:   0.5,  // Priya bridges communities — knows how to offer services
    joinCollective:       0.7,  // Connector loves collectives
  },
  temporalPattern: {
    peakHours:         [7, 8, 12, 13, 18, 19, 20],
    activeHours:       [9, 10, 11, 14, 15, 16, 17, 21],
    activeDays:        [0, 1, 2, 3, 4, 5, 6],
    offPeakMultiplier: 0.2,
  },
  socialBias: {
    reciprocity:           1.2,
    inviteAfterHelped:     true,
    requestAfterMatch:     false,
    crossCommunityGrowth:  1.0,
  },
  inviteeRegions: ['Palo_Alto', 'Peninsula', 'South_Bay', 'SF_Other', 'Oakland'],
};
