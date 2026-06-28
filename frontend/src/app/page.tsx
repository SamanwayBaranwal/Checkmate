'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api } from '@/lib/api';
import LiveGameCard from '@/components/LiveGameCard';
import MatchmakingModal from '@/components/MatchmakingModal';

export default function LobbyPage() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [token, setToken] = useState('');
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [addingBalance, setAddingBalance] = useState(false);
  const [bonusNotice, setBonusNotice] = useState<{ streak: number; amount: number } | null>(null);

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
