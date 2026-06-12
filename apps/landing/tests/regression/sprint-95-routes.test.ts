/**
 * Sprint 95 — karmyq.org Multi-Route Relaunch — Route/Nav/Copy Regression
 *
 * Pure TypeScript tests against the extracted route + content contract
 * (src/lib/landingRoutes.ts, src/lib/landingContent.ts). No React/jsdom —
 * matches the landing Jest harness (`**​/tests/**​/*.test.ts`, ts-jest).
 *
 * These lock in the public information architecture: five static routes plus
 * /docs, exact source meta descriptions, story-only home, route-aware nav with
 * a single Join CTA button, isolated star-line emphasis, and the forbidden-copy
 * guarantees (no "LinkedIn", no "Roy", no standalone "In Defense of Gossip").
 */

import {
  ROUTES,
  NAV_LINKS,
  CTA_LINK,
  DOCS_LINK,
  ALL_ROUTE_PATHS,
  routeByPath,
} from '../../src/lib/landingRoutes';
import {
  homeContent,
  principlesContent,
  howItWorksContent,
  researchContent,
  joinContent,
  blocksToText,
  homeStarLines,
  ESSAY_TITLES,
  allRouteText,
} from '../../src/lib/landingContent';

// Exact meta descriptions copied verbatim from the v5 source HTML files.
const EXPECTED_DESCRIPTIONS: Record<string, string> = {
  '/':
    'Open-source infrastructure for neighborhoods, mutual aid groups, and local communities to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.',
  '/principles':
    'Built on values, not valuations. The six principles behind every technical decision in Karmyq.',
  '/how-it-works':
    'How Karmyq works: reputation without performance, trust without scores, governance without permanent roles, communities that split and merge by their own judgment.',
  '/research':
    'The researchers Karmyq is standing on: Ostrom, Dunbar, Henrich, Mauss, Simard, Haidt, Putnam, Arthur, Scholz, Bregman, Graeber. Load-bearing walls, not footnotes.',
  '/join':
    "Karmyq's founding circle: pressure-test the idea, name what's missing, and help decide what the platform must become before communities depend on it.",
};

describe('route contract', () => {
  test('all expected public routes plus /docs are present', () => {
    for (const path of ['/', '/principles', '/how-it-works', '/research', '/join', '/docs']) {
      expect(ALL_ROUTE_PATHS).toContain(path);
    }
  });

  test('five public routes are defined in nav order', () => {
    expect(ROUTES.map((r) => r.path)).toEqual([
      '/',
      '/principles',
      '/how-it-works',
      '/research',
      '/join',
    ]);
  });

  test('each public route carries the exact source-file meta description', () => {
    for (const route of ROUTES) {
      expect(route.description).toBe(EXPECTED_DESCRIPTIONS[route.path]);
    }
  });

  test('routeByPath resolves known routes and ignores unknown ones', () => {
    expect(routeByPath('/research')?.navLabel).toBe('Research');
    expect(routeByPath('/nope')).toBeUndefined();
  });
});

describe('nav contract', () => {
  test('nav links cover Story, Principles, How it works, Research, Docs', () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual([
      'Story',
      'Principles',
      'How it works',
      'Research',
      'Docs',
    ]);
  });

  test('nav links point at the right paths', () => {
    const byLabel = Object.fromEntries(NAV_LINKS.map((l) => [l.label, l.href]));
    expect(byLabel['Story']).toBe('/');
    expect(byLabel['Principles']).toBe('/principles');
    expect(byLabel['How it works']).toBe('/how-it-works');
    expect(byLabel['Research']).toBe('/research');
    expect(byLabel['Docs']).toBe('/docs');
  });

  test('Docs is reachable and unchanged', () => {
    expect(DOCS_LINK.href).toBe('/docs');
  });

  test('Join the circle is the CTA button to /join, not a plain nav item', () => {
    expect(CTA_LINK.label).toBe('Join the circle');
    expect(CTA_LINK.href).toBe('/join');
    // The CTA must not be duplicated as a plain text nav link.
    expect(NAV_LINKS.some((l) => l.label === 'Join the circle')).toBe(false);
    expect(NAV_LINKS.some((l) => l.href === '/join')).toBe(false);
  });
});

describe('home is story-only', () => {
  test('home contains the founding story and founder note', () => {
    const text = blocksToText(homeContent.hero) + blocksToText(homeContent.thinking);
    expect(text).toContain('Help build the neighborhood layer the internet forgot.');
    expect(homeContent.founderNote.attribution).toContain('Ravi Chavali');
  });

  test('home does not inline the other routes’ page blocks', () => {
    const homeText =
      blocksToText(homeContent.hero) +
      blocksToText(homeContent.thinking) +
      homeContent.standTogether.join(' ');
    // Principles page H1
    expect(homeText).not.toContain('Built on values, not valuations.');
    // Research page H1
    expect(homeText).not.toContain('Load-bearing walls, not footnotes.');
    // How-it-works design-essay title
    expect(homeText).not.toContain('The Problem with Stars');
    // Join page section
    expect(homeText).not.toContain('The circle needs more than software.');
  });
});

describe('star-line emphasis', () => {
  test('home exposes isolated star-line emphasis entries', () => {
    const lines = homeStarLines();
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines).toContain('Karmyq is a bet on the slower game.');
  });

  test('star lines are marked as star blocks, never plain paragraphs', () => {
    const starTexts = new Set(homeStarLines());
    const paragraphTexts = homeContent.thinking
      .filter((b) => b.kind === 'p')
      .map((b) => blocksToText([b]));
    for (const star of starTexts) {
      expect(paragraphTexts).not.toContain(star);
    }
    // Every star line originates from a block of kind 'star'.
    const starBlockTexts = homeContent.thinking
      .filter((b) => b.kind === 'star')
      .map((b) => blocksToText([b]));
    for (const star of starTexts) {
      expect(starBlockTexts).toContain(star);
    }
  });
});

describe('essay structure', () => {
  test('"The Problem with Stars" is the single merged reputation essay', () => {
    expect(ESSAY_TITLES).toContain('The Problem with Stars');
  });

  test('"Why No Role Is Permanent" exists as the governance essay', () => {
    expect(ESSAY_TITLES).toContain('Why No Role Is Permanent');
  });

  test('"In Defense of Gossip" is not a standalone essay/card title', () => {
    expect(ESSAY_TITLES.some((t) => /in defense of gossip/i.test(t))).toBe(false);
  });

  test('how-it-works carries the merged reputation essay', () => {
    const titles = howItWorksContent.essays.map((e) => e.title);
    expect(titles).toContain('The Problem with Stars');
    expect(titles).toContain('Why No Role Is Permanent');
  });
});

describe('content shape sanity', () => {
  test('principles route lists exactly six principles', () => {
    expect(principlesContent.principles).toHaveLength(6);
  });

  test('research route lists the eleven named thinkers', () => {
    const names = researchContent.thinkers.map((t) => t.name);
    expect(names).toContain('Elinor Ostrom');
    expect(names).toContain('David Graeber');
    expect(researchContent.thinkers).toHaveLength(11);
  });

  test('join route exposes specialist/builder/organizer lanes', () => {
    const audiences = joinContent.lanes.map((l) => l.audience.toLowerCase());
    expect(audiences.join(' ')).toContain('specialist');
    expect(audiences.join(' ')).toContain('builder');
    expect(audiences.join(' ')).toContain('organizer');
  });
});

describe('forbidden copy is absent everywhere', () => {
  const corpus = allRouteText();

  test('no "LinkedIn relaunch" wording', () => {
    expect(corpus).not.toContain('LinkedIn');
  });

  test('no Roy quote', () => {
    expect(/\bRoy\b/.test(corpus)).toBe(false);
  });

  test('no forbidden mechanics implications in surfaced copy', () => {
    // "founder group" framing is forbidden; "founding circle" is allowed.
    expect(corpus.toLowerCase()).not.toContain('founder group');
    expect(corpus.toLowerCase()).not.toContain('founding group');
  });
});
