'use client';

import { useState } from 'react';
import { submitFoundingCircle } from '../../lib/submitFoundingCircle';
import { PRIMARY_CTA_CLASS } from './styles';
import { SecondaryCta } from './primitives';

/**
 * Founding-circle note composer. Sprint 96 (ADR-076) wires the four fields to a real
 * backend write: a cross-origin POST to the auth-service intake endpoint, replacing the
 * Sprint 95 mailto. A visually-hidden honeypot (`website`) screens bots, and the visible
 * contact@karmyq.org address remains as the error-path fallback if the submit fails.
 */
const fieldClass =
  'w-full rounded-lg border border-karmyq-brown-200 bg-white px-4 py-2.5 text-base text-karmyq-brown-900 placeholder:text-karmyq-brown-400 focus:border-karmyq-green-500 focus:outline-none focus:ring-1 focus:ring-karmyq-green-500';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function JoinForm() {
  const [email, setEmail] = useState('');
  const [lens, setLens] = useState('');
  const [contribution, setContribution] = useState('');
  const [concern, setConcern] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    const result = await submitFoundingCircle({ email, lens, contribution, concern, website });

    if (result.ok) {
      setStatus('success');
      setEmail('');
      setLens('');
      setContribution('');
      setConcern('');
      setWebsite('');
    } else {
      setStatus('error');
      setErrorMsg(result.message || 'Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div id="join-form" className="rounded-lg border border-karmyq-green-200 bg-karmyq-green-50 p-6">
        <p className="text-lg font-semibold text-karmyq-brown-900">Your note landed. Thank you.</p>
        <p className="mt-2 text-base text-karmyq-brown-700">
          We read every founding-circle note ourselves. We&apos;ll be in touch when there&apos;s
          something worth your time.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm font-medium text-karmyq-brown-900 underline"
        >
          Send another note
        </button>
        <p className="mt-4 text-sm text-karmyq-brown-500">
          Prefer email? Reach us directly at{' '}
          <a href="mailto:contact@karmyq.org" className="font-medium text-karmyq-brown-900 underline">
            contact@karmyq.org
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form id="join-form" onSubmit={handleSubmit} className="space-y-5">
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

      {/* Honeypot: hidden from humans, off-screen rather than display:none so bots still fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="join-website">Leave this field empty</label>
        <input
          id="join-website"
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {status === 'error' && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5 pt-1">
        <button type="submit" className={PRIMARY_CTA_CLASS} disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending…' : 'Write the note'}
        </button>
        <SecondaryCta href="https://karmyq.com">Try the proof-of-concept</SecondaryCta>
      </div>

      <p className="text-sm text-karmyq-brown-500">
        Prefer email? Reach us directly at{' '}
        <a href="mailto:contact@karmyq.org" className="font-medium text-karmyq-brown-900 underline">
          contact@karmyq.org
        </a>
        .
      </p>
    </form>
  );
}
