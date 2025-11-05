import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ChatWindow from '@/components/ChatWindow'

export default function ChatPage() {
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  if (!id || typeof id !== 'string') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-500">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Chat - Karmyq</title>
      </Head>
      <Layout title="Chat">
        <div className="chat-page-container">
          <div className="chat-page-inner">
            <ChatWindow conversationId={id} />
          </div>
        </div>

        <style jsx>{`
          .chat-page-container {
            height: calc(100vh - 140px); /* Adjust based on your header height */
            background-color: #f9f9f9;
          }

          .chat-page-inner {
            max-width: 1200px;
            margin: 0 auto;
            height: 100%;
            background-color: white;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          }

          @media (max-width: 768px) {
            .chat-page-container {
              height: calc(100vh - 60px);
            }

            .chat-page-inner {
              box-shadow: none;
            }
          }
        `}</style>
      </Layout>
    </>
  )
}
