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
        <title>Karmyq - Community Mutual Aid Platform</title>
        <meta name="description" content="Trust-based community mutual aid" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold font-serif text-text mb-4">
              Welcome to Karmyq
            </h1>
            <p className="text-xl text-text-muted mb-8">
              Building trust-based communities where people help each other
            </p>

            {!isLoggedIn ? (
              <div className="flex gap-4 justify-center">
                <Link
                  href="/register"
                  className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-3 bg-surface-raised text-primary border border-primary rounded-lg hover:bg-primary-light transition"
                >
                  Login
                </Link>
              </div>
            ) : (
              <div className="flex gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 bg-surface-raised rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-3">Trust-Based</h3>
              <p className="text-text-muted">
                Build reputation through helping others. No money, just karma.
              </p>
            </div>
            <div className="p-6 bg-surface-raised rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-3">Community-Driven</h3>
              <p className="text-text-muted">
                Communities are limited to 150 members (Dunbar's number) to maintain trust.
              </p>
            </div>
            <div className="p-6 bg-surface-raised rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-3">Mutual Aid</h3>
              <p className="text-text-muted">
                Request help or offer your skills. Everyone contributes, everyone benefits.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
