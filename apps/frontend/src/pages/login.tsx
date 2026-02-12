import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { api } from '@/lib/api'

export default function Login() {
  const router = useRouter()
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
        console.error('Invalid response structure:', response)
        setError('Invalid response from server')
        setLoading(false)
        return
      }

      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))

      console.log('Redirecting to dashboard...')
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      console.error('Error response:', err.response)
      console.error('Error data:', err.response?.data)
      const errorMessage = err.response?.data?.error || err.message || 'Login failed'
      console.error('Setting error:', errorMessage)
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:bg-primary-medium"
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
