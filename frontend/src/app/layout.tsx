import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import Providers from '@/components/Providers';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TITLE, REAL_MONEY } from '@/lib/site';

// Server component: the page shell renders immediately; only the interactive parts are client code.
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s · ELO' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: REAL_MONEY
    ? ['chess', 'play chess online', 'chess for money', 'chess betting', 'blitz chess', 'bullet chess', 'rated chess']
    : ['chess', 'play chess online', 'free chess', 'chess leaderboard', 'blitz chess', 'bullet chess', 'rated chess', 'chess with friends'],
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: REAL_MONEY ? '/og.png' : '/og-free.png', width: 1200, height: 630, alt: REAL_MONEY ? 'ELO: Play chess. Win money.' : 'ELO: Play chess. Win credits.' }],
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [REAL_MONEY ? '/og.png' : '/og-free.png'] },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#111112',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        {/* Runs before paint: signed-in players skip the logged-out landing while the session loads. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('checkmate_token'))document.documentElement.classList.add('has-session')}catch(e){}" }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
