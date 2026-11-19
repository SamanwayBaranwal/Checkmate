'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/lib/session';
import MatchmakingModal from '@/components/MatchmakingModal';
import AuthLanding from '@/components/AuthLanding';
import { Icon } from '@/components/Icons';
import BoardPreview from '@/components/BoardPreview';

const CHALLENGE_BETS = [1, 5, 10, 25];
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function PlayerRow({ player, token, onSent }: { player: any; token: string; onSent: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const name = player.username || short(player.wallet);
  const wr = player.games_played ? Math.round((player.games_won / player.games_played) * 100) : 0;
  const send = (bet: number) => {
    getSocket(token).emit('challenge_user', { targetId: player.id, betAmount: bet });
    setOpen(false);
    onSent(name);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/profile/${player.id}`} className="avatar w-9 h-9 text-sm">{name[0]?.toUpperCase()}</Link>
      <Link href={`/profile/${player.id}`} className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-faint num">{player.elo} · {wr}% wins</div>
      </Link>
      {open ? (
        <div className="flex items-center gap-1">
          {CHALLENGE_BETS.map((b) => (
            <button key={b} onClick={() => send(b)} className="h-8 px-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs font-semibold num">${b}</button>
          ))}
          <button onClick={() => setOpen(false)} className="btn-ghost p-1.5" aria-label="Cancel"><Icon name="x" size={14} /></button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-secondary h-8 py-0 px-3 text-xs">Challenge</button>
      )}
    </div>
  );
}

export default function HomePage() {
  const { ready, authenticated, token, me, balance } = useSession();
  const [live, setLive] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const loadLive = useCallback(() => { api.games.active().then(setLive).catch(() => {}); }, []);
  useEffect(() => { loadLive(); const t = setInterval(loadLive, 8000); return () => clearInterval(t); }, [loadLive]);

  useEffect(() => {
    if (!token || !me) return;
    api.users.recentOpponents().then(setRecent).catch(() => {});
    api.users.suggested().then(setSuggested).catch(() => {});
    api.users.leaderboard('elo').then((rows: any[]) => {
      const i = rows.findIndex((r) => r.id === me.id);
      setRank(i >= 0 ? i + 1 : null);
    }).catch(() => {});
  }, [token, me]);

  if (!ready) return <div className="min-h-[60vh]" />;
  if (!authenticated) return <AuthLanding />;

  const gp = me?.gamesPlayed ?? me?.games_played ?? 0;
  const gw = me?.gamesWon ?? me?.games_won ?? 0;
  const wr = gp ? Math.round((gw / gp) * 100) : 0;
  const sent = (n: string) => { setNotice(`Challenge sent to ${n}`); setTimeout(() => setNotice(''), 2500); };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-5 md:pt-8 space-y-8">
      <section className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-10 items-start">
        {/* Board: the hero (desktop) */}
        <div className="hidden lg:block"><BoardPreview /></div>

        {/* Play panel */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="avatar w-12 h-12 text-lg !bg-accent !text-white">{(me?.username || me?.wallet || '?')[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="text-sm text-muted font-semibold">{greeting()}</p>
              <h1 className="text-2xl font-extrabold truncate">{me?.username || 'Player'}</h1>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-faint">Rating</div>
              <div className="text-2xl font-black num">{me?.elo ?? '—'}</div>
            </div>
          </div>

          <div>
            {balance <= 0 ? (
              <Link href="/wallet" className="play-tile play-tile-primary">
                <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center"><Icon name="gift" size={24} /></span>
                <span className="flex-1"><span className="block text-lg font-extrabold">Claim free credits</span><span className="block text-sm text-white/80 font-medium">$10 to start playing</span></span>
                <Icon name="chevron-right" size={20} />
              </Link>
            ) : (
              <button onClick={() => setPlayOpen(true)} className="play-tile play-tile-primary">
                <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center"><Icon name="bolt" size={24} /></span>
                <span className="flex-1"><span className="block text-xl font-black">Play online</span><span className="block text-sm text-white/80 font-medium">Matched with someone near your rating</span></span>
                <Icon name="chevron-right" size={20} />
              </button>
            )}
            <Link href="/friends" className="play-tile mt-3">
              <span className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center text-accent"><Icon name="users" size={22} /></span>
              <span className="flex-1"><span className="block text-lg font-extrabold">Play a friend</span><span className="block text-sm text-muted font-medium">Send a challenge</span></span>
              <Icon name="chevron-right" size={20} className="text-faint" />
            </Link>
            <Link href="/leaderboard" className="play-tile mt-3">
              <span className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center text-accent"><Icon name="trophy" size={22} /></span>
              <span className="flex-1"><span className="block text-lg font-extrabold">Leaderboard</span><span className="block text-sm text-muted font-medium">{rank ? `You are #${rank}` : 'See the top players'}</span></span>
              <Icon name="chevron-right" size={20} className="text-faint" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Games', value: gp },
              { label: 'Win rate', value: gp ? `${wr}%` : '—' },
              { label: 'Balance', value: `$${balance.toFixed(2)}` },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface border border-line/[0.07] px-3 py-3 text-center">
                <div className="text-lg font-black num">{s.value}</div>
                <div className="text-[11px] font-bold text-faint uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live games */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            Live now {live.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-negative animate-pulse-dot" />}
          </h2>
          <span className="text-xs text-faint num">{live.length} {live.length === 1 ? 'game' : 'games'}</span>
        </div>
        {live.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm font-medium">No games in progress</p>
            <p className="text-sm text-muted mt-1">Start one and others can watch.</p>
          </div>
        ) : (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {live.map((g) => {
              const w = g.white_username || short(g.white_wallet);
              const b = g.black_username || short(g.black_wallet);
              return (
                <Link key={g.id} href={`/game/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ink mr-2 align-middle" />{w}
                      <span className="text-faint mx-2">vs</span>
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-surface-3 border border-line/20 mr-2 align-middle" />{b}
                    </div>
                  </div>
                  <span className="text-sm font-semibold num text-ink">${(g.bet_amount * 2).toFixed(0)}</span>
                  <span className="text-xs text-muted flex items-center gap-1">Watch <Icon name="chevron-right" size={14} /></span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Opponents */}
      {(recent.length > 0 || suggested.length > 0) && (
        <section className="grid md:grid-cols-2 gap-4">
          {[{ title: 'Play again', list: recent }, { title: 'Players near your rating', list: suggested }]
            .filter((s) => s.list.length > 0)
            .map((s) => (
              <div key={s.title} className="card p-0 overflow-hidden">
                <div className="px-4 h-11 flex items-center border-b border-line/[0.06]"><span className="eyebrow">{s.title}</span></div>
                <div className="divide-y divide-line/[0.05]">
                  {s.list.map((p) => <PlayerRow key={p.id} player={p} token={token} onSent={sent} />)}
                </div>
              </div>
            ))}
        </section>
      )}

      {notice && (
        <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-8 card py-2.5 px-4 text-sm shadow-pop animate-in">
          {notice}
        </div>
      )}

      {playOpen && <MatchmakingModal onClose={() => setPlayOpen(false)} balance={balance} token={token} />}
    </div>
  );
}
