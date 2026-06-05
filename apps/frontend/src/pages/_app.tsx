import '@/styles/globals.css'
import '@/styles/karmyq-shell.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ProviderProvider } from '@/contexts/ProviderContext'
import { MessagingProvider } from '@/contexts/MessagingContext'
import { Component as ReactComponent, ErrorInfo, ReactNode, useEffect } from 'react'

interface ErrorBoundaryState { hasError: boolean; refId?: string }

class ErrorBoundary extends ReactComponent<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, refId: error?.refId }
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
          <h2>Something went wrong.</h2>
          <p>Try refreshing the page.</p>
          {this.state.refId && (
            <p style={{ fontSize: '0.75rem', color: '#999' }}>
              Reference: {this.state.refId}
            </p>
          )}
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
