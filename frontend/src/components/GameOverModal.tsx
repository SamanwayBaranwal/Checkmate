'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icons';

type RematchState = 'idle' | 'offered' | 'incoming';

interface Props {
  result: string;
  winner: string | null;
  playerColor: 'white' | 'black';
  eloChange: number;
  betAmount: number;
  payout?: number;
  streakBonus?: number;
  streak?: number;
  gameId?: string;
  onRematch?: () => void;
  rematchState?: RematchState;
  onAcceptRematch?: () => void;
}

export default function GameOverModal({
  result, winner, playerColor, eloChange, betAmount, payout,
  streakBonus, streak, gameId, onRematch, rematchState = 'idle', onAcceptRematch,
}: Props) {
  const isWinner = winner === playerColor;
  const isDraw = winner === null || winner === 'draw';
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const earned = payout ?? betAmount * 2 * 0.975;
    const msg = isDraw
      ? `I drew a $${betAmount} chess game on ELO!`
      : isWinner
      ? `I just won $${earned.toFixed(2)} on ELO! +${eloChange} ELO rating`
      : `Tough game on ELO — I'll be back!`;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${gameId ? `/replay/${gameId}` : ''}`
      : '';
    const fullText = `${msg}\n${url}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ text: fullText }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="card w-full max-w-sm mx-4 text-center">
        <img
          src={isDraw ? '/brand/el-thinking.png' : isWinner ? '/brand/el-victory.png' : '/brand/el-relaxed.png'}
          alt=""
          className="w-24 h-24 mx-auto rounded-2xl mb-3 select-none pointer-events-none"
        />
        <h2 className="text-2xl font-bold mb-1">
          {isDraw ? 'Draw' : isWinner ? 'You Won!' : 'You Lost'}
        </h2>
        <p className="text-white/50 text-sm mb-4 capitalize">{result.replace('_', ' ')}</p>

        <div className="space-y-2 mb-6">
          {!isDraw && (
            <div className={`text-lg font-bold ${isWinner ? 'text-[#46a883]' : 'text-red-400'}`}>
              {isWinner ? `+$${payout?.toFixed(2) ?? betAmount.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}
            </div>
          )}
          <div className={`text-sm ${isDraw ? 'text-white/50' : isWinner ? 'text-[#46a883]' : 'text-red-400'}`}>
            {isDraw ? 'ELO unchanged' : isWinner ? `+${eloChange} ELO` : `-${eloChange} ELO`}
          </div>
          {isWinner && streakBonus && streakBonus > 0 && (
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 rounded-full px-3 py-1 text-sm text-orange-400 font-semibold">
              <Icon name="fire" size={14} />
              <span>{streak}-win streak bonus +${streakBonus.toFixed(2)}!</span>
            </div>
          )}
        </div>

        {/* Rematch */}
        {onRematch && rematchState === 'idle' && (
          <button onClick={onRematch} className="btn-primary w-full mb-3">
            Rematch
          </button>
        )}
        {rematchState === 'offered' && (
          <div className="bg-white/5 rounded-lg px-4 py-2 mb-3 text-sm text-white/60 animate-pulse">
            Waiting for opponent...
          </div>
        )}
        {rematchState === 'incoming' && onAcceptRematch && (
          <button onClick={onAcceptRematch} className="btn-primary w-full mb-3 bg-[#f0b232] hover:bg-[#e6c200] text-black">
            Accept Rematch
          </button>
        )}

        <div className="flex gap-3 mb-3">
          <Link href="/" className="btn-secondary flex-1">Home</Link>
          {gameId && (
            <Link href={`/replay/${gameId}`} className="btn-secondary flex-1">Watch Replay</Link>
          )}
        </div>

        <button onClick={handleShare} className="btn-secondary w-full text-sm">
          {copied ? 'Copied to clipboard' : 'Share Result'}
        </button>
      </div>
    </div>
  );
}
