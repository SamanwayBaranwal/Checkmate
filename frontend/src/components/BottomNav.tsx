'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = (active: boolean) => (active ? '#4caf50' : 'currentColor');

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Home',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Ranks',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V3h12v6a6 6 0 0 1-12 0Z" /><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3" /><path d="M9 21h6M12 15v6" />
      </svg>
    ),
  },
  {
    href: '/puzzle',
    label: 'Puzzle',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h4V5a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4h-4v-2a2 2 0 1 0-4 0v2H4v-4" />
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: 'Wallet',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h.01M3 10h18" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { authenticated } = usePrivy();

  // Hide during an active game — the board needs the full screen
  if (pathname.startsWith('/game/')) return null;

  const tabs = authenticated ? TABS : TABS.filter((t) => t.href === '/' || t.href === '/leaderboard' || t.href === '/puzzle');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div
        className="mx-2 mb-2 rounded-2xl border border-white/10 flex items-center justify-around px-1 py-1.5"
        style={{
          background: 'rgba(15, 22, 41, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
        }}
      >
        {tabs.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors"
              style={active ? { background: 'rgba(76,175,80,0.12)' } : undefined}
            >
              <span className={active ? 'text-[#4caf50]' : 'text-white/50'}>{tab.icon(active)}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-[#4caf50]' : 'text-white/50'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
