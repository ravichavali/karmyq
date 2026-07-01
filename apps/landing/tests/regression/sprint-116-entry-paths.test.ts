/**
 * Sprint 116 — Guided Entry: three distinct entry paths on karmyq.org.
 *
 * The public site now offers three separate destinations that must never collapse
 * into one another: Explore the live demo (karmyq.com/demo), Join the Platform
 * (ordinary registration at karmyq.com/register), and Join the Founding Circle
 * (/join). Pure data contract — no React, matching the landing ts-jest harness.
 */

import {
  EXPLORE_LINK,
  JOIN_PLATFORM_LINK,
  FOUNDING_CIRCLE_LINK,
  PRIMARY_CTAS,
} from '../../src/lib/landingRoutes';

describe('Sprint 116 — three distinct entry paths', () => {
  test('Explore points at the live demo', () => {
    expect(EXPLORE_LINK.label).toBe('Explore the live demo');
    expect(EXPLORE_LINK.href).toBe('https://karmyq.com/demo');
  });

  test('Join the Platform is ordinary registration, never the founding circle', () => {
    expect(JOIN_PLATFORM_LINK.label).toBe('Join the Platform');
    expect(JOIN_PLATFORM_LINK.href).toBe('https://karmyq.com/register');
    expect(JOIN_PLATFORM_LINK.href).not.toBe(FOUNDING_CIRCLE_LINK.href);
    expect(JOIN_PLATFORM_LINK.href).not.toBe('/join');
  });

  test('Founding Circle remains the /join path', () => {
    expect(FOUNDING_CIRCLE_LINK.label).toBe('Join the Founding Circle');
    expect(FOUNDING_CIRCLE_LINK.href).toBe('/join');
  });

  test('the primary CTA set carries all three destinations in order', () => {
    expect(PRIMARY_CTAS.map((c) => c.href)).toEqual([
      'https://karmyq.com/demo',
      'https://karmyq.com/register',
      '/join',
    ]);
  });

  test('Story is not duplicated as a CTA — the logo owns home', () => {
    expect(PRIMARY_CTAS.some((c) => c.href === '/')).toBe(false);
    expect(PRIMARY_CTAS.some((c) => /story/i.test(c.label))).toBe(false);
  });
});
