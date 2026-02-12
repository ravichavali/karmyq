import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { MessagingProvider } from '@/contexts/MessagingContext'
import { useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  // Initialize geocoding cache on app startup
  useEffect(() => {
    async function initCache() {
      const { initGeocodingCache } = await import('@/lib/geocodingCache')
      await initGeocodingCache()
    }
    initCache()
  }, [])

  return (
    <ThemeProvider>
      <NotificationProvider>
        <MessagingProvider>
          <Component {...pageProps} />
        </MessagingProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
