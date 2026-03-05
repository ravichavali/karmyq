/**
 * Register as provider workflow
 *
 * Simulates a user registering as a service provider (ride, skill, etc.).
 * Skips if the user already has a provider profile for that service type.
 */

import { Workflow } from '../types';
import { delay, pickRandom } from '../utils';

const SERVICE_TYPES = ['ride', 'skill', 'errand', 'care', 'other'];

const DISPLAY_NAME_TEMPLATES: Record<string, string[]> = {
  ride: ['Rides with {name}', '{name} – Rideshare', '{name} Driver'],
  skill: ['{name} – Skills & Help', '{name} Handyperson', '{name} Repair & More'],
  errand: ['{name} Errands', '{name} – Errands & Delivery', 'Errands by {name}'],
  care: ['{name} – Care & Support', '{name} Caregiver', 'Care by {name}'],
  other: ['{name} – General Help', '{name} Community Helper', 'Help by {name}'],
};

const BIOS: Record<string, string[]> = {
  ride: [
    'Happy to offer rides around the neighborhood. Just ask!',
    'I drive a reliable car and love helping neighbors get around.',
    'Available evenings and weekends for local trips.',
  ],
  skill: [
    'Handy with tools and minor repairs. Happy to help neighbors.',
    'Years of DIY experience — reach out for home fixes, gardening, or IT help.',
    'I enjoy sharing skills with my community.',
  ],
  errand: [
    'I run errands regularly and can pick things up for neighbors.',
    'Going to the store anyway — happy to grab what you need.',
    'Available most weekday mornings for errands.',
  ],
  care: [
    'Experienced with elder care and childcare. Here to support neighbors.',
    'I offer friendly check-ins and companionship.',
    'Happy to help with care tasks for those who need it.',
  ],
  other: [
    'General helping hand in the community.',
    'Whatever you need, reach out and I will do my best.',
    'Love being part of a mutual aid network.',
  ],
};

export const registerAsProviderWorkflow: Workflow = async (context) => {
  const { session, sessionManager } = context;
  const client = sessionManager.getClient(session);
  const firstName = session.user.name.split(' ')[0] || session.user.name;

  console.log(`[${session.user.email}] Checking provider registration...`);

  try {
    // Check if already registered as a provider
    const existing = await sessionManager.executeAction(
      session,
      'getMyProviderProfiles',
      () => client.getMyProviderProfiles()
    );

    const existingTypes = new Set((existing || []).map((p: any) => p.service_type));

    // Pick a service type not yet registered
    const available = SERVICE_TYPES.filter(t => !existingTypes.has(t));
    if (available.length === 0) {
      console.log(`[${session.user.email}] Already registered for all service types`);
      return;
    }

    const serviceType = pickRandom(available) as string;
    const templates = DISPLAY_NAME_TEMPLATES[serviceType];
    const displayName = pickRandom(templates).replace('{name}', firstName);
    const bio = pickRandom(BIOS[serviceType]);

    // Simulate time to fill in the registration form
    await delay({ min: 10, max: 30, unit: 'seconds' });

    const profile = await sessionManager.executeAction(
      session,
      'registerAsProvider',
      () => client.registerProvider({ service_type: serviceType, display_name: displayName, bio })
    );

    if (profile) {
      console.log(`[${session.user.email}] Registered as provider: "${displayName}" (${serviceType})`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Register as provider workflow failed:`, error.message);
  }
};
