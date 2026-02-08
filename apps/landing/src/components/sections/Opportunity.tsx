'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function Opportunity() {
  return (
    <section className="section-padding bg-karmyq-green-50/50">
      <div className="container-narrow">
        <AnimateOnScroll>
          <p className="text-karmyq-teal-600 font-medium text-sm tracking-widest uppercase mb-4">
            The Opportunity
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            Technology can now support{' '}
            <span className="text-karmyq-teal-600">complexity at scale</span>
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          <div className="space-y-6 body-large">
            <p>
              Bees coordinate at massive scale — but on simple tasks. Humans, with
              bigger brains, can coordinate on astonishingly complex tasks. But until
              now, we lacked the technological scaffolding to do both: complex
              cooperation, at community scale.
            </p>
            <p>
              We built technology that scales monocultures: one marketplace, one social
              network, one way to interact. What if instead, we built technology that
              scales <em>diversity</em>? Infrastructure that supports a thousand different
              ways of cooperating — each one adapted to its community, its culture,
              its people?
            </p>
          </div>
        </AnimateOnScroll>

        {/* Visual: Three cooperation models */}
        <AnimateOnScroll delay={0.3}>
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {[
              {
                emoji: '🌱',
                title: 'Gift Economies',
                desc: 'Give without keeping score. Build trust through generosity. Let reciprocity emerge naturally.',
              },
              {
                emoji: '⏰',
                title: 'Time Banking',
                desc: 'One hour of help equals one hour of help. Carpentry, cooking, tutoring — all valued equally.',
              },
              {
                emoji: '🤝',
                title: 'Mutual Aid',
                desc: 'Community members support each other through hard times. No means-testing. No bureaucracy.',
              },
            ].map((model, i) => (
              <AnimateOnScroll key={model.title} delay={0.4 + i * 0.1}>
                <div className="card text-center">
                  <div className="text-4xl mb-4">{model.emoji}</div>
                  <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mb-3">
                    {model.title}
                  </h3>
                  <p className="text-karmyq-brown-600">{model.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.5}>
          <p className="body-large mt-12 text-center">
            These aren&apos;t utopian fantasies. They&apos;re how humans cooperated for
            millennia. We just need modern scaffolding to make them work again.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
