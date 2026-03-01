import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import CollectiveForm from '@/components/providers/CollectiveForm'
import { collectiveService } from '../../../lib/api'

export default function NewCollectivePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!userStr) { router.push('/login'); return }
    setCurrentUser(JSON.parse(userStr))
  }, [])

  async function handleSubmit(data: any) {
    const response = await collectiveService.createCollective(data)
    router.push(`/providers/collectives/${response.data.id}`)
  }

  if (!currentUser) return null

  return (
    <Layout>
      <Head><title>New Collective — Karmyq</title></Head>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">Create a Collective</h1>
          <p className="text-sm text-text-muted mt-1">A collective groups providers (a stand, cooperative, or network) that serve the neighborhood together.</p>
        </div>
        <div className="bg-surface-raised rounded-xl border border-border p-6">
          <CollectiveForm onSubmit={handleSubmit} />
        </div>
      </div>
    </Layout>
  )
}
