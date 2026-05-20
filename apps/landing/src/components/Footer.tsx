export default function Footer() {
  return (
    <footer className="bg-karmyq-brown-900 text-karmyq-brown-400">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12 text-center space-y-4">
        <p className="font-serif text-2xl md:text-3xl italic text-karmyq-brown-100 leading-relaxed">
          &ldquo;Meaning-making matters, not accounting.&rdquo;
        </p>
        <p className="text-sm text-karmyq-brown-500">
          &mdash; The Karmyq philosophy
        </p>

        <div className="pt-6 border-t border-karmyq-brown-800 space-y-3">
          <p className="text-sm">
            <a href="https://karmyq.org" className="hover:text-karmyq-green-400 transition-colors">karmyq.org</a>
            {' '}&mdash; the commons{' '}&middot;{' '}
            <a href="https://karmyq.com" className="hover:text-karmyq-green-400 transition-colors">karmyq.com</a>
            {' '}&mdash; the platform
          </p>
          <p className="text-sm">
            <a href="https://opencollective.com/karmyq" className="hover:text-karmyq-green-400 transition-colors">OpenCollective</a>
            {' '}&middot;{' '}
            <a href="https://github.com/ravichavali/karmyq" className="hover:text-karmyq-green-400 transition-colors">GitHub</a>
            {' '}&middot;{' '}
            <a href="mailto:contact@karmyq.org" className="hover:text-karmyq-green-400 transition-colors">Contact</a>
            {' '}&middot;{' '}
            Open source, AGPLv3
            {' '}&middot;{' '}
            No ads{' '}&middot;{' '}No tracking
          </p>
        </div>
      </div>
    </footer>
  );
}
