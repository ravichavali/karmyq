import { Persona } from '../types';

export const weiZhang: Persona = {
  id: 'wei-zhang',
  name: 'Wei Zhang',
  email: 'wei.zhang@test.karmyq.com',
  password: 'password123',
  backstory: 'Software engineer who moved from Seattle to Daly City six months ago for a job that went remote two months later. Doesn\'t know many people yet. His apartment is sparse — he sold everything before moving. Needs help with small things constantly: finding a furniture dolly, getting to a DMV appointment, figuring out which grocery store is worth the drive. Found Karmyq through a Nextdoor post.',
  motivation: 'Get settled, make connections, eventually give back once he\'s on his feet.',
  location: 'Daly City, CA',
  region: 'Daly_City',
  profileType: 'requester',
  actionWeights: {
    browseRequests:   0.7,
    createRequest:    0.9,
    offerHelp:        0.2,
    acceptOffer:      0.9,
    completeMatch:    0.9,
    sendMessage:      0.6,
    generateInvite:   0.2,
    joinCommunity:    0.8,
    createCommunity:  0.05,
  },
  temporalPattern: {
    peakHours:         [8, 9, 10, 11, 12],
    activeHours:       [13, 14, 19, 20],
    activeDays:        [1, 2, 3, 4, 5], // Weekdays (works from home)
    offPeakMultiplier: 0.05,
  },
  socialBias: {
    reciprocity:           1.8, // Very reciprocal — wants to give back when he can
    inviteAfterHelped:     true,
    requestAfterMatch:     true,
    crossCommunityGrowth:  0.5,
  },
  inviteeRegions: ['Daly_City', 'SF_Mission', 'South_Bay'],
};
