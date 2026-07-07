'use client';

export const dynamic = 'force-dynamic';

import './globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig, PRIVY_APP_ID } from '@/lib/privy';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Checkmate — Bet Chess</title>
        <meta name="description" content="Play chess for real USDC. Wager, win, withdraw instantly." />
        <meta name="theme-color" content="#262421" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Checkmate" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
          <Navbar />
          <main className="min-h-screen animate-in pb-24 md:pb-0">{children}</main>
          <BottomNav />
        </PrivyProvider>
      </body>
    </html>
  );
}
