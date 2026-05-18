'use client';

import { useState } from 'react';
import AnimateOnScroll from '../AnimateOnScroll';

export default function Movement() {
  const [email, setEmail] = useState('');

  const handleSubscribe = () => {
    if (email) {
      window.location.href = `mailto:ravichavali@gmail.com?subject=Karmyq updates&body=Please add me to the Karmyq updates list. My email: ${email}`;
    }
  };

  return (
    <section id="cohort" className="section-padding bg-karmyq-green-50/40">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-orange-500 font-medium text-xs tracking-widest uppercase mb-4">
            Join the movement
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            We&apos;re forming the founding cohort.
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-5 body-large max-w-2xl mb-10">
            <p>
              Karmyq is early. We&apos;re looking for the first communities willing to help shape what this
              becomes — neighborhood groups, mutual aid circles, cohousing communities, local organizers.
              People who believe the infrastructure matters and want to help build it.
            </p>
            <p>
              Founding communities get direct access to the team, influence over roadmap decisions, and
              the knowledge that they helped build something that will outlast them.
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.25}>
          <div className="flex flex-col sm:flex-row gap-4 mb-14">
            <a href="https://karmyq.com" className="btn-primary">
              Start a community
            </a>
            <a
              href="https://github.com/ravichavali/karmyq"
              className="btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
            <a
              href="https://opencollective.com/karmyq"
              className="btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Support on OpenCollective
            </a>
          </div>
        </AnimateOnScroll>

        {/* Email signup */}
        <AnimateOnScroll delay={0.35}>
          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-karmyq-brown-100 max-w-xl">
            <p className="text-xs font-medium text-karmyq-brown-400 uppercase tracking-widest mb-2">
              Follow the build
            </p>
            <h3 className="font-serif text-2xl font-semibold text-karmyq-brown-900 mb-2">
              Not ready to start — but want to watch?
            </h3>
            <p className="text-karmyq-brown-600 mb-6 text-sm leading-relaxed">
              Get occasional updates on new communities, research, and platform developments. No spam.
              Unsubscribe anytime.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3 rounded-full border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent text-sm"
                aria-label="Email address"
              />
              <button
                type="button"
                onClick={handleSubscribe}
                className="w-full px-6 py-3 rounded-full bg-karmyq-green-600 text-white text-sm font-medium hover:bg-karmyq-green-700 transition-colors"
              >
                Subscribe
              </button>
            </div>
            <p className="text-xs text-karmyq-brown-400 mt-3">
              No tracking. No selling your address. Ever.{' '}
              <a href="mailto:ravichavali@gmail.com" className="hover:text-karmyq-brown-600 transition-colors">
                ravichavali@gmail.com
              </a>
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
