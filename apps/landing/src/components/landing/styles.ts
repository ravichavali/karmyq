/**
 * Canonical Tailwind class strings for the public-site essay routes.
 *
 * These live in one place so the route pages, the Blocks renderer, and the CTA
 * primitives share exactly one definition of each visual token instead of
 * re-typing long className strings (which had already drifted between pages).
 * Spacing (margins) is intentionally left off so each call site can set its own
 * vertical rhythm without forking the font/color/size tokens.
 */

export const HEADING_1_CLASS =
  'font-serif text-4xl md:text-5xl font-light text-karmyq-green-700 leading-tight tracking-tight';

export const HEADING_2_CLASS =
  'font-serif text-2xl md:text-3xl font-normal text-karmyq-brown-900 leading-snug';

export const QUOTE_CLASS =
  'font-serif text-xl md:text-2xl italic text-karmyq-green-700 text-center border-y border-karmyq-brown-200 py-6 my-10 leading-relaxed';

export const PRIMARY_CTA_CLASS =
  'inline-flex items-center px-7 py-3 rounded-full bg-karmyq-green-600 text-white font-medium text-sm tracking-wide uppercase hover:bg-karmyq-green-700 transition-colors';

export const SECONDARY_CTA_CLASS =
  'inline-block font-medium text-sm tracking-wide uppercase text-karmyq-green-700 border-b border-karmyq-brown-200 pb-1 hover:text-karmyq-brown-900 hover:border-karmyq-brown-900 transition-colors';

/** Shared narrow essay-column width + horizontal padding. */
export const COLUMN_CLASS = 'max-w-3xl mx-auto px-6 md:px-8';
