import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function RequestsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <>
      <Head>
        <title>Requests moved - Karmyq</title>
      </Head>
      <main className="kq-page py-10">
        <div className="kq-finite-state" aria-live="polite">
          <h1 className="kq-headline-sm">Requests live on Dashboard Home</h1>
          <p className="text-sm text-text-muted mt-2">
            Redirecting you to the warm feed where open asks and decisions are handled together.
          </p>
        </div>
      </main>
    </>
  )
}
