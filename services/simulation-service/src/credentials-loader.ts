/**
 * Load simulated user credentials from .env.{environment}.users file
 */

import * as fs from 'fs';
import * as path from 'path';

export interface UserCredentials {
  email: string;
  password: string;
  userId: string;
  name: string;
  profile: string;
}

/**
 * Load user credentials from environment-specific file
 */
export function loadUserCredentials(environment: string): UserCredentials[] {
  const credentialsFile = path.join(process.cwd(), `.env.${environment}.users`);

  if (!fs.existsSync(credentialsFile)) {
    console.warn(`⚠️  Credentials file not found: ${credentialsFile}`);
    console.warn(`   Run: node create-simulated-users.js --env ${environment} --count 20`);
    return [];
  }

  try {
    const content = fs.readFileSync(credentialsFile, 'utf-8');
    const lines = content.split('\n');

    const users: UserCredentials[] = [];
    let currentUser: Partial<UserCredentials> = {};
    let currentName = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        // Extract name from comment if present
        if (trimmed.startsWith('# ') && trimmed.includes('[')) {
          const match = trimmed.match(/# (.+?) \[(.+?)\]/);
          if (match) {
            currentName = match[1];
            currentUser.profile = match[2];
          }
        }
        continue;
      }

      // Parse key=value pairs
      const [key, value] = trimmed.split('=').map(s => s.trim());

      if (key && value) {
        if (key.includes('_EMAIL')) {
          currentUser.email = value;
        } else if (key.includes('_PASSWORD')) {
          currentUser.password = value;
        } else if (key.includes('_ID')) {
          currentUser.userId = value;
          currentUser.name = currentName;

          // User is complete, add to list
          if (currentUser.email && currentUser.password && currentUser.userId && currentUser.name && currentUser.profile) {
            users.push(currentUser as UserCredentials);
          }

          // Reset for next user
          currentUser = {};
          currentName = '';
        }
      }
    }

    console.log(`✅ Loaded ${users.length} user credentials from ${credentialsFile}`);
    return users;

  } catch (error: any) {
    console.error(`❌ Error loading credentials file: ${error.message}`);
    return [];
  }
}

/**
 * Get a random user from the loaded credentials
 */
export function getRandomUser(users: UserCredentials[]): UserCredentials | null {
  if (users.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * users.length);
  return users[index];
}
