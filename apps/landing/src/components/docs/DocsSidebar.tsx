'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import navData from '@/data/docs/nav.json';

export default function DocsSidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(navData.sections.map((s) => [s.title, true]))
  );

  const toggle = (title: string) =>
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <aside className="w-64 shrink-0 hidden lg:block">
      <nav className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 pb-8">
        {navData.sections.map((section) => (
          <div key={section.title} className="mb-6">
            <button
              onClick={() => toggle(section.title)}
              className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-2 hover:text-karmyq-green-600 transition-colors"
            >
              {section.title}
              <svg
                className={`w-3 h-3 transition-transform ${expandedSections[section.title] ? 'rotate-0' : '-rotate-90'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections[section.title] && (
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block text-sm py-1 px-3 rounded-md transition-colors ${
                          active
                            ? 'bg-karmyq-green-50 text-karmyq-green-700 font-medium'
                            : 'text-karmyq-brown-600 hover:text-karmyq-green-600 hover:bg-karmyq-green-50/50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
