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

/** The single founding-circle call to action, rendered as the nav button. */
export const CTA_LINK = { label: 'Join the circle', href: '/join' } as const;

/**
 * Plain-text nav links shown on every page: the non-CTA routes plus Docs.
 * Join the circle is intentionally excluded here — it is the CTA button only,
 * never duplicated as a plain nav item.
 */
export const NAV_LINKS: { label: string; href: string }[] = [
  ...ROUTES.filter((r) => r.path !== CTA_LINK.href).map((r) => ({
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
