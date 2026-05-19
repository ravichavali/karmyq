'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const PRINCIPLES = [
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 34c0-7-4-10-4-16a4 4 0 018 0c0 6-4 9-4 16z" strokeLinejoin="round" />
        <path d="M16 34h8" strokeLinecap="round" />
        <path d="M14 12c-2-2-2-6 1-8" strokeLinecap="round" />
        <path d="M26 12c2-2 2-6-1-8" strokeLinecap="round" />
        <path d="M17 36h6" strokeLinecap="round" />
      </svg>
    ),
    title: 'Open source',
    description:
      'Every line of code is public. The infrastructure for community cooperation should belong to communities, not to a company with a growth mandate. Fork it, run it yourself, or build something better.',
    color: 'bg-karmyq-green-50 text-karmyq-green-600',
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="10" y="18" width="6" height="10" rx="1" strokeLinejoin="round" />
        <rect x="17" y="14" width="6" height="14" rx="1" strokeLinejoin="round" />
        <rect x="24" y="18" width="6" height="10" rx="1" strokeLinejoin="round" />
        <path d="M8 28h24" strokeLinecap="round" />
        <path d="M14 18v-3a6 6 0 0112 0v3" />
      </svg>
    ),
    title: 'Community sovereignty',
    description:
      'Each community sets its own rules — membership criteria, how trust flows, what kinds of help to enable. No platform override, ever. The platform holds the infrastructure; the community holds the power.',
    color: 'bg-karmyq-orange-50 text-karmyq-orange-600',
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="20" cy="20" r="10" />
        <path d="M25 18c0 0-2 6-8 6" strokeLinecap="round" />
        <circle cx="16" cy="18" r="1.5" fill="currentColor" />
        <circle cx="24" cy="18" r="1.5" fill="currentColor" />
        <path d="M14 32l-2 4M26 32l2 4" strokeLinecap="round" opacity="0.4" />
        <path d="M10 30l-3 3M30 30l3 3" strokeLinecap="round" opacity="0.25" />
      </svg>
    ),
    title: 'Privacy as default',
    description:
      'No tracking. No ads. No profiling. Your interaction history belongs to your community, not to a database that outlives your membership. What you do inside a community stays inside a community.',
    color: 'bg-karmyq-teal-50 text-karmyq-teal-600',
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 28c4-2 6-8 6-14h4c0 4-1 8-3 11" strokeLinecap="round" />
        <path d="M32 28c-4-2-6-8-6-14h-4c0 4 1 8 3 11" strokeLinecap="round" />
        <circle cx="20" cy="12" r="3" />
        <path d="M16 32h8" strokeLinecap="round" />
        <path d="M20 28v4" strokeLinecap="round" />
      </svg>
    ),
    title: 'Meaning-making',
    description:
      'The point is not efficiency. It is the relationship that forms when someone shows up, and the one that forms when you let them. We are not optimizing a transaction. We are building the conditions for community.',
    color: 'bg-karmyq-brown-50 text-karmyq-brown-500',
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="20" cy="20" r="4" />
        <circle cx="20" cy="20" r="10" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="28" cy="12" r="2" />
        <circle cx="12" cy="28" r="2" />
        <circle cx="28" cy="28" r="2" />
        <path d="M14 14l4 4M22 18l4-4M18 22l-4 4M22 22l4 4" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
    title: 'Biomimetic design',
    description:
      'Healthy ecosystems are diverse, adaptive, and resistant to monoculture. So is Karmyq. A thousand communities with different rules, different trust models, different ways of cooperating — each adapted to its people.',
    color: 'bg-karmyq-green-50 text-karmyq-green-600',
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 8c-6 0-10 4-10 9 0 4 3 7 6 8v3h8v-3c3-1 6-4 6-8 0-5-4-9-10-9z" strokeLinejoin="round" />
        <path d="M16 28h8v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2z" />
        <path d="M15 18h10" strokeLinecap="round" opacity="0.3" />
        <path d="M20 14v8" strokeLinecap="round" opacity="0.3" />
      </svg>
    ),
    title: 'No extraction',
    description:
      'Karmyq does not take a cut of trust. No ads, no data brokering, no VC growth mandate. The measure of success is not how much you use this platform. It is how little you eventually need to.',
    color: 'bg-karmyq-orange-50 text-karmyq-orange-600',
  },
];

export default function Principles() {
  return (
    <section id="principles" className="section-padding bg-white">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-green-600 font-medium text-xs tracking-widest uppercase mb-4">
              Our principles
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              Built on values, not valuations.
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              Every technical decision flows from these principles.
              They&apos;re not marketing — they&apos;re architecture.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRINCIPLES.map((principle, i) => (
            <AnimateOnScroll key={principle.title} delay={0.1 + i * 0.08}>
              <div className="card h-full">
                <div className={`w-16 h-16 rounded-2xl ${principle.color} flex items-center justify-center mb-5`}>
                  {principle.icon}
                </div>
                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mb-3">
                  {principle.title}
                </h3>
                <p className="text-karmyq-brown-600 leading-relaxed">
                  {principle.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
