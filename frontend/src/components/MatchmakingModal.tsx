'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { Icon } from '@/components/Icons';

const BET_TIERS = [1, 5, 10, 25] as const;
type BetTier = (typeof BET_TIERS)[number];

type TimeControl = '3+0' | '5+0' | '10+0';
const TIME_CONTROLS: { value: TimeControl; name: string; time: string; desc: string }[] = [
  { value: '10+0', name: 'Rapid', time: '10 min', desc: 'Relaxed pace, more time to think' },
  { value: '5+0', name: 'Blitz', time: '5 min', desc: 'Fast and sharp — the classic' },
  { value: '3+0', name: 'Bullet', time: '3 min', desc: 'Lightning fast, pure instinct' },
];

interface Props {
  onClose: () => void;
  balance: number;
  token: string;
}

export default function MatchmakingModal({ onClose, balance, token }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'mode' | 'setup'>('mode');
  const [selectedTier, setSelectedTier] = useState<BetTier>(1);
  const [selectedTC, setSelectedTC] = useState<TimeControl>('5+0');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const joinQueue = useCallback(() => {
    if (balance < selectedTier) {
      setError(`Not enough credits. You need $${selectedTier} to play this stake.`);
      return;
    }
    const socket = getSocket(token);
    setSearching(true);
    setError('');
    socket.emit('join_queue', { tier: selectedTier, timeControl: selectedTC });

    socket.once('match_found', (data: { gameId: string }) => {
      setSearching(false);
      router.push(`/game/${data.gameId}`);
      onClose();
    });
    socket.once('error', (err: { message: string }) => {
      setSearching(false);
      setError(err.message);
    });
  }, [selectedTier, selectedTC, balance, token, router, onClose]);

  const cancelSearch = useCallback(() => {
    getSocket(token).emit('leave_queue');
    setSearching(false);
  }, [token]);

  useEffect(() => () => { if (searching) cancelSearch(); }, [searching, cancelSearch]);

  const tc = TIME_CONTROLS.find((t) => t.value === selectedTC);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#141715] border-t sm:border border-white/[0.08] rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#141715]">
          <div className="flex items-center gap-2">
            {step === 'setup' && !searching && (
              <button onClick={() => setStep('mode')} className="w-7 h-7 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] flex items-center justify-center">←</button>
            )}
            <h2 className="text-lg font-bold">{searching ? 'Matchmaking' : step === 'mode' ? 'Play' : 'New Game'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] flex items-center justify-center">✕</button>
        </div>

        {/* Step 1: choose mode */}
        {step === 'mode' && !searching && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-white/45 mb-1">Choose how you want to play.</p>
            <button
              onClick={() => setStep('setup')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] hover:border-[#46a883]/50 hover:bg-[#46a883]/[0.06] transition-all text-left"
            >
              <span className="w-11 h-11 rounded-xl bg-[#46a883]/15 text-[#46a883] flex items-center justify-center shrink-0"><Icon name="play" size={20} /></span>
              <div>
                <div className="font-bold">Play Online</div>
                <div className="text-xs text-white/45 mt-0.5">Get matched with a player worldwide</div>
              </div>
            </button>
            <button
              onClick={() => { onClose(); router.push('/friends'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] hover:border-[#46a883]/50 hover:bg-[#46a883]/[0.06] transition-all text-left"
            >
              <span className="w-11 h-11 rounded-xl bg-white/[0.06] text-white/70 flex items-center justify-center shrink-0"><Icon name="users" size={20} /></span>
              <div>
                <div className="font-bold">Play with Friends</div>
                <div className="text-xs text-white/45 mt-0.5">Challenge someone from your friends list</div>
              </div>
            </button>
          </div>
        )}

        {step === 'setup' && !searching ? (
          <div className="p-5">
            {/* Time control — vertical list */}
            <p className="eyebrow mb-3">Time Control</p>
            <div className="space-y-2 mb-6">
              {TIME_CONTROLS.map((t) => {
                const active = selectedTC === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setSelectedTC(t.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      active ? 'border-[#46a883] bg-[#46a883]/10' : 'border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-[#46a883]/15 text-[#46a883]' : 'bg-white/[0.05] text-white/60'}`}>
                      <Icon name="clock" size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{t.name}</span>
                        <span className="text-xs text-white/40">{t.time}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5 truncate">{t.desc}</div>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-[#46a883] bg-[#46a883]' : 'border-white/25'}`}>
                      {active && <Icon name="check" size={12} className="text-[#0b0d0c]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Stake */}
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">Stake</p>
              <span className="text-xs text-white/40">Balance ${balance.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {BET_TIERS.map((tier) => {
                const active = selectedTier === tier;
                const cant = balance < tier;
                return (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    disabled={cant}
                    className={`rounded-xl py-3 border text-center transition-all ${
                      active ? 'border-[#46a883] bg-[#46a883]/10' : 'border-white/[0.08] hover:border-white/20'
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    <div className="text-base font-bold font-display">${tier}</div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg bg-white/[0.03] px-4 py-2.5 mb-4 flex items-center justify-between text-sm">
              <span className="text-white/45">Winner takes</span>
              <span className="font-bold text-[#46a883]">${(selectedTier * 2 * 0.975).toFixed(2)}</span>
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button onClick={joinQueue} className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2">
              <Icon name="play" size={16} /> Start Game
            </button>
          </div>
        ) : null}

        {searching && (
          <div className="text-center px-5 py-12">
            <div className="flex justify-center mb-5 text-[#46a883] animate-pulse-dot"><Icon name="pawn" size={44} /></div>
            <p className="text-lg font-bold mb-1">Finding an opponent…</p>
            <p className="text-sm text-white/50 mb-1">{tc?.name} · {tc?.time}</p>
            <p className="text-sm text-white/40 mb-7">Stake ${selectedTier} · winner gets ${(selectedTier * 2 * 0.975).toFixed(2)}</p>
            <button onClick={cancelSearch} className="btn-secondary">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
