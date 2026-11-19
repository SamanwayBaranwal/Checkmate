'use client';

import { useSession } from '@/lib/session';
import { Icon, type IconName } from './Icons';
import BoardPreview from './BoardPreview';

const POINTS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'bolt', title: 'A game in seconds', desc: 'Bullet, blitz or rapid against someone at your level.' },
  { icon: 'shield', title: 'Cheaters don’t get paid', desc: 'Stockfish checks every game before any winnings unlock.' },
  { icon: 'gift', title: '$10 on us', desc: 'Free credits when you join. No card needed.' },
];

export default function AuthLanding() {
  const { login } = useSession();
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-14 pb-12">
      <div className="grid lg:grid-cols-[1fr_minmax(0,520px)] gap-10 lg:gap-14 items-center">
        <div>
          <h1 className="text-[44px] leading-[1.02] md:text-[64px] font-black tracking-tight">
            Play chess.<br /><span className="text-accent">Win money.</span>
          </h1>
          <p className="text-muted text-lg md:text-xl font-medium mt-4 max-w-md">
            Rated games against real people. The better you play, the more you take home.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button onClick={login} className="btn-primary h-14 px-8 text-lg">Play now, it&apos;s free</button>
            <button onClick={login} className="btn-secondary h-14 px-6 text-lg">Log in</button>
          </div>
          <p className="text-sm text-faint font-medium mt-3">Email, Google or wallet. Takes 10 seconds.</p>

          <div className="lg:hidden mt-10"><BoardPreview /></div>

          <div className="mt-10 grid gap-3">
            {POINTS.map((p) => (
              <div key={p.title} className="flex items-center gap-4 rounded-2xl bg-surface border border-line/[0.07] px-4 py-3.5">
                <span className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center text-accent shrink-0">
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
    </div>
  );
}
