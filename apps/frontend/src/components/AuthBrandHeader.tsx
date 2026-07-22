import Link from 'next/link'

/**
 * Sprint 120 PR C (F-7) — the brand anchor above the login and registration cards.
 *
 * Both pages are common cold-arrival landing spots (a shared link, a bookmark), and both used to
 * render an unbranded form with no route back to the front door. Shared so the two stay identical.
 */
export default function AuthBrandHeader() {
  return (
    <div className="text-center mb-6">
      <Link href="/" className="kq-wordmark justify-center text-2xl">
        <span className="kq-wordmark-seed" aria-hidden="true" />
        Karmyq
      </Link>
      <p className="text-sm text-text-muted mt-2">Help that runs on trust, not transactions.</p>
    </div>
  )
}
