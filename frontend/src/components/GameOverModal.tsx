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

const RESULT_TEXT: Record<string, string> = {
  checkmate: 'by checkmate', resignation: 'by resignation', timeout: 'on time', draw: 'by agreement',
};

export default function GameOverModal({
  result, winner, playerColor, eloChange, betAmount, payout,
  streakBonus, streak, gameId, onRematch, rematchState = 'idle', onAcceptRematch,
}: Props) {
  const won = winner === playerColor;
  const draw = winner === null || winner === 'draw';
  const [copied, setCopied] = useState(false);
  const earned = payout ?? betAmount * 2 * 0.975;

  const share = () => {
    const msg = draw ? `Drew a $${betAmount} chess game on ELO` : won ? `Won $${earned.toFixed(2)} on ELO (+${eloChange} rating)` : 'Good game on ELO';
    const text = `${msg}\n${window.location.origin}${gameId ? `/replay/${gameId}` : ''}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else if (navigator.clipboard) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="overlay">
      <div className="sheet text-center">
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${draw ? 'bg-surface-2 text-muted' : won ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>
          <Icon name={draw ? 'handshake' : won ? 'trophy' : 'flag'} size={24} />
        </div>
        <h2 className="text-2xl font-semibold">{draw ? 'Draw' : won ? 'You won' : 'You lost'}</h2>
        <p className="text-sm text-muted mt-1">{RESULT_TEXT[result] ?? result.replace('_', ' ')}</p>

        <div className="grid grid-cols-2 gap-2 my-5">
          <div className="rounded-xl bg-surface-2 py-3">
            <div className="text-xs text-faint">Money</div>
            <div className={`text-lg font-semibold num ${draw ? '' : won ? 'text-positive' : 'text-negative'}`}>
              {draw ? 'Refunded' : won ? `+$${earned.toFixed(2)}` : `−$${betAmount.toFixed(2)}`}
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 py-3">
            <div className="text-xs text-faint">Rating</div>
            <div className={`text-lg font-semibold num ${draw ? '' : won ? 'text-positive' : 'text-negative'}`}>
              {draw ? '±0' : won ? `+${eloChange}` : `−${eloChange}`}
            </div>
          </div>
        </div>

        {won && streakBonus && streakBonus > 0 ? (
          <p className="text-sm text-accent mb-3 flex items-center justify-center gap-1.5"><Icon name="fire" size={14} /> {streak}-win streak bonus +${streakBonus.toFixed(2)}</p>
        ) : null}
        {won && <p className="text-xs text-faint mb-4">Winnings unlock after the fair-play check.</p>}

        {onRematch && rematchState === 'idle' && <button onClick={onRematch} className="btn-primary w-full h-12 mb-2">Rematch</button>}
        {rematchState === 'offered' && <div className="h-12 mb-2 rounded-[10px] bg-surface-2 text-sm text-muted flex items-center justify-center">Waiting for opponent…</div>}
        {rematchState === 'incoming' && onAcceptRematch && <button onClick={onAcceptRematch} className="btn-primary w-full h-12 mb-2">Accept rematch</button>}

        <div className="grid grid-cols-3 gap-2">
          <Link href="/" className="btn-secondary h-11">Home</Link>
          {gameId && <Link href={`/replay/${gameId}`} className="btn-secondary h-11">Replay</Link>}
          <button onClick={share} className="btn-secondary h-11">{copied ? 'Copied' : 'Share'}</button>
        </div>
      </div>
    </div>
  );
}
