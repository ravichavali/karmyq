import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ProviderForm from '@/components/providers/ProviderForm'
import { providerService } from '../../lib/api'

export default function NewProviderPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!userStr) {
      router.push('/login')
      return
    }
    setCurrentUser(JSON.parse(userStr))
  }, [])

  async function handleSubmit(data: any) {
    const response = await providerService.createProvider(data)
    router.push(`/providers/${response.data.id}`)
  }

  if (!currentUser) return null

  return (
    <Layout>
      <Head><title>Become a Provider — Karmyq</title></Head>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">Become a Provider</h1>
          <p className="text-sm text-text-muted mt-1">Create your profile in the neighborhood service directory.</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-6">
          <ProviderForm onSubmit={handleSubmit} />
        </div>
      </div>
    </Layout>
  )
}
