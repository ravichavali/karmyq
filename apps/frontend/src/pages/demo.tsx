import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { demoService } from '@/lib/api'
import RelationshipContextPanel from '@/components/relationships/RelationshipContextPanel'

/**
 * Sprint 116 / ADR-084 — the guided read-only Maria demo at `karmyq.com/demo`.
 *
 * It walks two truthful helping stories (an ordinary neighbor offer and a provider offer)
 * so a visitor can answer the three five-second questions — how are these two connected,
 * where does each belong, and which offerer is a provider — without any account or write.
 *
 * The session is read-only by construction: the token carries `sessionMode:'demo_read_only'`,
 * the shared auth middleware rejects any mutating method server-side, and this page renders
 * NO Accept/Decline/Submit/Withdraw/Complete controls (defense in depth). No refresh token is
 * ever stored, so the tour simply expires.
 */

type DemoStory =
  | { kind: 'ordinary'; requestId: string; matchId: string }
  | { kind: 'provider'; requestId: string; offerId: string }

interface DemoContext {
  expiresInMinutes: number
  stories: DemoStory[]
}

const REGISTER_URL = 'https://karmyq.com/register'

// Decode a JWT payload (no verification) — used only to decide whether to rehydrate.
function decodePayload(token: string): { exp?: number; sessionMode?: string } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

// Only rehydrate a token that is BOTH a demo session and unexpired. Requiring
// sessionMode prevents an ordinary logged-in token (plus stale demoContext) from
// masquerading as a read-only demo session on this page.
function isValidDemoToken(token: string | null): boolean {
  if (!token) return false
  const payload = decodePayload(token)
  if (!payload || payload.sessionMode !== 'demo_read_only') return false
  return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
}

export default function DemoPage() {
  const [phase, setPhase] = useState<'disclosure' | 'active' | 'unavailable'>('disclosure')
  const [context, setContext] = useState<DemoContext | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    // Rehydrate only a still-valid *demo* session so a refresh doesn't drop the tour.
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('demoContext')
    if (isValidDemoToken(token) && raw) {
      try {
        const parsed = JSON.parse(raw) as DemoContext
        if (parsed?.stories?.length) {
          setContext(parsed)
          setPhase('active')
        }
      } catch {
        /* corrupt context — stay on disclosure */
      }
    }
  }, [])

  async function startSession() {
    setStarting(true)
    try {
      const res = await demoService.startSession()
      const data = res.data as { token: string; user: unknown; demo: DemoContext }
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('demoContext', JSON.stringify(data.demo))
      // A demo session must never keep a refresh token — the tour is meant to expire.
      localStorage.removeItem('refreshToken')
      setContext(data.demo)
      setPhase('active')
    } catch {
      setPhase('unavailable')
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Karmyq — Guided Demo</title>
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-text">See how help travels through trust</h1>

        {phase === 'disclosure' && (
          <section className="mt-4">
            <p className="text-text-muted">
              This is a <strong>read-only</strong> guided tour. You’ll explore as Maria, a synthetic
              demo neighbor, for about 30 minutes — no account, and nothing you do changes any real
              data. You’ll see two real offers of help and how each offerer connects to Maria.
            </p>
            <button
              type="button"
              onClick={startSession}
              disabled={starting}
              className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {starting ? 'Starting…' : 'Explore the live demo as Maria'}
            </button>
          </section>
        )}

        {phase === 'unavailable' && (
          <section className="mt-4">
            <p className="text-text-muted">
              The live demo isn’t available right now. You can still explore Karmyq another way.
            </p>
          </section>
        )}

        {phase === 'active' && context && (
          <div className="mt-6 space-y-8">
            <p className="text-sm text-text-muted">
              You’re exploring as Maria in a read-only session. Compare how each offer connects to
              her — one from an ordinary neighbor, one from a service provider.
            </p>
            {context.stories.map((story) => (
              <section
                key={story.kind === 'ordinary' ? story.matchId : story.offerId}
                className="rounded-xl border border-border bg-surface p-4"
              >
                {story.kind === 'ordinary' ? (
                  <>
                    <h2 className="text-lg font-medium text-text">A neighbor offered to help</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      How Maria and this helper are connected across the platform.
                    </p>
                    <RelationshipContextPanel
                      kind="match"
                      requestId={story.requestId}
                      matchId={story.matchId}
                    />
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-medium text-text">A provider offered a service</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      The same connection lens — the provider badge marks the commercial role, not a
                      more important person.
                    </p>
                    <RelationshipContextPanel
                      kind="provider-offer"
                      requestId={story.requestId}
                      offerId={story.offerId}
                    />
                  </>
                )}
              </section>
            ))}
          </div>
        )}

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-sm text-text-muted">Ready to be part of it?</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <a
              href={REGISTER_URL}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white"
            >
              Join the Platform
            </a>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
