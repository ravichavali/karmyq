import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsLoggedIn(!!token)
  }, [])

  return (
    <>
      <Head>
        <title>Karmyq — Community Mutual Aid Platform</title>
        <meta name="description" content="Trust-based communities where neighbours help each other — mutual aid and trusted local service providers, side by side." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-surface">
        <div className="kq-page py-20">
          <div className="text-center max-w-2xl mx-auto">
            <Link href={isLoggedIn ? '/dashboard' : '/'} className="kq-wordmark justify-center text-3xl">
              <span className="kq-wordmark-seed" aria-hidden="true" />
              Karmyq
            </Link>
            <h1 className="kq-headline mt-6">Help that runs on trust, not transactions.</h1>
            <p className="kq-lede mt-4">
              Karmyq is where neighbours help each other — mutual aid and trusted local service
              providers, side by side, inside communities small enough to stay personal.
            </p>

            {!isLoggedIn ? (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/register" className="btn-primary">Get started</Link>
                <Link href="/login" className="btn-secondary">Log in</Link>
              </div>
            ) : (
              <div className="mt-8 flex justify-center">
                <Link href="/dashboard" className="btn-primary">Go to your dashboard</Link>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-5 mt-16 max-w-4xl mx-auto">
            <div className="kq-card">
              <h3 className="font-semibold text-text mb-2">Trust, not money</h3>
              <p className="text-sm text-text-muted">
                Reputation grows by helping neighbours. Karmyq never touches money — mutual aid runs
                on karma, and any service arrangement stays between the two people.
              </p>
            </div>
            <div className="kq-card">
              <h3 className="font-semibold text-text mb-2">Built for real relationships</h3>
              <p className="text-sm text-text-muted">
                Communities cap at around 150 members (Dunbar&apos;s number) so trust stays personal
                and the people you meet are genuinely your neighbours.
              </p>
            </div>
            <div className="kq-card">
              <h3 className="font-semibold text-text mb-2">Two ways to help</h3>
              <p className="text-sm text-text-muted">
                Ask for a hand or offer your skills through mutual aid — or find a trusted local
                service provider from the same circle. One community, two ways to show up.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
