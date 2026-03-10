/**
 * Register as provider workflow
 *
 * Simulates a user registering as a service provider (ride, skill, etc.).
 * Skips if the user already has a provider profile for that service type.
 */

import { Workflow } from '../types';
import { delay, pickRandom, randomInt } from '../utils';
import { pickProvider } from '../data/realistic-data';

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

    const existingTypes = (existing || []).map((p: any) => p.service_type as string);

    const SERVICE_TYPES = ['ride', 'tradesperson', 'tutor', 'other'];
    if (existingTypes.length >= SERVICE_TYPES.length) {
      console.log(`[${session.user.email}] Already registered for all service types`);
      return;
    }

    const provider = pickProvider(firstName, existingTypes);

    const { service_type: serviceType, display_name: displayName, bio, pricing_notes, location_notes } = provider;

    // Build registration payload; ride providers include vehicle details
    const registrationPayload: Record<string, any> = { service_type: serviceType, display_name: displayName, bio, pricing_notes, location_notes };
    if (serviceType === 'ride') {
      registrationPayload.ride_details = {
        vehicle_type: pickRandom(['sedan', 'suv', 'minivan']),
        max_passengers: randomInt(2, 5),
        advance_booking_required: Math.random() > 0.5,
      };
    }

    // Simulate time to fill in the registration form
    await delay({ min: 10, max: 30, unit: 'seconds' });

    const profile = await sessionManager.executeAction(
      session,
      'registerAsProvider',
      () => client.registerProvider(registrationPayload)
    );

    if (profile) {
      console.log(`[${session.user.email}] Registered as provider: "${displayName}" (${serviceType})`);
    }

  } catch (error: any) {
    console.error(`[${session.user.email}] Register as provider workflow failed:`, error.message);
  }
};
