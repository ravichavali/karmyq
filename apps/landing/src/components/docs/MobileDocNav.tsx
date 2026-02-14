'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import navData from '@/data/docs/nav.json';

export default function MobileDocNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-karmyq-brown-600 border border-karmyq-brown-200 rounded-lg px-4 py-2 w-full hover:bg-karmyq-green-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Documentation Menu
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <nav className="mt-2 border border-karmyq-brown-200 rounded-lg p-4 bg-white max-h-80 overflow-y-auto">
          {navData.sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-1">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block text-sm py-1 px-2 rounded ${
                        pathname === item.href
                          ? 'text-karmyq-green-700 font-medium bg-karmyq-green-50'
                          : 'text-karmyq-brown-600 hover:text-karmyq-green-600'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
