'use client';

import { usePathname } from 'next/navigation';

// Page container. Offsets the desktop sidebar; the game screen gets the whole viewport.
export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/game/')) {
    return <main className="overflow-hidden">{children}</main>;
  }
  return <main className="min-h-[100dvh] md:pl-60 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-10">{children}</main>;
}
