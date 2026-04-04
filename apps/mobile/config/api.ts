// import { Platform } from "react-native"; // Available for platform-specific config when needed

/**
 * Centralized API Configuration
 *
 * All API endpoints should use these constants to ensure consistency
 * across the mobile app (web, iOS, Android).
 *
 * Configuration priority:
 * 1. EXPO_PUBLIC_API_HOST environment variable (from .env)
 * 2. Platform-specific defaults:
 *    - Android emulator: 10.0.2.2
 *    - Web/iOS: localhost
 *
 * For development on physical devices, set EXPO_PUBLIC_API_HOST
 * in .env to your computer's local IP address (e.g., 192.168.0.163)
 */

// TEMPORARY: Hardcoded for development
// TODO: Switch back to environment variable when Metro bundler env var issue is resolved (See ROADMAP.md Backlog #25)
const API_HOST = "192.168.0.163";

// Alternative: Use environment variable with platform-specific fallback
// const API_HOST = process.env.EXPO_PUBLIC_API_HOST ||
//   (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

/**
 * Service URLs for all backend services
 */
export const API_CONFIG = {
  AUTH_URL: `http://${API_HOST}:3001`,
  COMMUNITY_URL: `http://${API_HOST}:3002`,
  REQUEST_URL: `http://${API_HOST}:3003`,
  REPUTATION_URL: `http://${API_HOST}:3004`,
  NOTIFICATION_URL: `http://${API_HOST}:3005`,
  MESSAGING_URL: `http://${API_HOST}:3006`,
  FEED_URL: `http://${API_HOST}:3007`,

  // Base host for constructing custom URLs
  BASE_HOST: API_HOST,
};

export default API_CONFIG;
