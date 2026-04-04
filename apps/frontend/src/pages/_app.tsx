import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ProviderProvider } from '@/contexts/ProviderContext'
import { MessagingProvider } from '@/contexts/MessagingContext'
import { Component as ReactComponent, ErrorInfo, ReactNode, useEffect } from 'react'

class ErrorBoundary extends ReactComponent<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', {
      component: info.componentStack?.split('\n')[1]?.trim(),
      error: error.message,
      stack: info.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent({ Component, pageProps }: AppProps) {
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
        <ProviderProvider>
          <MessagingProvider>
            <Component {...pageProps} />
          </MessagingProvider>
        </ProviderProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default function App(props: AppProps) {
  return (
    <ErrorBoundary>
      <AppContent {...props} />
    </ErrorBoundary>
  )
}
