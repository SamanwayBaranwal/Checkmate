'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

const BET_TIERS = [1, 5, 10, 25] as const;
type BetTier = (typeof BET_TIERS)[number];

const TIME_CONTROLS = [
  { value: '3+0', label: '3+0', sub: 'Bullet', icon: '⚡' },
  { value: '5+0', label: '5+0', sub: 'Blitz',  icon: '♟' },
  { value: '10+0', label: '10+0', sub: 'Rapid', icon: '🕐' },
] as const;
type TimeControl = '3+0' | '5+0' | '10+0';

interface Props {
  onClose: () => void;
  balance: number;
  token: string;
}

export default function MatchmakingModal({ onClose, balance, token }: Props) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<BetTier | null>(null);
  const [selectedTC, setSelectedTC] = useState<TimeControl>('5+0');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const joinQueue = useCallback(() => {
    if (!selectedTier) return;
    if (balance < selectedTier) {
      setError(`Insufficient balance. You need $${selectedTier} USDC.`);
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
    const socket = getSocket(token);
    socket.emit('leave_queue');
    setSearching(false);
  }, [token]);

  useEffect(() => {
    return () => {
      if (searching) cancelSearch();
    };
  }, [searching, cancelSearch]);

  const tcLabel = TIME_CONTROLS.find((t) => t.value === selectedTC);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Find a Match</h2>

        {!searching ? (
          <>
            <p className="text-sm text-white/60 mb-4">Select your bet amount. Winner takes 95% of the pot.</p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {BET_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  disabled={balance < tier}
                  className={`rounded-xl p-4 border-2 transition-all ${
                    selectedTier === tier
                      ? 'border-[#4caf50] bg-[#4caf50]/20'
                      : 'border-white/10 hover:border-white/30'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="text-2xl font-bold">${tier}</div>
                  <div className="text-xs text-white/60 mt-1">USDC</div>
                  {balance < tier && <div className="text-xs text-red-400 mt-1">Insufficient</div>}
                </button>
              ))}
            </div>

            {/* Time control */}
            <p className="text-sm text-white/60 mb-2">Time control</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.value}
                  onClick={() => setSelectedTC(tc.value as TimeControl)}
                  className={`rounded-lg p-3 border transition-all text-center ${
                    selectedTC === tc.value
                      ? 'border-[#ffd700] bg-[#ffd700]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-lg">{tc.icon}</div>
                  <div className="text-sm font-bold mt-0.5">{tc.label}</div>
                  <div className="text-xs text-white/50">{tc.sub}</div>
                </button>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={joinQueue} disabled={!selectedTier} className="btn-primary flex-1">
                Find Opponent
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4 animate-pulse">♟</div>
            <p className="text-lg font-semibold mb-2">Searching for opponent...</p>
            <p className="text-sm text-white/60 mb-6">
              Bet: ${selectedTier} USDC · {tcLabel?.icon} {selectedTC} {tcLabel?.sub}
            </p>
            <button onClick={cancelSearch} className="btn-secondary">Cancel Search</button>
          </div>
        )}
      </div>
    </div>
  );
}
