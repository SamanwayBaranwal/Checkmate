'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icons';

const BET_TIERS = [1, 5, 10, 25] as const;
type BetTier = (typeof BET_TIERS)[number];
type TimeControl = '3+0' | '5+0' | '10+0';
const TIME_CONTROLS: { value: TimeControl; name: string; time: string }[] = [
  { value: '3+0', name: 'Bullet', time: '3 min' },
  { value: '5+0', name: 'Blitz', time: '5 min' },
  { value: '10+0', name: 'Rapid', time: '10 min' },
];

interface Props { onClose: () => void; balance: number; token: string }

export default function MatchmakingModal({ onClose, balance, token }: Props) {
  const router = useRouter();
  const [tier, setTier] = useState<BetTier>(1);
  const [tc, setTc] = useState<TimeControl>('5+0');
  const [searching, setSearching] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [limits, setLimits] = useState<Awaited<ReturnType<typeof api.users.limits>> | null>(null);
  const searchingRef = useRef(false);

  useEffect(() => { api.users.limits().then(setLimits).catch(() => {}); }, []);
  const maxStake = limits ? limits.maxStake : Infinity;

  useEffect(() => {
    if (!searching) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [searching]);

  const join = useCallback(() => {
    if (balance < tier) { setError(`You need $${tier} to play this stake.`); return; }
    const socket = getSocket(token);
    setError(''); setSearching(true); searchingRef.current = true;
    socket.emit('join_queue', { tier, timeControl: tc });
    socket.once('match_found', (d: { gameId: string }) => { searchingRef.current = false; setSearching(false); router.push(`/game/${d.gameId}`); onClose(); });
    socket.once('error', (e: { message: string }) => { searchingRef.current = false; setSearching(false); setError(e.message); });
  }, [tier, tc, balance, token, router, onClose]);

  const cancel = useCallback(() => {
    getSocket(token).emit('leave_queue');
    searchingRef.current = false;
    setSearching(false);
  }, [token]);

  useEffect(() => () => { if (searchingRef.current) getSocket(token).emit('leave_queue'); }, [token]);

  const close = () => { if (searching) cancel(); onClose(); };

  return (
    <div className="overlay" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{searching ? 'Finding an opponent' : 'New game'}</h2>
          <button onClick={close} className="btn-ghost p-2 -mr-2" aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        {searching ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-surface-3 border-t-accent animate-spin" />
            <p className="text-sm text-muted mt-5">
              {TIME_CONTROLS.find((t) => t.value === tc)?.name} · ${tier} stake
            </p>
            <p className="text-2xl font-semibold num mt-1">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
            <button onClick={cancel} className="btn-secondary w-full h-12 mt-6">Cancel</button>
          </div>
        ) : (
          <>
            <div className="eyebrow mb-2">Time control</div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {TIME_CONTROLS.map((t) => {
                const on = tc === t.value;
                return (
                  <button key={t.value} onClick={() => setTc(t.value)}
                    className={`rounded-xl py-3 border text-center transition-colors ${on ? 'border-accent/60 bg-accent/10' : 'border-line/[0.08] bg-surface-2 hover:bg-surface-3'}`}>
                    <div className={`text-sm font-semibold ${on ? 'text-accent' : ''}`}>{t.name}</div>
                    <div className="text-xs text-muted mt-0.5 num">{t.time}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">Stake</span>
              <span className="text-xs text-muted num">Balance ${balance.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BET_TIERS.map((b) => {
                const on = tier === b;
                const locked = b > maxStake;
                const cant = locked || balance < b;
                return (
                  <button key={b} onClick={() => setTier(b)} disabled={cant}
                    className={`relative h-12 rounded-xl border text-sm font-semibold num transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line/[0.08] bg-surface-2 hover:bg-surface-3'}`}>
                    ${b}
                    {locked && <Icon name="lock" size={11} className="absolute top-1.5 right-1.5 text-faint" />}
                  </button>
                );
              })}
            </div>
            {limits && maxStake < 25 && (
              <p className="text-xs text-muted mt-2">
                {limits.reason ? limits.reason
                  : `Limit $${limits.maxStake} per game while your account is new.${limits.next ? ` ${Math.max(0, limits.next.games - limits.cleanGames)} more clean games and ${limits.next.days}+ days unlock $${limits.next.maxStake}.` : ''}`}
              </p>
            )}

            <div className="flex items-center justify-between mt-5 py-3 border-t border-line/[0.08] text-sm">
              <span className="text-muted">Winner receives</span>
              <span className="font-semibold num">${(tier * 2 * 0.975).toFixed(2)}</span>
            </div>
            <p className="text-xs text-faint -mt-1 mb-4">Winnings unlock after the fair-play check{limits ? ` (about ${limits.holdHours}h)` : ''}.</p>

            {error && <p className="text-sm text-negative mb-3">{error}</p>}
            <button onClick={join} disabled={balance < tier || tier > maxStake} className="btn-primary w-full h-12 text-[15px]">
              Find opponent
            </button>
          </>
        )}
      </div>
    </div>
  );
}
