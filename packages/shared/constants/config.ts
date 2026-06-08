// API Configuration
export const API_CONFIG = {
  // Use environment variable or default to localhost
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
  COMMUNITY_API_URL: process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002',
  REQUEST_API_URL: process.env.NEXT_PUBLIC_REQUEST_API_URL || 'http://localhost:3003',
  REPUTATION_API_URL: process.env.NEXT_PUBLIC_REPUTATION_API_URL || 'http://localhost:3004',
  NOTIFICATION_API_URL: process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3005',
  MESSAGING_API_URL: process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:3006',
  TIMEOUT: 10000,
};

// App Constants
export const APP_CONSTANTS = {
  MAX_COMMUNITY_MEMBERS: 150, // Dunbar's number
  DEFAULT_AVATAR: 'https://via.placeholder.com/150',
};

// Request Categories
export const REQUEST_CATEGORIES = [
  'Childcare',
  'Elder Care',
  'Transportation',
  'Home Repair',
  'Meal Preparation',
  'Errands',
  'Emotional Support',
  'Professional Help',
  'Other',
] as const;

// Urgency Levels
export const URGENCY_LEVELS = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;
