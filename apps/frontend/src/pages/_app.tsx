import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { MessagingProvider } from '@/contexts/MessagingContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NotificationProvider>
      <MessagingProvider>
        <Component {...pageProps} />
      </MessagingProvider>
    </NotificationProvider>
  )
}
