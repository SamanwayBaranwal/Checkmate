'use client';

import { useSession } from '@/lib/session';
import { Icon, type IconName } from './Icons';
import BoardPreview from './BoardPreview';
import Link from 'next/link';
import { REAL_MONEY } from '@/lib/site';

const POINTS: { icon: IconName; color: string; title: string; desc: string }[] = [
  { icon: 'bolt', color: '#F2A93B', title: 'A game in seconds', desc: 'Bullet, blitz or rapid against someone at your level.' },
  { icon: 'shield', color: '#9B82FF', title: 'Cheaters don’t get paid', desc: 'Stockfish checks every game before any winnings unlock.' },
  { icon: 'gift', color: '#4C9BFF', title: '$10 on us', desc: 'Free credits when you join. No card needed.' },
];

export default function AuthLanding() {
  const { login } = useSession();
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-14 pb-12">
      <div className="grid lg:grid-cols-[1fr_minmax(0,520px)] gap-10 lg:gap-14 items-center">
        <div>
          <h1 className="text-[44px] leading-[1.02] md:text-[64px] font-black tracking-tight">
            Play chess.<br /><span className="text-muted">{REAL_MONEY ? 'Win money.' : 'Win credits.'}</span>
          </h1>
          <p className="text-muted text-lg md:text-xl font-medium mt-4 max-w-md">
            Rated games against real people. The better you play, the more you take home.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button onClick={login} className="btn-primary h-14 px-8 text-lg">Play now, it&apos;s free</button>
            <button onClick={login} className="btn-secondary h-14 px-6 text-lg">Log in</button>
          </div>
          <p className="text-sm text-faint font-medium mt-3">Email, Google or wallet. Takes 10 seconds.</p>
          {!REAL_MONEY && <p className="text-xs text-faint mt-1.5">Free to play. Credits have no cash value.</p>}

          <div className="lg:hidden mt-10"><BoardPreview /></div>

          <div className="mt-10 grid gap-3">
            {POINTS.map((p) => (
              <div key={p.title} className="flex items-center gap-4 rounded-2xl bg-surface border border-line/[0.07] px-4 py-3.5">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}26`, color: p.color }}>
                  <Icon name={p.icon} size={20} />
                </span>
                <div>
                  <div className="font-extrabold">{p.title}</div>
                  <div className="text-sm text-muted font-medium">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block"><BoardPreview /></div>
      </div>
      <footer className="mt-14 pt-6 border-t border-line/[0.07] flex flex-wrap gap-x-5 gap-y-2 text-sm text-faint font-medium">
        <span>© {new Date().getFullYear()} ELO</span>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/leaderboard" className="hover:text-ink">Leaderboard</Link>
      </footer>
    </div>
  );
}
