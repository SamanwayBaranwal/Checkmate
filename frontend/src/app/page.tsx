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
        <div className="w-8 h-8 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/30 flex items-center justify-center text-sm font-bold text-[#4caf50]">
          {(player.username || player.wallet || '?')[0].toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-sm">{player.username || shortAddr(player.wallet)}</div>
          <div className="text-xs text-white/40">{player.elo} ELO · {wr}% WR</div>
        </div>
      </div>
      <div className="relative">
        {!open ? (
          <button onClick={() => setOpen(true)} className="btn-secondary text-xs py-1 px-3">
            Challenge
          </button>
        ) : (
          <div className="flex items-center gap-1">
            {CHALLENGE_BETS.map((bet) => (
              <button
                key={bet}
                onClick={() => sendChallenge(bet)}
                disabled={sending !== null}
                className="btn-primary text-xs py-1 px-2 min-w-[36px]"
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
  const [addingBalance, setAddingBalance] = useState(false);
  const [bonusNotice, setBonusNotice] = useState<{ streak: number; amount: number } | null>(null);
  const [recentOpponents, setRecentOpponents] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [challengeSentNotice, setChallengeSentNotice] = useState('');

  // Initialize backend session after Privy login
  useEffect(() => {
    if (!authenticated || !user || authInitialized) return;

    const init = async () => {
      try {
        const privyAccessToken = await getAccessToken();
        const wallet = user.wallet?.address || user.linkedAccounts?.find((a: any) => a.type === 'wallet')?.address;

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

        // Load discovery data
        api.users.recentOpponents().then(setRecentOpponents).catch(() => {});
        api.users.suggested().then(setSuggested).catch(() => {});

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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-[#1a1a2e] border border-[#ffd700]/40 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="font-bold text-sm text-[#ffd700]">Daily bonus claimed! +${bonusNotice.amount.toFixed(2)}</p>
            <p className="text-xs text-white/50">Day {bonusNotice.streak} streak — keep it up!</p>
          </div>
          <button onClick={() => setBonusNotice(null)} className="text-white/30 hover:text-white text-lg ml-2">×</button>
        </div>
      )}

      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">
          Play Chess.<br />
          <span className="text-[#ffd700]">Win Real Money.</span>
        </h1>
        <p className="text-white/60 text-lg mb-8">
          Bet USDC, beat your opponent, climb the leaderboard.
        </p>

        {ready && !authenticated && (
          <button onClick={login} className="btn-primary text-lg px-8 py-3">
            Connect to Play
          </button>
        )}

        {authenticated && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4caf50]">${balance.toFixed(2)}</div>
              <div className="text-xs text-white/50">USDC Balance</div>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => setShowMatchmaking(true)}
                disabled={balance === 0}
                className="btn-primary text-lg px-8 py-3"
              >
                Find Match ♟
              </button>
              {/* Dev only — remove before launch */}
              <button
                onClick={async () => {
                  setAddingBalance(true);
                  try {
                    const r = await api.dev.addBalance();
                    setBalance(r.balance);
                  } finally {
                    setAddingBalance(false);
                  }
                }}
                disabled={addingBalance}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {addingBalance ? 'Adding...' : '🪙 Get $100 Test Money'}
              </button>
            </div>
            {balance === 0 && (
              <p className="text-sm text-white/50">Click "Get $100 Test Money" to start playing</p>
            )}
          </div>
        )}
      </div>

      {/* Live Games */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Live Games</h2>
          <span className="text-sm text-white/40">{activeGames.length} active</span>
        </div>

        {activeGames.length === 0 ? (
          <div className="card text-center py-12 text-white/40">
            <div className="text-4xl mb-3">♟</div>
            <p>No live games right now. Be the first to play!</p>
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
              <div className="px-4 py-3 border-b border-white/10">
                <h2 className="font-bold text-sm">Play Again</h2>
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
              <div className="px-4 py-3 border-b border-white/10">
                <h2 className="font-bold text-sm">Suggested Opponents</h2>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1a1a2e] border border-[#4caf50]/40 rounded-xl px-5 py-3 text-sm text-[#4caf50] shadow-2xl">
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
