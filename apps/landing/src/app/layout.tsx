import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Karmyq — Infrastructure for Community Cooperation',
  description:
    'Communities are experiments in cooperation. Karmyq provides the infrastructure to run those experiments — preserving the rich diversity of mutual aid that thrived before we simplified everything to scale.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Karmyq — Infrastructure for Community Cooperation',
    description:
      'Communities are experiments in cooperation. Karmyq provides the infrastructure to run those experiments at scale.',
    url: 'https://karmyq.org',
    siteName: 'Karmyq',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
