'use client';

import Link from 'next/link';

interface LiveGame {
  id: string;
  white_username: string | null;
  white_wallet: string;
  black_username: string | null;
  black_wallet: string;
  white_elo_before: number;
  black_elo_before: number;
  bet_amount: number;
  fen?: string;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function initial(name: string) {
  return (name || '?')[0].toUpperCase();
}

export default function LiveGameCard({ game }: { game: LiveGame }) {
  const white = game.white_username || shortAddr(game.white_wallet);
  const black = game.black_username || shortAddr(game.black_wallet);

  return (
    <Link href={`/game/${game.id}`}>
      <div className="card card-hover cursor-pointer group">
        <div className="flex justify-between items-center mb-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-dot" /> LIVE
          </span>
          <span className="text-sm font-bold text-[#f0b232] font-display">${game.bet_amount}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded bg-white text-[#21201d] text-xs font-bold flex items-center justify-center shrink-0">{initial(white)}</span>
              <span className="text-sm font-semibold truncate">{white}</span>
            </div>
            <span className="text-xs text-white/45 shrink-0 ml-2">{game.white_elo_before}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded bg-[#3a3835] border border-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0">{initial(black)}</span>
              <span className="text-sm font-semibold truncate">{black}</span>
            </div>
            <span className="text-xs text-white/45 shrink-0 ml-2">{game.black_elo_before}</span>
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-white/[0.06] text-xs text-white/40 text-center group-hover:text-[#46a883] transition-colors font-medium">
          Watch game →
        </div>
      </div>
    </Link>
  );
}
