'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface IncomingChallenge {
  challengeId: string;
  from: { userId: string; username: string; elo: number };
  betAmount: number;
}

export default function Navbar() {
  const { ready, authenticated, login, logout } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [declinedNotice, setDeclinedNotice] = useState('');

  useEffect(() => {
    if (!authenticated) { setBalance(null); return; }
    api.wallet.balance().then((r) => setBalance(r.balance)).catch(() => {});
  }, [authenticated]);

  // Socket listeners for challenges
  useEffect(() => {
    if (!authenticated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    if (!token) return;

    const socket = getSocket(token);

    const onChallengeReceived = (data: IncomingChallenge) => {
      setIncomingChallenge(data);
    };

    const onMatchFound = (data: { gameId: string }) => {
      // Navigate to game unless already on that game page
      if (!pathname.startsWith('/game/')) {
        router.push(`/game/${data.gameId}`);
      }
    };

    const onChallengeDeclined = () => {
      setDeclinedNotice('Challenge was declined');
      setTimeout(() => setDeclinedNotice(''), 3000);
    };

    socket.on('challenge_received', onChallengeReceived);
    socket.on('match_found', onMatchFound);
    socket.on('challenge_declined', onChallengeDeclined);

    return () => {
      socket.off('challenge_received', onChallengeReceived);
      socket.off('match_found', onMatchFound);
      socket.off('challenge_declined', onChallengeDeclined);
    };
  }, [authenticated, pathname, router]);

  const acceptChallenge = () => {
    if (!incomingChallenge) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('accept_challenge', { challengeId: incomingChallenge.challengeId });
    setIncomingChallenge(null);
  };

  const declineChallenge = () => {
    if (!incomingChallenge) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('checkmate_token') ?? undefined : undefined;
    const socket = getSocket(token);
    socket.emit('decline_challenge', { challengeId: incomingChallenge.challengeId });
    setIncomingChallenge(null);
  };

  return (
    <>
      <nav className="border-b border-white/10 bg-[#0f3460] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-[#ffd700]">
            ♟ Checkmate
          </Link>
          <Link href="/leaderboard" className="text-sm text-white/70 hover:text-white transition-colors">
            Leaderboard
          </Link>
          <Link href="/tournaments" className="text-sm text-white/70 hover:text-white transition-colors">
            Tournaments
          </Link>
          {authenticated && (
            <Link href="/wallet" className="text-sm text-white/70 hover:text-white transition-colors">
              Wallet
            </Link>
          )}
          {authenticated && (
            <Link href="/profile" className="text-sm text-white/70 hover:text-white transition-colors">
              Profile
            </Link>
          )}
          {authenticated && (
            <Link href="/settings" className="text-sm text-white/70 hover:text-white transition-colors">
              Settings
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {authenticated && balance !== null && (
            <span className="text-sm text-[#4caf50] font-semibold">
              ${balance.toFixed(2)} USDC
            </span>
          )}
          {ready && !authenticated && (
            <button onClick={login} className="btn-primary text-sm">
              Connect
            </button>
          )}
          {authenticated && (
            <button onClick={logout} className="btn-secondary text-sm">
              Disconnect
            </button>
          )}
        </div>
      </nav>

      {/* Incoming challenge notification */}
      {incomingChallenge && (
        <div className="fixed bottom-6 right-6 z-[100] card border border-[#ffd700]/40 shadow-2xl w-72">
          <p className="font-bold text-sm mb-1">⚔️ Challenge received!</p>
          <p className="text-sm text-white/70 mb-3">
            <span className="text-white font-semibold">{incomingChallenge.from.username}</span>{' '}
            ({incomingChallenge.from.elo} ELO) challenges you to a{' '}
            <span className="text-[#ffd700] font-semibold">${incomingChallenge.betAmount}</span> game
          </p>
          <div className="flex gap-2">
            <button onClick={acceptChallenge} className="btn-primary flex-1 text-sm py-1.5">Accept</button>
            <button onClick={declineChallenge} className="btn-secondary flex-1 text-sm py-1.5">Decline</button>
          </div>
        </div>
      )}

      {/* Challenge declined notice */}
      {declinedNotice && (
        <div className="fixed bottom-6 right-6 z-[100] card border border-red-500/30 text-red-400 text-sm w-64">
          {declinedNotice}
        </div>
      )}
    </>
  );
}
