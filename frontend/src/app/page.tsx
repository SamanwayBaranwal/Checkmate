'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import LiveGameCard from '@/components/LiveGameCard';
import MatchmakingModal from '@/components/MatchmakingModal';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';

const CHALLENGE_BETS = [1, 5, 10, 25];

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '???';
}

function PlayerCard({ player, token, onChallengeSent }: { player: any; token: string; onChallengeSent: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  const sendChallenge = (betAmount: number) => {
    setSending(betAmount);
    const socket = getSocket(token);
    socket.emit('challenge_user', { targetId: player.id, betAmount });
    setTimeout(() => {
      setSending(null);
      setOpen(false);
      onChallengeSent(player.username || shortAddr(player.wallet));
    }, 500);
  };

  const wr = player.games_played ? Math.round((player.games_won / player.games_played) * 100) : 0;

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-lg transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#46a883]/20 border border-[#46a883]/30 flex items-center justify-center text-sm font-bold text-[#46a883]">
          {(player.username || player.wallet || '?')[0].toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-sm">{player.username || shortAddr(player.wallet)}</div>
          <div className="text-xs text-white/40">{player.elo} ELO · {wr}% WR</div>
        </div>
      </div>
      <div className="relative">
        {!open ? (
          <button onClick={() => setOpen(true)} className="btn-secondary text-xs py-1 px-3 shrink-0">
            Challenge
          </button>
        ) : (
          <div className="flex items-center gap-1 flex-wrap justify-end max-w-[160px] sm:max-w-none">
            {CHALLENGE_BETS.map((bet) => (
              <button
                key={bet}
                onClick={() => sendChallenge(bet)}
                disabled={sending !== null}
                className="btn-primary text-xs py-1 px-2 min-w-[34px]"
              >
                {sending === bet ? '…' : `$${bet}`}
              </button>
            ))}
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white px-1 text-sm">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [token, setToken] = useState('');
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [bonusNotice, setBonusNotice] = useState<{ streak: number; amount: number } | null>(null);
  const [recentOpponents, setRecentOpponents] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [challengeSentNotice, setChallengeSentNotice] = useState('');
  const [me, setMe] = useState<any>(null);
  const [rank, setRank] = useState<number | null>(null);

  // Initialize backend session after Privy login
  useEffect(() => {
    if (!authenticated || !user || authInitialized) return;

    const init = async () => {
      try {
        const privyAccessToken = await getAccessToken();
        const wallet = user.wallet?.address || (user.linkedAccounts?.find((a: any) => a.type === 'wallet') as any)?.address;

        if (!wallet) return;

        // Pick up referral code from URL or localStorage
        const urlRef = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('ref') ?? undefined
          : undefined;
        if (urlRef && typeof window !== 'undefined') localStorage.setItem('checkmate_ref', urlRef);
        const storedRef = typeof window !== 'undefined' ? localStorage.getItem('checkmate_ref') ?? undefined : undefined;
        const referralCode = urlRef || storedRef;

        const { token: sessionToken, user: userData } = await api.auth.verify(user.id, wallet, referralCode);
        if (referralCode && typeof window !== 'undefined') localStorage.removeItem('checkmate_ref');
        localStorage.setItem('checkmate_token', sessionToken);
        setToken(sessionToken);
        setBalance(userData.usdcBalance || 0);
        setAuthInitialized(true);

        // Load discovery data + my stats
        api.users.recentOpponents().then(setRecentOpponents).catch(() => {});
        api.users.suggested().then(setSuggested).catch(() => {});
        api.users.me().then(setMe).catch(() => {});
        api.users.leaderboard('elo').then((rows: any[]) => {
          const idx = rows.findIndex((r) => r.id === userData.id);
          if (idx >= 0) setRank(idx + 1);
        }).catch(() => {});

        // Claim daily bonus after auth
        try {
          const bonus = await api.users.dailyBonus();
          if (bonus.credited && bonus.amount && bonus.streak) {
            setBalance((prev) => prev + bonus.amount!);
            setBonusNotice({ streak: bonus.streak!, amount: bonus.amount! });
            setTimeout(() => setBonusNotice(null), 6000);
          }
        } catch {}
      } catch (err) {
        console.error('Auth init failed:', err);
      }
    };

    init();
  }, [authenticated, user, authInitialized, getAccessToken]);

  // Reload balance periodically
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      api.wallet.balance().then((r) => setBalance(r.balance)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // Load live games
  const loadGames = useCallback(async () => {
    try {
      const games = await api.games.active();
      setActiveGames(games);
    } catch {}
  }, []);

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 5000);
    return () => clearInterval(interval);
  }, [loadGames]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Daily bonus toast */}
      {bonusNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-[#262421] border border-[#f0b232]/40 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="font-bold text-sm text-[#f0b232]">Daily bonus claimed! +${bonusNotice.amount.toFixed(2)}</p>
            <p className="text-xs text-white/50">Day {bonusNotice.streak} streak — keep it up!</p>
          </div>
          <button onClick={() => setBonusNotice(null)} className="text-white/30 hover:text-white text-lg ml-2">×</button>
        </div>
      )}

      {/* Welcome header (signed-in) */}
      {authenticated && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              Welcome back{me?.username ? `, ${me.username}` : ''} <span className="inline-block">👋</span>
            </h2>
            <p className="text-sm text-white/45 mt-0.5">Ready to play and climb the ranks?</p>
          </div>
          <Link href="/wallet" className="pill pill-green shrink-0">
            ${balance.toFixed(2)}
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] mb-8">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'conic-gradient(#fff 90deg, transparent 90deg 180deg, #fff 180deg 270deg, transparent 270deg)',
            backgroundSize: '52px 52px',
          }}
        />
        <div
          className="absolute -bottom-32 -right-10 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(87,176,106,0.14) 0%, transparent 68%)' }}
        />

        <div className="relative px-6 sm:px-10 py-10 sm:py-14 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="pill pill-green mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#46a883] animate-pulse-dot" />
              {activeGames.length} live {activeGames.length === 1 ? 'game' : 'games'} now
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.02] mb-3">
              EVERY MOVE.<br />
              EVERY <span className="text-[#46a883]">RISE.</span>
            </h1>
            <p className="text-white/50 text-sm sm:text-base font-semibold tracking-wide mb-8">
              PLAY. IMPROVE. EARN.
            </p>

            {ready && !authenticated && (
              <button onClick={login} className="btn-primary text-base px-8 py-3.5">
                Get started — it&apos;s free
              </button>
            )}

            {authenticated && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  onClick={() => setShowMatchmaking(true)}
                  disabled={balance === 0}
                  className="btn-primary text-base px-8 py-3.5 flex items-center justify-center gap-2"
                >
                  ▶ Play Now
                </button>
                {balance === 0 && (
                  <Link href="/wallet" className="btn-gold text-sm px-4 py-2.5">
                    Claim free credits
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Mascot */}
          <div className="hidden sm:block shrink-0 relative">
            <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(87,176,106,0.22) 0%, transparent 70%)' }} />
            <img
              src="/brand/el-victory.png"
              alt="ELO mascot"
              className="relative w-40 lg:w-52 rounded-2xl select-none pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Stat row (signed-in) */}
      {authenticated && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {(() => {
            const gp = me?.gamesPlayed ?? me?.games_played ?? 0;
            const gw = me?.gamesWon ?? me?.games_won ?? 0;
            const wr = gp ? Math.round((gw / gp) * 100) : 0;
            const stats = [
              { label: 'ELO Rating', value: me?.elo ?? '—', icon: '♟', accent: true },
              { label: 'Games Played', value: gp, icon: '🎮' },
              { label: 'Win Rate', value: `${wr}%`, icon: '📈' },
              { label: 'Global Rank', value: rank ? `#${rank}` : '—', icon: '🏆' },
            ];
            return stats.map((s, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/40">{s.label}</span>
                  <span className="text-sm opacity-60">{s.icon}</span>
                </div>
                <div className={`text-2xl font-bold font-display ${s.accent ? 'text-[#46a883]' : 'text-white'}`}>{s.value}</div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Live Games */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
            <h2 className="text-lg font-bold">Live Games</h2>
          </div>
          <span className="pill">{activeGames.length} active</span>
        </div>

        {activeGames.length === 0 ? (
          <div className="card text-center py-14 text-white/40">
            <div className="text-5xl mb-3 opacity-60">♟</div>
            <p className="font-medium">No live games right now</p>
            <p className="text-sm text-white/30 mt-1">Be the first to play!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeGames.map((game) => (
              <LiveGameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>

      {/* Discovery: Recent + Suggested */}
      {authenticated && token && (recentOpponents.length > 0 || suggested.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {recentOpponents.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.07]">
                <h2 className="eyebrow">Play Again</h2>
              </div>
              <div className="py-1">
                {recentOpponents.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    token={token}
                    onChallengeSent={(name) => {
                      setChallengeSentNotice(`Challenge sent to ${name}!`);
                      setTimeout(() => setChallengeSentNotice(''), 3000);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {suggested.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.07]">
                <h2 className="eyebrow">Suggested Opponents</h2>
              </div>
              <div className="py-1">
                {suggested.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    token={token}
                    onChallengeSent={(name) => {
                      setChallengeSentNotice(`Challenge sent to ${name}!`);
                      setTimeout(() => setChallengeSentNotice(''), 3000);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {challengeSentNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#262421] border border-[#46a883]/40 rounded-xl px-5 py-3 text-sm text-[#46a883] shadow-2xl">
          ⚔️ {challengeSentNotice}
        </div>
      )}

      {showMatchmaking && token && (
        <MatchmakingModal
          onClose={() => setShowMatchmaking(false)}
          balance={balance}
          token={token}
        />
      )}
    </div>
  );
}
