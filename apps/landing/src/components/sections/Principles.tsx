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
      'Every line of code is public. Fork it, improve it, make it yours. Knowledge wants to be free — and so does the infrastructure for cooperation.',
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
      'Each community governs itself. Choose your own rules, reputation model, and request types. No one-size-fits-all. No platform override.',
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
      'No tracking. No profiling. No ads. Interactions fade over time like footprints in sand. Your data belongs to your community.',
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
      'We don\'t reduce relationships to transactions. Helping builds meaning — stories, not spreadsheets. Community, not currency.',
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
      'Inspired by how living systems organize — mycelium networks, bee colonies, forest ecosystems. Resilient, adaptive, decentralized.',
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
      'We don\'t extract value from communities. No venture capital growth mandates. No monetization of relationships. Built to serve, not to scale.',
    color: 'bg-karmyq-orange-50 text-karmyq-orange-600',
  },
];

export default function Principles() {
  return (
    <section id="principles" className="section-padding bg-white">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-green-600 font-medium text-sm tracking-widest uppercase mb-4">
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
