'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const FOUNDATIONS = [
  {
    field: 'Commons Economics',
    author: 'Elinor Ostrom',
    insight:
      'Communities can self-govern shared resources more effectively than markets or states — given the right institutional design.',
    source: 'Governing the Commons (1990)',
  },
  {
    field: 'Reciprocity Theory',
    author: 'Marcel Mauss',
    insight:
      'Gift exchange creates social bonds that market transactions destroy. The obligation to give, receive, and reciprocate is the foundation of society.',
    source: 'The Gift (1925)',
  },
  {
    field: 'Complexity Science',
    author: 'Brian Arthur / Santa Fe Institute',
    insight:
      'Economies are complex adaptive systems. Diversity and adaptation, not efficiency and equilibrium, drive long-term resilience.',
    source: 'Complexity Economics',
  },
  {
    field: 'Platform Cooperativism',
    author: 'Trebor Scholz',
    insight:
      'Technology platforms can be owned and governed by the people who use them — not by investors seeking extraction.',
    source: 'Platform Cooperativism (2016)',
  },
];

export default function Research() {
  return (
    <section id="research" className="section-padding bg-white">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-green-600 font-medium text-sm tracking-widest uppercase mb-4">
              Research Foundations
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              Standing on the shoulders of giants
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              Karmyq isn&apos;t built on tech industry hype. It&apos;s built on
              decades of research into how humans actually cooperate.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 gap-8">
          {FOUNDATIONS.map((item, i) => (
            <AnimateOnScroll key={item.field} delay={0.1 + i * 0.1}>
              <div className="card h-full">
                <p className="text-xs font-medium text-karmyq-teal-600 uppercase tracking-wide mb-2">
                  {item.field}
                </p>
                <h3 className="font-serif text-lg font-semibold text-karmyq-brown-900 mb-3">
                  {item.author}
                </h3>
                <p className="text-karmyq-brown-600 leading-relaxed mb-4">
                  {item.insight}
                </p>
                <p className="text-sm text-karmyq-brown-400 italic">
                  {item.source}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
