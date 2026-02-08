import AnimateOnScroll from './AnimateOnScroll';

const LINKS = {
  'The Vision': [
    { label: 'About Karmyq', href: '#about' },
    { label: 'Our Principles', href: '#principles' },
    { label: 'Community Stories', href: '#stories' },
    { label: 'Research Foundations', href: '#research' },
  ],
  Resources: [
    { label: 'Pattern Library', href: '#' },
    { label: 'Technical Docs', href: '#' },
    { label: 'Community Guide', href: '#' },
    { label: 'API Documentation', href: '#' },
  ],
  Community: [
    { label: 'GitHub', href: 'https://github.com/karmyq' },
    { label: 'OpenCollective', href: '#' },
    { label: 'Contact', href: 'mailto:hello@karmyq.org' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-karmyq-brown-900 text-karmyq-brown-200">
      {/* Quote banner */}
      <div className="border-b border-karmyq-brown-800">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12 text-center">
          <AnimateOnScroll>
            <blockquote className="font-serif text-2xl md:text-3xl italic text-karmyq-brown-100 leading-relaxed">
              &ldquo;Meaning-making matters, not accounting.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-karmyq-brown-400">
              &mdash; The Karmyq Philosophy
            </p>
          </AnimateOnScroll>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <p className="font-serif text-2xl font-bold text-white mb-4">
              Karmyq
            </p>
            <p className="text-karmyq-brown-400 text-sm leading-relaxed mb-6">
              Open-source infrastructure for community cooperation.
              Built with care in Portland, OR.
            </p>
            <div className="space-y-1 text-sm text-karmyq-brown-400">
              <p>
                <a href="https://karmyq.com" className="hover:text-karmyq-green-400 transition-colors">
                  karmyq.com
                </a>{' '}
                &mdash; The platform
              </p>
              <p>
                <a href="https://karmyq.org" className="hover:text-karmyq-green-400 transition-colors">
                  karmyq.org
                </a>{' '}
                &mdash; The commons
              </p>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {heading}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-karmyq-brown-400 hover:text-karmyq-green-400 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-karmyq-brown-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-karmyq-brown-500">
            Open Source &middot; AGPLv3 License
          </p>
          <p className="text-sm text-karmyq-brown-500">
            Built for communities, by communities
          </p>
        </div>
      </div>
    </footer>
  );
}
