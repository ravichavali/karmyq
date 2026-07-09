import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      })

      localStorage.setItem('token', response.data.token)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      // Clear any leftover read-only demo state when registering a real account.
      localStorage.removeItem('demoContext')

      router.push('/communities?welcome=true')
    } catch (err: any) {
      setError(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Register - Karmyq</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold font-serif text-center mb-6">Create Account</h1>

          {/* Sprint 118 (ADR-085): invitation is the celebrated join path. */}
          <div className="bg-accent-light/60 border border-accent/30 rounded-lg px-4 py-3 mb-6 text-sm text-text-muted">
            <span className="font-medium text-text">Have an invitation?</span> Your invite link is
            the best way in — it connects you with the person who invited you from your very first
            day. Open it to join their community directly.
          </div>

          {error && (
            <div className="bg-error-light border border-error/20 text-error px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-text mb-2">
                Name
              </label>
              <input
                id="register-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-text mb-2">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-text mb-2">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-text mb-2">
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-6 text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
