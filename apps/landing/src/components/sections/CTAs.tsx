'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const AUDIENCES = [
  {
    title: 'For community organizers',
    description:
      'Configure request types, set governance rules, grow your community organically. The first communities will shape everything that comes after.',
    cta: 'Start a community',
    href: 'https://karmyq.com',
    gradient: 'from-karmyq-green-500 to-karmyq-green-700',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5">
        <circle cx="16" cy="10" r="4" />
        <circle cx="8" cy="22" r="3" />
        <circle cx="24" cy="22" r="3" />
        <path d="M12 12l-2 8M20 12l2 8M11 22h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'For developers',
    description:
      'Karmyq is open source. Contribute to the platform, build integrations, or fork it for your context. The governance service is intentionally minimal — great territory for contributors.',
    cta: 'View on GitHub',
    href: 'https://github.com/ravichavali/karmyq',
    gradient: 'from-karmyq-brown-600 to-karmyq-brown-800',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 20l4-8 4 8M12 17h4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 12v8" strokeLinecap="round" />
        <path d="M22 12c0-1 1-2 2-2" strokeLinecap="round" />
        <path d="M22 18c0 1 1 2 2 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'For researchers',
    description:
      'Help build the evidence base for community infrastructure. Publish findings. Hold us accountable to the research. The platform is designed to be a living laboratory for the questions Ostrom, Dunbar, and Henrich spent careers asking.',
    cta: 'Read the research',
    href: '#deeper-research',
    gradient: 'from-karmyq-teal-500 to-karmyq-teal-700',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 6h16v20l-8-4-8 4V6z" strokeLinejoin="round" />
        <path d="M12 12h8M12 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function CTAs() {
  return (
    <section className="section-padding bg-karmyq-cream">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-green-600 font-medium text-sm tracking-widest uppercase mb-4">
              Get involved
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              There&apos;s a place for you here.
            </h2>
          </div>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8">
          {AUDIENCES.map((audience, i) => (
            <AnimateOnScroll key={audience.title} delay={0.15 + i * 0.1}>
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                {/* Gradient header */}
                <div className={`bg-gradient-to-br ${audience.gradient} p-6 flex items-center gap-4`}>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    {audience.icon}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-white">
                    {audience.title}
                  </h3>
                </div>

                {/* Content */}
                <div className="p-8 flex-grow flex flex-col">
                  <p className="text-karmyq-brown-600 leading-relaxed mb-8 flex-grow">
                    {audience.description}
                  </p>
                  <a
                    href={audience.href}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r ${audience.gradient} text-white font-medium hover:opacity-90 transition-opacity`}
                  >
                    {audience.cta}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
