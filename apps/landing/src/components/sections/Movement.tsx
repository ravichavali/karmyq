'use client';

import { useState } from 'react';
import AnimateOnScroll from '../AnimateOnScroll';
import { buildFoundingCircleMailto } from '../../lib/buildSubscribeMailto';

export default function Movement() {
  const [email, setEmail] = useState('');
  const [lens, setLens] = useState('');
  const [contribution, setContribution] = useState('');
  const [concern, setConcern] = useState('');

  const handleJoin = () => {
    if (email.trim()) {
      window.location.href = buildFoundingCircleMailto({
        email,
        lens,
        contribution,
        concern,
      });
    }
  };

  return (
    <section id="founding-circle" className="section-padding bg-karmyq-green-50/40">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-orange-500 font-medium text-xs tracking-widest uppercase mb-4">
            LinkedIn launch relaunch
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            Join the founding circle.
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-5 body-large max-w-2xl mb-10">
            <p>
              This is not a waitlist for an app. It is an invitation to a working conversation:
              what would make Karmyq safe, useful, and legible enough for real communities to trust?
            </p>
            <p>
              Send a short note with your lens, what you can contribute, and the hardest concern you think
              the project needs to face. The mailto link opens your email client; the address is also visible
              below in case protocol handlers are not your friend.
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.25}>
          <div className="flex flex-col sm:flex-row gap-4 mb-14">
            <a href="#founding-circle-form" className="btn-primary">
              Write the note
            </a>
            <a
              href="https://karmyq.com"
              className="btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Try the PoC
            </a>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.35}>
          <div id="founding-circle-form" className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-karmyq-brown-100 max-w-2xl">
            <p className="text-xs font-medium text-karmyq-brown-400 uppercase tracking-widest mb-2">
              Founding-circle note
            </p>
            <h3 className="font-serif text-2xl font-semibold text-karmyq-brown-900 mb-2">
              Tell us what you see.
            </h3>
            <p className="text-karmyq-brown-600 mb-6 text-sm leading-relaxed">
              A few plain details are enough. Every field is encoded before it becomes a mailto link.
            </p>
            <div className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3 rounded-full border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent text-sm"
                aria-label="Email address"
              />
              <input
                type="text"
                placeholder="Your lens — organizer, therapist, designer, builder, researcher..."
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                className="w-full px-5 py-3 rounded-full border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent text-sm"
                aria-label="Your lens"
              />
              <textarea
                placeholder="What could you contribute?"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                className="w-full px-5 py-3 rounded-3xl border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent text-sm min-h-28"
                aria-label="What you can contribute"
              />
              <textarea
                placeholder="What should we pressure-test first?"
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                className="w-full px-5 py-3 rounded-3xl border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent text-sm min-h-28"
                aria-label="What we should pressure-test"
              />
              <button
                type="button"
                onClick={handleJoin}
                className="w-full px-6 py-3 rounded-full bg-karmyq-green-600 text-white text-sm font-medium hover:bg-karmyq-green-700 transition-colors"
              >
                Open email to contact@karmyq.org
              </button>
            </div>
            <p className="text-xs text-karmyq-brown-400 mt-3">
              Mailto not opening? Copy{' '}
              <a href="mailto:contact@karmyq.org" className="hover:text-karmyq-brown-600 transition-colors">
                contact@karmyq.org
              </a>
              {' '}and send the note directly.
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
