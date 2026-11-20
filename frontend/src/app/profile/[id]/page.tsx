'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/lib/session';
import { Icon, type IconName } from '@/components/Icons';

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'Player');

function computeBadges(p: any): { icon: IconName; label: string }[] {
  const badges: { icon: IconName; label: string }[] = [];
  const winRate = p.gamesPlayed ? (p.gamesWon / p.gamesPlayed) * 100 : 0;
  if (p.gamesWon >= 1) badges.push({ icon: 'trophy', label: 'First win' });
  if (p.gamesPlayed >= 10) badges.push({ icon: 'bolt', label: 'Veteran' });
  if (p.gamesPlayed >= 50) badges.push({ icon: 'gem', label: 'Grinder' });
  if (winRate >= 60 && p.gamesPlayed >= 10) badges.push({ icon: 'target', label: 'Sharp' });
  if (p.elo >= 1400) badges.push({ icon: 'star', label: 'Rising star' });
  if (p.elo >= 1600) badges.push({ icon: 'crown', label: 'Elite' });
  if (p.totalEarnings !== null && p.totalEarnings >= 10) badges.push({ icon: 'coin', label: 'Earner' });
  return badges;
}

function ago(iso?: string) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const BET_TIERS = [1, 5, 10, 25] as const;

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated, token, me, login } = useSession();
  const myId = me?.id ?? null;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [challengeError, setChallengeError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.users.profile(id).then(setProfile).catch(() => setProfile(null)).finally(() => setLoading(false));
  }, [id]);

  const sendChallenge = () => {
    const socket = getSocket(token || undefined);
    socket.emit('challenge_user', { targetId: profile.id, betAmount: selectedBet });
    setChallengeStatus('idle');
    setChallengeError('');

    const onSent = () => { setChallengeStatus('sent'); cleanup(); };
    const onError = ({ reason }: { reason: string }) => {
      setChallengeStatus('error');
      setChallengeError(reason);
      cleanup();
    };
    const cleanup = () => {
      socket.off('challenge_sent', onSent);
      socket.off('challenge_error', onError);
    };

    socket.once('challenge_sent', onSent);
    socket.once('challenge_error', onError);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-2 animate-pulse" />
          <div className="space-y-2"><div className="h-5 w-36 rounded bg-surface-2 animate-pulse" /><div className="h-3 w-24 rounded bg-surface-2 animate-pulse" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-[74px] animate-pulse" />)}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-16 flex justify-center">
        <div className="card w-full max-w-sm text-center p-6">
          <div className="avatar w-12 h-12 mx-auto text-muted"><Icon name="user" size={20} /></div>
          <h1 className="text-lg font-semibold mt-4">Player not found</h1>
          <p className="text-sm text-muted mt-1">This profile does not exist or was removed.</p>
          <Link href="/leaderboard" className="btn-secondary w-full h-12 mt-5">Browse the leaderboard</Link>
        </div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const badges = computeBadges(profile);
  const displayName = profile.username || shortAddr(profile.wallet);
  const isMe = myId === profile.id;
  const canChallenge = authenticated && myId && !isMe && profile.username;
  const joined = profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;
  const openChallenge = () => { setShowChallengeModal(true); setChallengeStatus('idle'); setChallengeError(''); };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 space-y-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <span className="avatar w-16 h-16 md:w-[72px] md:h-[72px] text-2xl">
            {profile.username ? profile.username[0].toUpperCase() : <Icon name="user" size={26} className="text-muted" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold truncate">{displayName}</h1>
            <p className="text-sm text-muted mt-0.5 num">
              {profile.elo} rating{joined ? ` · Joined ${joined}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.fairPlay && (
                <span className="pill" title="No fair-play violations on record">
                  <Icon name="shield" size={13} className="text-positive" />Fair play verified
                </span>
              )}
              {profile.username && <span className="pill num">{shortAddr(profile.wallet)}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:shrink-0">
          {canChallenge && (
            <button onClick={openChallenge} className="btn-primary h-11 px-6 flex-1 md:flex-none">
              <Icon name="bolt" size={14} />Challenge
            </button>
          )}
          {!authenticated && (
            <button onClick={login} className="btn-primary h-11 px-6 flex-1 md:flex-none">Sign in to challenge</button>
          )}
          {isMe && <Link href="/profile" className="btn-secondary h-11 px-5 flex-1 md:flex-none">Edit profile</Link>}
          <Link href="/leaderboard" className="btn-secondary h-11 px-5 flex-1 md:flex-none">Leaderboard</Link>
        </div>
      </section>

      {/* Stats */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Rating', value: profile.elo, tone: '' },
            { label: 'Win rate', value: profile.gamesPlayed ? `${winRate}%` : '—', tone: '' },
            { label: 'Games', value: profile.gamesPlayed ?? 0, tone: '' },
            {
              label: 'Total won',
              value: profile.totalEarnings !== null ? `$${Number(profile.totalEarnings).toFixed(2)}` : 'Private',
              tone: profile.totalEarnings === null ? 'text-faint' : profile.totalEarnings > 0 ? 'text-positive' : '',
            },
          ].map((s) => (
            <div key={s.label} className="card py-3.5">
              <div className="text-xs text-faint">{s.label}</div>
              <div className={`text-xl font-semibold num mt-1 ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="card p-0 grid grid-cols-3 divide-x divide-line/[0.06]">
          {[
            { label: 'Wins', value: profile.gamesWon ?? 0 },
            { label: 'Best streak', value: profile.bestStreak ?? 0 },
            { label: 'Avg per win', value: profile.avgEarnings ? `$${Number(profile.avgEarnings).toFixed(2)}` : '—' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 min-w-0">
              <div className="text-xs text-faint truncate">{s.label}</div>
              <div className="text-base font-semibold num mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Recent games */}
        <section className="min-w-0">
          <h2 className="text-base font-semibold mb-3">Recent games</h2>
          {!profile.recentGames?.length ? (
            <div className="card text-center py-10">
              <p className="text-sm font-medium">No games yet</p>
              <p className="text-sm text-muted mt-1">Finished games will show up here.</p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
              {profile.recentGames.map((g: any) => {
                const won = g.winner === profile.id;
                const isDraw = !g.winner;
                const isWhite = g.player_white === profile.id;
                const opp = (isWhite ? g.black_username : g.white_username) || 'Opponent';
                const tone = isDraw ? 'text-muted' : won ? 'text-positive' : 'text-negative';
                return (
                  <Link key={g.id} href={`/replay/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                    <span className={`w-9 h-9 shrink-0 rounded-[10px] bg-surface-2 flex items-center justify-center text-xs font-semibold ${tone}`}>
                      {isDraw ? 'D' : won ? 'W' : 'L'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate"><span className="text-faint font-normal">vs </span>{opp}</div>
                      <div className="text-xs text-faint mt-0.5 num">
                        <span className={`inline-block w-2 h-2 rounded-sm mr-1.5 align-[1px] ${isWhite ? 'bg-ink' : 'bg-surface-3 border border-line/20'}`} />
                        ${g.bet_amount} stake{g.completed_at ? ` · ${ago(g.completed_at)}` : ''}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${tone}`}>{isDraw ? 'Draw' : won ? 'Won' : 'Lost'}</span>
                    <Icon name="chevron-right" size={16} className="text-faint -mr-1 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Achievements */}
        {badges.length > 0 && (
          <section className="min-w-0">
            <h2 className="text-base font-semibold mb-3">Achievements</h2>
            <div className="card flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b.label} className="pill text-ink py-1.5 px-3">
                  <Icon name={b.icon} size={14} className="text-accent" />{b.label}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Challenge sheet */}
      {showChallengeModal && (
        <div className="overlay" onClick={() => setShowChallengeModal(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold truncate">Challenge {displayName}</h2>
              <button onClick={() => setShowChallengeModal(false)} className="btn-ghost p-2 -mr-2" aria-label="Close"><Icon name="x" size={18} /></button>
            </div>

            {challengeStatus === 'idle' || challengeStatus === 'error' ? (
              <>
                <p className="text-sm text-muted mb-5">Winner takes 97.5% of the pot.</p>
                <div className="eyebrow mb-2">Stake</div>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {BET_TIERS.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setSelectedBet(tier)}
                      aria-pressed={selectedBet === tier}
                      className={`h-12 rounded-[10px] border text-base font-semibold num transition-colors ${
                        selectedBet === tier
                          ? 'border-accent/60 bg-accent/10 text-ink'
                          : 'border-line/[0.08] bg-surface-2 text-muted hover:text-ink'
                      }`}
                    >
                      ${tier}
                    </button>
                  ))}
                </div>

                {challengeError && <p className="text-sm text-negative mb-4">{challengeError}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setShowChallengeModal(false)} className="btn-secondary flex-1 h-12">Cancel</button>
                  <button onClick={sendChallenge} className="btn-primary flex-1 h-12">Send ${selectedBet} challenge</button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto rounded-full border-2 border-surface-3 border-t-accent animate-spin" />
                <p className="font-semibold mt-5">Challenge sent</p>
                <p className="text-sm text-muted mt-1">Waiting for {displayName} to respond…</p>
                <button onClick={() => setShowChallengeModal(false)} className="btn-secondary w-full h-12 mt-6">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
