import type { Metadata } from 'next';
import './globals.css';
import { routeByKey, SITE_URL } from '../lib/landingRoutes';

const home = routeByKey('home');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: home.title,
  description: home.description,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: home.title,
    description: home.description,
    url: SITE_URL,
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
