'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function WhatIsKarmyq() {
  return (
    <section className="section-padding bg-organic-2">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-green-600 font-medium text-sm tracking-widest uppercase mb-4">
            What Is Karmyq
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            Infrastructure for community experiments
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-6 body-large mb-16">
            <p>
              Karmyq is an open-source platform that lets communities design their own
              cooperation systems. Not another marketplace. Not another social network.
              <strong> A toolkit for building the kind of community you actually want
              to live in.</strong>
            </p>
          </div>
        </AnimateOnScroll>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 gap-8">
          {[
            {
              icon: (
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="11" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
              title: 'Community-Owned',
              desc: 'Each community configures its own rules, request types, and reputation system. Your community, your way.',
            },
            {
              icon: (
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
              title: 'Polymorphic Requests',
              desc: 'Five request types out of the box — rides, services, lending, events, and general help. Or define your own.',
            },
            {
              icon: (
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              ),
              title: 'Meaning, Not Points',
              desc: 'Karma reflects real contributions, not gamification. It builds trust organically — and fades over time, like memory.',
            },
            {
              icon: (
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                  <path d="M6 16c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="16" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
                  <circle cx="6" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="26" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
                </svg>
              ),
              title: 'Privacy-First',
              desc: 'No tracking. No ads. No selling data. Interactions fade over time. Your community\'s business is your own.',
            },
          ].map((feature, i) => (
            <AnimateOnScroll key={feature.title} delay={0.2 + i * 0.1}>
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-karmyq-green-100 text-karmyq-green-700 flex items-center justify-center">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-karmyq-brown-600 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
