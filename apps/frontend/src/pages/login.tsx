import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', formData)
      console.log('Login response:', response)
      console.log('Response data:', response.data)
      console.log('Token:', response.data?.token)
      console.log('User:', response.data?.user)

      if (!response.data || !response.data.token || !response.data.user) {
        console.error('Invalid response structure', { error: response instanceof Error ? response.message : String(response) })
        setError('Invalid response from server')
        setLoading(false)
        return
      }

      localStorage.setItem('token', response.data.token)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(response.data.user))

      // Hard redirect so ProviderContext (and other auth-gated contexts) re-mount with the token in place
      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error('Login error', { error: err instanceof Error ? err.message : String(err) })
      console.error('Error response:', err.response)
      console.error('Error data:', err.response?.data)
      const errorMessage = getErrorMessage(err, 'Login failed')
      console.error('Setting error', { error: errorMessage })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Login - Karmyq</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-primary-light to-surface-raised flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface-raised rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold font-serif text-center mb-8">Login</h1>

          {error && (
            <div className="bg-error-light border border-error/20 text-error px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="text-center mt-6 text-text-muted">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
