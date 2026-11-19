import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import Providers from '@/components/Providers';

// Server component: the page shell renders immediately; only the interactive parts are client code.
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'ELO: real-time chess for real stakes',
  description: 'Play rated chess, climb the leaderboard and win. Fair play checked on every game.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'ELO', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#181715',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
