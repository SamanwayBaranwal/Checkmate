'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Icon } from '@/components/Icons';

type Tab = 'elo' | 'earnings' | 'weekly' | 'referrals';

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'Player');
const winRate = (won: number, played: number) => (played ? `${Math.round((won / played) * 100)}%` : '0%');

const TAB_CONFIG: Record<Tab, { label: string; valueKey: string; valueLabel: string; money: boolean; format: (v: number) => string }> = {
  elo: { label: 'Rating', valueKey: 'elo', valueLabel: 'Rating', money: false, format: (v) => String(v) },
  earnings: { label: 'Earnings', valueKey: 'total_earnings', valueLabel: 'Earned', money: true, format: (v) => `$${Number(v).toFixed(2)}` },
  weekly: { label: 'This week', valueKey: 'weekly_earnings', valueLabel: 'This week', money: true, format: (v) => `$${Number(v).toFixed(2)}` },
  referrals: { label: 'Referrals', valueKey: 'referral_earnings', valueLabel: 'Referral earnings', money: true, format: (v) => `$${Number(v).toFixed(2)}` },
};

export default function LeaderboardPage() {
  const { me } = useSession();
  const myId = me?.id ?? null;
  const [tab, setTab] = useState<Tab>('elo');
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.users.leaderboard(tab)
      .then((p) => { if (alive) { setPlayers(p); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab]);

  const cfg = TAB_CONFIG[tab];
  const myRank = myId ? players.findIndex((p) => p.id === myId) : -1;
  const mePlayer = myRank >= 0 ? players[myRank] : null;

  const Row = ({ player, i }: { player: any; i: number }) => {
    const isMe = player.id === myId;
    const name = player.username || shortAddr(player.wallet);
    const value = Number(player[cfg.valueKey] ?? 0);
    const sub = tab === 'referrals'
      ? `${player.referred_count ?? 0} invited`
      : tab === 'elo'
        ? `${player.games_played ?? 0} ${player.games_played === 1 ? 'game' : 'games'} · ${winRate(player.games_won, player.games_played)} wins`
        : `${player.elo} rating · ${winRate(player.games_won, player.games_played)} wins`;
    return (
      <Link
        href={`/profile/${player.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
      >
        <span className={`w-7 shrink-0 text-center text-sm font-semibold num ${i < 3 ? 'text-accent' : 'text-faint'}`}>{i + 1}</span>
        <span className={`avatar w-9 h-9 text-sm ${i < 3 ? 'ring-1 ring-accent/40' : ''}`}>
          {player.username ? player.username[0].toUpperCase() : <Icon name="user" size={15} className="text-muted" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate flex items-center gap-2">
            <span className="truncate">{name}</span>
            {isMe && <span className="pill-accent pill py-0 px-2 text-[11px] shrink-0">You</span>}
          </div>
          <div className="text-xs text-faint num mt-0.5 truncate">{sub}</div>
        </div>
        <div className={`text-sm font-semibold num shrink-0 ${cfg.money && value > 0 ? 'text-positive' : 'text-ink'}`}>
          {cfg.format(value)}
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-muted mt-1">Top players, updated in real time.</p>
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="segmented" role="tablist">
            {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                data-active={tab === t}
                onClick={() => setTab(t)}
                className="whitespace-nowrap h-9"
              >
                {TAB_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mePlayer && (
        <div className="card py-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-faint">Your rank</div>
            <div className="text-xl font-semibold num mt-1">#{myRank + 1} <span className="text-sm font-normal text-faint">of {players.length}</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs text-faint">{cfg.valueLabel}</div>
            <div className="text-xl font-semibold num mt-1">{cfg.format(Number(mePlayer[cfg.valueKey] ?? 0))}</div>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="eyebrow">Player</span>
          <span className="eyebrow">{cfg.valueLabel}</span>
        </div>
        {loading ? (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-3 rounded bg-surface-2 animate-pulse" />
                <div className="w-9 h-9 rounded-full bg-surface-2 animate-pulse" />
                <div className="flex-1 space-y-1.5"><div className="h-3 w-28 rounded bg-surface-2 animate-pulse" /><div className="h-2.5 w-20 rounded bg-surface-2 animate-pulse" /></div>
                <div className="h-3 w-12 rounded bg-surface-2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm font-medium">No players ranked yet</p>
            <p className="text-sm text-muted mt-1">Play a game to get on the board.</p>
          </div>
        ) : (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {players.map((player, i) => <Row key={player.id} player={player} i={i} />)}
          </div>
        )}
      </section>
    </div>
  );
}
