'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function Movement() {
  return (
    <section className="section-padding bg-karmyq-green-50/40 bg-organic-2">
      <div className="container-narrow text-center">
        <AnimateOnScroll>
          <p className="text-karmyq-orange-500 font-medium text-sm tracking-widest uppercase mb-4">
            Join the Movement
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            Rebuilding the complexity we lost
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-6 body-large max-w-2xl mx-auto mb-12">
            <p>
              We&apos;re not building another app. We&apos;re building infrastructure
              for a future where communities can coordinate in ways as diverse as the
              people in them.
            </p>
            <p>
              Every community that joins is another experiment. Every experiment that
              works teaches something. Every lesson learned is shared openly.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Stats */}
        <AnimateOnScroll delay={0.3}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            {[
              { number: '100%', label: 'Open Source' },
              { number: '5', label: 'Request Types' },
              { number: '0', label: 'Ads Served' },
              { number: '∞', label: 'Possible Models' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-serif text-3xl md:text-4xl font-bold text-karmyq-green-600">
                  {stat.number}
                </p>
                <p className="text-sm text-karmyq-brown-500 mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        {/* Newsletter signup */}
        <AnimateOnScroll delay={0.4}>
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm max-w-xl mx-auto">
            <h3 className="font-serif text-2xl font-semibold text-karmyq-brown-900 mb-3">
              Stay in the loop
            </h3>
            <p className="text-karmyq-brown-600 mb-6">
              Get occasional updates on new communities, research, and platform
              developments. No spam, ever.
            </p>
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-grow px-5 py-3 rounded-full border border-karmyq-brown-200 text-karmyq-brown-800 placeholder:text-karmyq-brown-300 focus:outline-none focus:ring-2 focus:ring-karmyq-green-400 focus:border-transparent"
                aria-label="Email address"
              />
              <button
                type="submit"
                className="btn-primary whitespace-nowrap !px-6 !py-3"
              >
                Subscribe
              </button>
            </form>
            <p className="text-xs text-karmyq-brown-400 mt-3">
              No tracking. Unsubscribe anytime.
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
