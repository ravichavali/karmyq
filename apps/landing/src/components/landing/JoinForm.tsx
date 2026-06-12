'use client';

import { useState } from 'react';
import { buildFoundingCircleMailto } from '../../lib/buildSubscribeMailto';
import { PRIMARY_CTA_CLASS } from './styles';
import { SecondaryCta } from './primitives';

/**
 * Founding-circle note composer. Sprint 95 keeps the active submission path as
 * an encoded mailto (every field is URL-encoded in buildFoundingCircleMailto,
 * which closes the CodeQL request-forgery / DOM-XSS surface). The fields are
 * shaped so Sprint 96 can wire the same inputs to a backend endpoint without
 * restructuring the page. A visible, copyable contact address remains the
 * fallback if the user's mail client does not open.
 */
const fieldClass =
  'w-full rounded-lg border border-karmyq-brown-200 bg-white px-4 py-2.5 text-base text-karmyq-brown-900 placeholder:text-karmyq-brown-400 focus:border-karmyq-green-500 focus:outline-none focus:ring-1 focus:ring-karmyq-green-500';

export default function JoinForm() {
  const [email, setEmail] = useState('');
  const [lens, setLens] = useState('');
  const [contribution, setContribution] = useState('');
  const [concern, setConcern] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = buildFoundingCircleMailto({ email, lens, contribution, concern });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="join-email" className="block text-sm font-medium text-karmyq-brown-700 mb-1">
          Email
        </label>
        <input
          id="join-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="join-lens" className="block text-sm font-medium text-karmyq-brown-700 mb-1">
          Your lens
        </label>
        <input
          id="join-lens"
          type="text"
          value={lens}
          onChange={(e) => setLens(e.target.value)}
          placeholder="e.g. community organizer, therapist, civic technologist"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="join-contribution" className="block text-sm font-medium text-karmyq-brown-700 mb-1">
          What you can contribute
        </label>
        <textarea
          id="join-contribution"
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
          rows={3}
          placeholder="The expertise, time, or perspective you'd bring."
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="join-concern" className="block text-sm font-medium text-karmyq-brown-700 mb-1">
          The hardest concern the project needs to face
        </label>
        <textarea
          id="join-concern"
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          rows={3}
          placeholder="Name what worries you most about this working."
          className={fieldClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-5 pt-1">
        <button type="submit" className={PRIMARY_CTA_CLASS}>
          Write the note
        </button>
        <SecondaryCta href="https://karmyq.com">Try the proof-of-concept</SecondaryCta>
      </div>

      <p className="text-sm text-karmyq-brown-500">
        Mailto not opening? Copy{' '}
        <a href="mailto:contact@karmyq.org" className="font-medium text-karmyq-brown-900 underline">
          contact@karmyq.org
        </a>{' '}
        and send the note directly.
      </p>
    </form>
  );
}
