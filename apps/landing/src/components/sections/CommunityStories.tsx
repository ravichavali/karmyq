'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const STORIES = [
  {
    name: 'Neighborhood Tool Library',
    location: 'Foster City, CA',
    quote:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    author: 'Community Organizer',
    type: 'Tool Lending',
    color: 'border-karmyq-green-300',
  },
  {
    name: 'Bay Area Care Circle',
    location: 'Foster City, CA',
    quote:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.',
    author: 'Circle Member',
    type: 'Mutual Aid',
    color: 'border-karmyq-orange-300',
  },
  {
    name: 'Peninsula Time Bank',
    location: 'Foster City, CA',
    quote:
      'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit.',
    author: 'Time Banker',
    type: 'Time Banking',
    color: 'border-karmyq-teal-300',
  },
];

export default function CommunityStories() {
  return (
    <section id="stories" className="section-padding bg-organic-1">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-karmyq-orange-500 font-medium text-sm tracking-widest uppercase mb-4">
              Community Stories
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              Real communities, real cooperation
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              Every community finds its own way. Here are some of the experiments
              in cooperation happening right now.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8">
          {STORIES.map((story, i) => (
            <AnimateOnScroll key={story.name} delay={0.15 + i * 0.1}>
              <div className={`card h-full border-t-4 ${story.color}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-karmyq-brown-50 text-karmyq-brown-600">
                    {story.type}
                  </span>
                  <span className="text-xs text-karmyq-brown-400">
                    {story.location}
                  </span>
                </div>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mb-4">
                  {story.name}
                </h3>

                <blockquote className="text-karmyq-brown-700 leading-relaxed italic mb-6 flex-grow">
                  &ldquo;{story.quote}&rdquo;
                </blockquote>

                <p className="text-sm font-medium text-karmyq-green-700">
                  &mdash; {story.author}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
