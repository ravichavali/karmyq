import { Persona } from '../types';

export const mariaReyes: Persona = {
  id: 'maria-reyes',
  name: 'Maria Elena Reyes',
  email: 'maria.reyes@test.karmyq.com',
  password: 'password123',
  backstory: 'Former program manager at a San Francisco nonprofit. Left after a decade when budget cuts gutted the programs she built. Believes deeply that neighbors can take care of each other without waiting for institutions. Started Karmyq with friends after her landlord raised rent and three neighbors helped her move.',
  motivation: 'Build the community she wished existed when she needed it most.',
  location: 'Mission District, San Francisco',
  region: 'SF_Mission',
  profileType: 'communityBuilder',
  actionWeights: {
    browseRequests:   0.5,
    createRequest:    0.2,
    offerHelp:        0.5,
    acceptOffer:      0.7,
    completeMatch:    0.8,
    sendMessage:      0.7,
    generateInvite:   0.9,
    joinCommunity:    0.4,
    createCommunity:      0.6,
    registerAsProvider:   0.3,  // Maria is a community organizer, not primarily a service provider
    joinCollective:       0.4,
  },
  temporalPattern: {
    peakHours:         [7, 8, 9, 19, 20, 21],
    activeHours:       [10, 11, 12, 17, 18],
    activeDays:        [0, 1, 2, 3, 4, 5, 6], // All days
    offPeakMultiplier: 0.1,
  },
  socialBias: {
    reciprocity:           1.5,
    inviteAfterHelped:     true,
    requestAfterMatch:     true,
    crossCommunityGrowth:  0.8,
  },
  inviteeRegions: ['SF_Mission', 'SF_Other', 'Oakland', 'Daly_City'],
};
