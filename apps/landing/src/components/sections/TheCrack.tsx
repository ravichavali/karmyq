'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function TheCrack() {
  return (
    <section id="about" className="section-padding bg-organic-1">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-orange-500 font-medium text-sm tracking-widest uppercase mb-4">
            The Crack in the Foundation
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            We&apos;ve turned relationships into accounting
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-6 body-large">
            <p>
              As human societies grew, we simplified cooperation to scale. Money. Markets.
              Bureaucracy. These became the universal languages of exchange — efficient,
              but impoverished.
            </p>
            <p>
              We lost the gift economies where people gave without expectation of return.
              The time banks where an hour of carpentry equaled an hour of childcare.
              The skill-sharing circles where expertise flowed freely. The care networks
              where communities held each other through hard times.
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.3}>
          <blockquote className="pull-quote my-12">
            &ldquo;The simplification that got us here won&apos;t get us there. We traded
            the rich complexity of human cooperation for something that scales — and
            lost the soul of community in the process.&rdquo;
          </blockquote>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.35}>
          <p className="body-large">
            Every neighborhood app that reduces helping to a transaction. Every platform
            that turns neighbors into customers. Every system that makes you prove your
            worth before you can ask for help. The crack runs deep.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
