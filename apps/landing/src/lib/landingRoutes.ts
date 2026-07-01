/**
 * Public-site route + navigation contract for karmyq.org (Sprint 95).
 *
 * Pure data, no React — so the landing Jest harness can test the route/nav
 * information architecture without a component/jsdom stack. Pages and the
 * shared Header/Footer consume these values so nav can never drift from the
 * routes it points at.
 *
 * Meta descriptions are copied verbatim from the v5 source HTML files and are
 * regression-locked in tests/regression/sprint-95-routes.test.ts.
 */

export interface RouteMeta {
  /** Stable key for the route. */
  key: 'home' | 'principles' | 'how-it-works' | 'research' | 'join';
  /** App Router path. */
  path: string;
  /** Label shown in the shared nav. */
  navLabel: string;
  /** <title> for the route. */
  title: string;
  /** <meta name="description"> for the route (exact, from v5 sources). */
  description: string;
}

/** The five public essay/invitation routes, in nav order. */
export const ROUTES: RouteMeta[] = [
  {
    key: 'home',
    path: '/',
    navLabel: 'Story',
    title: 'Karmyq — Help build the neighborhood layer the internet forgot',
    description:
      'Open-source infrastructure for neighborhoods, mutual aid groups, and local communities to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.',
  },
  {
    key: 'principles',
    path: '/principles',
    navLabel: 'Principles',
    title: 'Karmyq — Our principles',
    description:
      'Built on values, not valuations. The six principles behind every technical decision in Karmyq.',
  },
  {
    key: 'how-it-works',
    path: '/how-it-works',
    navLabel: 'How it works',
    title: 'Karmyq — How it works',
    description:
      'How Karmyq works: reputation without performance, trust without scores, governance without permanent roles, communities that split and merge by their own judgment.',
  },
  {
    key: 'research',
    path: '/research',
    navLabel: 'Research',
    title: 'Karmyq — The research foundation',
    description:
      'The researchers Karmyq is standing on: Ostrom, Dunbar, Henrich, Mauss, Simard, Haidt, Putnam, Arthur, Scholz, Bregman, Graeber. Load-bearing walls, not footnotes.',
  },
  {
    key: 'join',
    path: '/join',
    navLabel: 'Join the circle',
    title: 'Karmyq — Join the founding circle',
    description:
      "Karmyq's founding circle: pressure-test the idea, name what's missing, and help decide what the platform must become before communities depend on it.",
  },
];

/** Generated docs site — unchanged in Sprint 95, reachable from every page. */
export const DOCS_LINK = { label: 'Docs', href: '/docs' } as const;

/**
 * Sprint 116 / ADR-084 — three DISTINCT entry paths. These must never collapse into
 * one another. Join the Platform is ordinary registration; the Founding Circle (/join)
 * is the separate invitation path; Explore opens the read-only live demo. Explore and
 * Join the Platform are cross-site absolute URLs to the app (karmyq.com); the Founding
 * Circle stays an internal karmyq.org route.
 */
export const EXPLORE_LINK = { label: 'Explore the live demo', href: 'https://karmyq.com/demo' } as const;
export const JOIN_PLATFORM_LINK = { label: 'Join the Platform', href: 'https://karmyq.com/register' } as const;
export const FOUNDING_CIRCLE_LINK = { label: 'Join the Founding Circle', href: '/join' } as const;

/**
 * The ordered primary call-to-action set rendered on desktop and mobile: Explore first
 * (lowest-commitment), then Join the Platform, then the quieter Founding Circle. The
 * home logo owns the Story/home route, so it is intentionally absent here.
 */
export const PRIMARY_CTAS: ReadonlyArray<{ label: string; href: string }> = [
  EXPLORE_LINK,
  JOIN_PLATFORM_LINK,
  FOUNDING_CIRCLE_LINK,
];

/**
 * Plain-text nav links shown on every page: the essay routes plus Docs.
 * The founding-circle route (/join) is intentionally excluded here — it is a primary
 * CTA only, never duplicated as a plain nav item.
 */
export const NAV_LINKS: { label: string; href: string }[] = [
  ...ROUTES.filter((r) => r.path !== FOUNDING_CIRCLE_LINK.href).map((r) => ({
    label: r.navLabel,
    href: r.path,
  })),
  { label: DOCS_LINK.label, href: DOCS_LINK.href },
];

/** Every routable path the public site owns, including generated docs. */
export const ALL_ROUTE_PATHS: string[] = [
  ...ROUTES.map((r) => r.path),
  DOCS_LINK.href,
];

export function routeByPath(path: string): RouteMeta | undefined {
  return ROUTES.find((r) => r.path === path);
}

export function routeByKey(key: RouteMeta['key']): RouteMeta {
  const route = ROUTES.find((r) => r.key === key);
  if (!route) throw new Error(`Unknown route key: ${key}`);
  return route;
}

/** Canonical origin for the public commons site. */
export const SITE_URL = 'https://karmyq.org';

/** Absolute canonical URL for a route path (`/` maps to the bare origin). */
export function absoluteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Per-route Next.js metadata (title, description, canonical, Open Graph) built
 * from the single route contract, so every route ships correct, route-specific
 * social cards and canonical URLs instead of inheriting the layout default.
 * Shape is structurally compatible with Next's `Metadata`; pages annotate the
 * assignment with `Metadata`.
 */
export function buildRouteMetadata(key: RouteMeta['key']) {
  const route = routeByKey(key);
  const url = absoluteUrl(route.path);
  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: url },
    openGraph: {
      title: route.title,
      description: route.description,
      url,
      siteName: 'Karmyq',
      type: 'website' as const,
    },
  };
}
