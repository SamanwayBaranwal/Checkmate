'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Logo } from './Logo';
import { Icon, type IconName } from './Icons';

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'pawn', title: 'Play', desc: 'Real-time chess matches, any skill level' },
  { icon: 'winrate', title: 'Improve', desc: 'Climb the ELO ladder and track progress' },
  { icon: 'trophy', title: 'Earn', desc: 'Win games, tournaments, and daily rewards' },
];

export default function AuthLanding() {
  const { login } = usePrivy();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10">
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        {/* Left — branding */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-8 flex flex-col justify-between min-h-[460px]">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: 'conic-gradient(#fff 90deg, transparent 90deg 180deg, #fff 180deg 270deg, transparent 270deg)', backgroundSize: '52px 52px' }}
          />
          <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(70,168,131,0.16) 0%, transparent 68%)' }} />

          <div className="relative">
            <Logo size={40} />
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.03] mt-8">
              EVERY MOVE.<br />EVERY <span className="text-[#46a883]">RISE.</span>
            </h1>
            <p className="text-white/50 text-sm font-semibold tracking-wide mt-3">PLAY. IMPROVE. EARN.</p>
          </div>

          <div className="relative flex items-end justify-between gap-4 mt-8">
            <div className="space-y-2.5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#46a883]/12 flex items-center justify-center text-[#46a883]"><Icon name={f.icon} size={16} /></span>
                  <div>
                    <div className="text-sm font-semibold leading-none">{f.title}</div>
                    <div className="text-xs text-white/40 mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <img src="/brand/el-happy.png" alt="ELO mascot" className="hidden sm:block w-28 rounded-2xl shrink-0 select-none pointer-events-none" />
          </div>
        </div>

        {/* Right — auth card */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#141715] p-8 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-1">Welcome</h2>
          <p className="text-sm text-white/45 mb-7">Sign in to play, climb, and earn.</p>

          <div className="space-y-3">
            <button onClick={login} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              Sign in / Sign up
            </button>
            <button onClick={login} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Icon name="google" size={16} /> Continue with Google
            </button>
            <button onClick={login} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Icon name="wallet-connect" size={16} /> Continue with Wallet
            </button>
          </div>

          <div className="mt-6 rounded-lg bg-[#46a883]/8 border border-[#46a883]/20 px-4 py-3 text-center">
            <p className="text-sm text-[#46a883] font-semibold flex items-center justify-center gap-1.5"><Icon name="gift" size={15} /> New players get $10 free credits</p>
            <p className="text-xs text-white/40 mt-0.5">Start playing instantly — no payment needed.</p>
          </div>

          <p className="text-[11px] text-white/25 text-center mt-6 leading-relaxed">
            By continuing you agree to fair play. Skill-based chess only.
          </p>
        </div>
      </div>
    </div>
  );
}
