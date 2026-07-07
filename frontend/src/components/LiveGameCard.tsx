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

export default function LiveGameCard({ game }: { game: LiveGame }) {
  const white = game.white_username || shortAddr(game.white_wallet);
  const black = game.black_username || shortAddr(game.black_wallet);

  return (
    <Link href={`/game/${game.id}`}>
      <div className="card hover:border-[#81b64c]/50 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
            ● LIVE
          </span>
          <span className="text-sm font-bold text-[#f0b232]">${game.bet_amount} USDC</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">⬜ {white}</span>
            <span className="text-xs text-white/50">{game.white_elo_before}</span>
          </div>
          <div className="text-center text-white/30 text-xs">vs</div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">⬛ {black}</span>
            <span className="text-xs text-white/50">{game.black_elo_before}</span>
          </div>
        </div>

        <div className="mt-3 text-xs text-white/40 text-center">Click to spectate</div>
      </div>
    </Link>
  );
}
