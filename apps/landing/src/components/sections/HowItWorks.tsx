'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const STEPS = [
  {
    number: '01',
    title: 'Start a Community',
    description:
      'Create a space for your neighborhood, co-op, or interest group. Choose which cooperation models fit your values — mutual aid, skill sharing, tool lending, or all of the above.',
    color: 'bg-karmyq-green-100 text-karmyq-green-700',
  },
  {
    number: '02',
    title: 'Ask and Offer',
    description:
      'Post requests for help or offer your skills and time. Need a ride to the airport? Know how to fix a leaky faucet? Looking for someone to watch your dog? Every act of helping strengthens the community fabric.',
    color: 'bg-karmyq-orange-100 text-karmyq-orange-700',
  },
  {
    number: '03',
    title: 'Trust Grows Naturally',
    description:
      'As people help each other, trust and reputation build organically. No artificial gamification — just real relationships forming through real interactions. Over time, your community becomes resilient.',
    color: 'bg-karmyq-teal-100 text-karmyq-teal-700',
  },
];

export default function HowItWorks() {
  return (
    <section className="section-padding bg-white">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-orange-500 font-medium text-sm tracking-widest uppercase mb-4">
              How It Works
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              Simple to start, deep to grow
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              You don&apos;t need to read a manifesto to get started. Just neighbors
              helping neighbors — with infrastructure that lets the complexity emerge.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {STEPS.map((step, i) => (
            <AnimateOnScroll key={step.number} delay={0.2 + i * 0.15}>
              <div className="relative">
                {/* Connector line (hidden on mobile) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-karmyq-brown-200 to-transparent z-0" />
                )}

                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center font-serif text-2xl font-bold mb-6`}>
                  {step.number}
                </div>
                <h3 className="font-serif text-2xl font-semibold text-karmyq-brown-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-karmyq-brown-600 leading-relaxed text-lg">
                  {step.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
