/**
 * Sprint 89 / ADR-068 — the community page's warm four-tab model and the single deep-link resolver.
 *
 * The page collapsed ~10 legacy tabs (overview/people/requests/providers/settings/activities/trust/
 * governance/fission/fusion + aliases) into four warm tabs (+ a group-only Activities). This is the
 * ONE place that maps any legacy `?tab=` value into the new model so that no old link 404s or dead-
 * ends. Both the page AND the redirect test import this — never copy the map.
 */

export type CommunityTab = 'home' | 'people' | 'connected' | 'stewardship' | 'activities'

/** The canonical tab set, in display order (Activities is rendered group-only by the page). */
export const VALID_TABS: CommunityTab[] = ['home', 'people', 'connected', 'stewardship', 'activities']

/**
 * Every legacy alias → its warm-model home. Canonical tabs map to themselves. Anything unknown
 * (or undefined) falls back to Home — the default surface for every role.
 */
const TAB_ALIASES: Record<string, CommunityTab> = {
  // Home (the warm member feed — was the admin-gated `requests`/`overview`)
  home: 'home',
  overview: 'home',
  requests: 'home',
  // People (members list + norms + admin member management)
  people: 'people',
  manage: 'people',
  pending: 'people',
  members: 'people',
  norms: 'people',
  // How we're connected (community trust graph)
  connected: 'connected',
  trust: 'connected',
  // Stewardship (governance/split/fusion + admin steward requests/insights/settings/providers)
  stewardship: 'stewardship',
  governance: 'stewardship',
  fission: 'stewardship',
  fusion: 'stewardship',
  settings: 'stewardship',
  config: 'stewardship',
  links: 'stewardship',
  providers: 'stewardship',
  stats: 'stewardship',
  insights: 'stewardship',
  export: 'stewardship',
  // Activities (group-only 5th tab)
  activities: 'activities',
}

/** Resolve any raw `?tab=` value (legacy alias, canonical, or unknown) to a warm-model tab. */
export function resolveCommunityTab(raw: string | undefined | null): CommunityTab {
  if (!raw) return 'home'
  return TAB_ALIASES[raw] ?? 'home'
}

/** Sub-sections inside the Stewardship tab (some are admin-gated by `StewardshipTab`). */
export type StewardshipSection = 'decisions' | 'split' | 'fusion' | 'requests' | 'settings' | 'providers'

/**
 * Several legacy aliases collapse into Stewardship but pointed at *different* sub-surfaces
 * (`?tab=settings` opened settings, `?tab=fission` opened the split tool, …). This maps the raw
 * alias to the Stewardship sub-section it used to open, so an old deep link lands where it meant to
 * — not just on Stewardship's default. Returns `undefined` when there's no specific sub-section
 * (the tab then opens on Decisions).
 */
const STEWARDSHIP_SECTION_ALIASES: Record<string, StewardshipSection> = {
  governance: 'decisions',
  fission: 'split',
  fusion: 'fusion',
  settings: 'settings',
  config: 'settings',
  links: 'settings',
  providers: 'providers',
  stats: 'requests',
  insights: 'requests',
  export: 'requests',
}

/** Map a raw `?tab=` alias to the Stewardship sub-section it historically opened (or undefined). */
export function resolveStewardshipSection(raw: string | undefined | null): StewardshipSection | undefined {
  if (!raw) return undefined
  return STEWARDSHIP_SECTION_ALIASES[raw]
}
