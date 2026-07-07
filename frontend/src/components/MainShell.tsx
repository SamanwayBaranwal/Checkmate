'use client';

import { usePathname } from 'next/navigation';

// Wraps page content. On game routes there's no bottom nav, so drop the
// bottom padding that would otherwise cause the board to overflow/scroll.
export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGame = pathname.startsWith('/game/');
  return (
    <main className={`animate-in ${isGame ? 'overflow-hidden' : 'min-h-screen pb-24 md:pb-0'}`}>
      {children}
    </main>
  );
}
