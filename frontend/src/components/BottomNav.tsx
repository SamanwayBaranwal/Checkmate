'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/session';
import { PieceGlyph, CoinGlyph, SquaresGlyph, GearGlyph } from './GameIcons';

// Mobile tab bar with chess-made icons: Play (knight) · Ranks (king) · Wallet (coins) · Profile (pawn) · More (squares)
const TABS = [
  { href: '/', label: 'Play', icon: (c: string) => <PieceGlyph piece="N" size={24} className={c} /> },
  { href: '/leaderboard', label: 'Ranks', icon: (c: string) => <PieceGlyph piece="K" size={24} className={c} /> },
  { href: '/wallet', label: 'Wallet', icon: (c: string) => <CoinGlyph size={24} className={c} /> },
  { href: '/profile', label: 'Profile', icon: (c: string) => <PieceGlyph piece="P" size={24} className={c} /> },
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
            <div className="w-10 h-1.5 rounded-full bg-surface-3 mx-auto mb-4" />
            {authenticated ? (
              <div className="space-y-2">
                <button onClick={() => go('/friends')} className="play-tile !py-3">
                  <span className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-accent"><PieceGlyph piece="P" size={22} /></span>
                  <span className="flex-1 font-extrabold">Friends</span>
                </button>
                <button onClick={() => go('/settings')} className="play-tile !py-3">
                  <span className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-accent"><GearGlyph size={22} /></span>
                  <span className="flex-1 font-extrabold">Settings</span>
                </button>
                <button onClick={() => { setSheet(false); logout(); }} className="btn-secondary w-full h-12 !text-negative mt-2">Sign out</button>
              </div>
            ) : (
              <button onClick={() => { setSheet(false); login(); }} className="btn-primary w-full h-12">Sign in</button>
            )}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-canvas/95 backdrop-blur border-t border-line/[0.07] pb-safe">
        <div className="grid grid-cols-5 h-[64px]">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center justify-center gap-1">
                <span className={`w-12 h-8 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-accent/20' : ''}`}>
                  {t.icon(active ? 'text-accent' : 'text-faint')}
                </span>
                <span className={`text-[11px] font-extrabold ${active ? 'text-ink' : 'text-faint'}`}>{t.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setSheet(true)} className="flex flex-col items-center justify-center gap-1">
            <span className={`w-12 h-8 rounded-full flex items-center justify-center ${sheet ? 'bg-accent/20' : ''}`}>
              <SquaresGlyph size={22} className={sheet ? 'text-accent' : 'text-faint'} />
            </span>
            <span className={`text-[11px] font-extrabold ${sheet ? 'text-ink' : 'text-faint'}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
