'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '???';
}

function computeBadges(p: any) {
  const badges = [];
  const winRate = p.gamesPlayed ? (p.gamesWon / p.gamesPlayed) * 100 : 0;
  if (p.gamesWon >= 1) badges.push({ icon: '🏆', label: 'First Win' });
  if (p.gamesPlayed >= 10) badges.push({ icon: '⚡', label: 'Veteran' });
  if (p.gamesPlayed >= 50) badges.push({ icon: '💎', label: 'Grinder' });
  if (winRate >= 60 && p.gamesPlayed >= 10) badges.push({ icon: '🎯', label: 'Sharp' });
  if (p.elo >= 1400) badges.push({ icon: '🌙', label: 'Rising Star' });
  if (p.elo >= 1600) badges.push({ icon: '👑', label: 'Elite' });
  if (p.totalEarnings !== null && p.totalEarnings >= 10) badges.push({ icon: '💰', label: 'Earner' });
  return badges;
}

const BET_TIERS = [1, 5, 10, 25] as const;

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated } = usePrivy();
  const [profile, setProfile] = useState<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [challengeError, setChallengeError] = useState('');

  useEffect(() => {
    api.users.profile(id).then(setProfile).catch(() => {}).finally(() => setLoading(false));
    if (authenticated) {
      api.users.me().then((u) => setMyId(u.id)).catch(() => {});
    }
  }, [id, authenticated]);

  const sendChallenge = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
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

  if (loading) return <div className="text-center py-20 text-white/40">Loading...</div>;

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40 mb-4">Player not found</p>
        <Link href="/" className="btn-secondary">Back to Lobby</Link>
      </div>
    );
  }

  const winRate = profile.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const badges = computeBadges(profile);
  const displayName = profile.username || shortAddr(profile.wallet);
  const canChallenge = authenticated && myId && myId !== profile.id && profile.username;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          {profile.username && (
            <p className="text-sm text-white/40 font-mono mt-1">{shortAddr(profile.wallet)}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canChallenge && (
            <button
              onClick={() => { setShowChallengeModal(true); setChallengeStatus('idle'); setChallengeError(''); }}
              className="btn-primary text-sm"
            >
              ⚔️ Challenge
            </button>
          )}
          <Link href="/leaderboard" className="btn-secondary text-sm">Leaderboard</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'ELO', value: profile.elo, color: 'text-[#ffd700]' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-[#4caf50]' },
          { label: 'Games', value: profile.gamesPlayed, color: 'text-white' },
          {
            label: 'Earned',
            value: profile.totalEarnings !== null ? `$${profile.totalEarnings.toFixed(2)}` : 'Private',
            color: profile.totalEarnings !== null ? 'text-[#4caf50]' : 'text-white/40',
          },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Best Streak', value: profile.bestStreak ?? 0, color: (profile.bestStreak ?? 0) >= 5 ? 'text-orange-400' : 'text-white' },
          { label: 'Games Won', value: profile.gamesWon, color: 'text-white' },
          {
            label: 'Avg per Win',
            value: profile.avgEarnings ? `$${profile.avgEarnings.toFixed(2)}` : '—',
            color: profile.avgEarnings > 0 ? 'text-[#4caf50]' : 'text-white/40',
          },
        ].map((s) => (
          <div key={s.label} className="card text-center py-3">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">Achievements</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div key={b.label} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <span className="text-xl">{b.icon}</span>
                <span className="text-sm font-semibold">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent games */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="font-bold">Recent Games</h2>
        </div>
        {!profile.recentGames?.length ? (
          <p className="text-white/40 text-center py-8">No games yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/5">
                <th className="px-4 py-2 text-left">Result</th>
                <th className="px-4 py-2 text-left">Opponent</th>
                <th className="px-4 py-2 text-right">Bet</th>
                <th className="px-4 py-2 text-right">Replay</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentGames.map((g: any) => {
                const won = g.winner === profile.id;
                const isDraw = !g.winner;
                const isWhite = g.player_white === profile.id;
                const oppName = isWhite ? g.black_username : g.white_username;
                return (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${isDraw ? 'text-yellow-400' : won ? 'text-[#4caf50]' : 'text-red-400'}`}>
                        {isDraw ? 'Draw' : won ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white/70">{oppName || 'Opponent'}</td>
                    <td className="px-4 py-2 text-right text-[#ffd700]">${g.bet_amount}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/replay/${g.id}`} className="text-xs text-white/40 hover:text-white">▶ Watch</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Challenge modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowChallengeModal(false)}>
          <div className="card w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">Challenge {displayName}</h2>
            <p className="text-sm text-white/50 mb-5">Winner takes 97.5% of the pot</p>

            {challengeStatus === 'idle' || challengeStatus === 'error' ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {BET_TIERS.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setSelectedBet(tier)}
                      className={`rounded-xl p-3 border-2 text-center transition-all ${
                        selectedBet === tier
                          ? 'border-[#4caf50] bg-[#4caf50]/20'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="text-lg font-bold">${tier}</div>
                    </button>
                  ))}
                </div>

                {challengeError && <p className="text-red-400 text-sm mb-3">{challengeError}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setShowChallengeModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={sendChallenge} className="btn-primary flex-1">Send Challenge</button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-3 animate-pulse">⚔️</div>
                <p className="font-semibold mb-1">Challenge sent!</p>
                <p className="text-sm text-white/50 mb-4">Waiting for {displayName} to respond...</p>
                <button onClick={() => setShowChallengeModal(false)} className="btn-secondary">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
