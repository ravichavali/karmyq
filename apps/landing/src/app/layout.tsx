import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Karmyq — Meaning-making, not accounting',
  description:
    'Karmyq is open-source infrastructure for neighborhoods, mutual aid groups, and local communities to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Karmyq — Meaning-making, not accounting',
    description:
      'Karmyq is open-source infrastructure for neighborhoods, mutual aid groups, and local communities to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.',
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
