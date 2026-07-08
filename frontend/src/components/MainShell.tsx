'use client';

import { usePathname } from 'next/navigation';

// Wraps page content. Offsets for the desktop sidebar; drops bottom padding
// on game routes (no bottom nav there) so the board never overflows.
export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGame = pathname.startsWith('/game/');
  if (isGame) {
    return <main className="animate-in overflow-hidden">{children}</main>;
  }
  return (
    <main className="animate-in min-h-screen md:pl-60 pb-24 md:pb-8">
      {children}
    </main>
  );
}
