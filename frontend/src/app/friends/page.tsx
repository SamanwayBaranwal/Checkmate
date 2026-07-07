'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';

const BET_TIERS = [1, 5, 10, 25] as const;

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '???';
}

function winRate(won: number, played: number) {
  if (!played) return '0%';
  return `${Math.round((won / played) * 100)}%`;
}

const MEDAL = ['🥇', '🥈', '🥉'];

type Tab = 'friends' | 'leaderboard';

export default function FriendsPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [challengeError, setChallengeError] = useState('');

  useEffect(() => {
    if (ready && !authenticated) { router.push('/'); return; }
  }, [ready, authenticated, router]);

  const loadFriends = useCallback(async () => {
    if (!authenticated) return;
    try {
      const data = await api.friends.list();
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    } catch {}
    setLoading(false);
  }, [authenticated]);

  const loadLeaderboard = useCallback(async () => {
    if (!authenticated) return;
    try {
      const data = await api.friends.leaderboard();
      setLeaderboard(data);
    } catch {}
  }, [authenticated]);

  useEffect(() => {
    loadFriends();
    loadLeaderboard();
  }, [loadFriends, loadLeaderboard]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.users.search(searchQuery);
        setSearchResults(results);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sendRequest = async (targetId: string) => {
    setActionStatus((s) => ({ ...s, [targetId]: 'sending' }));
    try {
      await api.friends.request(targetId);
      setActionStatus((s) => ({ ...s, [targetId]: 'sent' }));
      loadFriends();
    } catch {
      setActionStatus((s) => ({ ...s, [targetId]: 'error' }));
    }
  };

  const acceptRequest = async (requesterId: string) => {
    setActionStatus((s) => ({ ...s, [requesterId]: 'accepting' }));
    try {
      await api.friends.accept(requesterId);
      setActionStatus((s) => ({ ...s, [requesterId]: 'done' }));
      loadFriends();
      loadLeaderboard();
    } catch {
      setActionStatus((s) => ({ ...s, [requesterId]: 'error' }));
    }
  };

  const removeFriend = async (targetId: string) => {
    try {
      await api.friends.remove(targetId);
      loadFriends();
      loadLeaderboard();
    } catch {}
  };

  const openChallengeModal = (friend: any) => {
    setChallengeTarget({ id: friend.id, name: friend.username || `${friend.wallet?.slice(0, 6)}...` });
    setChallengeStatus('idle');
    setChallengeError('');
    setSelectedBet(1);
  };

  const sendChallenge = () => {
    if (!challengeTarget) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('challenge_user', { targetId: challengeTarget.id, betAmount: selectedBet });

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Friends</h1>
        {incoming.length > 0 && (
          <span className="bg-[#f0b232] text-black text-xs font-bold px-2 py-1 rounded-full">
            {incoming.length} pending
          </span>
        )}
      </div>

      {/* Search */}
      <div className="card">
        <h2 className="font-bold mb-3">Add Friend</h2>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username..."
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#81b64c] mb-3"
        />
        {searching && <p className="text-sm text-white/40">Searching...</p>}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u) => {
              const status = actionStatus[u.id];
              const isPending = outgoing.some((o) => o.id === u.id);
              const isFriend = friends.some((f) => f.id === u.id);
              return (
                <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div>
                    <Link href={`/profile/${u.id}`} className="font-semibold hover:text-[#f0b232]">{u.username}</Link>
                    <div className="text-xs text-white/40">{u.elo} ELO · {winRate(u.games_won, u.games_played)} WR</div>
                  </div>
                  {isFriend ? (
                    <span className="text-xs text-[#81b64c]">Friends</span>
                  ) : isPending || status === 'sent' ? (
                    <span className="text-xs text-white/40">Sent</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(u.id)}
                      disabled={status === 'sending'}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      {status === 'sending' ? '...' : '+ Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['friends', 'leaderboard'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${
              tab === t ? 'bg-[#f0b232] text-black' : 'btn-secondary'
            }`}
          >
            {t === 'friends' ? `Friends (${friends.length})` : 'Friend Leaderboard'}
          </button>
        ))}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && tab === 'friends' && (
        <div className="card border border-[#f0b232]/30">
          <h2 className="font-bold mb-3 text-[#f0b232]">Pending Requests</h2>
          <div className="space-y-2">
            {incoming.map((u) => (
              <div key={u.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-[#81b64c]' : 'bg-white/20'}`} />
                  <Link href={`/profile/${u.id}`} className="font-semibold hover:text-[#f0b232]">
                    {u.username || shortAddr(u.wallet)}
                  </Link>
                  <span className="text-xs text-white/40">{u.elo} ELO</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptRequest(u.id)}
                    className="btn-primary text-xs py-1 px-3"
                    disabled={actionStatus[u.id] === 'accepting'}
                  >
                    Accept
                  </button>
                  <button onClick={() => removeFriend(u.id)} className="btn-secondary text-xs py-1 px-2">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      {tab === 'friends' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="font-bold">Your Friends</h2>
          </div>
          {loading ? (
            <p className="text-center py-8 text-white/40 text-sm">Loading...</p>
          ) : friends.length === 0 ? (
            <p className="text-center py-8 text-white/40 text-sm">No friends yet — search above to add some!</p>
          ) : (
            <div className="divide-y divide-white/5">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.isOnline ? 'bg-[#81b64c] shadow-[0_0_6px_#81b64c]' : 'bg-white/20'}`} />
                    <div>
                      <Link href={`/profile/${f.id}`} className="font-semibold hover:text-[#f0b232]">
                        {f.username || shortAddr(f.wallet)}
                      </Link>
                      <div className="text-xs text-white/40">
                        {f.elo} ELO · {winRate(f.games_won, f.games_played)} WR · {f.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.isOnline && (
                      <button
                        onClick={() => openChallengeModal(f)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        ⚔️ Challenge
                      </button>
                    )}
                    <Link href={`/profile/${f.id}`} className="btn-secondary text-xs py-1 px-3">Profile</Link>
                    <button onClick={() => removeFriend(f.id)} className="text-xs text-white/30 hover:text-red-400 px-2 py-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Challenge modal */}
      {challengeTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setChallengeTarget(null)}>
          <div className="card w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">Challenge {challengeTarget.name}</h2>
            <p className="text-sm text-white/50 mb-5">Winner takes 97.5% of the pot</p>

            {challengeStatus !== 'sent' ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {BET_TIERS.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setSelectedBet(tier)}
                      className={`rounded-xl p-3 border-2 text-center transition-all ${
                        selectedBet === tier
                          ? 'border-[#81b64c] bg-[#81b64c]/20'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="text-lg font-bold">${tier}</div>
                    </button>
                  ))}
                </div>
                {challengeError && <p className="text-red-400 text-sm mb-3">{challengeError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setChallengeTarget(null)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={sendChallenge} className="btn-primary flex-1">Send Challenge</button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-3 animate-pulse">⚔️</div>
                <p className="font-semibold mb-1">Challenge sent!</p>
                <p className="text-sm text-white/50 mb-4">Waiting for {challengeTarget.name} to respond...</p>
                <button onClick={() => setChallengeTarget(null)} className="btn-secondary">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Friend leaderboard */}
      {tab === 'leaderboard' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="font-bold">Friend Leaderboard</h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-center py-8 text-white/40 text-sm">Add friends to see how you compare!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs">
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-right">ELO</th>
                  <th className="px-4 py-2 text-right">Win %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/5 ${p.isMe ? 'bg-[#81b64c]/10' : 'hover:bg-white/5'}`}>
                    <td className="px-4 py-2 text-lg">
                      {i < 3 ? MEDAL[i] : <span className="text-white/40 text-sm">#{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-[#81b64c]' : 'bg-white/20'}`} />
                        <Link href={`/profile/${p.id}`} className="font-semibold hover:text-[#f0b232]">
                          {p.username || shortAddr(p.wallet)}
                        </Link>
                        {p.isMe && <span className="text-xs text-[#81b64c]">(you)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-[#f0b232]">{p.elo}</td>
                    <td className="px-4 py-2 text-right text-[#81b64c]">{winRate(p.games_won, p.games_played)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
