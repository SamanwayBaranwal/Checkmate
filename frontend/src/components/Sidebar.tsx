'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Logo } from './Logo';

function I({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS: Record<string, string> = {
  dashboard: 'M3 3h8v8H3z|M13 3h8v5h-8z|M13 11h8v10h-8z|M3 13h8v8H3z',
  play: 'M5 3v18l14-9z',
  leaderboard: 'M6 9V3h12v6a6 6 0 0 1-12 0Z|M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3|M9 21h6M12 15v6',
  tournaments: 'M4 4h16|M4 4v6a8 8 0 0 0 16 0V4|M12 18v3M8 21h8',
  puzzle: 'M4 7h4V5a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4h-4v-2a2 2 0 1 0-4 0v2H4v-4',
  learn: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z|M8 7h8M8 11h6',
  rewards: 'M20 12v9H4v-9|M2 7h20v5H2z|M12 22V7|M12 7S9 2 6.5 3.5 8 7 12 7|M12 7s3-5 5.5-3.5S16 7 12 7',
  friends: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  wallet: 'M3 6h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M16 13h.01M3 10h18',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M4 21c0-4 4-6 8-6s8 2 8 6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

const NAV = [
  { href: '/', label: 'Home', icon: 'dashboard', auth: false },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard', auth: false },
  { href: '/friends', label: 'Friends', icon: 'friends', auth: true },
  { href: '/wallet', label: 'Wallet', icon: 'wallet', auth: true },
  { href: '/profile', label: 'Profile', icon: 'profile', auth: true },
  { href: '/settings', label: 'Settings', icon: 'settings', auth: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { authenticated, logout } = usePrivy();

  // Hidden during a live game (board needs full width)
  if (pathname.startsWith('/game/')) return null;

  const items = NAV.filter((n) => !n.auth || authenticated);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col border-r border-white/[0.06] bg-[#0e1110] z-40">
      <div className="px-5 py-5">
        <Link href="/"><Logo size={34} /></Link>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#46a883]/12 text-[#46a883]'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className={active ? 'text-[#46a883]' : ''}><I d={ICONS[n.icon]} /></span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/[0.06]">
        {authenticated ? (
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.04] w-full transition-colors"
          >
            <I d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9" />
            Logout
          </button>
        ) : null}
      </div>
    </aside>
  );
}
