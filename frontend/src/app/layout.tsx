'use client';

import './globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig, PRIVY_APP_ID } from '@/lib/privy';
import Navbar from '@/components/Navbar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </PrivyProvider>
      </body>
    </html>
  );
}
