'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig, PRIVY_APP_ID } from '@/lib/privy';
import { SessionProvider } from '@/lib/session';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';
import MainShell from '@/components/MainShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <SessionProvider>
        <Sidebar />
        <Navbar />
        <MainShell>{children}</MainShell>
        <BottomNav />
      </SessionProvider>
    </PrivyProvider>
  );
}
