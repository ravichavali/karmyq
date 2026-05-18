'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function WhatIsKarmyq() {
  return (
    <section className="section-padding bg-organic-2">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-green-600 font-medium text-sm tracking-widest uppercase mb-4">
            How it works
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            What Karmyq actually is.
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <p className="body-large">
            A toolkit. An open-source platform that lets communities design their own cooperation systems —
            not one model handed down, but infrastructure flexible enough to hold mutual aid, skill sharing,
            tool lending, local services, or any combination a community needs. The platform doesn&apos;t decide
            what your community values. It gives your community the means to decide for itself, and to
            change its mind over time.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
