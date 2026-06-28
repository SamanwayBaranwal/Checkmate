'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import Link from 'next/link';

type Tab = 'elo' | 'earnings' | 'weekly' | 'referrals';

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '???';
}

function winRate(won: number, played: number) {
  if (!played) return '0%';
  return `${Math.round((won / played) * 100)}%`;
}

const MEDAL = ['🥇', '🥈', '🥉'];

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t ? 'bg-[#ffd700] text-black' : 'btn-secondary'
            }`}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Your rank banner */}
      {myRank >= 0 && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-[#4caf50]/10 border border-[#4caf50]/30 text-sm text-[#4caf50]">
          Your rank: <strong>#{myRank + 1}</strong>{' '}
          {myRank < 3 && <span>— you're on the podium! 🏆</span>}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : (
        <div className="card overflow-hidden p-0">
          {tab === 'weekly' && players.length === 0 && (
            <p className="text-center py-12 text-white/40 text-sm">No earnings recorded this week yet.</p>
          )}
          {players.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-right">{cfg.valueLabel}</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">{tab === 'referrals' ? 'Referred' : 'Games'}</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">{tab === 'referrals' ? '' : 'Win %'}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => {
                  const isMe = player.id === myId;
                  const isTop3 = i < 3;
                  return (
                    <tr
                      key={player.id}
                      className={`border-b border-white/5 transition-colors ${
                        isMe ? 'bg-[#4caf50]/10 border-[#4caf50]/20' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="px-4 py-3 text-lg">
                        {isTop3 ? MEDAL[i] : <span className="text-white/40 text-sm">#{i + 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/profile/${player.id}`} className="hover:text-[#ffd700] transition-colors">
                          <div className="font-semibold flex items-center gap-2">
                            {player.username || shortAddr(player.wallet)}
                            {isMe && <span className="text-xs text-[#4caf50] font-normal">(you)</span>}
                          </div>
                          {player.username && (
                            <div className="text-xs text-white/40 font-mono">{shortAddr(player.wallet)}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${tab === 'elo' ? 'text-[#ffd700]' : 'text-[#4caf50]'}`}>
                          {cfg.format(player[cfg.valueKey] ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/60 hidden sm:table-cell">
                        {tab === 'referrals' ? (player.referred_count ?? 0) : player.games_played}
                      </td>
                      <td className="px-4 py-3 text-right text-[#4caf50] hidden sm:table-cell">
                        {tab === 'referrals' ? `${player.referred_count ?? 0} users` : winRate(player.games_won, player.games_played)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
