/**
 * Register a new simulated user via the API.
 * Called by the simulator's growth engine, not as a session workflow.
 */
import { ApiClient } from '../api-client';
import { FIRST_NAMES, LAST_NAMES } from '../data/realistic-data';
import { pickRandom } from '../utils';

export interface NewUserResult {
  id: string;
  email: string;
  name: string;
  token: string;
}

export async function registerNewUser(
  apiBaseUrl: string,
  emailDomain: string,
  password: string
): Promise<NewUserResult | null> {
  const client = new ApiClient(apiBaseUrl);

  const firstName = pickRandom(FIRST_NAMES);
  const lastName = pickRandom(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`;
  // Add random suffix to avoid collisions
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  const email = baseEmail.replace('@', `${suffix}@`);

  try {
    const result = await client.register({ email, name, password });
    if (!result || !result.user) {
      return null;
    }
    console.log(`[growth] Registered new user: ${name} <${email}>`);
    return {
      id: result.user.id,
      email,
      name,
      token: result.token
    };
  } catch (error: any) {
    console.error(`[growth] Failed to register ${email}:`, error.message);
    return null;
  }
}
