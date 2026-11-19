'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/session';
import { Logo } from './Logo';
import { Icon, type IconName } from './Icons';

const NAV: { href: string; label: string; icon: IconName; auth: boolean }[] = [
  { href: '/', label: 'Play', icon: 'home', auth: false },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'chart', auth: false },
  { href: '/friends', label: 'Friends', icon: 'users', auth: true },
  { href: '/wallet', label: 'Wallet', icon: 'wallet', auth: true },
  { href: '/profile', label: 'Profile', icon: 'user', auth: true },
  { href: '/settings', label: 'Settings', icon: 'settings', auth: true },
];

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export default function Sidebar() {
  const pathname = usePathname();
  const { authenticated, me, logout } = useSession();
  if (pathname.startsWith('/game/')) return null;

  const items = NAV.filter((n) => !n.auth || authenticated);
  const name = me?.username || short(me?.wallet);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-canvas border-r border-line/[0.08] z-40">
      <div className="h-16 px-5 flex items-center">
        <Link href="/" aria-label="Home"><Logo /></Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-medium transition-colors ${
                active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink hover:bg-surface'
              }`}
            >
              <Icon name={n.icon} size={18} className={active ? 'text-accent' : ''} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      {authenticated && me && (
        <div className="p-3 border-t border-line/[0.08]">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="avatar w-8 h-8 text-xs">{(name || '?')[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-faint num">{me.elo} rating</div>
            </div>
            <button onClick={logout} className="btn-ghost p-2" aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
