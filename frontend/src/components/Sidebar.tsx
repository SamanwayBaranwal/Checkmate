'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/session';
import { Logo } from './Logo';
import { Icon } from './Icons';
import { PieceGlyph, CoinGlyph, GearGlyph, PieceAvatar } from './GameIcons';

const NAV = [
  { href: '/', label: 'Play', auth: false, icon: (c: string) => <PieceGlyph piece="N" size={22} className={c} /> },
  { href: '/leaderboard', label: 'Leaderboard', auth: false, icon: (c: string) => <PieceGlyph piece="K" size={22} className={c} /> },
  { href: '/friends', label: 'Friends', auth: true, icon: (c: string) => <PieceGlyph piece="P" size={22} className={c} /> },
  { href: '/wallet', label: 'Wallet', auth: true, icon: (c: string) => <CoinGlyph size={22} className={c} /> },
  { href: '/profile', label: 'Profile', auth: true, icon: (c: string) => <PieceGlyph piece="Q" size={22} className={c} /> },
  { href: '/settings', label: 'Settings', auth: true, icon: (c: string) => <GearGlyph size={22} className={c} /> },
];

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export default function Sidebar() {
  const pathname = usePathname();
  const { authenticated, me, logout } = useSession();
  if (pathname.startsWith('/game/')) return null;

  const items = NAV.filter((n) => !n.auth || authenticated);
  const name = me?.username || short(me?.wallet);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-canvas border-r border-line/[0.07] z-40">
      <div className="h-16 px-5 flex items-center">
        <Link href="/" aria-label="Home"><Logo /></Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-extrabold transition-colors ${
                active ? 'bg-accent/15 text-ink' : 'text-muted hover:text-ink hover:bg-surface'
              }`}>
              {n.icon(active ? 'text-accent' : 'text-faint')}
              {n.label}
            </Link>
          );
        })}
      </nav>

      {authenticated && me && (
        <div className="p-3 border-t border-line/[0.07]">
          <div className="flex items-center gap-3 px-2 py-2">
            <PieceAvatar seed={me.username || me.id} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold truncate">{name}</div>
              <div className="text-xs text-faint font-semibold num">{me.elo} rating</div>
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
