/**
 * Temporal scheduler — returns an activity multiplier for a persona
 * based on current time and how long they've been on the platform.
 *
 * Fatima's ramp-up arc: very low activity for first 2 weeks,
 * then full weights kick in. All browsers start at 30% and ramp.
 */

import { Persona, TemporalPattern } from '../personas/types';
import { FATIMA_RAMP_WEEKS } from '../personas/founders/fatima-alhassan';

/**
 * Returns a multiplier 0-1 representing how active this persona should
 * be right now. 0 = completely inactive, 1 = full activity.
 */
export function getActivityMultiplier(persona: Persona, accountCreatedAt: Date): number {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const pattern = persona.temporalPattern;

  // Time-of-day multiplier
  let timeMultiplier: number;
  if (pattern.peakHours.includes(hour)) {
    timeMultiplier = 1.0;
  } else if (pattern.activeHours.includes(hour)) {
    timeMultiplier = 0.5;
  } else {
    timeMultiplier = pattern.offPeakMultiplier;
  }

  // Day-of-week multiplier
  const dayMultiplier = pattern.activeDays.includes(day) ? 1.0 : 0.15;

  // Ramp-up for browser profile and Fatima specifically
  const rampMultiplier = getRampMultiplier(persona, accountCreatedAt);

  return timeMultiplier * dayMultiplier * rampMultiplier;
}

function getRampMultiplier(persona: Persona, accountCreatedAt: Date): number {
  const weeksOld = (Date.now() - accountCreatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000);

  // Fatima's specific ramp
  if (persona.id === 'fatima-alhassan') {
    if (weeksOld < FATIMA_RAMP_WEEKS) {
      return 0.1 + (weeksOld / FATIMA_RAMP_WEEKS) * 0.9;
    }
    return 1.0;
  }

  // All browser profiles ramp up over 2 weeks
  if (persona.profileType === 'browser') {
    const rampWeeks = 2;
    if (weeksOld < rampWeeks) {
      return 0.2 + (weeksOld / rampWeeks) * 0.8;
    }
    return 1.0;
  }

  // New invitees start at 60% and ramp to 100% over 1 week
  if (weeksOld < 1) {
    return 0.6 + weeksOld * 0.4;
  }

  return 1.0;
}

/**
 * Given a multiplier, decide whether to skip this tick entirely.
 * Uses the multiplier as a probability threshold.
 */
export function shouldActThisTick(multiplier: number): boolean {
  return Math.random() < multiplier;
}

/**
 * Select a workflow from weighted action map.
 * Returns null if all weights sum to 0 (shouldn't happen).
 */
export function selectAction(weights: Record<string, number>): string | null {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [action, weight] of entries) {
    r -= weight;
    if (r <= 0) return action;
  }
  return entries[entries.length - 1][0];
}
