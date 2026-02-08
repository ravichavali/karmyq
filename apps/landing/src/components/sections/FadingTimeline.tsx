'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const TIMELINE_EVENTS = [
  { time: 'Today', text: 'Maria helps James move a couch', opacity: 1 },
  { time: '2 weeks ago', text: 'Priya gave Wei a ride to the airport', opacity: 0.85 },
  { time: '1 month ago', text: 'Carlos fixed Aisha\'s leaky faucet', opacity: 0.7 },
  { time: '3 months ago', text: 'Liam taught Yuki to make sourdough', opacity: 0.5 },
  { time: '6 months ago', text: 'Sarah organized a neighborhood cleanup', opacity: 0.35 },
  { time: '1 year ago', text: 'Mohamed watched Elena\'s dog for a week', opacity: 0.2 },
  { time: '2 years ago', text: 'David helped Mei set up her garden...', opacity: 0.08 },
];

export default function FadingTimeline() {
  return (
    <section className="section-padding bg-karmyq-green-50/30">
      <div className="container-narrow">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Left: Explanation */}
          <div>
            <AnimateOnScroll>
              <p className="text-karmyq-teal-600 font-medium text-sm tracking-widest uppercase mb-4">
                Designed to Fade
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.1}>
              <h2 className="heading-2 text-karmyq-brown-900 mb-8">
                Trust is a living thing, not a permanent record
              </h2>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.2}>
              <div className="space-y-6 body-large">
                <p>
                  In real life, relationships are shaped by recent interactions —
                  not a permanent ledger. A neighbor who helped you last month matters
                  more than one who helped three years ago.
                </p>
                <p>
                  Karmyq&apos;s reputation system works the same way. Karma decays
                  naturally over time. Old interactions fade, like memories. What remains
                  is a living sense of trust — not an immutable score.
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.3}>
              <blockquote className="pull-quote mt-8">
                &ldquo;Meaning-making matters, not accounting.&rdquo;
              </blockquote>
            </AnimateOnScroll>
          </div>

          {/* Right: Fading timeline visualization */}
          <AnimateOnScroll delay={0.2} direction="right">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-0 w-px bg-gradient-to-b from-karmyq-green-400 to-transparent" />

              <div className="space-y-6">
                {TIMELINE_EVENTS.map((event, i) => (
                  <div
                    key={i}
                    className="relative pl-12 transition-opacity"
                    style={{ opacity: event.opacity }}
                  >
                    {/* Dot */}
                    <div
                      className="absolute left-2 top-1.5 w-5 h-5 rounded-full border-2 border-karmyq-green-400 bg-white"
                      style={{ opacity: event.opacity }}
                    />
                    <p className="text-xs font-medium text-karmyq-brown-400 mb-1">
                      {event.time}
                    </p>
                    <p className="text-karmyq-brown-700">
                      {event.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Fade overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-karmyq-green-50/30 to-transparent pointer-events-none" />
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
