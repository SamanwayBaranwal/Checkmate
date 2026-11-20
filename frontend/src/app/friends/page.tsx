'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/lib/session';
import { Icon } from '@/components/Icons';

const BET_TIERS = [1, 5, 10, 25] as const;

type Tab = 'friends' | 'requests' | 'leaderboard';

function shortAddr(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Unknown';
}

function displayName(u: any) {
  return u?.username || shortAddr(u?.wallet);
}

function winRate(won?: number, played?: number) {
  if (!played) return '0%';
  return `${Math.round(((won ?? 0) / played) * 100)}%`;
}

/** Initials circle with an optional online dot */
function Avatar({ name, online, href }: { name: string; online?: boolean; href: string }) {
  return (
    <Link href={href} className="relative shrink-0" aria-label={`${name} profile`}>
      <span className="avatar w-10 h-10 text-sm">{(name || '?')[0]?.toUpperCase()}</span>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface ${online ? 'bg-positive' : 'bg-surface-3'}`} />
      )}
    </Link>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card text-center py-10 px-6">
      <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-faint">
        <Icon name="users" size={20} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted mt-1">{body}</p>
    </div>
  );
}

export default function FriendsPage() {
  const { ready, authenticated, token, balance, login } = useSession();
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
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [challengeError, setChallengeError] = useState('');
  const [menuFor, setMenuFor] = useState<any | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
    if (!searchQuery.trim() || searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await api.users.search(searchQuery.trim());
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
    const socket = getSocket(token || undefined);
    setChallengeStatus('sending');
    setChallengeError('');
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

  const closeMenu = () => { setMenuFor(null); setConfirmRemove(false); };

  if (!ready) return <div className="min-h-[60vh]" />;

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 pt-16 md:pt-24">
        <div className="card p-6 text-center">
          <span className="mx-auto mb-4 w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted">
            <Icon name="users" size={22} />
          </span>
          <h1 className="text-lg font-semibold">Sign in to see your friends</h1>
          <p className="text-sm text-muted mt-1">Add players, see who is online and send challenges.</p>
          <button onClick={login} className="btn-primary h-12 w-full mt-5">Sign in</button>
        </div>
      </div>
    );
  }

  const onlineCount = friends.filter((f) => f.isOnline).length;
  const sortedFriends = [...friends].sort((a, b) => Number(!!b.isOnline) - Number(!!a.isOnline));
  const requestCount = incoming.length;
  const showSearch = searchQuery.trim().length >= 2;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Friends</h1>
          <p className="text-sm text-muted mt-1 num">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
            {onlineCount > 0 && <> · <span className="text-positive">{onlineCount} online</span></>}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find players by username"
          className="input h-12 pl-10 pr-10 text-[15px]"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-faint hover:text-ink">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Search results */}
      {showSearch && (
        <section className="animate-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Players</h2>
            {searching && <span className="text-xs text-faint">Searching…</span>}
          </div>
          {!searching && searchResults.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-muted">No players match &ldquo;{searchQuery.trim()}&rdquo;</p>
            </div>
          ) : searchResults.length > 0 && (
            <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
              {searchResults.map((u) => {
                const status = actionStatus[u.id];
                const isPending = outgoing.some((o) => o.id === u.id);
                const isFriend = friends.some((f) => f.id === u.id);
                const name = displayName(u);
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={name} href={`/profile/${u.id}`} />
                    <Link href={`/profile/${u.id}`} className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <div className="text-xs text-faint num">{u.elo} · {winRate(u.games_won, u.games_played)} wins</div>
                    </Link>
                    {isFriend ? (
                      <span className="pill">Friends</span>
                    ) : isPending || status === 'sent' ? (
                      <span className="pill"><Icon name="check" size={12} /> Sent</span>
                    ) : (
                      <button onClick={() => sendRequest(u.id)} disabled={status === 'sending'}
                        className="btn-secondary h-10 py-0 px-3.5 text-[13px]">
                        <Icon name="plus" size={14} /> {status === 'sending' ? 'Adding' : status === 'error' ? 'Retry' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tabs */}
      <div className="segmented w-full md:w-auto">
        {([
          { key: 'friends', label: 'Friends', count: friends.length },
          { key: 'requests', label: 'Requests', count: requestCount },
          { key: 'leaderboard', label: 'Ranking', count: 0 },
        ] as { key: Tab; label: string; count: number }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-active={tab === t.key}
            className="flex-1 md:flex-none md:px-5 h-10 !py-0 flex items-center justify-center gap-1.5">
            {t.label}
            {t.key === 'requests' && t.count > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-ink text-[11px] font-semibold num flex items-center justify-center">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        loading ? (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="w-10 h-10 rounded-full bg-surface-2 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-surface-2 animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-surface-2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <Empty title="No friends yet" body="Search for players above and add them." />
        ) : (
          <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
            {sortedFriends.map((f) => {
              const name = displayName(f);
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={name} online={!!f.isOnline} href={`/profile/${f.id}`} />
                  <Link href={`/profile/${f.id}`} className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-faint num truncate">
                      {f.elo} · {winRate(f.games_won, f.games_played)} wins
                      {f.isOnline ? <span className="text-positive"> · Online</span> : ' · Offline'}
                    </div>
                  </Link>
                  {f.isOnline && (
                    <button onClick={() => openChallengeModal(f)} className="btn-primary h-10 py-0 px-3.5 text-[13px]">
                      Challenge
                    </button>
                  )}
                  <button onClick={() => setMenuFor(f)} aria-label={`More options for ${name}`}
                    className="w-10 h-10 -mr-2 rounded-lg flex items-center justify-center text-faint hover:text-ink hover:bg-surface-2 transition-colors">
                    <Icon name="more" size={20} strokeWidth={2.6} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Requests */}
      {tab === 'requests' && (
        incoming.length === 0 && outgoing.length === 0 ? (
          <Empty title="No pending requests" body="Friend requests you send or receive show up here." />
        ) : (
          <div className="space-y-6">
            {incoming.length > 0 && (
              <section>
                <div className="eyebrow mb-2 px-1">Received</div>
                <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
                  {incoming.map((u) => {
                    const name = displayName(u);
                    const busy = actionStatus[u.id] === 'accepting';
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={name} online={!!u.isOnline} href={`/profile/${u.id}`} />
                        <Link href={`/profile/${u.id}`} className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-faint num">{u.elo} rating</div>
                        </Link>
                        <button onClick={() => removeFriend(u.id)} aria-label={`Decline ${name}`}
                          className="btn-ghost h-10 w-10 !p-0">
                          <Icon name="x" size={18} />
                        </button>
                        <button onClick={() => acceptRequest(u.id)} disabled={busy} className="btn-primary h-10 py-0 px-4 text-[13px]">
                          {busy ? 'Adding' : 'Accept'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {outgoing.length > 0 && (
              <section>
                <div className="eyebrow mb-2 px-1">Sent</div>
                <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden">
                  {outgoing.map((u) => {
                    const name = displayName(u);
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={name} href={`/profile/${u.id}`} />
                        <Link href={`/profile/${u.id}`} className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-faint num">{u.elo} rating · Pending</div>
                        </Link>
                        <button onClick={() => removeFriend(u.id)} className="btn-ghost h-10 py-0 px-3 text-[13px]">Cancel</button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )
      )}

      {/* Friend leaderboard */}
      {tab === 'leaderboard' && (
        leaderboard.length === 0 ? (
          <Empty title="No ranking yet" body="Add friends to see how you compare." />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="grid grid-cols-[32px_1fr_auto] gap-3 px-4 h-10 items-center border-b border-line/[0.06] eyebrow">
              <span>#</span><span>Player</span><span className="text-right">Rating</span>
            </div>
            <div className="divide-y divide-line/[0.06]">
              {leaderboard.map((p, i) => {
                const name = displayName(p);
                return (
                  <Link key={p.id} href={`/profile/${p.id}`}
                    className={`grid grid-cols-[32px_1fr_auto] gap-3 items-center px-4 py-3 transition-colors ${p.isMe ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
                    <span className={`text-sm font-semibold num ${i === 0 ? 'text-accent' : i < 3 ? 'text-ink' : 'text-faint'}`}>{i + 1}</span>
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="relative shrink-0">
                        <span className="avatar w-9 h-9 text-sm">{name[0]?.toUpperCase()}</span>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ${p.isMe ? 'ring-surface-2' : 'ring-surface'} ${p.isOnline ? 'bg-positive' : 'bg-surface-3'}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{name}</span>
                          {p.isMe && <span className="pill-accent pill !py-0 !px-2 text-[11px]">You</span>}
                        </span>
                        <span className="block text-xs text-faint num">{winRate(p.games_won, p.games_played)} wins</span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold num text-right">{p.elo}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Friend options sheet */}
      {menuFor && (
        <div className="overlay" onClick={closeMenu}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="avatar w-11 h-11 text-base">{displayName(menuFor)[0]?.toUpperCase()}</span>
              <div className="min-w-0">
                <div className="font-semibold truncate">{displayName(menuFor)}</div>
                <div className="text-xs text-faint num">{menuFor.elo} rating · {menuFor.isOnline ? 'Online' : 'Offline'}</div>
              </div>
            </div>
            {confirmRemove ? (
              <>
                <p className="text-sm text-muted mb-4">Remove {displayName(menuFor)} from your friends? You can add them again later.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirmRemove(false)} className="btn-secondary h-12">Keep</button>
                  <button onClick={() => { removeFriend(menuFor.id); closeMenu(); }} className="btn-danger h-12">Remove</button>
                </div>
              </>
            ) : (
              <div className="card p-0 divide-y divide-line/[0.06] overflow-hidden bg-surface-2/40">
                {menuFor.isOnline && (
                  <button onClick={() => { const f = menuFor; closeMenu(); openChallengeModal(f); }}
                    className="w-full h-14 px-4 flex items-center gap-3 text-sm font-medium hover:bg-surface-2 text-left">
                    <Icon name="bolt" size={18} className="text-accent" /> Challenge
                  </button>
                )}
                <Link href={`/profile/${menuFor.id}`} onClick={closeMenu}
                  className="w-full h-14 px-4 flex items-center gap-3 text-sm font-medium hover:bg-surface-2">
                  <Icon name="user" size={18} className="text-muted" /> View profile
                  <Icon name="chevron-right" size={16} className="ml-auto text-faint" />
                </Link>
                <button onClick={() => setConfirmRemove(true)}
                  className="w-full h-14 px-4 flex items-center gap-3 text-sm font-medium text-negative hover:bg-negative/10 text-left">
                  <Icon name="x" size={18} /> Remove friend
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Challenge sheet */}
      {challengeTarget && (
        <div className="overlay" onClick={() => setChallengeTarget(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {challengeStatus !== 'sent' ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">Challenge {challengeTarget.name}</h2>
                    <p className="text-sm text-muted mt-0.5">Winner takes 97.5% of the pot</p>
                  </div>
                  <button onClick={() => setChallengeTarget(null)} aria-label="Close" className="btn-ghost w-10 h-10 !p-0 -mr-2 -mt-1">
                    <Icon name="x" size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-5 mb-2">
                  <span className="eyebrow">Stake</span>
                  <span className="text-xs text-faint num">Balance ${balance.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BET_TIERS.map((tier) => {
                    const active = selectedBet === tier;
                    return (
                      <button key={tier} onClick={() => setSelectedBet(tier)} aria-pressed={active}
                        className={`h-14 rounded-xl border text-base font-semibold num transition-colors ${
                          active ? 'border-accent/60 bg-accent/10 text-ink' : 'border-line/[0.08] bg-surface-2 text-muted hover:text-ink'
                        }`}>
                        ${tier}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-muted">You win</span>
                  <span className="font-semibold num text-positive">${(selectedBet * 2 * 0.975).toFixed(2)}</span>
                </div>

                {challengeError && (
                  <p className="mt-3 text-sm text-negative">{challengeError}</p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button onClick={() => setChallengeTarget(null)} className="btn-secondary h-12">Cancel</button>
                  <button onClick={sendChallenge} disabled={challengeStatus === 'sending'} className="btn-primary h-12">
                    {challengeStatus === 'sending' ? 'Sending…' : <>Send <span className="num">${selectedBet}</span></>}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <span className="mx-auto mb-4 w-12 h-12 rounded-full bg-positive/10 text-positive flex items-center justify-center">
                  <Icon name="check" size={22} />
                </span>
                <p className="text-lg font-semibold">Challenge sent</p>
                <p className="text-sm text-muted mt-1 flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
                  Waiting for {challengeTarget.name} to respond
                </p>
                <button onClick={() => setChallengeTarget(null)} className="btn-secondary h-12 w-full mt-6">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
