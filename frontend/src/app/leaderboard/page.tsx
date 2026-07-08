'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icons';
import Link from 'next/link';

type Tab = 'elo' | 'earnings' | 'weekly' | 'referrals';

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '???';
}

function winRate(won: number, played: number) {
  if (!played) return '0%';
  return `${Math.round((won / played) * 100)}%`;
}


const TAB_CONFIG: Record<Tab, { label: string; valueKey: string; valueLabel: string; format: (v: number) => string }> = {
  elo: { label: 'By Rating', valueKey: 'elo', valueLabel: 'ELO', format: (v) => String(v) },
  earnings: { label: 'By Earnings', valueKey: 'total_earnings', valueLabel: 'Earned', format: (v) => `$${v.toFixed(2)}` },
  weekly: { label: 'This Week', valueKey: 'weekly_earnings', valueLabel: 'This Week', format: (v) => `$${v.toFixed(2)}` },
  referrals: { label: 'Referrals', valueKey: 'referral_earnings', valueLabel: 'Ref. Earned', format: (v) => `$${v.toFixed(2)}` },
};

export default function LeaderboardPage() {
  const { authenticated, user } = usePrivy();
  const [tab, setTab] = useState<Tab>('elo');
  const [players, setPlayers] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authenticated) {
      api.users.me().then((u) => setMyId(u.id)).catch(() => {});
    }
  }, [authenticated]);

  useEffect(() => {
    setLoading(true);
    api.users.leaderboard(tab).then((p) => {
      setPlayers(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tab]);

  const cfg = TAB_CONFIG[tab];
  const myRank = myId ? players.findIndex((p) => p.id === myId) : -1;
  const mePlayer = myRank >= 0 ? players[myRank] : null;

  const Avatar = ({ p, i }: { p: any; i: number }) => (
    <span
      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        i === 0 ? 'bg-[#f0b232]/20 text-[#f0b232]' : i === 1 ? 'bg-white/15 text-white' : i === 2 ? 'bg-[#cd7f32]/20 text-[#cd7f32]' : 'bg-[#46a883]/15 text-[#46a883]'
      }`}
    >
      {(p.username || p.wallet || '?')[0].toUpperCase()}
    </span>
  );

  const Row = ({ player, i, sticky }: { player: any; i: number; sticky?: boolean }) => {
    const isMe = player.id === myId;
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] transition-colors ${
          sticky ? 'bg-[#46a883]/12 rounded-lg border-transparent' : isMe ? 'bg-[#46a883]/8' : 'hover:bg-white/[0.03]'
        }`}
      >
        <span className="w-8 text-center shrink-0">
          <span className={`text-sm font-bold ${i === 0 ? 'text-[#f0b232]' : i === 1 ? 'text-white/80' : i === 2 ? 'text-[#cd7f32]' : 'text-white/40'}`}>{i + 1}</span>
        </span>
        <Avatar p={player} i={i} />
        <Link href={`/profile/${player.id}`} className="flex-1 min-w-0 group">
          <div className="font-semibold text-sm truncate group-hover:text-[#46a883] transition-colors">
            {player.username || shortAddr(player.wallet)}
            {isMe && <span className="text-xs text-[#46a883] font-normal ml-1.5">you</span>}
          </div>
          <div className="text-xs text-white/35">{player.elo} ELO</div>
        </Link>
        <div className="text-right shrink-0 w-20">
          <div className={`font-bold text-sm ${tab === 'elo' ? 'text-white' : 'text-[#46a883]'}`}>{cfg.format(player[cfg.valueKey] ?? 0)}</div>
          <div className="text-[11px] text-white/30">{cfg.valueLabel}</div>
        </div>
        <div className="text-right shrink-0 w-14 hidden sm:block">
          <div className="font-semibold text-sm text-white/80">
            {tab === 'referrals' ? (player.referred_count ?? 0) : winRate(player.games_won, player.games_played)}
          </div>
          <div className="text-[11px] text-white/30">{tab === 'referrals' ? 'Refs' : 'Win'}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#f0b232]"><Icon name="trophy" size={22} /></span>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>
      <p className="text-sm text-white/45 mb-6">Top players ranked by performance.</p>

      {/* Tabs — underline style */}
      <div className="flex gap-1 mb-5 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[#46a883] text-[#46a883]' : 'border-transparent text-white/45 hover:text-white'
            }`}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="card text-center py-12 text-white/40 text-sm">No players ranked yet.</div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            {players.map((player, i) => <Row key={player.id} player={player} i={i} />)}
          </div>
          {/* Sticky your-rank row (like mockup) */}
          {mePlayer && myRank >= 8 && (
            <div className="mt-2 card p-1">
              <Row player={mePlayer} i={myRank} sticky />
            </div>
          )}
          <p className="text-center text-xs text-white/25 mt-4">Leaderboard updates in real time.</p>
        </>
      )}
    </div>
  );
}
