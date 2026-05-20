'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function CommunityStories() {
  return (
    <section id="stories" className="section-padding bg-karmyq-cream">
      <div className="container-narrow">

        {/* Founder's note */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            Why we&apos;re building this.
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <div className="card border border-karmyq-brown-200 mb-8">
            <div className="mb-4">
              <p className="text-xs font-medium text-karmyq-green-600 uppercase tracking-widest mb-1">
                Founder&apos;s note
              </p>
              <p className="text-xs text-karmyq-brown-400 tracking-wide">
                Foster City, CA
              </p>
            </div>

            <div className="font-serif text-lg italic leading-relaxed text-karmyq-brown-700 space-y-5">
              <p>
                My neighborhood runs on driveway waves. You know the kind — eye contact, a half-lift of the
                hand, back inside. Polite. Sufficient. Not quite community.
              </p>
              <p>
                Then a couple moved in a few doors down. They were the kind of people who stop. Who start
                conversations. Who remember names. Slowly, without anyone deciding it, something shifted.
              </p>
              <p>
                When they went on vacation, they asked if we&apos;d look after their cat. A small thing. But it
                was the first real ask — the moment a wave becomes something more.
              </p>
              <p>
                A few months later, I had to travel for three weeks. My wife would have been alone with our
                dog — the logistics, the cost, the quiet weight of it. Before I could figure out what to do,
                our neighbors were there. They stepped in. What could have been expensive and stressful became
                something we laughed about over dinner afterward. Proof that we&apos;d built something real,
                without quite meaning to.
              </p>
              <p>
                We didn&apos;t use an app. We didn&apos;t need one — we&apos;d been lucky enough to find each other.
              </p>
              <p>
                But I kept thinking about everyone on my street who hadn&apos;t. The neighbors managing alone
                because no one found the right opening. The professional a few houses down whose skills
                nobody knows about. The person who moved here a year ago and still doesn&apos;t know anyone&apos;s name.
              </p>
              <p>
                Most neighborhoods aren&apos;t waiting for connection. They&apos;re waiting for a reason to start.
              </p>
              <p className="not-italic text-karmyq-brown-600">
                That&apos;s why we&apos;re building Karmyq. Not to replace what happened between us — you can&apos;t build
                that with software. But to create the conditions. To make the first ask a little easier. To
                give people the infrastructure for the thing that wants to happen anyway.
              </p>
            </div>

            <p className="mt-6 text-sm font-medium text-karmyq-green-700">
              — Ravi Chavali, founder
            </p>
          </div>
        </AnimateOnScroll>

        {/* Contact placeholder */}
        <AnimateOnScroll delay={0.2}>
          <div className="card text-center">
            <p className="font-serif text-lg italic text-karmyq-brown-500 mb-4">
              &ldquo;We&apos;re looking for communities ready to write the next chapter.
              If that&apos;s you, we want to hear from you.&rdquo;
            </p>
            <a
              href="mailto:contact@karmyq.org"
              className="text-sm text-karmyq-green-700 border-b border-karmyq-brown-200 hover:text-karmyq-brown-900 hover:border-karmyq-brown-500 transition-colors"
            >
              Tell us about your community →
            </a>
          </div>
        </AnimateOnScroll>

      </div>
    </section>
  );
}
