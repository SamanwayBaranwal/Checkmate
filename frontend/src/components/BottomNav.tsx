'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/session';
import { Icon, type IconName } from './Icons';

// Mobile tab bar: Play · Ranks · Wallet · Profile · More
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Play', icon: 'home' },
  { href: '/leaderboard', label: 'Ranks', icon: 'chart' },
  { href: '/wallet', label: 'Wallet', icon: 'wallet' },
  { href: '/profile', label: 'Profile', icon: 'user' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, login, logout } = useSession();
  const [sheet, setSheet] = useState(false);
  if (pathname.startsWith('/game/')) return null;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const go = (href: string) => { setSheet(false); router.push(href); };

  return (
    <>
      {sheet && (
        <div className="overlay md:hidden" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-surface-3 mx-auto mb-4" />
            {authenticated ? (
              <div className="space-y-1">
                {[
                  { href: '/friends', label: 'Friends', icon: 'users' as IconName },
                  { href: '/settings', label: 'Settings', icon: 'settings' as IconName },
                ].map((l) => (
                  <button key={l.href} onClick={() => go(l.href)}
                    className="w-full flex items-center gap-3 h-12 px-3 rounded-[10px] hover:bg-surface-2 text-left">
                    <Icon name={l.icon} size={18} className="text-muted" />
                    <span className="flex-1 text-sm font-medium">{l.label}</span>
                    <Icon name="chevron-right" size={16} className="text-faint" />
                  </button>
                ))}
                <button onClick={() => { setSheet(false); logout(); }}
                  className="w-full flex items-center gap-3 h-12 px-3 rounded-[10px] hover:bg-surface-2 text-left text-negative">
                  <Icon name="logout" size={18} />
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            ) : (
              <button onClick={() => { setSheet(false); login(); }} className="btn-primary w-full h-12">Sign in</button>
            )}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-canvas/95 backdrop-blur border-t border-line/[0.08] pb-safe">
        <div className="grid grid-cols-5 h-[60px]">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center justify-center gap-1">
                <Icon name={t.icon} size={21} className={active ? 'text-accent' : 'text-faint'} />
                <span className={`text-[10.5px] font-medium ${active ? 'text-ink' : 'text-faint'}`}>{t.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setSheet(true)} className="flex flex-col items-center justify-center gap-1">
            <Icon name="more" size={21} className={sheet ? 'text-accent' : 'text-faint'} strokeWidth={3} />
            <span className={`text-[10.5px] font-medium ${sheet ? 'text-ink' : 'text-faint'}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
