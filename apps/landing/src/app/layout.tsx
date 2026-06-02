import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Karmyq — Join the founding circle',
  description:
    'A founding-circle invitation for specialists, organizers, builders, and researchers shaping open-source infrastructure for local trust.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Karmyq — Join the founding circle',
    description:
      'A founding-circle invitation for specialists, organizers, builders, and researchers shaping open-source infrastructure for local trust.',
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
