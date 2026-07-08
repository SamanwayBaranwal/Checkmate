'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';

const stroke = (active: boolean) => (active ? '#46a883' : 'currentColor');

function Icon({ name, active }: { name: string; active: boolean }) {
  const c = stroke(active);
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></svg>;
    case 'ranks':
      return <svg {...common}><path d="M6 9V3h12v6a6 6 0 0 1-12 0Z" /><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3" /><path d="M9 21h6M12 15v6" /></svg>;
    case 'wallet':
      return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h.01M3 10h18" /></svg>;
    case 'more':
      return <svg {...common}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
    default:
      return null;
  }
}

const MORE_LINKS = [
  { href: '/friends', label: 'Friends', emoji: '👥', auth: true },
  { href: '/tournaments', label: 'Tournaments', emoji: '🏆', auth: false },
  { href: '/missions', label: 'Missions', emoji: '🎯', auth: true },
  { href: '/learn', label: 'Learn', emoji: '📚', auth: false },
  { href: '/puzzle', label: 'Daily Puzzle', emoji: '🧩', auth: false },
  { href: '/settings', label: 'Settings', emoji: '⚙️', auth: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, login, logout } = usePrivy();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Hide during an active game — the board needs the full screen
  if (pathname.startsWith('/game/')) return null;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const moreLinks = MORE_LINKS.filter((l) => !l.auth || authenticated);

  const go = (href: string) => { setSheetOpen(false); router.push(href); };

  const tabs = [
    { href: '/', icon: 'home', label: 'Home' },
    { href: '/leaderboard', icon: 'ranks', label: 'Ranks' },
  ];

  return (
    <>
      {/* Backdrop + bottom sheet */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-white/10 p-4 pb-8 pb-safe animate-in"
            style={{ background: '#26241f' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map((l) => (
                <button
                  key={l.href}
                  onClick={() => go(l.href)}
                  className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl transition-colors ${isActive(l.href) ? 'bg-[#46a883]/12' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}
                >
                  <span className="text-2xl">{l.emoji}</span>
                  <span className={`text-xs font-medium ${isActive(l.href) ? 'text-[#46a883]' : 'text-white/70'}`}>{l.label}</span>
                </button>
              ))}
            </div>
            {authenticated ? (
              <button onClick={() => { setSheetOpen(false); logout(); }} className="btn-secondary w-full mt-3 text-sm">
                Sign out
              </button>
            ) : (
              <button onClick={() => { setSheetOpen(false); login(); }} className="btn-primary w-full mt-3 text-sm">
                Sign in
              </button>
            )}
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe border-t border-white/[0.06]"
        style={{ background: 'rgba(28, 27, 24, 0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center justify-around px-1 pt-1.5 pb-1">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 py-1 flex-1">
                <Icon name={tab.icon} active={active} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#46a883]' : 'text-white/45'}`}>{tab.label}</span>
              </Link>
            );
          })}

          {/* Center prominent Play button */}
          <Link href="/" className="flex-1 flex justify-center">
            <span className="w-14 h-14 -mt-6 rounded-2xl bg-[#46a883] flex items-center justify-center text-[#21201d] text-2xl shadow-lg border-4 border-[#1c1b18]">
              ♟
            </span>
          </Link>

          <Link href="/wallet" className="flex flex-col items-center gap-1 py-1 flex-1">
            <Icon name="wallet" active={isActive('/wallet')} />
            <span className={`text-[10px] font-medium ${isActive('/wallet') ? 'text-[#46a883]' : 'text-white/45'}`}>Wallet</span>
          </Link>

          <button onClick={() => setSheetOpen(true)} className="flex flex-col items-center gap-1 py-1 flex-1">
            <Icon name="more" active={sheetOpen} />
            <span className={`text-[10px] font-medium ${sheetOpen ? 'text-[#46a883]' : 'text-white/45'}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
