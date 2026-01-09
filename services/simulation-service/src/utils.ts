/**
 * Utility functions for simulation
 */

import { TimeRange } from './types';

/**
 * Random number between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random element from array
 */
export function pickRandom<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

/**
 * Delay for specified time range
 */
export async function delay(range: TimeRange): Promise<void>;
export async function delay(ms: number): Promise<void>;
export async function delay(rangeOrMs: TimeRange | number): Promise<void> {
  const ms = typeof rangeOrMs === 'number'
    ? rangeOrMs
    : randomInt(rangeOrMs.min, rangeOrMs.max) * timeUnitToMs(rangeOrMs.unit);

  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert time unit to milliseconds
 */
export function timeUnitToMs(unit: 'seconds' | 'minutes' | 'hours'): number {
  switch (unit) {
    case 'seconds': return 1000;
    case 'minutes': return 60 * 1000;
    case 'hours': return 60 * 60 * 1000;
  }
}

/**
 * Generate random request titles
 */
export const REQUEST_TITLES = [
  'Need help moving furniture',
  'Looking for a ride to the airport',
  'Can someone help me with groceries?',
  'Need babysitter for Saturday evening',
  'Help with computer setup needed',
  'Looking for someone to walk my dog',
  'Need assistance with yard work',
  'Can anyone help me fix my leaky faucet?',
  'Looking for tutoring help',
  'Need help planning a birthday party'
];

/**
 * Generate random offer messages
 */
export const OFFER_MESSAGES = [
  'I can help with this!',
  'Happy to assist, let me know when works for you',
  'I have some free time this weekend',
  'This sounds like something I can help with',
  'I\'d be glad to help out',
  'Count me in!',
  'I can do this, just let me know the details',
  'Available to help, message me!'
];

/**
 * Generate random chat messages
 */
export const CHAT_MESSAGES = [
  'Thanks so much for offering to help!',
  'What time works best for you?',
  'I really appreciate this',
  'Let me know if you need anything',
  'Sounds good!',
  'Perfect, see you then',
  'Thanks again!',
  'You\'re a lifesaver'
];

/**
 * Check if current time is within business hours
 */
export function isBusinessHours(config: { start: string; end: string; timezone: string }): boolean {
  const now = new Date();
  const [startHour, startMin] = config.start.split(':').map(Number);
  const [endHour, endMin] = config.end.split(':').map(Number);

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTime = currentHour * 60 + currentMin;
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Exponential backoff for rate limiting
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      if (err.response?.status === 429 && retries < maxRetries - 1) {
        const waitTime = Math.pow(2, retries) * baseDelay;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
        await delay(waitTime);
        retries++;
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
