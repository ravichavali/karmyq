import { useEffect, useState } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'
import { requestService } from '@/lib/api'

interface RetentionWindows {
  completedRequestWindowDays: number
  expiredRequestWindowDays: number
  messageWindowDays: number
}

interface RetentionPolicy {
  windows: RetentionWindows
  counts: { held: number; forgotten: number }
}

/**
 * Sprint 90 / ADR-069 — "What Karmyq remembers, and what it lets go."
 *
 * A plain-language transparency page: the live retention windows, what anonymizes vs hard-deletes,
 * the Exchange Unit cascade, and what is deliberately kept (aggregates). The windows are pulled live
 * from the retention-policy endpoint so this page can never drift from the job that does the forgetting.
 */
export default function MemoryTransparencyPage() {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)

  useEffect(() => {
    requestService
      .getRetentionPolicy()
      .then((res: any) => setPolicy(res.data ?? null))
      .catch(() => setPolicy(null))
  }, [])

  const w = policy?.windows
  const months = (days: number) => (days % 30 === 0 ? `${days / 30} months` : `${days} days`)

  return (
    <>
      <Head>
        <title>What Karmyq remembers — and what it lets go</title>
      </Head>
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <header className="kq-hero mb-6">
            <p className="kq-section-label !mt-0">Designed to forget</p>
            <h1 className="kq-hero-name">What Karmyq remembers — and what it lets go</h1>
            <p className="kq-hero-mission mt-3">
              A mutual-aid network shouldn&apos;t keep a permanent record of everyone&apos;s asks and
              messages. Karmyq forgets the <em>details</em> of past exchanges on a schedule, while
              keeping the <em>aggregates</em> that let trust and karma stay meaningful.
            </p>
          </header>

          <section className="kq-card mb-6">
            <h2 className="kq-section-label !mt-0">When things are let go</h2>
            <div className="grid gap-3">
              <PolicyRow
                title="Completed exchanges"
                detail="The free text of a completed request — its title, description, and any details you
                  entered — is anonymized, along with the conversation that went with it."
                window={w ? `after ${months(w.completedRequestWindowDays)}` : '—'}
                kind="anonymized"
              />
              <PolicyRow
                title="Expired, unanswered asks"
                detail="A request that expired without ever being matched has no shared history to keep,
                  so it is deleted outright."
                window={w ? `after ${months(w.expiredRequestWindowDays)}` : '—'}
                kind="deleted"
              />
              <PolicyRow
                title="Old messages"
                detail="Messages are forgotten with their exchange. Any that linger in very long
                  conversations are anonymized on their own schedule as a backstop."
                window={w ? `after ${months(w.messageWindowDays)}` : '—'}
                kind="anonymized"
              />
            </div>
          </section>

          <section className="kq-card mb-6">
            <h2 className="kq-section-label !mt-0">The exchange, forgotten as one</h2>
            <p className="text-sm text-text-muted leading-6">
              A request, the match that fulfilled it, and the conversation between you are one
              <strong> exchange</strong>. When an exchange is forgotten, its request text and its messages
              are anonymized <em>together, in a single step</em> — never half-forgotten. What stays is the
              fact that the exchange happened: the match, and the karma each of you earned.
            </p>
          </section>

          <section className="kq-card mb-6">
            <h2 className="kq-section-label !mt-0">What is always kept</h2>
            <ul className="grid gap-2 text-sm text-text-muted">
              <li>• <strong>That you helped.</strong> The match record stays, so your history of showing up is intact.</li>
              <li>• <strong>Your karma.</strong> Karma is never touched by forgetting — only the words around it are let go.</li>
              <li>• <strong>Your trust.</strong> Relationship strength keeps decaying gently on its own, the way real bonds do.</li>
            </ul>
          </section>

          {policy && (
            <section className="kq-card">
              <h2 className="kq-section-label !mt-0">Your own record</h2>
              <p className="text-sm text-text-muted">
                You currently have <strong>{policy.counts.held}</strong>{' '}
                {policy.counts.held === 1 ? 'request' : 'requests'} whose details are still held, and{' '}
                <strong>{policy.counts.forgotten}</strong> that {policy.counts.forgotten === 1 ? 'has' : 'have'}{' '}
                already been let go.
              </p>
            </section>
          )}
        </div>
      </Layout>
    </>
  )
}

function PolicyRow({
  title,
  detail,
  window,
  kind,
}: {
  title: string
  detail: string
  window: string
  kind: 'anonymized' | 'deleted'
}) {
  return (
    <div className="kq-action-band">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-text">{title}</h3>
        <span className="kq-pill flex-none">{window}</span>
      </div>
      <p className="text-sm text-text-muted mt-1 leading-6">{detail}</p>
      <span
        className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          kind === 'deleted'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-primary-light text-primary-dark border border-primary-medium'
        }`}
      >
        {kind === 'deleted' ? 'Deleted' : 'Anonymized — aggregates kept'}
      </span>
    </div>
  )
}
