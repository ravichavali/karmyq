'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { NAV_LINKS, EXPLORE_LINK, JOIN_PLATFORM_LINK, FOUNDING_CIRCLE_LINK } from '../lib/landingRoutes';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-karmyq-warmWhite/95 backdrop-blur-md border-b border-karmyq-brown-100 transition-shadow duration-300 ${
        scrolled ? 'shadow-xs' : ''
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-20">
        {/* Wordmark — route-safe home link */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/brand/karmyq-mark-1level.svg" width={28} height={28} alt="" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-karmyq-green-700">
            Karmyq
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-karmyq-brown-700 hover:text-karmyq-green-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {/* Three distinct entry paths (Sprint 116): Explore, Join the Platform, Founding Circle. */}
          <a
            href={EXPLORE_LINK.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-karmyq-green-600 text-white text-sm font-medium hover:bg-karmyq-green-700 transition-colors"
          >
            {EXPLORE_LINK.label}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a
            href={JOIN_PLATFORM_LINK.href}
            className="inline-flex items-center px-5 py-2.5 rounded-full border border-karmyq-green-600 text-karmyq-green-700 text-sm font-medium hover:bg-karmyq-green-50 transition-colors"
          >
            {JOIN_PLATFORM_LINK.label}
          </a>
          <Link
            href={FOUNDING_CIRCLE_LINK.href}
            className="text-sm font-medium text-karmyq-brown-700 hover:text-karmyq-green-600 transition-colors"
          >
            {FOUNDING_CIRCLE_LINK.label}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-karmyq-brown-700"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu — full nav loop, closes after navigation */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-karmyq-warmWhite border-t border-karmyq-brown-100 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-karmyq-brown-700 hover:text-karmyq-green-600 transition-colors py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {/* All three entry paths stay separately visible on mobile — never hidden
                  behind a single primary action. */}
              <a
                href={EXPLORE_LINK.href}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-karmyq-green-600 text-white text-base font-medium mt-2"
                onClick={() => setMenuOpen(false)}
              >
                {EXPLORE_LINK.label}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href={JOIN_PLATFORM_LINK.href}
                className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-karmyq-green-600 text-karmyq-green-700 text-base font-medium"
                onClick={() => setMenuOpen(false)}
              >
                {JOIN_PLATFORM_LINK.label}
              </a>
              <Link
                href={FOUNDING_CIRCLE_LINK.href}
                className="text-base font-medium text-karmyq-brown-700 hover:text-karmyq-green-600 transition-colors py-2"
                onClick={() => setMenuOpen(false)}
              >
                {FOUNDING_CIRCLE_LINK.label}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
