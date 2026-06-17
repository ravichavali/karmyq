import { ReactNode } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'

interface AdminLayoutProps {
  children: ReactNode
  title: string
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <Layout title={`${title} - Karmyq`}>
      <div className="flex">
        <div className="w-64 border-r border-border bg-surface">
          <div className="p-4 space-y-4">
            <h2 className="text-2xl font-bold text-text mb-4">{title}</h2>
            <nav className="space-y-2">
              <Link
                href="/admin/schemas"
                className="block px-4 py-2 rounded hover:bg-surface-raised text-text-muted hover:text-primary"
              >
                Schemas
              </Link>
              <Link
                href="/admin/founding-circle"
                className="block px-4 py-2 rounded hover:bg-surface-raised text-text-muted hover:text-primary"
              >
                Founding Circle
              </Link>
            </nav>
          </div>
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </Layout>
  )
}
